const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { Employee, EMPLOYEE_DOCUMENT_KEYS } = require("../models/employeeModel");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_DOCUMENT_LABELS = {
    fatherAadharCard: "Father's Aadhaar Card",
    motherAadharCard: "Mother's Aadhaar Card",
    employeeAadharFront: "Employee Aadhaar Card",
    employeePanCard: "Employee PAN Card",
    bankPassbook: "Bank Passbook / Cancelled Cheque",
};

const UPLOAD_DIR = path.resolve(__dirname, "../../public/Uploads");

const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveUserId = (req) => {
    const candidateId = req.authUser?._id || req.user?._id || req.headers["x-user-id"];
    return candidateId && mongoose.isValidObjectId(candidateId) ? candidateId : null;
};

const getUploadedFilesList = (req) => {
    if (Array.isArray(req.files)) return req.files;
    if (req.files && typeof req.files === "object") {
        return Object.values(req.files).flat();
    }
    if (req.file) return [req.file];
    return [];
};

const cleanupUploadedFiles = async (req) => {
    const files = getUploadedFilesList(req);
    await Promise.all(
        files.map(async (file) => {
            if (!file?.path) return;
            try {
                await fs.promises.unlink(file.path);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error("Unable to remove unlinked employee file:", error);
                }
            }
        })
    );
};

const removeStoredFileByUrl = async (fileUrl) => {
    if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.includes("/uploads/")) return;
    try {
        const filename = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop());
        if (filename && path.basename(filename) === filename) {
            await fs.promises.unlink(path.resolve(UPLOAD_DIR, filename));
        }
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Unable to remove stored employee file:", error);
        }
    }
};

const buildUploadUrl = (req, filename) =>
    `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(filename)}`;

const parseEmployeeBody = (req) => {
    const raw = req.body || {};
    let payload = raw;

    const jsonField = typeof raw.employee === "string"
        ? raw.employee
        : typeof raw.data === "string"
            ? raw.data
            : null;

    if (jsonField) {
        try {
            payload = JSON.parse(jsonField);
        } catch {
            const error = new Error("Invalid employee payload JSON.");
            error.statusCode = 400;
            throw error;
        }
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        const error = new Error("Employee payload must be an object.");
        error.statusCode = 400;
        throw error;
    }

    return {
        ...payload,
        documents: payload.documents && typeof payload.documents === "object" && !Array.isArray(payload.documents)
            ? { ...payload.documents }
            : {},
    };
};

const applyUploadedFilesToPayload = (req, payload) => {
    const files = getUploadedFilesList(req);
    for (const file of files) {
        const url = buildUploadUrl(req, file.filename);
        if (file.fieldname === "avatar") {
            payload.avatar = url;
            continue;
        }
        const docKey = file.fieldname.startsWith("doc_")
            ? file.fieldname.slice(4)
            : file.fieldname;
        if (EMPLOYEE_DOCUMENT_KEYS.includes(docKey)) {
            payload.documents[docKey] = url;
        }
    }
    return payload;
};

const countUploadedDocuments = (documents = {}) =>
    EMPLOYEE_DOCUMENT_KEYS.reduce(
        (count, key) => (documents?.[key] ? count + 1 : count),
        0
    );

