


const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Interview = require("../models/interviewformmodel");
const { notifyInterviewEvent } = require("../comman/notificationService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveUserId = (req) => {
    const candidateId = req.authUser?._id || req.user?._id || req.headers["x-user-id"];
    return candidateId && mongoose.isValidObjectId(candidateId) ? candidateId : null;
};

const buildResumeObject = (req) => {
    if (!req.file) return undefined;
    return {
        originalName: req.file.originalname,
        url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(req.file.filename)}`,
        mimeType: req.file.mimetype,
        size: req.file.size,
    };
};

const parseOptionalSalary = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        const error = new Error("Expected salary must be a non-negative number.");
        error.statusCode = 400;
        throw error;
    }
    return parsed;
};

const removeUploadedResume = async (file) => {
    if (!file) return;
    try {
        await fs.promises.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Unable to remove unlinked resume upload:", error);
        }
    }
};

const removeResumeByUrl = async (resumeUrl) => {
    if (!resumeUrl) return;
    try {
        const filename = decodeURIComponent(new URL(resumeUrl).pathname.split("/").pop());
        if (filename && path.basename(filename) === filename) {
            await fs.promises.unlink(path.resolve(__dirname, "../../public/Uploads", filename));
        }
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Unable to remove stored candidate resume:", error);
        }
    }
};

exports.createInterview = async (req, res) => {
    try {
        const body = req.body || {};
        const candidateName = String(body.candidateName ?? body.name ?? "").trim();
        const candidateEmail = String(body.candidateEmail ?? body.email ?? "").trim().toLowerCase();
        const candidatePhone = String(body.candidatePhone ?? body.phone ?? "").trim();
        const department = String(body.department ?? "").trim();
        const candidatePosition = String(body.candidatePosition ?? body.position ?? "").trim();
        const source = String(body.source ?? body.platform ?? "").trim();
        const referredBy = String(body.referredBy ?? "").trim();
        const hiringStatus = String(body.hiringStatus ?? body.selectionStatus ?? "").trim() || "New";
        const trainingStatus = String(body.trainingStatus ?? "").trim() || "Not Started";

        if (
            !candidateName ||
            !candidatePhone ||
            !department ||
            !candidatePosition ||
            !source
        ) {
            await removeUploadedResume(req.file);
            return res.status(400).json({
                success: false,
                message: "Please fill all required candidate details.",
            });
        }

        if (candidateEmail && !EMAIL_REGEX.test(candidateEmail)) {
            await removeUploadedResume(req.file);
            return res.status(400).json({
                success: false,
                message: "Enter a valid candidate email address.",
            });
        }

        const expectedSalary = parseOptionalSalary(body.expectedSalary ?? body.proposedSalary);
        const actorUserId = resolveUserId(req);

        const candidate = await Interview.create({
            candidateName,
            candidateEmail,
            candidatePhone,
            department,
            candidatePosition,
            source,
            referredBy,
            expectedSalary,
            hiringStatus,
            training: {
                status: trainingStatus,
            },
            ...(expectedSalary !== null ? { interview: { proposedSalary: expectedSalary } } : {}),
            resume: buildResumeObject(req),
            createdBy: actorUserId,
        });

        await notifyInterviewEvent({
            candidate,
            eventType: "created",
            senderUserId: actorUserId,
        });

        res.status(201).json({
            success: true,
            message: "Candidate registered successfully.",
            data: candidate,
        });
    } catch (error) {
        await removeUploadedResume(req.file);
        const statusCode = error.statusCode || (error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);
        res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getAllInterviews = async (req, res) => {
    try {
        const {
            search = "",
            department,
            candidatePosition,
            source,
            hiringStatus,
            fromDate,
            toDate,
            page = 1,
            limit = 10,
        } = req.query;

        // Pagination
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(limit, 10) || 10)
        );
        const skip = (pageNumber - 1) * pageSize;

        // Filter
        const filter = {};

        if (department && !["All", "All Departments"].includes(department)) {
            filter.department = department;
        }

        if (candidatePosition && candidatePosition.trim()) {
            filter.candidatePosition = new RegExp(escapeRegex(candidatePosition.trim()), "i");
        }

        if (source && source.trim()) {
            filter.source = new RegExp(escapeRegex(source.trim()), "i");
        }

        if (hiringStatus && !["All", "All Statuses"].includes(hiringStatus)) {
            filter.hiringStatus = hiringStatus;
        }

        if (fromDate || toDate) {
            const createdAtFilter = {};
            if (fromDate) {
                const start = new Date(`${fromDate}T00:00:00.000Z`);
                if (!Number.isNaN(start.getTime())) {
                    createdAtFilter.$gte = start;
                }
            }
            if (toDate) {
                const end = new Date(`${toDate}T23:59:59.999Z`);
                if (!Number.isNaN(end.getTime())) {
                    createdAtFilter.$lte = end;
                }
            }
            if (Object.keys(createdAtFilter).length > 0) {
                filter.createdAt = createdAtFilter;
            }
        }

        // Search by name, email, phone, position, department or referrer
        if (search.trim()) {
            const regex = new RegExp(escapeRegex(search.trim()), "i");

            filter.$or = [
                { candidateName: regex },
                { candidateEmail: regex },
                { candidatePhone: regex },
                { candidatePosition: regex },
                { department: regex },
                { referredBy: regex },
            ];
        }

        // Fetch data and total count
        const [interviews, total] = await Promise.all([
            Interview.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize),

            Interview.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: interviews,
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
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getInterviewById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid candidate ID.",
            });
        }

        const candidate = await Interview.findById(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: "Candidate not found.",
            });
        }

        return res.status(200).json({
            success: true,
            data: candidate,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateInterview = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            await removeUploadedResume(req.file);
            return res.status(400).json({
                success: false,
                message: "Invalid candidate ID.",
            });
        }

        const candidate = await Interview.findById(id);
        if (!candidate) {
            await removeUploadedResume(req.file);
            return res.status(404).json({
                success: false,
                message: "Candidate not found.",
            });
        }

        let body = req.body || {};
        if (typeof body.profile === "string") {
            try {
                body = JSON.parse(body.profile);
            } catch {
                await removeUploadedResume(req.file);
                return res.status(400).json({
                    success: false,
                    message: "Invalid candidate profile data.",
                });
            }
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            await removeUploadedResume(req.file);
            return res.status(400).json({
                success: false,
                message: "Candidate profile data must be an object.",
            });
        }
        const updates = {};
        const topLevelFields = [
            "candidateName",
            "candidateEmail",
            "candidatePhone",
            "department",
            "candidatePosition",
            "source",
            "referredBy",
            "expectedSalary",
            "hiringStatus",
        ];
        const nestedFields = {
            interview: [
                "interviewDate",
                "interviewer",
                "feedback",
                "rating",
                "offeredPosition",
                "proposedSalary",
                "interviewStatus",
                "interviewMode",
                "remarks",
            ],
            training: [
                "trainingDepartment",
                "startDate",
                "expectedEndDate",
                "reviewDueDate",
                "progress",
                "status",
                "remarks",
            ],
            review: [
                "reviewDate",
                "attendanceRating",
                "performanceRating",
                "behaviourRating",
                "feedback",
                "decision",
                "nextReviewDate",
            ],
            joining: [
                "approvalDate",
                "joiningDate",
                "employeeId",
                "employmentType",
                "probationMonths",
            ],
            salary: [
                "monthlySalary",
                "salaryType",
                "basicSalary",
                "allowances",
                "deductions",
                "effectiveFrom",
                "paymentMode",
                "salaryApproved",
            ],
        };

        for (const field of topLevelFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates[field] = body[field];
            }
        }

        for (const [group, fields] of Object.entries(nestedFields)) {
            const values = body[group];
            if (!values || typeof values !== "object" || Array.isArray(values)) {
                continue;
            }
            for (const field of fields) {
                if (Object.prototype.hasOwnProperty.call(values, field)) {
                    updates[`${group}.${field}`] = values[field];
                }
            }
        }

        if (Object.keys(updates).length === 0 && !req.file) {
            return res.status(400).json({
                success: false,
                message: "No editable candidate fields were provided.",
            });
        }

        for (const field of ["candidateName", "candidatePhone", "department", "candidatePosition", "source"]) {
            if (Object.prototype.hasOwnProperty.call(updates, field)) {
                if (typeof updates[field] !== "string" || !updates[field].trim()) {
                    await removeUploadedResume(req.file);
                    return res.status(400).json({
                        success: false,
                        message: `${field} is required.`,
                    });
                }
                updates[field] = updates[field].trim();
            }
        }

        if (Object.prototype.hasOwnProperty.call(updates, "candidateEmail")) {
            updates.candidateEmail = typeof updates.candidateEmail === "string"
                ? updates.candidateEmail.trim().toLowerCase()
                : "";
            if (updates.candidateEmail && !EMAIL_REGEX.test(updates.candidateEmail)) {
                await removeUploadedResume(req.file);
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid candidate email address.",
                });
            }
        }
        if (Object.prototype.hasOwnProperty.call(updates, "referredBy")) {
            updates.referredBy = typeof updates.referredBy === "string" ? updates.referredBy.trim() : "";
        }
        if (Object.prototype.hasOwnProperty.call(updates, "expectedSalary")) {
            updates.expectedSalary = parseOptionalSalary(updates.expectedSalary);
        }

        const previousResumeUrl = candidate.resume?.url;
        const nextResume = buildResumeObject(req);
        if (nextResume) {
            updates.resume = nextResume;
        }
        const actorUserId = resolveUserId(req);
        if (actorUserId) {
            updates.lastUpdatedBy = actorUserId;
        }

        const updatedCandidate = await Interview.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        const statusOrScheduleChanged =
            (updates.hiringStatus && updates.hiringStatus !== candidate.hiringStatus) ||
            (updates["interview.interviewStatus"] && updates["interview.interviewStatus"] !== candidate.interview?.interviewStatus) ||
            (updates["interview.interviewDate"] &&
                String(updates["interview.interviewDate"]) !== String(candidate.interview?.interviewDate || ""));

        if (statusOrScheduleChanged) {
            await notifyInterviewEvent({
                candidate: updatedCandidate,
                eventType: "updated",
                senderUserId: actorUserId,
            });
        }

        if (req.file && previousResumeUrl) {
            await removeResumeByUrl(previousResumeUrl);
        }

        return res.status(200).json({
            success: true,
            message: "Candidate profile updated successfully.",
            data: updatedCandidate,
        });
    } catch (error) {
        await removeUploadedResume(req.file);
        const statusCode = error.statusCode || (error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};

exports.deleteInterview = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid candidate ID.",
            });
        }

        const deletedCandidate = await Interview.findByIdAndDelete(id);
        if (!deletedCandidate) {
            return res.status(404).json({
                success: false,
                message: "Candidate not found.",
            });
        }

        if (deletedCandidate.resume?.url) {
            await removeResumeByUrl(deletedCandidate.resume.url);
        }

        return res.status(200).json({
            success: true,
            message: "Candidate deleted successfully.",
            data: { _id: deletedCandidate._id },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
