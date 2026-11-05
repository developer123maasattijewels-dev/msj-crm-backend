
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

        checklistId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Cheacklist',
            default: null
        },

        checklistOccurrenceKey: {
            type: String,
            default: undefined
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

        assignPC: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        notifyPCTeamWhenDue: {
            type: Boolean,
            default: false
        },

        notifyPCTeamUsersWhenDue: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],

        dueDate: {
            type: Date,
            default: null
        },

        dueAt: {
            type: Date,
            default: null,
            index: true
        },

        dueTime: {
            type: String,
            default: '11:00'
        },

        reminderMinutesBefore: {
            type: Number,
            min: 0,
            max: 1440,
            default: 15
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

taskSchema.index({ checklistOccurrenceKey: 1 }, { unique: true, sparse: true });

// Auto-generate taskId if not provided
taskSchema.pre('save', async function () {
    if (!this.taskId) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        this.taskId = `TSK-${randomNum}`;
    }
});

const Tasks = mongoose.model('Task', taskSchema);

if (!mongoose.models.Tasks) {
    mongoose.model('Tasks', taskSchema, Tasks.collection.name);
}

module.exports = Tasks;