
const mongoose = require("mongoose");
const Notification = require("../models/notificationModel");


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

        const notifications = await Notification.create({
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
        const userId = req.query.userId;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required"
            });
        }
        const notifications = await Notification.find({
            recipient: userId
        })
            .populate("task", "taskId title dueAt dueDate dueTime")
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

        const userId = req.user?._id || req.query.userId;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required"
            });
        }

        const updatedNotification = await Notification.findOneAndUpdate(
            {
                _id: id,
                recipient: userId
            },
            {
                isRead: true,
                readAt: new Date()
            },
            { new: true }
        );

        if (!updatedNotification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification: updatedNotification
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
        const userId = req.user?._id || req.query.userId;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required"
            });
        }

        await Notification.updateMany(
            {
                recipient: userId,
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