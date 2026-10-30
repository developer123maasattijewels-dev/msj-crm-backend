
const mongoose = require("mongoose");
const notification = require("../models/notificationModel");

const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const notifications = await notification.find({
            recipient: userId
        })
            .populate("task")
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            notifications,
            unreadCount
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID"
            });
        }

        const notification = await Notification.findOneAndUpdate(
            {
                _id: id,
                recipient: req.user._id
            },
            {
                isRead: true,
                readAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                recipient: req.user._id,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};