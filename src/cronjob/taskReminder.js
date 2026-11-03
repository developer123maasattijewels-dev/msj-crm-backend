const cron = require("node-cron");

const Tasks = require("../models/taskmodel");
const Notification = require("../models/notificationModel");

const createAndSend = async ({
    task,
    type,
    title,
    message
}) => {
    if (!task.assignedTo) return;

    const recipient = task.assignedTo._id || task.assignedTo;

    try {
        await Notification.create({
            recipient,
            task: task._id,
            title,
            message,
            type
        });

        console.log(
            `${type} notification sent for task ${task.taskId}`
        );

    } catch (error) {
        if (error.code === 11000) return;

        console.error("Reminder error:", error);
    }
};

const checkTaskReminders = async () => {
    try {
        const now = new Date();
        const latestReminderDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const activeTasks = await Tasks.find({
            assignedTo: { $ne: null },
            status: { $nin: ["Completed", "completed", "Cancelled", "cancelled"] },
            $or: [
                { dueAt: { $lte: latestReminderDueAt } },
                { dueAt: null, dueDate: { $lte: latestReminderDueAt } }
            ]
        });

        for (const task of activeTasks) {
            const dueAt = task.dueAt || (
                task.dueDate
                    ? new Date(Date.UTC(
                        task.dueDate.getUTCFullYear(),
                        task.dueDate.getUTCMonth(),
                        task.dueDate.getUTCDate(),
                        ...String(task.dueTime || "11:00").split(":").map(Number)
                    ))
                    : null
            );

            if (!dueAt || Number.isNaN(dueAt.getTime())) continue;

            const reminderMinutesBefore = task.reminderMinutesBefore === undefined
                ? 15
                : task.reminderMinutesBefore;

            if (reminderMinutesBefore !== null) {
                const reminderAt = new Date(
                    dueAt.getTime() - reminderMinutesBefore * 60 * 1000
                );

                if (reminderAt <= now) {
                    await createAndSend({
                        task,
                        type: "task_reminder",
                        title: "Task Reminder",
                        message: `Your task "${task.title}" is due ${reminderMinutesBefore === 0
                            ? "now"
                            : `in ${reminderMinutesBefore} minutes`}.`
                    });
                }
            }

            if (dueAt <= now) {
                await createAndSend({
                    task,
                    type: "task_overdue",
                    title: "Task Overdue",
                    message: `Your task "${task.title}" is overdue. Please complete it.`
                });
            }
        }

    } catch (error) {
        console.error("Task reminder cron error:", error);
    }
};

const startTaskReminderCron = () => {
    cron.schedule("*/5 * * * * *", async () => {
        await checkTaskReminders();
    });

    console.log("Task reminder cron started.");
};

module.exports = {
    startTaskReminderCron,
    checkTaskReminders
};