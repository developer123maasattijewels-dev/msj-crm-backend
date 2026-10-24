
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        department: {
            type: String,
            required: true,
            enum: [
                'Administration',
                'CRM & Sales',
                'Marketing',
                'Designing',
                'CAD',
                'CAM',
                'Production',
                'Inventory & Stores',
                'Purchase & Vendors',
                'Products & Costing',
                'Quality Control',
                'Dispatch & Logistics',
                'HR & Employees',
                'Finance & Accounts',
                'MIS',
                'IT & Development',
                'Maintenance & Assets'
            ]
        },

        description: {
            type: String,
            default: '',
            trim: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

// Same department mein duplicate category allow nahi hogi
categorySchema.index(
    { name: 1, department: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    'Category',
    categorySchema
);
