const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema(
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

const orderFormSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        fields: {
            type: [formFieldSchema],
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('OrderForm', orderFormSchema);
