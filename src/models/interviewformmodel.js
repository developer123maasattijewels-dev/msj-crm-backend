const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
    {

        candidateName: {
            type: String,
            required: true,
            trim: true,
        },
        candidateEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        candidatePhone: {
            type: String,
            required: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        candidatePosition: {
            type: String,
            required: true,
            trim: true,
        },
        source: {
            type: String,
            required: true,
            enum: [
                "Walk-in",
                "Employee Referral",
                "Job Portal",
                "Social Media",
                "Consultancy",
                "Other",
            ],
        },
        referredBy: {
            type: String,
            trim: true,
            default: "",
        },

        // 2. Hiring & Interview
        interview: {
            interviewDate: {
                type: Date,
                default: null,
            },
            interviewer: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            feedback: {
                type: String,
                default: "",
            },
            rating: {
                type: Number,
                min: 1,
                max: 5,
                default: null,
            },
    
            offeredPosition: {
                type: String,
                default: "",
            },
            proposedSalary: {
                type: Number,
                min: 0,
                default: null,
            },
            interviewStatus: {
                type: String,
                enum: [
                    "Pending",
                    "Scheduled",
                    "In Progress",
                    "Selected",
                    "Rejected",
                    "On Hold",
                ],
                default: "Pending",
            },

            interviewDate: {
                type: Date,
                default: null,
            },

            interviewMode: {
                type: String,
                enum: ["Online", "Offline", "Telephonic"],
                default: "Offline",
            },

            interviewer: {
                type: String,
                trim: true,
                default: "",
            },

            feedback: {
                type: String,
                trim: true,
                default: "",
            },

            remarks: {
                type: String,
                trim: true,
                default: "",
            },

        },

        // 3. Overall Hiring Workflow
        hiringStatus: {
            type: String,
            enum: [
                "New",
                "Interview Scheduled",
                "Selected",
                "Training",
                "Review Due",
                "Training Extended",
                "Approved",
                "Rejected",
                "On Hold",
                "Joined",
                "Withdrawn",
            ],
            default: "New",
        },

        // 4. Training Assignment
        training: {
            trainer: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            trainingDepartment: {
                type: String,
                default: "",
            },
            startDate: {
                type: Date,
                default: null,
            },
            expectedEndDate: {
                type: Date,
                default: null,
            },
            reviewDueDate: {
                type: Date,
                default: null,
            },
            progress: {
                type: Number,
                min: 0,
                max: 100,
                default: 0,
            },
            status: {
                type: String,
                enum: [
                    "Not Started",
                    "In Progress",
                    "Completed",
                    "Extended",
                    "Cancelled",
                ],
                default: "Not Started",
            },
            remarks: {
                type: String,
                default: "",
            },
        },

        // 5. Seven-Day Review
        review: {
            reviewDate: {
                type: Date,
                default: null,
            },
            reviewer: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            attendanceRating: {
                type: Number,
                min: 1,
                max: 5,
                default: null,
            },
            performanceRating: {
                type: Number,
                min: 1,
                max: 5,
                default: null,
            },
            behaviourRating: {
                type: Number,
                min: 1,
                max: 5,
                default: null,
            },
            feedback: {
                type: String,
                default: "",
            },
            decision: {
                type: String,
                enum: [
                    "Pending",
                    "Pass",
                    "Extend Training",
                    "Reject",
                ],
                default: "Pending",
            },
            nextReviewDate: {
                type: Date,
                default: null,
            },
        },

        // 6. Final Selection & Joining
        joining: {
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            approvalDate: {
                type: Date,
                default: null,
            },
            joiningDate: {
                type: Date,
                default: null,
            },
            employeeId: {
                type: String,
                default: "",
                trim: true,
            },
            employmentType: {
                type: String,
                enum: [
                    "Full-time",
                    "Part-time",
                    "Contract",
                    "Intern",
                ],
                default: "Full-time",
            },
            probationMonths: {
                type: Number,
                default: 3,
                min: 0,
            },
        },

        // 7. Salary & Payroll
        salary: {
            monthlySalary: {
                type: Number,
                min: 0,
                default: null,
            },
            salaryType: {
                type: String,
                enum: ["Monthly", "Daily", "Hourly", "Stipend"],
                default: "Monthly",
            },
            basicSalary: {
                type: Number,
                min: 0,
                default: null,
            },
            allowances: {
                type: Number,
                min: 0,
                default: 0,
            },
            deductions: {
                type: Number,
                min: 0,
                default: 0,
            },
            effectiveFrom: {
                type: Date,
                default: null,
            },
            paymentMode: {
                type: String,
                enum: ["Bank Transfer", "Cash", "Other"],
                default: "Bank Transfer",
            },
            salaryApprovedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            salaryApproved: {
                type: Boolean,
                default: false,
            },
        },

        // 8. Record Management
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Dashboard filters
interviewSchema.index({ hiringStatus: 1 });
interviewSchema.index({ department: 1 });
interviewSchema.index({ "training.trainer": 1 });
interviewSchema.index({ "training.reviewDueDate": 1 });

const Interview = mongoose.model("Interview", interviewSchema);
module.exports = Interview