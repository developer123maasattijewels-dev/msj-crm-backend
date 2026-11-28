const mongoose = require("mongoose");

const EMPLOYEE_DOCUMENT_KEYS = [
    "fatherAadharCard",
    "motherAadharCard",
    "employeeAadharFront",
    "employeePanCard",
    "schoolingMarksheet10th",
    "schoolingMarksheet12th",
    "degreeCertificate",
    "bankPassbook",
    "offerLetter",
    "lastCompanySalarySlip",
    "policeVerificationCert",
    "healthFitnessCert",
    "relievingLetter",
];

const employeeSchema = new mongoose.Schema(
    {
        // 1. Basic & Personal
        name: {
            type: String,
            required: true,
            trim: true,
        },
        employeeCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        personalEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            enum: ["Male", "Female", "Other", ""],
            default: "Male",
        },
        dob: {
            type: String,
            trim: true,
            default: "",
        },
        bloodGroup: {
            type: String,
            trim: true,
            default: "",
        },
        avatar: {
            type: String,
            default: "",
        },
        currentAddress: {
            type: String,
            trim: true,
            default: "",
        },
        permanentAddress: {
            type: String,
            trim: true,
            default: "",
        },
        emergencyContact: {
            type: String,
            trim: true,
            default: "",
        },

        // 2. Family / Parents
        fatherName: {
            type: String,
            required: true,
            trim: true,
        },
        fatherContact: {
            type: String,
            trim: true,
            default: "",
        },
        fatherOccupation: {
            type: String,
            trim: true,
            default: "",
        },
        motherName: {
            type: String,
            trim: true,
            default: "",
        },
        motherContact: {
            type: String,
            trim: true,
            default: "",
        },
        guardianRelation: {
            type: String,
            trim: true,
            default: "Father",
        },
        familyAddress: {
            type: String,
            trim: true,
            default: "",
        },

        // 3. Last Company / Experience
        hasPreviousExperience: {
            type: Boolean,
            default: false,
        },
        lastCompanyName: {
            type: String,
            trim: true,
            default: "",
        },
        lastDesignation: {
            type: String,
            trim: true,
            default: "",
        },
        lastDepartment: {
            type: String,
            trim: true,
            default: "",
        },
        tenureFrom: {
            type: String,
            trim: true,
            default: "",
        },
        tenureTo: {
            type: String,
            trim: true,
            default: "",
        },
        lastDrawnSalary: {
            type: String,
            trim: true,
            default: "",
        },
        reasonForLeaving: {
            type: String,
            trim: true,
            default: "",
        },
        reportingManagerName: {
            type: String,
            trim: true,
            default: "",
        },
        reportingManagerPhone: {
            type: String,
            trim: true,
            default: "",
        },
        lastCompanyAddress: {
            type: String,
            trim: true,
            default: "",
        },
        lastBankName: {
            type: String,
            trim: true,
            default: "",
        },
        lastAccountNumber: {
            type: String,
            trim: true,
            default: "",
        },
        lastIfsc: {
            type: String,
            trim: true,
            uppercase: true,
            default: "",
        },

        // 4. Current Banking & Salary
        department: {
            type: String,
            required: true,
            trim: true,
        },
        designation: {
            type: String,
            required: true,
            trim: true,
        },
        dateOfJoining: {
            type: String,
            trim: true,
            default: "",
        },
        employmentType: {
            type: String,
            trim: true,
            default: "Full-Time",
        },
        employmentStatus: {
            type: String,
            enum: ["Active", "Inactive", "On Leave"],
            default: "Active",
        },
        reportingManager: {
            type: String,
            trim: true,
            default: "",
        },
        monthlySalary: {
            type: String,
            trim: true,
            default: "",
        },
        ctc: {
            type: String,
            trim: true,
            default: "",
        },
        bankName: {
            type: String,
            trim: true,
            default: "",
        },
        accountHolderName: {
            type: String,
            trim: true,
            default: "",
        },
        accountNumber: {
            type: String,
            required: true,
            trim: true,
        },
        ifscCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        branchName: {
            type: String,
            trim: true,
            default: "",
        },
        accountType: {
            type: String,
            trim: true,
            default: "Salary Account",
        },

        // 5. Health & Police Verification
        healthStatus: {
            type: String,
            enum: ["Pending", "Cleared", "Needs Review"],
            default: "Pending",
        },
        checkupDate: {
            type: String,
            trim: true,
            default: "",
        },
        medicalClinicName: {
            type: String,
            trim: true,
            default: "",
        },
        bloodPressure: {
            type: String,
            trim: true,
            default: "",
        },
        allergies: {
            type: String,
            trim: true,
            default: "",
        },
        chronicConditions: {
            type: String,
            trim: true,
            default: "",
        },
        insurancePolicyNo: {
            type: String,
            trim: true,
            default: "",
        },
        healthNotes: {
            type: String,
            trim: true,
            default: "",
        },
        policeVerificationStatus: {
            type: String,
            enum: ["Pending", "In Progress", "Under Process", "Verified", "Rejected"],
            default: "Pending",
        },
        policeStation: {
            type: String,
            trim: true,
            default: "",
        },
        verificationRefNo: {
            type: String,
            trim: true,
            default: "",
        },
        verificationDate: {
            type: String,
            trim: true,
            default: "",
        },
        policeOfficerRemarks: {
            type: String,
            trim: true,
            default: "",
        },
        courtRecordCheck: {
            type: String,
            trim: true,
            default: "Clear",
        },

        // 6. Documents (13-document vault)
        documents: {
            fatherAadharCard: { type: String, default: "" },
            motherAadharCard: { type: String, default: "" },
            employeeAadharFront: { type: String, default: "" },
            employeePanCard: { type: String, default: "" },
            schoolingMarksheet10th: { type: String, default: "" },
            schoolingMarksheet12th: { type: String, default: "" },
            degreeCertificate: { type: String, default: "" },
            bankPassbook: { type: String, default: "" },
            offerLetter: { type: String, default: "" },
            lastCompanySalarySlip: { type: String, default: "" },
            policeVerificationCert: { type: String, default: "" },
            healthFitnessCert: { type: String, default: "" },
            relievingLetter: { type: String, default: "" },
        },
        documentsUploaded: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalDocuments: {
            type: Number,
            default: EMPLOYEE_DOCUMENT_KEYS.length,
        },

        // Record metadata
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

employeeSchema.index({ department: 1 });
employeeSchema.index({ employmentStatus: 1 });
employeeSchema.index({ policeVerificationStatus: 1 });
employeeSchema.index({ createdAt: -1 });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

module.exports = {
    Employee,
    EMPLOYEE_DOCUMENT_KEYS,
};
