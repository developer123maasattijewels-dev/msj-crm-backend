const express = require("express");
const router = express.Router();
const { getNotificatio, markAllAsRead, markAsRead } = require("../controller/notificationController")
router.get("/", auth, getNotifications);

router.patch("/read-all", auth, markAllAsRead);

router.patch("/:id/read", auth, markAsRead);

module.exports = router;