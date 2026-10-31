const express = require("express");
const router = express.Router();
const { markAllAsRead, markAsRead, getNotifications, createNotification } = require("../controller/notificationController")

router.post("/create", createNotification)
router.get("/", getNotifications);

router.patch("/read-all", markAllAsRead);

router.patch("/:id/read", markAsRead);

module.exports = router;