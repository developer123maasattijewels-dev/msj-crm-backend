const mongoose = require("mongoose");
const Checklists = require("../models/cheacklist");
const Tasks = require("../models/taskmodel");
const Users = require("../models/usermodel");
const ChecklistResponseNotification = require("../models/checklistResponseNotification");
const { notifyChecklistEvent } = require("../comman/notificationService");
const XLSX = require("xlsx");

const checklistFields = [
    "taskName",
    "message",
    "assignedTo",
    "frequency",
    "weeklyDays",
    "monthlyDay",
    "customIntervalDays",
    "plannedDate",
    "remindBeforeDays",
    "mode",
    "priority",
    "setReminder",
    "reminderMode",
    "reminderFrequency",
    "setReminderBeforeDays",
    "notifyMe",
    "notifyOnCompletionUsers",
    "notifyPCTeamUsersWhenDue",
    "notifyPCTeamWhenDue",
    "auditor",
    "groupName",
    "makeAttachmentMandatoryWhenWorkDone",
    "assignPC",
    "reminderStartingTime",
    "checklistAutoClose",
    "checklistAutoCloseDays",
    "makeNoteMandatoryWhenWorkDone",
    "assignedBy",
    "skipChecklistOnHolidays",
    "isComplianceTask",
    "selectNotifyDoerWhenTaskDone"
];

const pickChecklistFields = body => checklistFields.reduce((fields, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields[key] = body[key];
    }
    return fields;
}, {});

const validateChecklist = async (fields, creating = false) => {
    if (creating && !fields.assignedTo) return "A valid assignee is required.";
    if (fields.taskName !== undefined && (typeof fields.taskName !== "string" || !fields.taskName.trim())) {
        return creating ? "Task name is required." : "Task name cannot be empty.";
    }
    if (fields.message !== undefined && typeof fields.message !== "string") return "Message must be text.";
    if (fields.assignedTo !== undefined && (!fields.assignedTo || !mongoose.isValidObjectId(fields.assignedTo))) {
        return "A valid assignee is required.";
    }

    const people = ["assignedTo", "auditor", "assignPC"];
    const lists = ["notifyOnCompletionUsers", "notifyPCTeamUsersWhenDue"];
    if (people.some(key => fields[key] && !mongoose.isValidObjectId(fields[key])) ||
        lists.some(key => fields[key] !== undefined &&
            (!Array.isArray(fields[key]) || fields[key].some(id => !mongoose.isValidObjectId(id))))) {
        return "Assignee, auditor, and PC must be valid team members.";
    }
    if (fields.assignPC && !await Users.exists({ _id: fields.assignPC, department: /^pc$/i })) {
        return "Assign PC must be a member of the PC department.";
    }
    if (fields.notifyPCTeamUsersWhenDue?.length) {
        const ids = [...new Set(fields.notifyPCTeamUsersWhenDue.map(String))];
        const count = await Users.countDocuments({ _id: { $in: ids }, department: /^pc$/i });
        if (count !== ids.length) return "Overdue notification recipients must be members of the PC department.";
    }

    const { frequency } = fields;
    if (frequency === undefined || frequency === "One Time") return null;
    if (!["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Custom"].includes(frequency)) {
        return "Choose a supported checklist frequency.";
    }
    if (!fields.plannedDate || Number.isNaN(new Date(fields.plannedDate).getTime())) {
        return "A planned start date is required for recurring checklists.";
    }
    if (fields.reminderStartingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.reminderStartingTime)) {
        return "Choose a valid checklist task time.";
    }
    if (frequency === "Weekly" && (!Array.isArray(fields.weeklyDays) || !fields.weeklyDays.length ||
        fields.weeklyDays.some(day => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6))) {
        return "Select at least one valid weekday for a weekly checklist.";
    }
    if (frequency === "Monthly" &&
        (!Number.isInteger(Number(fields.monthlyDay)) || Number(fields.monthlyDay) < 1 || Number(fields.monthlyDay) > 31)) {
        return "Choose a valid day of the month (1-31).";
    }
    if (frequency === "Custom" &&
        (!Number.isInteger(Number(fields.customIntervalDays)) || Number(fields.customIntervalDays) < 1 || Number(fields.customIntervalDays) > 365)) {
        return "Custom recurrence must be between 1 and 365 days.";
    }
    return null;
};

const populatePeople = query => query
    .populate("assignedTo", "name email department designation role")
    .populate("auditor", "name email department designation role")
    .populate("assignPC", "name email department designation role")
    .populate("notifyOnCompletionUsers", "name email department designation role")
    .populate("notifyPCTeamUsersWhenDue", "name email department designation role");

const addChecklist = async (req, res) => {
    try {
        const validationError = await validateChecklist(req.body, true);
        if (validationError) return res.status(400).json({ success: false, message: validationError });

        const { taskName, message } = req.body;
        const checklist = await Checklists.create({
            ...pickChecklistFields(req.body),
            taskName: taskName.trim(),
            message: typeof message === "string" ? message.trim() : ""
        });
        const data = await populatePeople(Checklists.findById(checklist._id));
        const notificationStatus = await notifyChecklistEvent({
            checklist: data,
            eventType: "created",
            senderUserId: req.body.senderUserId
        });
        return res.status(201).json({ success: true, data, notificationStatus });
    } catch (error) {
        console.error("Error creating checklist:", error);
        const status = error.name === "ValidationError" || error.name === "CastError" ? 400 : 500;
        return res.status(status).json({ success: false, message: error.message || "Unable to create checklist." });
    }
};

