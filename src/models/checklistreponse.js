const checklistResponseSchema = new mongoose.Schema({
    checklistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Checklist"
    },

    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    status: {
        type: String,
        enum: ["completed", "partial", "pending", "blocked"]
    },

    completionPercentage: Number,

    workDescription: String,
    result: String,

    issues: {
        hasIssue: Boolean,
        description: String,
        actionTaken: String,
        supportRequired: String
    },

    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: Date
    }],

    startTime: Date,
    endTime: Date,
    timeSpentMinutes: Number,

    customResponses: [{
        fieldId: String,
        label: String,
        value: mongoose.Schema.Types.Mixed
    }],

    approval: {
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "rework"],
            default: "pending"
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        remarks: String,
        reviewedAt: Date
    },

    score: {
        automatic: Number,
        manager: Number
    },

    submittedAt: Date
}, { timestamps: true });