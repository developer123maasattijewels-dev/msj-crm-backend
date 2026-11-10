
const express = require("express");

const router = express.Router();

const {
    getModules,
    assignAccess,
    getUserAccess
} = require("../controller/access");


// Get all sidebar modules
router.get("/modules", getModules);

// Assign or update employee access
router.post("/assign", assignAccess);

// Get particular employee access
router.get("/user/:userId", getUserAccess);


module.exports = router;