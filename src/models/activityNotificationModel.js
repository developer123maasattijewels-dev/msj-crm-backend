const mongoose = require('mongoose');

const activityNotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: [
                'ticket_created',
                'ticket_updated',
                'ticket_reply',
                'ticket_assigned',
                'po_created',
                'checklist_created',
                'checklist_assigned',
                'checklist_due',
                'task_assigned',
                'task_completed',
                'lead_assigned',
                'interview_created',
                'interview_updated'
            ],
            required: true
        },
        entityType: {
            type: String,
            enum: ['ticket', 'checklist', 'task', 'lead', 'interview', 'system'],
            default: 'system'
        },
        entityId: {
            type: String,
            default: '',
            trim: true
        },
        route: {
            type: String,
            default: '/dashboard',
            trim: true
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
    {
        timestamps: true
    }
);

const ActivityNotification = mongoose.models.ActivityNotification ||
    mongoose.model('ActivityNotification', activityNotificationSchema);

module.exports = ActivityNotification;

