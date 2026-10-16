
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        source: {
            type: String,
            required: true,
            enum: [
                'website',
                'social-media',
                'referral',
                'other',
            ],
        },

        interestedProduct: {
            type: String,
            required: true,
            enum: [
                'diamond-ring',
                'gold-necklace',
                'bracelet',
                'other',
            ],
        },

        status: {
            type: String,
            required: true,
            enum: [
                'new',
                'contacted',
                'qualified',
                'rejected',
            ],
            default: 'new',
        },

        assignedTo: {
            type: String,
            default: '',
            trim: true,
        },

        notes: {
            type: String,
            required: true,
            trim: true,
        },

        // Lead ki edit history
        editHistory: [
            {
                changes: [
                    {
                        field: {
                            type: String,
                            required: true,
                        },
                        oldValue: mongoose.Schema.Types.Mixed,
                        newValue: mongoose.Schema.Types.Mixed,
                    },
                ],

                changedBy: {
                    type: String,
                    default: 'System',
                },

                changedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

const leadsmodel = mongoose.model('Leads', leadSchema);

module.exports = leadsmodel;
