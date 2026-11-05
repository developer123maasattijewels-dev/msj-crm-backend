const mongoose = require("mongoose");
const Checklists = require("../models/cheacklist");
const Users = require("../models/usermodel");
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

const hasInvalidPersonReference = fields => {
    const personFields = ["assignedTo", "auditor", "assignPC"];
    if (personFields.some(key => fields[key] && !mongoose.isValidObjectId(fields[key]))) {
        return true;
    }
    const userLists = ["notifyOnCompletionUsers", "notifyPCTeamUsersWhenDue"];
    return userLists.some(key => fields[key] !== undefined &&
        (!Array.isArray(fields[key]) ||
            fields[key].some(userId => !mongoose.isValidObjectId(userId))));
};

const isPCDepartmentUser = async assignPC => {
    if (!assignPC) return true;
    return Boolean(await Users.exists({
        _id: assignPC,
        department: /^pc$/i
    }));
};

const arePCDepartmentUsers = async userIds => {
    if (!userIds) return true;
    if (!Array.isArray(userIds)) return false;
    if (userIds.length === 0) return true;

    const uniqueIds = [...new Set(userIds.map(String))];
    const matchingUsers = await Users.countDocuments({
        _id: { $in: uniqueIds },
        department: /^pc$/i
    });
    return matchingUsers === uniqueIds.length;
};

const validateSchedule = fields => {
    const frequency = fields.frequency;
    if (frequency === undefined || frequency === "One Time") return null;
    if (!["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Custom"].includes(frequency)) {
        return "Choose a supported checklist frequency.";
    }
    if (!fields.plannedDate || Number.isNaN(new Date(fields.plannedDate).getTime())) {
        return "A planned start date is required for recurring checklists.";
    }
    if (fields.reminderStartingTime &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.reminderStartingTime)) {
        return "Choose a valid checklist task time.";
    }
    if (frequency === "Weekly") {
        if (!Array.isArray(fields.weeklyDays) || fields.weeklyDays.length === 0 ||
            fields.weeklyDays.some(day => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6)) {
            return "Select at least one valid weekday for a weekly checklist.";
        }
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
        const { taskName, message, assignedTo } = req.body;
        if (typeof taskName !== "string" || !taskName.trim()) {
            return res.status(400).json({ success: false, message: "Task name is required." });
        }
        if (!assignedTo || !mongoose.isValidObjectId(assignedTo)) {
            return res.status(400).json({ success: false, message: "A valid assignee is required." });
        }
        if (hasInvalidPersonReference(req.body)) {
            return res.status(400).json({ success: false, message: "Assignee, auditor, and PC must be valid team members." });
        }
        if (!(await isPCDepartmentUser(req.body.assignPC))) {
            return res.status(400).json({ success: false, message: "Assign PC must be a member of the PC department." });
        }
        if (!(await arePCDepartmentUsers(req.body.notifyPCTeamUsersWhenDue))) {
            return res.status(400).json({ success: false, message: "Overdue notification recipients must be members of the PC department." });
        }
        const scheduleError = validateSchedule(req.body);
        if (scheduleError) {
            return res.status(400).json({ success: false, message: scheduleError });
        }

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
        if (!response) {
            return res.status(400).json({ success: false, message: "Response cannot be empty." });
        }
        if (response.length > 2000) {
            return res.status(400).json({ success: false, message: "Response cannot exceed 2,000 characters." });
        }

        const checklist = await Checklists.findById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ success: false, message: "Checklist not found." });
        }
        checklist.responses.push({
            response,
            submittedBy: typeof req.body.submittedBy === "string" ? req.body.submittedBy.trim() : ""
        });
        await checklist.save();

        return res.status(201).json({
            success: true,
            message: "Checklist response submitted.",
            data: checklist.responses[checklist.responses.length - 1]
        });
    } catch (error) {
        console.error("Error submitting checklist response:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to submit response." });
    }
};

const importChecklistsExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload an Excel or CSV file." });
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) : [];
        if (!rows.length) {
            return res.status(400).json({ success: false, message: "The uploaded file has no checklist rows." });
        }
        if (rows.length > 1000) {
            return res.status(400).json({ success: false, message: "Import is limited to 1,000 checklist rows per file." });
        }

        const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const getValue = (row, aliases) => {
            const column = Object.keys(row).find(key => aliases.includes(normalize(key)));
            return column ? row[column] : "";
        };
        const users = await Users.find({}).select("name email");
        const imported = [];
        const invalidRows = [];

        for (const [index, row] of rows.entries()) {
            const taskName = String(getValue(row, ["taskname", "name", "title"]) || "").trim();
            const assignee = String(getValue(row, ["assignedto", "assignedtoemailorname", "assignee", "assignedemail", "assigneeemail"]) || "").trim();
            const frequency = String(getValue(row, ["frequency", "repeat"]) || "One Time").trim();
            const priority = String(getValue(row, ["priority"]) || "Medium").trim();
            const message = String(getValue(row, ["message", "instructions", "description"]) || "").trim();
            const weeklyDaysValue = String(getValue(row, ["weeklydays", "repeaton"]) || "").trim();
            const weeklyDayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
            const weeklyDays = weeklyDaysValue
                ? weeklyDaysValue.split(/[;,|]/).map(value => {
                    const day = value.trim().toLowerCase().slice(0, 3);
                    return /^\d$/.test(day) ? Number(day) : weeklyDayNames.indexOf(day);
                })
                : [];
            const monthlyDay = Number(getValue(row, ["monthlyday", "dayofmonth"])) || 0;
            const customIntervalDays = Number(getValue(row, ["customintervaldays", "repeateverydays"])) || 0;
            const assigneeUser = users.find(user =>
                user.email.toLowerCase() === assignee.toLowerCase() ||
                user.name.toLowerCase() === assignee.toLowerCase()
            );
            const rawDate = getValue(row, ["planneddate", "planneddateyyyymmdd", "startdate", "duedate"]);
            let plannedDate = null;
            if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
                plannedDate = rawDate;
            } else if (typeof rawDate === "number") {
                const parsed = XLSX.SSF.parse_date_code(rawDate);
                if (parsed) plannedDate = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
            } else if (rawDate) {
                const parsed = new Date(String(rawDate).trim());
                if (!Number.isNaN(parsed.getTime())) plannedDate = parsed;
            }

            const rowNumber = index + 2;
            if (!taskName) {
                invalidRows.push({ row: rowNumber, reason: "Task Name is required." });
                continue;
            }
            if (!assigneeUser) {
                invalidRows.push({ row: rowNumber, reason: `Assigned To "${assignee || "(blank)"}" did not match a user name or email.` });
                continue;
            }
            if (!["One Time", "Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Custom"].includes(frequency)) {
                invalidRows.push({ row: rowNumber, reason: `Unsupported frequency "${frequency}".` });
                continue;
            }
            if (!["Low", "Medium", "High", "Urgent"].includes(priority)) {
                invalidRows.push({ row: rowNumber, reason: `Unsupported priority "${priority}".` });
                continue;
            }
            if (frequency !== "One Time" && !plannedDate) {
                invalidRows.push({ row: rowNumber, reason: "A valid Planned Date is required for recurring tasks." });
                continue;
            }
            if (frequency === "Weekly" &&
                (!weeklyDays.length || weeklyDays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
                invalidRows.push({ row: rowNumber, reason: "Weekly Days must be comma-separated names (Mon,Wed) or numbers (1,3)." });
                continue;
            }
            if (frequency === "Monthly" && (!Number.isInteger(monthlyDay) || monthlyDay < 1 || monthlyDay > 31)) {
                invalidRows.push({ row: rowNumber, reason: "Monthly Day must be a number from 1 to 31." });
                continue;
            }
            if (frequency === "Custom" &&
                (!Number.isInteger(customIntervalDays) || customIntervalDays < 1 || customIntervalDays > 365)) {
                invalidRows.push({ row: rowNumber, reason: "Custom Interval Days must be a number from 1 to 365." });
                continue;
            }

            imported.push({
                taskName,
                message,
                assignedTo: assigneeUser._id,
                frequency,
                plannedDate,
                priority,
                weeklyDays: frequency === "Weekly" ? [...new Set(weeklyDays)] : [],
                monthlyDay: frequency === "Monthly" ? monthlyDay : 1,
                customIntervalDays: frequency === "Custom" ? customIntervalDays : 1
            });
        }

        if (imported.length) await Checklists.insertMany(imported, { ordered: false });
        return res.status(200).json({
            success: true,
            message: `${imported.length} checklist(s) imported.`,
            imported: imported.length,
            failed: invalidRows.length,
            invalidRows
        });
    } catch (error) {
        console.error("Checklist Excel import error:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to import checklists." });
    }
};

const updateChecklist = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid checklist ID." });
        }
        const update = pickChecklistFields(req.body);
        if (update.taskName !== undefined && (typeof update.taskName !== "string" || !update.taskName.trim())) {
            return res.status(400).json({ success: false, message: "Task name cannot be empty." });
        }
        if (update.message !== undefined && typeof update.message !== "string") {
            return res.status(400).json({ success: false, message: "Message must be text." });
        }
        if (update.assignedTo !== undefined && (!update.assignedTo || !mongoose.isValidObjectId(update.assignedTo))) {
            return res.status(400).json({ success: false, message: "A valid assignee is required." });
        }
        if (hasInvalidPersonReference(update)) {
            return res.status(400).json({ success: false, message: "Assignee, auditor, and PC must be valid team members." });
        }
        if (!(await isPCDepartmentUser(update.assignPC))) {
            return res.status(400).json({ success: false, message: "Assign PC must be a member of the PC department." });
        }
        if (!(await arePCDepartmentUsers(update.notifyPCTeamUsersWhenDue))) {
            return res.status(400).json({ success: false, message: "Overdue notification recipients must be members of the PC department." });
        }
        const scheduleError = validateSchedule(update);
        if (scheduleError) {
            return res.status(400).json({ success: false, message: scheduleError });
        }
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