const getChecklists = async (_req, res) => {
    try {
        const checklists = await populatePeople(Checklists.find({}).sort({ createdAt: -1 }));
        return res.status(200).json({ success: true, data: checklists });
    } catch (error) {
        console.error("Error fetching checklists:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to fetch checklists." });
    }
};

const getChecklistById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid checklist ID." });
        }
        const checklist = await populatePeople(Checklists.findById(req.params.id));
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        return res.status(200).json({ success: true, data: checklist });
    } catch (error) {
        console.error("Error fetching checklist:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to fetch checklist." });
    }
};

const submitChecklistResponse = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid checklist ID." });
        }
        const response = typeof req.body.response === "string" ? req.body.response.trim() : "";
        const details = typeof req.body.details === "string" ? req.body.details.trim() : "";
        const attachmentNote = typeof req.body.attachmentNote === "string" ? req.body.attachmentNote.trim() : "";
        const rawStatus = typeof req.body.status === "string" ? req.body.status.trim() : "";
        const allowedStatuses = ["Pending", "Not started", "In Progress", "Completed", "Overdue", "Cancelled"];
        const normalizedStatus = rawStatus === "Not started" ? "Pending" : rawStatus;
        if (!response) {
            return res.status(400).json({ success: false, message: "Response cannot be empty." });
        }
        if (response.length > 2000) {
            return res.status(400).json({ success: false, message: "Response cannot exceed 2,000 characters." });
        }
        if (details.length > 4000) {
            return res.status(400).json({ success: false, message: "Response details cannot exceed 4,000 characters." });
        }
        if (rawStatus && !allowedStatuses.includes(rawStatus)) {
            return res.status(400).json({ success: false, message: "Invalid checklist status." });
        }
        const pcRecipientsInput = Array.isArray(req.body.pcRecipients) ? req.body.pcRecipients : [];
        const notifyRecipientsInput = Array.isArray(req.body.notifyRecipients) ? req.body.notifyRecipients : [];
        if (pcRecipientsInput.some(id => !mongoose.isValidObjectId(id)) ||
            notifyRecipientsInput.some(id => !mongoose.isValidObjectId(id))) {
            return res.status(400).json({ success: false, message: "Recipients must be a list of valid team member IDs." });
        }

        const checklist = await Checklists.findById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        if (checklist.makeNoteMandatoryWhenWorkDone && !details) {
            return res.status(400).json({ success: false, message: "Completion note / additional details is mandatory for this checklist." });
        }
        if (checklist.makeAttachmentMandatoryWhenWorkDone && !attachmentNote) {
            return res.status(400).json({ success: false, message: "Attachment / proof reference is mandatory for this checklist." });
        }
        const assignedByName = String(checklist.assignedBy || "").split("·")[0].trim();
        const assignedByPattern = assignedByName
            ? new RegExp(`^${assignedByName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
            : null;
        const selectedPCIds = [...new Set(pcRecipientsInput.map(String))];
        const selectedNotifyIds = [...new Set(notifyRecipientsInput.map(String))];
        const [selectedPCMembers, selectedNotifyMembers, assignedPeople, assigningPeople] = await Promise.all([
            selectedPCIds.length
                ? Users.find({ _id: { $in: selectedPCIds }, department: /^pc$/i }).select("_id name email department emailNotificationsEnabled")
                : Promise.resolve([]),
            selectedNotifyIds.length
                ? Users.find({ _id: { $in: selectedNotifyIds } }).select("_id name email department emailNotificationsEnabled")
                : Promise.resolve([]),
            Users.find({
                _id: { $in: [checklist.assignedTo, checklist.assignPC, checklist.auditor].filter(Boolean) }
            }).select("_id name email department emailNotificationsEnabled"),
            assignedByPattern
                ? Users.find({ name: assignedByPattern }).select("_id name email department emailNotificationsEnabled")
                : Promise.resolve([])
        ]);
        if (selectedPCMembers.length !== selectedPCIds.length) {
            return res.status(400).json({ success: false, message: "One or more selected recipients are not PC team members." });
        }
        const recipientsById = new Map();
        [...selectedPCMembers, ...selectedNotifyMembers, ...assignedPeople, ...assigningPeople].forEach(user => {
            recipientsById.set(String(user._id), user);
        });
        const recipients = [...recipientsById.values()];
        const submittedResponse = {
            response,
            details,
            status: normalizedStatus || checklist.status || "Pending",
            attachmentNote,
            submittedBy: typeof req.body.submittedBy === "string" ? req.body.submittedBy.trim() : "",
            sentTo: recipients.map(user => ({
                userId: user._id,
                name: user.name,
                department: user.department
            }))
        };
        checklist.responses.push(submittedResponse);
        if (normalizedStatus) {
            checklist.status = normalizedStatus;
        }
        await checklist.save();

        if (normalizedStatus) {
            const latestTask = await Tasks.findOne({ checklistId: checklist._id }).sort({ dueAt: -1, dueDate: -1, createdAt: -1 });
            if (latestTask) {
                latestTask.status = normalizedStatus;
                if (normalizedStatus === "Completed") {
                    latestTask.submittedAt = new Date();
                    latestTask.submission = {
                        summary: response,
                        notes: details,
                        evidenceUrl: attachmentNote
                    };
                }
                await latestTask.save();
            }
        }

        const savedResponse = checklist.responses[checklist.responses.length - 1];
        const notificationResults = await Promise.allSettled(recipients.map(recipient =>
            ChecklistResponseNotification.create({
                recipient: recipient._id,
                checklistId: checklist._id,
                responseId: savedResponse._id,
                title: "Checklist response submitted",
                message: `${savedResponse.submittedBy || "A team member"} submitted a response for "${checklist.taskName}". Response: ${response}${details ? ` Details: ${details}` : ""}`
            })
        ));
        const failedNotifications = notificationResults.filter(result => result.status === "rejected");
        failedNotifications.forEach(result => {
            console.error("Checklist response notification error:", result.reason);
        });

        const emailNotification = await notifyChecklistEvent({
            checklist,
            eventType: "response",
            responseEntry: savedResponse,
            customRecipients: recipients,
            createInApp: false,
            senderUserId: req.body.senderUserId
        });

        return res.status(201).json({
            success: true,
            message: "Checklist response submitted.",
            data: savedResponse,
            notificationStatus: {
                recipients: recipients.length,
                sent: notificationResults.length - failedNotifications.length,
                failed: failedNotifications.length,
                email: emailNotification?.email || null
            }
        });
    } catch (error) {
        console.error("Error submitting checklist response:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to submit response." });
    }
};


const cleanWhitespace = value =>
    String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

const normalizeHeader = value =>
    cleanWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const extractEmail = value => {
    const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
};

const stripPersonSuffix = value =>
    cleanWhitespace(value)
        .replace(/Â·/g, "·")
        .split(/[·•|—–]/)[0]
        .replace(/\([^)]*\)/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();

const resolveUserFromList = (rawValue, users, { preferDepartment = null } = {}) => {
    const cleaned = cleanWhitespace(rawValue);
    if (!cleaned || /^(unassigned|none|na|n\/a|-)$/i.test(cleaned)) {
        return { empty: true, user: null };
    }

    const pickBest = matches => {
        if (!matches.length) return null;
        if (preferDepartment && matches.length > 1) {
            const preferred = matches.find(u => preferDepartment.test(String(u.department || "").trim()));
            if (preferred) return preferred;
        }
        return matches[0];
    };

    if (mongoose.isValidObjectId(cleaned)) {
        const byId = users.find(u => String(u._id) === cleaned);
        if (byId) return { empty: false, user: byId };
    }

    const email = extractEmail(cleaned);
    if (email) {
        const byEmail = users.filter(u => String(u.email || "").trim().toLowerCase() === email);
        if (byEmail.length) return { empty: false, user: pickBest(byEmail) };
    }

    const lowerCleaned = cleaned.toLowerCase();
    const exactNameMatches = users.filter(u => cleanWhitespace(u.name).toLowerCase() === lowerCleaned);
    if (exactNameMatches.length) return { empty: false, user: pickBest(exactNameMatches) };

    const stripped = stripPersonSuffix(cleaned).toLowerCase();
    if (stripped) {
        const strippedMatches = users.filter(u => stripPersonSuffix(u.name).toLowerCase() === stripped);
        if (strippedMatches.length) return { empty: false, user: pickBest(strippedMatches) };
    }

    return { empty: false, user: null };
};

const resolveUserListFromCell = (rawValue, users, options = {}) => {
    const cleaned = cleanWhitespace(rawValue);
    if (!cleaned) return { ids: [], invalid: [] };
    const tokens = String(rawValue)
        .split(/[\r\n,;|]+/)
        .map(cleanWhitespace)
        .filter(Boolean);
    const ids = [];
    const seen = new Set();
    const invalid = [];

    for (const token of tokens) {
        const result = resolveUserFromList(token, users, options);
        if (result.empty) continue;
        if (!result.user) {
            invalid.push(token);
            continue;
        }
        const idStr = String(result.user._id);
        if (!seen.has(idStr)) {
            seen.add(idStr);
            ids.push(result.user._id);
        }
    }
    return { ids, invalid };
};

const parseBooleanCell = (value, defaultValue = false) => {
    if (typeof value === "boolean") return { valid: true, value, provided: true };
    if (typeof value === "number") return { valid: true, value: value !== 0, provided: true };
    const cleaned = cleanWhitespace(value).toLowerCase();
    if (!cleaned) return { valid: true, value: defaultValue, provided: false };
    if (["yes", "y", "true", "1", "on", "enabled", "active"].includes(cleaned)) {
        return { valid: true, value: true, provided: true };
    }
    if (["no", "n", "false", "0", "off", "disabled", "inactive"].includes(cleaned)) {
        return { valid: true, value: false, provided: true };
    }
    return { valid: false, value: defaultValue, provided: true };
};

const makeValidUtcDate = (year, month, day) => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
};

const parsePlannedDateCell = rawDate => {
    if (rawDate === "" || rawDate === null || rawDate === undefined) {
        return { valid: true, value: null };
    }
    if (rawDate instanceof Date) {
        if (Number.isNaN(rawDate.getTime())) return { valid: false, value: null };
        return {
            valid: true,
            value: makeValidUtcDate(rawDate.getFullYear(), rawDate.getMonth() + 1, rawDate.getDate())
        };
    }
    if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
        const parsed = XLSX.SSF.parse_date_code(rawDate);
        const date = parsed ? makeValidUtcDate(parsed.y, parsed.m, parsed.d) : null;
        return date ? { valid: true, value: date } : { valid: false, value: null };
    }

    const str = cleanWhitespace(rawDate);
    if (!str) return { valid: true, value: null };

    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
    if (isoMatch) {
        const date = makeValidUtcDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
        return date ? { valid: true, value: date } : { valid: false, value: null };
    }

    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
        const first = Number(dmyMatch[1]);
        const second = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        const date = second > 12 && first <= 12
            ? makeValidUtcDate(year, first, second)
            : makeValidUtcDate(year, second, first);
        return date ? { valid: true, value: date } : { valid: false, value: null };
    }

    const fallback = new Date(str);
    if (!Number.isNaN(fallback.getTime())) {
        const date = makeValidUtcDate(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
        if (date) return { valid: true, value: date };
    }
    return { valid: false, value: null };
};

const parseTimeCell = (rawTime, defaultTime = "09:00") => {
    if (rawTime === "" || rawTime === null || rawTime === undefined) {
        return { valid: true, value: defaultTime, provided: false };
    }
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
        const frac = ((rawTime % 1) + 1) % 1;
        let totalMinutes = Math.round(frac * 24 * 60);
        if (totalMinutes >= 24 * 60) totalMinutes = 0;
        const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
        const mm = String(totalMinutes % 60).padStart(2, "0");
        return { valid: true, value: `${hh}:${mm}`, provided: true };
    }
    if (rawTime instanceof Date && !Number.isNaN(rawTime.getTime())) {
        const hh = String(rawTime.getHours()).padStart(2, "0");
        const mm = String(rawTime.getMinutes()).padStart(2, "0");
        return { valid: true, value: `${hh}:${mm}`, provided: true };
    }

    const str = cleanWhitespace(rawTime);
    if (!str) return { valid: true, value: defaultTime, provided: false };

    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (!match) return { valid: false, value: "", provided: true };

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const ampm = match[3] ? match[3].toLowerCase() : "";

    if (ampm) {
        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            return { valid: false, value: "", provided: true };
        }
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
    } else if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { valid: false, value: "", provided: true };
    }

    return {
        valid: true,
        value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        provided: true
    };
};

const importChecklistsExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an Excel or CSV file."
            });
        }

        const isCsv = /\.csv$/i.test(req.file.originalname || "") || req.file.mimetype === "text/csv";
        const workbook = isCsv
            ? XLSX.read(req.file.buffer.toString("utf8").replace(/^\uFEFF/, ""), {
                type: "string",
                cellDates: false,
                raw: true
            })
            : XLSX.read(req.file.buffer, {
                type: "buffer",
                cellDates: false,
                raw: false
            });

        const taskHeaderAliases = ["taskname", "taskchecklistname", "checklistname", "name", "title", "task"];
        const companionAliases = ["assignedto", "assignedtoemailorname", "assignee", "frequency", "priority", "planneddate", "status"];

        const findHeaderRowIndex = grid => {
            const limit = Math.min(grid.length, 15);
            for (let i = 0; i < limit; i++) {
                const normalizedCells = (grid[i] || []).map(normalizeHeader).filter(Boolean);
                const hasTaskHeader = normalizedCells.some(cell => taskHeaderAliases.includes(cell));
                const hasCompanion = normalizedCells.some(cell => companionAliases.includes(cell));
                if (hasTaskHeader && hasCompanion) return i;
            }
            for (let i = 0; i < limit; i++) {
                const normalizedCells = (grid[i] || []).map(normalizeHeader).filter(Boolean);
                if (normalizedCells.some(cell => taskHeaderAliases.includes(cell))) return i;
            }
            return -1;
        };

        let targetGrid = [];
        let headerIndex = -1;
        const preferredSheets = workbook.SheetNames.filter(
            name => !/^(instructions?|guide|team\s*members?|users|responses?\s*log)$/i.test(String(name).trim())
        );
        const orderedSheetNames = [
            ...preferredSheets,
            ...workbook.SheetNames.filter(name => !preferredSheets.includes(name))
        ];

        for (const sheetName of orderedSheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;
            const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            const foundIdx = findHeaderRowIndex(grid);
            if (foundIdx !== -1) {
                targetGrid = grid;
                headerIndex = foundIdx;
                break;
            }
            if (!targetGrid.length && grid.length) {
                targetGrid = grid;
                headerIndex = 0;
            }
        }

        if (!targetGrid.length || headerIndex === -1 || headerIndex >= targetGrid.length - 1) {
            return res.status(400).json({
                success: false,
                message: "Excel file is empty or missing checklist columns (Task Name, Assigned To)."
            });
        }

        const headers = (targetGrid[headerIndex] || []).map(h => cleanWhitespace(h));
        const rawRows = [];
        for (let r = headerIndex + 1; r < targetGrid.length; r++) {
            const cells = targetGrid[r] || [];
            if (cells.every(cell => !cleanWhitespace(cell))) continue;

            const rowObj = {};
            headers.forEach((header, colIdx) => {
                if (header) {
                    rowObj[header] = cells[colIdx] !== undefined ? cells[colIdx] : "";
                }
            });
            rawRows.push({ rowNumber: r + 1, row: rowObj });
        }

        if (!rawRows.length) {
            return res.status(400).json({
                success: false,
                message: "No checklist rows found in the uploaded file."
            });
        }

        if (rawRows.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Maximum 1000 rows allowed."
            });
        }

        const getValue = (row, aliases) => {
            const key = Object.keys(row).find(col => aliases.includes(normalizeHeader(col)));
            return key !== undefined ? row[key] : "";
        };

        const frequencyMap = {
            onetime: "One Time",
            once: "One Time",
            daily: "Daily",
            weekly: "Weekly",
            monthly: "Monthly",
            quarterly: "Quarterly",
            yearly: "Yearly",
            annual: "Yearly",
            annually: "Yearly",
            custom: "Custom"
        };

        const priorityMap = {
            low: "Low",
            medium: "Medium",
            med: "Medium",
            normal: "Medium",
            high: "High",
            urgent: "Urgent",
            critical: "Urgent"
        };

        const statusMap = {
            pending: "Pending",
            notstarted: "Pending",
            open: "Pending",
            inprogress: "In Progress",
            progress: "In Progress",
            working: "In Progress",
            completed: "Completed",
            complete: "Completed",
            done: "Completed",
            overdue: "Overdue",
            late: "Overdue",
            cancelled: "Cancelled",
            canceled: "Cancelled"
        };

        const reminderModeMap = {
            beforeduedate: "Before due date",
            before: "Before due date",
            onduedate: "On due date",
            ondue: "On due date",
            afterduedate: "After due date",
            after: "After due date"
        };

        const reminderFrequencyMap = {
            once: "Once",
            onetime: "Once",
            daily: "Daily",
            weekly: "Weekly"
        };

        const dayMap = {
            "0": 0, sun: 0, sunday: 0,
            "1": 1, mon: 1, monday: 1,
            "2": 2, tue: 2, tues: 2, tuesday: 2,
            "3": 3, wed: 3, wednesday: 3,
            "4": 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
            "5": 5, fri: 5, friday: 5,
            "6": 6, sat: 6, saturday: 6
        };

        const users = await Users.find({}).select("_id name email department designation role");
        const fallbackAssignedBy = cleanWhitespace(req.body?.assignedBy || "");

        const imported = [];
        const invalidRows = [];
        let processedCount = 0;

        for (const { rowNumber, row } of rawRows) {
            const taskName = cleanWhitespace(
                getValue(row, ["taskname", "taskchecklistname", "checklistname", "name", "title", "task"])
            );
            const rawAssignee = getValue(row, [
                "assignedto",
                "assignedtoemailorname",
                "assignee",
                "assignedemail",
                "assigneeemail",
                "doer"
            ]);
            const assigneeClean = cleanWhitespace(rawAssignee);

            // Stop cleanly if an exported CSV contains the trailing "Responses Log" header section
            if (taskName.toLowerCase() === "checklist task" && assigneeClean.toLowerCase() === "submitted by") {
                break;
            }

            processedCount += 1;

            const rawFrequency = cleanWhitespace(getValue(row, ["frequency", "repeat"]));
            const frequencyKey = normalizeHeader(rawFrequency);
            const frequency = !rawFrequency ? "One Time" : (frequencyMap[frequencyKey] || "");

            const rawPriority = cleanWhitespace(getValue(row, ["priority"]));
            const priorityKey = normalizeHeader(rawPriority);
            const priority = !rawPriority ? "Medium" : (priorityMap[priorityKey] || "");

            const rawStatus = cleanWhitespace(getValue(row, ["status", "taskstatus"]));
            const statusKey = normalizeHeader(rawStatus);
            const status = !rawStatus ? "Pending" : (statusMap[statusKey] || "");

            const message = String(
                getValue(row, ["message", "messageinstructions", "instructions", "description", "notes"]) ?? ""
            ).trim();
            const groupName = cleanWhitespace(getValue(row, ["groupname", "group", "category"]));
            const assignedBy = cleanWhitespace(getValue(row, ["assignedby", "createdby"])) || fallbackAssignedBy;
            const mode = cleanWhitespace(getValue(row, ["mode"])) || "Manual";

            // Resolve people
            const assigneeMatch = resolveUserFromList(rawAssignee, users);
            const assignPCMatch = resolveUserFromList(
                getValue(row, ["assignpc", "assignpcincharge", "pc", "pcname", "pcincharge"]),
                users,
                { preferDepartment: /^pc$/i }
            );
            const auditorMatch = resolveUserFromList(
                getValue(row, ["auditor", "reviewer"]),
                users
            );

            // Planned date
            const rawDateValue = getValue(row, [
                "planneddate",
                "planneddateyyyymmdd",
                "startdate",
                "duedate",
                "date"
            ]);
            const parsedDate = parsePlannedDateCell(rawDateValue);
            const plannedDate = parsedDate.value;

            // Weekly days
            const rawWeeklyDays = cleanWhitespace(getValue(row, ["weeklydays", "repeaton", "weekdays"]));
            let weeklyDays = [];
            let invalidWeeklyToken = "";
            if (rawWeeklyDays) {
                const seenDays = new Set();
                for (const token of rawWeeklyDays.split(/[\s,;|/]+/).filter(Boolean)) {
                    const mappedDay = dayMap[token.toLowerCase()];
                    if (mappedDay === undefined) {
                        invalidWeeklyToken = token;
                        break;
                    }
                    if (!seenDays.has(mappedDay)) {
                        seenDays.add(mappedDay);
                        weeklyDays.push(mappedDay);
                    }
                }
            } else if (frequency === "Weekly" && parsedDate.valid && plannedDate) {
                // Fall back to the Planned Date's weekday when Weekly Days is omitted
                weeklyDays = [plannedDate.getUTCDay()];
            }

            // Monthly and custom values
            const rawMonthlyDay = cleanWhitespace(getValue(row, ["monthlyday", "dayofmonth"]));
            const parsedMonthlyDay = rawMonthlyDay
                ? Number.parseInt(rawMonthlyDay, 10)
                : (frequency === "Monthly" && parsedDate.valid && plannedDate ? plannedDate.getUTCDate() : 0);

            const rawCustomInterval = cleanWhitespace(getValue(row, ["customintervaldays", "repeateverydays", "intervaldays"]));
            const customIntervalDays = rawCustomInterval ? Number.parseInt(rawCustomInterval, 10) : 0;

            // Reminder & notification settings
            const rawReminderDays = cleanWhitespace(
                getValue(row, ["reminderdaysbefore", "setreminderbeforedays", "remindbeforedays", "reminderdays"])
            );
            const reminderDaysParsed = rawReminderDays ? Number.parseInt(rawReminderDays, 10) : 0;
            const reminderTimeParsed = parseTimeCell(
                getValue(row, ["remindertime", "reminderstartingtime", "tasktime", "time", "duetime"]),
                "09:00"
            );

            const setReminderBool = parseBooleanCell(
                getValue(row, ["setreminder", "reminder", "reminderenabled"]),
                Boolean(reminderDaysParsed > 0 || reminderTimeParsed.provided)
            );
            const notifyMeBool = parseBooleanCell(
                getValue(row, ["notifyme", "notifications"]),
                false
            );
            const isComplianceBool = parseBooleanCell(
                getValue(row, ["compliancetask", "iscompliancetask", "compliance"]),
                false
            );
            const skipHolidaysBool = parseBooleanCell(
                getValue(row, ["skiponholidays", "skipchecklistonholidays", "skipholidays"]),
                false
            );
            const mandatoryAttachmentBool = parseBooleanCell(
                getValue(row, ["mandatoryattachment", "mandatoryattachmentwhendone", "makeattachmentmandatorywhendone", "attachmentmandatory"]),
                false
            );
            const mandatoryNoteBool = parseBooleanCell(
                getValue(row, ["mandatorynote", "mandatorynotewhendone", "makenotemandatorywhendone", "notemandatory"]),
                false
            );
            const autoCloseBool = parseBooleanCell(
                getValue(row, ["autoclose", "autocloseenabled", "checklistautoclose"]),
                false
            );
            const rawAutoCloseDays = cleanWhitespace(getValue(row, ["autoclosedays", "checklistautoclosedays"]));
            const autoCloseDays = rawAutoCloseDays ? Number.parseInt(rawAutoCloseDays, 10) : 0;
            const notifyDoerBool = parseBooleanCell(
                getValue(row, ["notifydoerwhendone", "selectnotifydoerwhentaskdone"]),
                false
            );

            const rawReminderMode = cleanWhitespace(getValue(row, ["remindermode"]));
            const reminderMode = !rawReminderMode
                ? "Before due date"
                : (reminderModeMap[normalizeHeader(rawReminderMode)] || "");

            const rawReminderFrequency = cleanWhitespace(getValue(row, ["reminderfrequency"]));
            const reminderFrequency = !rawReminderFrequency
                ? "Once"
                : (reminderFrequencyMap[normalizeHeader(rawReminderFrequency)] || "");

            const notifyCompletionUsers = resolveUserListFromCell(
                getValue(row, ["notifyoncompletion", "notifyoncompletionusers", "notifyusers"]),
                users
            );

            const rawNotifyPC = getValue(row, [
                "notifypcteamuserswhendue",
                "notifypcteamwhendue",
                "notifypconoverdue",
                "notifypcusers"
            ]);
            const notifyPCBoolCheck = parseBooleanCell(rawNotifyPC, false);
            const notifyPCTeamWhenDue = notifyPCBoolCheck.provided && notifyPCBoolCheck.valid
                ? notifyPCBoolCheck.value
                : false;
            const notifyPCUsers = notifyPCBoolCheck.provided && notifyPCBoolCheck.valid
                ? { ids: [], invalid: [] }
                : resolveUserListFromCell(rawNotifyPC, users, { preferDepartment: /^pc$/i });

            // Validation
            let error = "";

            if (!taskName) {
                error = "Task Name is required.";
            } else if (!assigneeMatch.user) {
                error = `Assigned To "${assigneeClean || "(blank)"}" did not match user ID, name or email.`;
            } else if (!assignPCMatch.empty && !assignPCMatch.user) {
                error = `Assign PC "${cleanWhitespace(getValue(row, ["assignpc", "assignpcincharge", "pc", "pcname", "pcincharge"]))}" did not match any user.`;
            } else if (!auditorMatch.empty && !auditorMatch.user) {
                error = `Auditor "${cleanWhitespace(getValue(row, ["auditor", "reviewer"]))}" did not match any user.`;
            } else if (!frequency) {
                error = `Invalid frequency "${rawFrequency}". Use One Time, Daily, Weekly, Monthly, Quarterly, Yearly, or Custom.`;
            } else if (!priority) {
                error = `Invalid priority "${rawPriority}". Use Low, Medium, High, or Urgent.`;
            } else if (!status) {
                error = `Invalid status "${rawStatus}". Use Pending, Not started, In Progress, Completed, Overdue, or Cancelled.`;
            } else if (!parsedDate.valid) {
                error = `Invalid Planned Date "${cleanWhitespace(rawDateValue)}". Use YYYY-MM-DD (e.g. 2026-11-30).`;
            } else if (frequency !== "One Time" && (!plannedDate || Number.isNaN(plannedDate.getTime()))) {
                error = "Valid Planned Date is required for recurring checklists.";
            } else if (invalidWeeklyToken) {
                error = `Invalid Weekly Day "${invalidWeeklyToken}". Use Sun, Mon, Tue, Wed, Thu, Fri, Sat.`;
            } else if (frequency === "Weekly" && (!weeklyDays.length || weeklyDays.some(d => !Number.isInteger(d) || d < 0 || d > 6))) {
                error = "Invalid Weekly Days. Use Mon,Wed,Fri.";
            } else if (frequency === "Monthly" && (!Number.isInteger(parsedMonthlyDay) || parsedMonthlyDay < 1 || parsedMonthlyDay > 31)) {
                error = "Monthly Day must be between 1 and 31.";
            } else if (frequency === "Custom" && (!Number.isInteger(customIntervalDays) || customIntervalDays < 1 || customIntervalDays > 365)) {
                error = "Custom Interval must be between 1 and 365 days.";
            } else if (!setReminderBool.valid) {
                error = "Invalid Set Reminder value. Use Yes or No.";
            } else if (!notifyMeBool.valid) {
                error = "Invalid Notify Me value. Use Yes or No.";
            } else if (!isComplianceBool.valid) {
                error = "Invalid Compliance Task value. Use Yes or No.";
            } else if (!skipHolidaysBool.valid) {
                error = "Invalid Skip On Holidays value. Use Yes or No.";
            } else if (!mandatoryAttachmentBool.valid) {
                error = "Invalid Mandatory Attachment value. Use Yes or No.";
            } else if (!mandatoryNoteBool.valid) {
                error = "Invalid Mandatory Note value. Use Yes or No.";
            } else if (!autoCloseBool.valid) {
                error = "Invalid Auto Close value. Use Yes or No.";
            } else if (!notifyDoerBool.valid) {
                error = "Invalid Notify Doer When Done value. Use Yes or No.";
            } else if (!reminderTimeParsed.valid) {
                error = `Invalid Reminder Time "${cleanWhitespace(getValue(row, ["remindertime", "reminderstartingtime", "tasktime", "time", "duetime"]))}". Use HH:MM (e.g. 10:00).`;
            } else if (rawReminderDays && (!Number.isInteger(reminderDaysParsed) || reminderDaysParsed < 0 || reminderDaysParsed > 365)) {
                error = "Reminder Days Before must be between 0 and 365.";
            } else if (!reminderMode) {
                error = `Invalid Reminder Mode "${rawReminderMode}".`;
            } else if (!reminderFrequency) {
                error = `Invalid Reminder Frequency "${rawReminderFrequency}".`;
            } else if (rawAutoCloseDays && (!Number.isInteger(autoCloseDays) || autoCloseDays < 0 || autoCloseDays > 3650)) {
                error = "Auto Close Days must be 0 or greater.";
            } else if (notifyCompletionUsers.invalid.length) {
                error = `Notify On Completion user(s) not found: ${notifyCompletionUsers.invalid.join(", ")}.`;
            } else if (notifyPCUsers.invalid.length) {
                error = `Notify PC Team user(s) not found: ${notifyPCUsers.invalid.join(", ")}.`;
            }

            if (error) {
                invalidRows.push({
                    row: rowNumber,
                    taskName,
                    reason: error
                });
                continue;
            }

            const hasExplicitNotifyUsers = notifyCompletionUsers.ids.length > 0 || notifyPCUsers.ids.length > 0;
            const effectiveNotifyMe = notifyMeBool.provided ? notifyMeBool.value : hasExplicitNotifyUsers;
            const effectiveReminderDays = Number.isInteger(reminderDaysParsed) && reminderDaysParsed >= 0 ? reminderDaysParsed : 0;

            imported.push({
                taskName,
                message,
                assignedTo: assigneeMatch.user._id,
                frequency,
                plannedDate,
                priority,
                status,
                mode,
                groupName,
                assignedBy,
                assignPC: assignPCMatch.user ? assignPCMatch.user._id : null,
                auditor: auditorMatch.user ? auditorMatch.user._id : null,
                weeklyDays: frequency === "Weekly" ? weeklyDays : [],
                monthlyDay: frequency === "Monthly" ? parsedMonthlyDay : 1,
                customIntervalDays: frequency === "Custom" ? customIntervalDays : 1,
                setReminder: setReminderBool.value,
                setReminderBeforeDays: effectiveReminderDays,
                remindBeforeDays: effectiveReminderDays,
                reminderStartingTime: reminderTimeParsed.value,
                reminderMode,
                reminderFrequency,
                notifyMe: effectiveNotifyMe,
                notifyOnCompletionUsers: effectiveNotifyMe ? notifyCompletionUsers.ids : [],
                notifyPCTeamUsersWhenDue: effectiveNotifyMe ? notifyPCUsers.ids : [],
                notifyPCTeamWhenDue: Boolean(effectiveNotifyMe && (notifyPCTeamWhenDue || notifyPCUsers.ids.length > 0)),
                isComplianceTask: isComplianceBool.value,
                skipChecklistOnHolidays: skipHolidaysBool.value,
                makeAttachmentMandatoryWhenWorkDone: mandatoryAttachmentBool.value,
                makeNoteMandatoryWhenWorkDone: mandatoryNoteBool.value,
                checklistAutoClose: autoCloseBool.value,
                checklistAutoCloseDays: autoCloseBool.value && Number.isInteger(autoCloseDays) ? autoCloseDays : 0,
                selectNotifyDoerWhenTaskDone: notifyDoerBool.value
            });
        }

        // Import valid rows
        if (imported.length) {
            const insertedDocs = await Checklists.insertMany(imported, { ordered: true });
            Promise.allSettled(
                insertedDocs.map(doc =>
                    notifyChecklistEvent({
                        checklist: doc,
                        eventType: "created",
                        senderUserId: req.body?.senderUserId
                    })
                )
            ).catch(err => console.error("Imported checklist notifications error:", err));
        }

        return res.status(200).json({
            success: true,
            message: `${imported.length} checklist(s) imported successfully.`,
            totalRows: processedCount,
            imported: imported.length,
            failed: invalidRows.length,
            invalidRows
        });

    } catch (error) {
        console.error("Checklist Excel import error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to import checklists."
        });
    }
};


const updateChecklist = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid checklist ID." });
        }
        const update = pickChecklistFields(req.body);
        const validationError = await validateChecklist(update);
        if (validationError) return res.status(400).json({ success: false, message: validationError });
        if (update.taskName !== undefined) update.taskName = update.taskName.trim();
        if (update.message !== undefined) update.message = update.message.trim();

        const previous = await Checklists.findById(req.params.id).select("assignedTo auditor assignPC").lean();
        if (!previous) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }

        const checklist = await Checklists.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        );
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        const data = await populatePeople(Checklists.findById(checklist._id));

        const assigneeChanged =
            String(previous.assignedTo || "") !== String(checklist.assignedTo || "") ||
            String(previous.auditor || "") !== String(checklist.auditor || "") ||
            String(previous.assignPC || "") !== String(checklist.assignPC || "");

        if (assigneeChanged) {
            await notifyChecklistEvent({
                checklist: data,
                eventType: "assigned",
                senderUserId: req.body.senderUserId
            });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error updating checklist:", error);
        const status = error.name === "ValidationError" || error.name === "CastError" ? 400 : 500;
        return res.status(status).json({ success: false, message: error.message || "Unable to update checklist." });
    }
};

const deleteChecklist = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid checklist ID." });
        }
        const checklist = await Checklists.findByIdAndDelete(req.params.id);
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        return res.status(200).json({ success: true, message: "Checklist deleted." });
    } catch (error) {
        console.error("Error deleting checklist:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to delete checklist." });
    }
};

module.exports = {
    addChecklist,
    getChecklists,
    getChecklistById,
    submitChecklistResponse,
    importChecklistsExcel,
    updateChecklist,
    deleteChecklist
};
