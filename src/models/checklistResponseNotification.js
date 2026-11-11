const mongoose = require("mongoose");

const checklistResponseNotificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    checklistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cheacklist",
        required: true
    },
    responseId: {
        type: mongoose.Schema.Types.ObjectId,
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
        default: "checklist_response"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("ChecklistResponseNotification", checklistResponseNotificationSchema);
