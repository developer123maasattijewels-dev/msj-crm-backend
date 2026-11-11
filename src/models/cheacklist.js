

const mongoose = require('mongoose')


const checklistSchema = new mongoose.Schema({
    taskName: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    frequency: { type: String, default: "One Time" },
    weeklyDays: { type: [Number], default: [] },
    monthlyDay: { type: Number, min: 1, max: 31, default: 1 },
    customIntervalDays: { type: Number, min: 1, max: 365, default: 1 },
    plannedDate: { type: Date, default: null },
    remindBeforeDays: { type: Number, min: 0, default: 0 },
    mode: { type: String, default: "Manual" },
    priority: { type: String, default: "Medium" },
    setReminder: { type: Boolean, default: false },
    reminderMode: { type: String, default: "Before due date" },
    reminderFrequency: { type: String, default: "Once" },
    setReminderBeforeDays: { type: Number, min: 0, default: 0 },
    notifyMe: { type: Boolean, default: false },
    notifyOnCompletionUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notifyPCTeamUsersWhenDue: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notifyPCTeamWhenDue: { type: Boolean, default: false },
    auditor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    groupName: { type: String, trim: true, default: "" },
    makeAttachmentMandatoryWhenWorkDone: { type: Boolean, default: false },
    assignPC: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reminderStartingTime: { type: String, default: "09:00" },
    checklistAutoClose: { type: Boolean, default: false },
    checklistAutoCloseDays: { type: Number, min: 0, default: 0 },
    makeNoteMandatoryWhenWorkDone: { type: Boolean, default: false },
    assignedBy: { type: String, trim: true, default: "" },
    skipChecklistOnHolidays: { type: Boolean, default: false },
    isComplianceTask: { type: Boolean, default: false },
    selectNotifyDoerWhenTaskDone: { type: Boolean, default: false },
    responses: [{
        response: { type: String, required: true, trim: true },
        details: { type: String, trim: true, default: "" },
        submittedBy: { type: String, trim: true, default: "" },
        sentTo: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: { type: String, trim: true },
            department: { type: String, trim: true }
        }],
        submittedAt: { type: Date, default: Date.now }
    }],
    lastProcessedDate: { type: Date, default: null },

    // Keep legacy checklist fields readable for existing documents.
    name: String,
    department: String,
    category: String,
    items: [{
        title: { type: String, required: true },
        description: String,
        required: { type: Boolean, default: true },
        requiresProof: { type: Boolean, default: false }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    isActive: { type: Boolean, default: true }
}, { timestamps: true })

module.exports = mongoose.models.Cheacklist || mongoose.model('Cheacklist', checklistSchema)