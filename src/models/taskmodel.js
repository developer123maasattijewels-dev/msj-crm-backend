
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        taskId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ''
        },

        taskType: {
            type: String,
            default: 'Follow-up Call',
            trim: true
        },

        relatedLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Leads',
            default: null
        },

        instructions: {
            type: String,
            default: '',
            trim: true
        },

        assignedBy: {
            type: String,
            required: true,
            default: 'Olivia Carter · Sales Manager'
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        dueDate: {
            type: Date,
            default: null
        },

        dueTime: {
            type: String,
            default: '11:00'
        },

        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Urgent'],
            default: 'High'
        },

        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Overdue', 'Cancelled'],
            default: 'Pending'
        },

        recurrence: {
            enabled: {
                type: Boolean,
                default: false
            },

            frequency: {
                type: String,
                default: ''
            }
        },

        submission: {
            summary: {
                type: String,
                default: ''
            },
            notes: {
                type: String,
                default: ''
            },
            evidenceUrl: {
                type: String,
                default: ''
            }
        },

        submittedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Auto-generate taskId if not provided
taskSchema.pre('save', async function () {
    if (!this.taskId) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        this.taskId = `TSK-${randomNum}`;
    }
});

const Tasks = mongoose.model('Task', taskSchema);

module.exports = Tasks;