const parseSalaryNumber = (salaryValue) => {
    const numeric = Number(String(salaryValue ?? "").replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : 0;
};

const serializeEmployee = (doc) => {
    if (!doc) return null;
    const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
    const docs = obj.documents || {};
    const uploadedCount = countUploadedDocuments(docs);
    const totalDocs = EMPLOYEE_DOCUMENT_KEYS.length;

    return {
        ...obj,
        id: String(obj._id),
        joiningDate: obj.dateOfJoining || "",
        policeStatus: obj.policeVerificationStatus || "Pending",
        status: obj.employmentStatus || "Active",
        salary: parseSalaryNumber(obj.monthlySalary),
        documents: EMPLOYEE_DOCUMENT_KEYS.reduce((acc, key) => {
            acc[key] = docs[key] || "";
            return acc;
        }, {}),
        documentsUploaded: uploadedCount,
        totalDocuments: totalDocs,
    };
};

const normalizeEmployeeFields = (payload, existing = null) => {
    const sourceDocs = payload.documents || {};
    const existingDocs = existing?.documents || {};
    const normalizedDocs = {};

    for (const key of EMPLOYEE_DOCUMENT_KEYS) {
        if (Object.prototype.hasOwnProperty.call(sourceDocs, key)) {
            normalizedDocs[key] = typeof sourceDocs[key] === "string" ? sourceDocs[key].trim() : "";
        } else if (existing) {
            normalizedDocs[key] = existingDocs[key] || "";
        } else {
            normalizedDocs[key] = "";
        }
    }

    const trimStr = (val, fallback = "") =>
        typeof val === "string" ? val.trim() : val === undefined ? fallback : String(val || "").trim();

    const pick = (key, fallback = "") =>
        Object.prototype.hasOwnProperty.call(payload, key)
            ? trimStr(payload[key], fallback)
            : existing
                ? trimStr(existing[key], fallback)
                : fallback;

    const hasPrevExp = Object.prototype.hasOwnProperty.call(payload, "hasPreviousExperience")
        ? Boolean(payload.hasPreviousExperience === true || payload.hasPreviousExperience === "true")
        : Boolean(existing?.hasPreviousExperience);

    const rawCode = pick("employeeCode");
    const employeeCode = rawCode
        ? rawCode.toUpperCase()
        : existing?.employeeCode || `MSJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    return {
        name: pick("name"),
        employeeCode,
        email: pick("email").toLowerCase(),
        personalEmail: pick("personalEmail").toLowerCase(),
        phone: pick("phone"),
        gender: pick("gender", "Male") || "Male",
        dob: pick("dob"),
        bloodGroup: pick("bloodGroup"),
        avatar: Object.prototype.hasOwnProperty.call(payload, "avatar")
            ? trimStr(payload.avatar)
            : existing?.avatar || "",
        currentAddress: pick("currentAddress"),
        permanentAddress: pick("permanentAddress"),
        emergencyContact: pick("emergencyContact"),

        fatherName: pick("fatherName"),
        fatherContact: pick("fatherContact"),
        fatherOccupation: pick("fatherOccupation"),
        motherName: pick("motherName"),
        motherContact: pick("motherContact"),
        guardianRelation: pick("guardianRelation", "Father") || "Father",
        familyAddress: pick("familyAddress"),

        hasPreviousExperience: hasPrevExp,
        lastCompanyName: pick("lastCompanyName"),
        lastDesignation: pick("lastDesignation"),
        lastDepartment: pick("lastDepartment"),
        tenureFrom: pick("tenureFrom"),
        tenureTo: pick("tenureTo"),
        lastDrawnSalary: pick("lastDrawnSalary"),
        reasonForLeaving: pick("reasonForLeaving"),
        reportingManagerName: pick("reportingManagerName"),
        reportingManagerPhone: pick("reportingManagerPhone"),
        lastCompanyAddress: pick("lastCompanyAddress"),
        lastBankName: pick("lastBankName"),
        lastAccountNumber: pick("lastAccountNumber"),
        lastIfsc: pick("lastIfsc").toUpperCase(),

        department: pick("department"),
        designation: pick("designation"),
        dateOfJoining: pick("dateOfJoining") || pick("joiningDate"),
        employmentType: pick("employmentType", "Full-Time") || "Full-Time",
        employmentStatus: pick("employmentStatus") || pick("status") || "Active",
        reportingManager: pick("reportingManager"),
        monthlySalary: pick("monthlySalary") || (payload.salary !== undefined ? String(payload.salary) : existing?.monthlySalary || ""),
        ctc: pick("ctc"),
        bankName: pick("bankName"),
        accountHolderName: pick("accountHolderName"),
        accountNumber: pick("accountNumber"),
        ifscCode: pick("ifscCode").toUpperCase(),
        branchName: pick("branchName"),
        accountType: pick("accountType", "Salary Account") || "Salary Account",

        healthStatus: pick("healthStatus", "Pending") || "Pending",
        checkupDate: pick("checkupDate"),
        medicalClinicName: pick("medicalClinicName"),
        bloodPressure: pick("bloodPressure"),
        allergies: pick("allergies"),
        chronicConditions: pick("chronicConditions"),
        insurancePolicyNo: pick("insurancePolicyNo"),
        healthNotes: pick("healthNotes"),
        policeVerificationStatus:
            pick("policeVerificationStatus") || pick("policeStatus") || "Pending",
        policeStation: pick("policeStation"),
        verificationRefNo: pick("verificationRefNo"),
        verificationDate: pick("verificationDate"),
        policeOfficerRemarks: pick("policeOfficerRemarks"),
        courtRecordCheck: pick("courtRecordCheck", "Clear") || "Clear",

        documents: normalizedDocs,
        documentsUploaded: countUploadedDocuments(normalizedDocs),
        totalDocuments: EMPLOYEE_DOCUMENT_KEYS.length,
    };
};

const validateEmployeeData = (data) => {
    if (!data.name) return "Employee full name is required.";
    if (!data.email || !EMAIL_REGEX.test(data.email)) {
        return "A valid official email address is required.";
    }
    if (data.personalEmail && !EMAIL_REGEX.test(data.personalEmail)) {
        return "Personal email address is invalid.";
    }
    if (!data.phone) return "Mobile phone number is required.";
    if (!data.fatherName) return "Father's full name is required.";
    if (!data.department) return "Department is required.";
    if (!data.designation) return "Designation is required.";
    if (!data.accountNumber) return "Bank account number is required.";
    if (!data.ifscCode) return "Bank IFSC code is required.";

    for (const [key, label] of Object.entries(REQUIRED_DOCUMENT_LABELS)) {
        if (!data.documents?.[key]) {
            return `Please upload required document: ${label}.`;
        }
    }

    return null;
};

const findEmployeeByParam = async (id) => {
    if (mongoose.isValidObjectId(id)) {
        const byId = await Employee.findById(id);
        if (byId) return byId;
    }
    const normalizedCode = String(id || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    return Employee.findOne({ employeeCode: normalizedCode });
};

exports.createEmployee = async (req, res) => {
    try {
        const payload = applyUploadedFilesToPayload(req, parseEmployeeBody(req));
        const normalized = normalizeEmployeeFields(payload);

        const validationError = validateEmployeeData(normalized);
        if (validationError) {
            await cleanupUploadedFiles(req);
            return res.status(400).json({ success: false, message: validationError });
        }

        const existingCode = await Employee.findOne({ employeeCode: normalized.employeeCode });
        if (existingCode) {
            await cleanupUploadedFiles(req);
            return res.status(409).json({
                success: false,
                message: `Employee code "${normalized.employeeCode}" is already registered.`,
            });
        }

        const actorUserId = resolveUserId(req);
        const employee = await Employee.create({
            ...normalized,
            createdBy: actorUserId,
        });

        return res.status(201).json({
            success: true,
            message: "Employee onboarded successfully.",
            data: serializeEmployee(employee),
        });
    } catch (error) {
        await cleanupUploadedFiles(req);
        const statusCode =
            error.statusCode ||
            (error.code === 11000 ? 409 : error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.code === 11000 ? "Employee code already exists." : error.message,
        });
    }
};

exports.getAllEmployees = async (req, res) => {
    try {
        const {
            search = "",
            department,
            status,
            employmentStatus,
            policeStatus,
            policeVerificationStatus,
            page = 1,
            limit = 100,
        } = req.query;

        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
        const skip = (pageNumber - 1) * pageSize;

        const filter = {};

        if (department && !["All", "All Departments"].includes(department)) {
            filter.department = department;
        }

        const statusFilter = employmentStatus || status;
        if (statusFilter && !["All", "All Employment Statuses"].includes(statusFilter)) {
            filter.employmentStatus = statusFilter;
        }

        const policeFilter = policeVerificationStatus || policeStatus;
        if (policeFilter && !["All", "All Police Statuses"].includes(policeFilter)) {
            if (["In Progress", "Under Process"].includes(policeFilter)) {
                filter.policeVerificationStatus = { $in: ["In Progress", "Under Process"] };
            } else {
                filter.policeVerificationStatus = policeFilter;
            }
        }

        if (search.trim()) {
            const regex = new RegExp(escapeRegex(search.trim()), "i");
            filter.$or = [
                { name: regex },
                { employeeCode: regex },
                { email: regex },
                { personalEmail: regex },
                { phone: regex },
                { department: regex },
                { designation: regex },
            ];
        }

        const [employees, total] = await Promise.all([
            Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
            Employee.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: employees.map(serializeEmployee),
            pagination: {
                total,
                currentPage: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: pageNumber * pageSize < total,
                hasPrevPage: pageNumber > 1,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await findEmployeeByParam(req.params.id);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found.",
            });
        }

        return res.status(200).json({
            success: true,
            data: serializeEmployee(employee),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const existing = await findEmployeeByParam(req.params.id);
        if (!existing) {
            await cleanupUploadedFiles(req);
            return res.status(404).json({
                success: false,
                message: "Employee not found.",
            });
        }

        const payload = applyUploadedFilesToPayload(req, parseEmployeeBody(req));
        const normalized = normalizeEmployeeFields(payload, existing);

        const validationError = validateEmployeeData(normalized);
        if (validationError) {
            await cleanupUploadedFiles(req);
            return res.status(400).json({ success: false, message: validationError });
        }

        const duplicateCode = await Employee.findOne({
            employeeCode: normalized.employeeCode,
            _id: { $ne: existing._id },
        });
        if (duplicateCode) {
            await cleanupUploadedFiles(req);
            return res.status(409).json({
                success: false,
                message: `Employee code "${normalized.employeeCode}" belongs to another employee.`,
            });
        }

        const urlsToDelete = [];
        if (existing.avatar && existing.avatar !== normalized.avatar) {
            urlsToDelete.push(existing.avatar);
        }
        for (const key of EMPLOYEE_DOCUMENT_KEYS) {
            const oldUrl = existing.documents?.[key];
            const newUrl = normalized.documents?.[key];
            if (oldUrl && oldUrl !== newUrl) {
                urlsToDelete.push(oldUrl);
            }
        }

        const actorUserId = resolveUserId(req);
        const updated = await Employee.findByIdAndUpdate(
            existing._id,
            {
                $set: {
                    ...normalized,
                    ...(actorUserId ? { lastUpdatedBy: actorUserId } : {}),
                },
            },
            { new: true, runValidators: true }
        );

        await Promise.all(urlsToDelete.map(removeStoredFileByUrl));

        return res.status(200).json({
            success: true,
            message: "Employee record updated successfully.",
            data: serializeEmployee(updated),
        });
    } catch (error) {
        await cleanupUploadedFiles(req);
        const statusCode =
            error.statusCode ||
            (error.code === 11000 ? 409 : error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.code === 11000 ? "Employee code already exists." : error.message,
        });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const existing = await findEmployeeByParam(req.params.id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found.",
            });
        }

        await Employee.findByIdAndDelete(existing._id);

        const urlsToDelete = [
            existing.avatar,
            ...EMPLOYEE_DOCUMENT_KEYS.map((key) => existing.documents?.[key]),
        ].filter(Boolean);
        await Promise.all(urlsToDelete.map(removeStoredFileByUrl));

        return res.status(200).json({
            success: true,
            message: "Employee deleted successfully.",
            data: { _id: existing._id },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
