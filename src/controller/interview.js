


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
