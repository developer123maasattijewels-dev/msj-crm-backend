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

        formId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrderForm'
        },

        formType: {
            type: String,
            default: ''
        },

        customer: {
            type: String,
            default: ''
        },

        product: {
            type: String,
            default: ''
        },

        phone: {
            type: String,
            default: ''
        },

        amount: {
            type: Number,
            default: 0
        },

        date: {
            type: String,
            default: ''
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

        hasReceipt: {
            type: Boolean,
            default: false
        },

        receiptNo: {
            type: String,
            default: ''
        },

        receiptDate: {
            type: Date
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
