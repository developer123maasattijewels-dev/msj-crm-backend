
const mongoose = require("mongoose");
const notification = require("../models/notificationModel");


const createNotification = async (req, res) => {
    try {
        const {
            recipient,
            task,
            title,
            message,
            type
        } = req.body;

        if (
            !mongoose.isValidObjectId(recipient) ||
            !mongoose.isValidObjectId(task)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid recipient and task IDs are required"
            });
        }

        const notifications = await notification.create({
            recipient,
            task,
            title,
            message,
            type
        });

        return res.status(201).json({
            success: true,
            message: "Notification created successfully",
            notifications
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getNotifications = async (req, res) => {
    try {
        const userId = req.query.userId;;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required"
            });
        }
        const notifications = await notification.find({
            recipient: userId
        })
            .populate("task")
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await notification.countDocuments({
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

        const notification = await notification.findOneAndUpdate(
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
        await notification.updateMany(
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
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,

};