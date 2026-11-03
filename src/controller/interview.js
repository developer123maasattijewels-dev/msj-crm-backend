


const mongoose = require("mongoose");
const Interview = require("../models/interviewformmodel");

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
            !candidateName ||
            !candidateEmail ||
            !candidatePhone ||
            !department ||
            !candidatePosition ||
            !source
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required candidate details.",
            });
        }

        const candidate = await Interview.create({
            candidateName,
            candidateEmail,
            candidatePhone,
            department,
            candidatePosition,
            source,
            referredBy,
            createdBy: req.user?._id || null,
        });

        res.status(201).json({
            success: true,
            message: "Candidate registered successfully.",
            data: candidate,
        });
    } catch (error) {
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
