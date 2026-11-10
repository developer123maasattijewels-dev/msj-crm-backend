
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const authenticateUser = require("../middleware/authenticateUser");

const router = express.Router();

const {
    getModules,
    assignAccess,
    getUserAccess,
    getAllAccess
} = require("../controller/access");


// Get all sidebar modules
router.get("/modules", getModules);

// Assign or update employee access
router.post("/assign", requireAdmin, assignAccess);

// Get particular employee access
router.get("/user/:userId", authenticateUser, getUserAccess);
router.get("/all", requireAdmin, getAllAccess);


module.exports = router;