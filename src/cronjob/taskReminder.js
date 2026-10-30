const cron = require("node-cron");

const Tasks = require("../models/taskmodel");
const Notification = require("../models/notificationModel");

const { sendNotification } = require("../sockets/socket");

const createAndSend = async ({
    task,
    type,
    title,
    message
}) => {
    if (!task.assignedTo) return;

    const recipient = task.assignedTo._id || task.assignedTo;

    try {
        const notification = await Notification.create({
            recipient,
            task: task._id,
            title,
            message,
            type
        });

        sendNotification(
            recipient.toString(),
            {
                _id: notification._id,
                task: task._id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                isRead: false,
                createdAt: notification.createdAt
            }
        );

        console.log(
            `${type} notification sent for task ${task.taskId}`
        );

    } catch (error) {
        // Duplicate notification is expected on subsequent cron runs.
        if (error.code === 11000) return;

        console.error("Reminder error:", error);
    }
};

const checkTaskReminders = async () => {
    try {
        const now = new Date();

        const fifteenMinutesLater = new Date(
            now.getTime() + 15 * 60 * 1000
        );

        const excludedStatuses = [
            "completed",
            "cancelled"
        ];

        // 1. Upcoming tasks: due within the next 15 minutes.
        const upcomingTasks = await Tasks.find({
            dueDate: {
                $gt: now,
                $lte: fifteenMinutesLater
            },
            assignedTo: { $ne: null },
            status: {
                $nin: excludedStatuses
            }
        });

        for (const task of upcomingTasks) {
            await createAndSend({
                task,
                type: "task_reminder",
                title: "Task Reminder",
                message: `Your task "${task.title}" is due within 15 minutes.`
            });
        }

        // 2. Overdue tasks.
        const overdueTasks = await Tasks.find({
            dueDate: {
                $lte: now
            },
            assignedTo: { $ne: null },
            status: {
                $nin: excludedStatuses
            }
        });

        for (const task of overdueTasks) {
            await createAndSend({
                task,
                type: "task_overdue",
                title: "Task Overdue",
                message: `Your task "${task.title}" is overdue. Please complete it.`
            });
        }

    } catch (error) {
        console.error("Task reminder cron error:", error);
    }
};

const startTaskReminderCron = () => {
    cron.schedule("* * * * *", async () => {
        console.log("Checking task reminders...");

        await checkTaskReminders();
    });

    console.log("Task reminder cron started.");
};

module.exports = {
    startTaskReminderCron,
    checkTaskReminders
};