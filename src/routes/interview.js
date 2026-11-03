
const express = require("express");
const { createInterview , getAllInterviews } = require("../controller/interview");
const router = express.Router();



// Candidate registration and dashboard
router.post("/add", createInterview);
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