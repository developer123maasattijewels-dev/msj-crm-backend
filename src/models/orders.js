
const mongoose = require('mongoose');

const customFieldDefinitionSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true
        },
        label: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        },
        placeholder: {
            type: String,
            default: ''
        },
        required: {
            type: Boolean,
            default: false
        },
        options: {
            type: [String],
            default: []
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            unique: true,
            required: true
        },

        customFieldDefinitions: {
            type: [customFieldDefinitionSchema],
            default: []
        },

        customFields: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        status: {
            type: String,
            default: 'Processing'
        },

        payment: {
            type: String,
            default: 'Pending'
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);
module.exports = Order