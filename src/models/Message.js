const mongoose = require('mongoose');

// Attachment Schema
const attachmentSchema = new mongoose.Schema(
    {
        fileName: {
            type: String,
            required: true
        },

        fileUrl: {
            type: String,
            required: true
        },

        fileType: {
            type: String,
            enum: ['image', 'pdf', 'document', 'audio', 'other'],
            default: 'other'
        },

        fileSize: {
            type: mongoose.Schema.Types.Mixed,
            default: ''
        }
    },
    { _id: false }
);

// Message Schema
const messageSchema = new mongoose.Schema(
    {
        // Which conversation this message belongs to
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true
        },

        // Who sent the message
        senderType: {
            type: String,
            enum: ['client', 'agent', 'system'],
            required: true
        },

        // Employee ID (only for agent messages)
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        senderName: {
            type: String,
            required: true,
            trim: true,
            default: 'Agent'
        },

        // Message Content
        content: {
            type: String,
            default: '',
            trim: true
        },

        // Message Type
        messageType: {
            type: String,
            enum: ['text', 'image', 'file', 'attachment', 'system'],
            default: 'text'
        },

        // Attachments
        attachments: {
            type: [attachmentSchema],
            default: []
        },

        // Message Delivery Status
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read', 'failed'],
            default: 'sent'
        },

        // Read Information
        readAt: {
            type: Date,
            default: null
        },

        // Reply to another message
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null
        },

        // Message deletion
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Database Indexes
messageSchema.index({
    conversation: 1,
    createdAt: 1
});

messageSchema.index({
    conversation: 1,
    status: 1
});

const Message = mongoose.model(
    'Message',
    messageSchema
);

module.exports = Message;
