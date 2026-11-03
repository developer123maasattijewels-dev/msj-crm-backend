
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const {
    createInterview,
    getAllInterviews,
    getInterviewById,
    updateInterview,
} = require("../controller/interview");
const router = express.Router();

const uploadDirectory = path.resolve(__dirname, "../../public/Uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedResumeTypes = new Map([
    [".pdf", "application/pdf"],
    [".doc", "application/msword"],
    [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

const resumeUpload = multer({
    storage: multer.diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
            callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
        },
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedResumeTypes.get(extension) !== file.mimetype) {
            return callback(new Error("Upload a PDF, DOC, or DOCX resume."));
        }
        callback(null, true);
    },
});

const handleResumeUpload = (req, res, next) => {
    resumeUpload.single("resume")(req, res, (error) => {
        if (error) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Resume must be 5 MB or smaller."
                : error.message;
            return res.status(400).json({ success: false, message });
        }
        next();
    });
};

// Candidate registration and dashboard
router.post("/add", handleResumeUpload, createInterview);
router.get("/candidate/:id", getInterviewById);
router.patch("/candidate/:id", handleResumeUpload, updateInterview);
router.get("/", getAllInterviews);

// // Individual candidate
// router.get("/:id", getInterviewById);
// router.put("/:id", updateInterview);
// router.delete("/:id", deleteInterview);

// // Hiring workflow
// router.patch("/:id/stage", updateHiringStage);
// router.patch("/:id/training", assignTraining);
// router.patch("/:id/review", submitReview);
// router.patch("/:id/joining", updateJoining);
// router.patch("/:id/salary", updateSalary);

module.exports = router;