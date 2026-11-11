const mongoose = require("mongoose");
const Checklists = require("../models/cheacklist");
const Users = require("../models/usermodel");
const ChecklistResponseNotification = require("../models/checklistResponseNotification");
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
        return res.status(201).json({ success: true, data });
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
        if (!response) {
            return res.status(400).json({ success: false, message: "Response cannot be empty." });
        }
        if (response.length > 2000) {
            return res.status(400).json({ success: false, message: "Response cannot exceed 2,000 characters." });
        }
        if (details.length > 4000) {
            return res.status(400).json({ success: false, message: "Response details cannot exceed 4,000 characters." });
        }
        if (!Array.isArray(req.body.pcRecipients) ||
            req.body.pcRecipients.some(id => !mongoose.isValidObjectId(id))) {
            return res.status(400).json({ success: false, message: "PC recipients must be a list of valid team member IDs." });
        }

        const checklist = await Checklists.findById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        const assignedByName = String(checklist.assignedBy || "").split("·")[0].trim();
        const assignedByPattern = assignedByName
            ? new RegExp(`^${assignedByName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
            : null;
        const selectedPCIds = [...new Set(req.body.pcRecipients.map(String))];
        const [selectedPCMembers, assignedPeople, assigningPeople] = await Promise.all([
            Users.find({ _id: { $in: selectedPCIds }, department: /^pc$/i }).select("_id name department"),
            Users.find({
                _id: { $in: [checklist.assignedTo, checklist.assignPC].filter(Boolean) }
            }).select("_id name department"),
            assignedByPattern
                ? Users.find({ name: assignedByPattern }).select("_id name department")
                : Promise.resolve([])
        ]);
        if (selectedPCMembers.length !== selectedPCIds.length) {
            return res.status(400).json({ success: false, message: "One or more selected recipients are not PC team members." });
        }
        const recipientsById = new Map();
        [...selectedPCMembers, ...assignedPeople, ...assigningPeople].forEach(user => {
            recipientsById.set(String(user._id), user);
        });
        const recipients = [...recipientsById.values()];
        const submittedResponse = {
            response,
            details,
            submittedBy: typeof req.body.submittedBy === "string" ? req.body.submittedBy.trim() : "",
            sentTo: recipients.map(user => ({
                userId: user._id,
                name: user.name,
                department: user.department
            }))
        };
        checklist.responses.push(submittedResponse);
        await checklist.save();

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

        return res.status(201).json({
            success: true,
            message: "Checklist response submitted.",
            data: savedResponse,
            notificationStatus: {
                recipients: recipients.length,
                sent: notificationResults.length - failedNotifications.length,
                failed: failedNotifications.length
            }
        });
    } catch (error) {
        console.error("Error submitting checklist response:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to submit response." });
    }
};


const importChecklistsExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an Excel or CSV file."
            });
        }

        const workbook = XLSX.read(req.file.buffer, {
            type: "buffer",
            cellDates: true
        });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = sheet
            ? XLSX.utils.sheet_to_json(sheet, { defval: "" })
            : [];

        if (!rows.length) {
            return res.status(400).json({
                success: false,
                message: "Excel file is empty."
            });
        }

        if (rows.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Maximum 1000 rows allowed."
            });
        }

        // Excel column matching
        const normalize = value =>
            String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");

        const getValue = (row, aliases) => {
            const key = Object.keys(row).find(key =>
                aliases.includes(normalize(key))
            );
            return key !== undefined ? row[key] : "";
        };

        // Fetch all users including MongoDB ID
        const users = await Users.find({}).select("_id name email");

        const imported = [];
        const invalidRows = [];

        const frequencies = [
            "One Time", "Daily", "Weekly", "Monthly",
            "Quarterly", "Yearly", "Custom"
        ];

        const priorities = ["Low", "Medium", "High", "Urgent"];
        const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

        for (const [index, row] of rows.entries()) {

            const rowNumber = index + 2;

            const taskName = String(
                getValue(row, ["taskname", "name", "title"]) || ""
            ).trim();

            const assignee = String(
                getValue(row, [
                    "assignedto",
                    "assignedtoemailorname",
                    "assignee",
                    "assignedemail",
                    "assigneeemail"
                ]) || ""
            ).trim();

            const frequency = String(
                getValue(row, ["frequency", "repeat"]) || "One Time"
            ).trim();

            const priority = String(
                getValue(row, ["priority"]) || "Medium"
            ).trim();

            const message = String(
                getValue(row, ["message", "instructions", "description"]) || ""
            ).trim();

            // Match MongoDB ID, Name or Email
            const assigneeUser = users.find(user =>
                String(user._id) === assignee ||
                user.email?.toLowerCase() === assignee.toLowerCase() ||
                user.name?.toLowerCase() === assignee.toLowerCase()
            );

            // Weekly days
            const weeklyDaysValue = String(
                getValue(row, ["weeklydays", "repeaton"]) || ""
            ).trim();

            const weeklyDays = weeklyDaysValue
                ? weeklyDaysValue.split(/[;,|]/).map(value => {
                    const day = value.trim().toLowerCase().slice(0, 3);
                    return /^\d$/.test(day)
                        ? Number(day)
                        : dayNames.indexOf(day);
                })
                : [];

            // Monthly and custom values
            const monthlyDay = Number(
                getValue(row, ["monthlyday", "dayofmonth"])
            ) || 0;

            const customIntervalDays = Number(
                getValue(row, ["customintervaldays", "repeateverydays"])
            ) || 0;

            // Planned date
            const rawDate = getValue(row, [
                "planneddate",
                "planneddateyyyymmdd",
                "startdate",
                "duedate"
            ]);

            let plannedDate = null;

            if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
                plannedDate = rawDate;

            } else if (typeof rawDate === "number") {
                const parsed = XLSX.SSF.parse_date_code(rawDate);

                if (parsed) {
                    plannedDate = new Date(
                        Date.UTC(parsed.y, parsed.m - 1, parsed.d)
                    );
                }

            } else if (rawDate) {
                const parsed = new Date(String(rawDate).trim());

                if (!isNaN(parsed.getTime())) {
                    plannedDate = parsed;
                }
            }

            // Validation
            let error = "";

            if (!taskName) {
                error = "Task Name is required.";

            } else if (!assigneeUser) {
                error = `Assigned To "${assignee || "(blank)"}" did not match user ID, name or email.`;

            } else if (!frequencies.includes(frequency)) {
                error = `Invalid frequency "${frequency}".`;

            } else if (!priorities.includes(priority)) {
                error = `Invalid priority "${priority}".`;

            } else if (
                frequency !== "One Time" &&
                (!plannedDate || isNaN(plannedDate.getTime()))
            ) {
                error = "Valid Planned Date is required.";

            } else if (
                frequency === "Weekly" &&
                (!weeklyDays.length ||
                    weeklyDays.some(day =>
                        !Number.isInteger(day) || day < 0 || day > 6
                    ) ||
                    new Set(weeklyDays).size !== weeklyDays.length)
            ) {
                error = "Invalid Weekly Days. Use Mon,Wed,Fri.";

            } else if (
                frequency === "Monthly" &&
                (monthlyDay < 1 || monthlyDay > 31)
            ) {
                error = "Monthly Day must be between 1 and 31.";

            } else if (
                frequency === "Custom" &&
                (customIntervalDays < 1 || customIntervalDays > 365)
            ) {
                error = "Custom Interval must be between 1 and 365 days.";
            }

            if (error) {
                invalidRows.push({
                    row: rowNumber,
                    taskName,
                    reason: error
                });
                continue;
            }

            // Prepare checklist data
            imported.push({
                taskName,
                message,
                assignedTo: assigneeUser._id,
                frequency,
                plannedDate,
                priority,
                weeklyDays: frequency === "Weekly" ? weeklyDays : [],
                monthlyDay: frequency === "Monthly" ? monthlyDay : 1,
                customIntervalDays: frequency === "Custom"
                    ? customIntervalDays
                    : 1
            });
        }

        // Import valid rows
        if (imported.length) {
            await Checklists.insertMany(imported, { ordered: true });
        }

        return res.status(200).json({
            success: true,
            message: `${imported.length} checklist(s) imported successfully.`,
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

        const checklist = await Checklists.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        );
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        const data = await populatePeople(Checklists.findById(checklist._id));
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
