


const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Interview = require("../models/interviewformmodel");

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

exports.createInterview = async (req, res) => {
    try {
        const {
            candidateName,
            candidateEmail,
            candidatePhone,
            department,
            candidatePosition,
            source,
            referredBy,
        } = req.body;

        if (
            !candidateName?.trim() ||
            !candidateEmail?.trim() ||
            !candidatePhone?.trim() ||
            !department?.trim() ||
            !candidatePosition?.trim() ||
            !source?.trim()
        ) {
            await removeUploadedResume(req.file);
            return res.status(400).json({
                success: false,
                message: "Please fill all required candidate details.",
            });
        }

      
        const candidate = await Interview.create({
            candidateName: candidateName.trim(),
            candidateEmail: candidateEmail.trim().toLowerCase(),
            candidatePhone: candidatePhone.trim(),
            department: department.trim(),
            candidatePosition: candidatePosition.trim(),
            source: source.trim(),
            referredBy: referredBy?.trim() || "",
            resume: req.file
                ? {
                    originalName: req.file.originalname,
                    url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(req.file.filename)}`,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                }
                : undefined,
            createdBy: req.user?._id || null,
        });


        res.status(201).json({
            success: true,
            message: "Candidate registered successfully.",
            data: candidate,
        });
    } catch (error) {
        await removeUploadedResume(req.file);
        res.status(500).json({
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
            page = 1,
            limit = 10,
        } = req.query;

        // Pagination
        const pageNumber = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(limit) || 10)
        );
        const skip = (pageNumber - 1) * pageSize;

        // Filter
        const filter = {};

        if (department) {
            filter.department = department;
        }

        if (candidatePosition) {
            filter.candidatePosition = candidatePosition;
        }

        if (source) {
            filter.source = source;
        }

        // Search by name, email, phone or position
        if (search.trim()) {
            const escapedSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            const regex = new RegExp(escapedSearch, "i");

            filter.$or = [
                { candidateName: regex },
                { candidateEmail: regex },
                { candidatePhone: regex },
                { candidatePosition: regex },
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

        for (const field of ["candidateName", "candidateEmail", "candidatePhone", "department", "candidatePosition", "source"]) {
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

        if (updates.candidateEmail) {
            updates.candidateEmail = updates.candidateEmail.toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.candidateEmail)) {
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

        const previousResumeUrl = candidate.resume?.url;
        if (req.file) {
            updates.resume = {
                originalName: req.file.originalname,
                url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(req.file.filename)}`,
                mimeType: req.file.mimetype,
                size: req.file.size,
            };
        }
        if (req.user?._id) {
            updates.lastUpdatedBy = req.user._id;
        }

        const updatedCandidate = await Interview.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (req.file && previousResumeUrl) {
            try {
                const previousFilename = decodeURIComponent(new URL(previousResumeUrl).pathname.split("/").pop());
                if (path.basename(previousFilename) === previousFilename) {
                    await fs.promises.unlink(path.resolve(__dirname, "../../public/Uploads", previousFilename));
                }
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error("Unable to remove replaced candidate resume:", error);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Candidate profile updated successfully.",
            data: updatedCandidate,
        });
    } catch (error) {
        await removeUploadedResume(req.file);
        const statusCode = error.name === "ValidationError" || error.name === "CastError" ? 400 : 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};
