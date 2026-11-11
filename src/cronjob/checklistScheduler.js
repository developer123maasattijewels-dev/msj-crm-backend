const cron = require("node-cron");
const Checklists = require("../models/cheacklist");
const Tasks = require("../models/taskmodel");
const { notifyChecklistEvent } = require("../comman/notificationService");

const timezone = "Asia/Kolkata";

const getDateKey = value => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const getTodayKey = () => {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (dateKey, amount) => {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
};

const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const isScheduledOn = (checklist, dateKey) => {
    const startKey = getDateKey(checklist.plannedDate);
    if (!startKey || dateKey < startKey) return false;

    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const start = new Date(`${startKey}T00:00:00.000Z`);
    const frequency = checklist.frequency;

    if (frequency === "Daily") return true;
    if (frequency === "Weekly") {
        return Array.isArray(checklist.weeklyDays) &&
            checklist.weeklyDays.map(Number).includes(date.getUTCDay());
    }

    if (frequency === "Monthly" || frequency === "Quarterly") {
        const monthDifference = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
            date.getUTCMonth() - start.getUTCMonth();
        if (frequency === "Quarterly" && monthDifference % 3 !== 0) return false;
        if (frequency === "Monthly" && monthDifference < 0) return false;

        const requestedDay = frequency === "Monthly"
            ? Number(checklist.monthlyDay)
            : start.getUTCDate();
        return date.getUTCDate() === Math.min(requestedDay, daysInMonth(date.getUTCFullYear(), date.getUTCMonth()));
    }

    if (frequency === "Yearly") {
        if (date.getUTCMonth() !== start.getUTCMonth()) return false;
        return date.getUTCDate() === Math.min(
            start.getUTCDate(),
            daysInMonth(date.getUTCFullYear(), date.getUTCMonth())
        );
    }

    if (frequency === "Custom") {
        const interval = Number(checklist.customIntervalDays);
        const elapsedDays = (date.getTime() - start.getTime()) / 86400000;
        return Number.isInteger(interval) && interval > 0 && elapsedDays % interval === 0;
    }

    return false;
};

const makeDueAt = (dateKey, time) => {
    const [hours, minutes] = String(time || "09:00").split(":").map(Number);
    if (!Number.isInteger(hours) || hours < 0 || hours > 23 ||
        !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid task time "${time}" for checklist.`);
    }
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes) - 330 * 60000);
};

const generateOccurrence = async (checklist, dateKey) => {
    const occurrenceKey = `${checklist._id}:${dateKey}`;
    const dueAt = makeDueAt(dateKey, checklist.reminderStartingTime);
    const reminderDays = Number(checklist.setReminderBeforeDays) || 0;

    try {
        const createdTask = await Tasks.create({
            title: checklist.taskName,
            description: checklist.message,
            taskType: "Checklist",
            instructions: checklist.message,
            assignedBy: checklist.assignedBy || "Checklist scheduler",
            assignedTo: checklist.assignedTo,
            assignPC: checklist.assignPC || null,
            notifyPCTeamUsersWhenDue: checklist.notifyMe ? checklist.notifyPCTeamUsersWhenDue : [],
            notifyPCTeamWhenDue: checklist.notifyMe && checklist.notifyPCTeamWhenDue,
            dueDate: new Date(`${dateKey}T00:00:00.000Z`),
            dueAt,
            dueTime: checklist.reminderStartingTime || "09:00",
            reminderMinutesBefore: checklist.setReminder && reminderDays > 0
                ? Math.min(reminderDays * 1440, 1440)
                : null,
            priority: checklist.priority,
            status: "Pending",
            recurrence: { enabled: false, frequency: "" },
            checklistId: checklist._id,
            checklistOccurrenceKey: occurrenceKey
        });
        console.log(`Recurring checklist task created: ${occurrenceKey}`);
        await notifyChecklistEvent({
            checklist,
            eventType: "due",
            task: createdTask
        });
    } catch (error) {
        if (error.code === 11000) return;
        throw error;
    }
};

const processChecklist = async (checklist, todayKey) => {
    const startKey = getDateKey(checklist.plannedDate);
    const lastProcessedKey = getDateKey(checklist.lastProcessedDate);
    let dateKey = lastProcessedKey ? addDays(lastProcessedKey, 1) : todayKey;
    if (dateKey < startKey) dateKey = startKey;

    while (dateKey <= todayKey) {
        if (isScheduledOn(checklist, dateKey)) {
            await generateOccurrence(checklist, dateKey);
        }
        dateKey = addDays(dateKey, 1);
    }

    if (!lastProcessedKey || lastProcessedKey < todayKey) {
        await Checklists.updateOne(
            { _id: checklist._id },
            { $set: { lastProcessedDate: new Date(`${todayKey}T00:00:00.000Z`) } }
        );
    }
};

const generateDueChecklistTasks = async () => {
    const todayKey = getTodayKey();
    const checklists = await Checklists.find({
        isActive: { $ne: false },
        frequency: { $in: ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Custom"] },
        plannedDate: { $ne: null, $lte: new Date(`${todayKey}T23:59:59.999Z`) },
        assignedTo: { $ne: null }
    });

    for (const checklist of checklists) {
        try {
            await processChecklist(checklist, todayKey);
        } catch (error) {
            console.error(`Recurring checklist scheduler failed for ${checklist._id}:`, error);
        }
    }
};

const startChecklistScheduler = () => {
    cron.schedule("*/5 * * * *", generateDueChecklistTasks, { timezone });
    generateDueChecklistTasks().catch(error => {
        console.error("Checklist scheduler startup run failed:", error);
    });
    console.log("Checklist scheduler started.");
};

module.exports = {
    startChecklistScheduler,
    generateDueChecklistTasks,
    isScheduledOn
};
