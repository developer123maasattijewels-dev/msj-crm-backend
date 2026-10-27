
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
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

        subCategories: {
            type: [String],
            validate: {
                validator: function (items) {
                    return items.length > 0 &&
                        items.every(item => item.trim().length > 0);
                },
                message: 'At least one valid subcategory is required.'
            }
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

categorySchema.index(
    { name: 1 },
    { unique: true }
);

const Categories = mongoose.model('Category', categorySchema);
module.exports = Categories