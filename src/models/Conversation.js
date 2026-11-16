const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        // Type of conversation: 'client' (with lead/customer) or 'internal' (between team users)
        chatType: {
            type: String,
            enum: ['client', 'internal'],
            default: 'client'
        },

        // Internal team participants
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],

        // Who created this conversation thread
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        createdByName: {
            type: String,
            default: ''
        },

        // Contact or Recipient Name
        clientName: {
            type: String,
            required: true,
            trim: true
        },

        clientEmail: {
            type: String,
            default: '',
            trim: true
        },

        clientPhone: {
            type: String,
            default: '',
            trim: true
        },

        clientType: {
            type: String,
            enum: ['VIP Client', 'Lead', 'Customer', 'Wholesale', 'Inquiry', 'Team Member'],
            default: 'Customer'
        },

        location: {
            type: String,
            default: '',
            trim: true
        },

        tier: {
            type: String,
            default: 'Standard Client',
            trim: true
        },

        avatarBg: {
            type: String,
            default: '#a77b35'
        },

        // Assigned CRM employee/agent
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        // Associated Lead if created from a CRM Lead
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lead',
            default: null
        },

        isVIP: {
            type: Boolean,
            default: false
        },

        starred: {
            type: Boolean,
            default: false
        },

        online: {
            type: Boolean,
            default: false
        },

        lastMessage: {
            type: String,
            default: ''
        },

        lastMessageAt: {
            type: Date,
            default: Date.now
        },

        unreadCount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalSpent: {
            type: String,
            default: '—'
        },

        ordersCount: {
            type: Number,
            default: 0
        },

        kycStatus: {
            type: String,
            enum: ['Verified', 'Pending', 'Unverified'],
            default: 'Verified'
        },

        status: {
            type: String,
            enum: ['active', 'closed', 'archived'],
            default: 'active'
        },

        deal: {
            name: {
                type: String,
                default: ''
            },

            value: {
                type: mongoose.Schema.Types.Mixed,
                default: ''
            },

            stage: {
                type: String,
                default: ''
            }
        }
    },
    {
        timestamps: true
    }
);

// Faster conversation listing and filtering
conversationSchema.index({ isVIP: 1, status: 1 });
conversationSchema.index({ starred: 1, status: 1 });
conversationSchema.index({ unreadCount: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ clientName: 1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ assignedTo: 1 });
conversationSchema.index({ createdBy: 1 });
conversationSchema.index({ chatType: 1 });

module.exports = mongoose.model(
    'Conversation',
    conversationSchema
);
