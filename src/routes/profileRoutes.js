const express = require("express");
const authenticateUser = require("../middleware/authenticateUser");
const { getByid, update } = require("../controller/Users");
const {
    getEmailProfile,
    updateEmailProfile,
    testEmailProfile,
    requireEmailProfileAccess
} = require("../controller/profileController");

const router = express.Router();

// Workspace Email / SMTP Profile API (email & appPassword default to blank "")
router.get("/", getEmailProfile);
router.put("/", authenticateUser, requireEmailProfileAccess, updateEmailProfile);
router.get("/email", getEmailProfile);
router.put("/email", authenticateUser, requireEmailProfileAccess, updateEmailProfile);
router.post("/email/test", authenticateUser, requireEmailProfileAccess, testEmailProfile);
router.post("/test-email", authenticateUser, requireEmailProfileAccess, testEmailProfile);

// Individual User Profile aliases
router.get("/:id", getByid);
router.put("/:id", update);

module.exports = router;

