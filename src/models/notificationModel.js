const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
            index: true
        },
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tasks",
            required: true
        },
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ["task_reminder", "task_overdue", "task_update"],
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

// Prevent duplicate reminders for the same task and recipient.
notificationSchema.index(
    { task: 1, recipient: 1, type: 1 },
    { unique: true }
);

const notification = mongoose.model("Notification", notificationSchema);
module.exports = notification