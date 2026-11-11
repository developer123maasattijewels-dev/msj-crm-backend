const Tasks = require("../models/taskmodel");
const mongoose = require("mongoose");
const Leads = require("../models/Leads");
const Users = require("../models/usermodel");
const Checklists = require("../models/cheacklist");
const Notification = require("../models/notificationModel");
const { notifyChecklistEvent, notifyTaskEvent } = require("../comman/notificationService");

const isCompletedStatus = status => String(status || "").toLowerCase() === "completed";

const notifyChecklistCompletion = async (task, senderUserId) => {
    if (!task.checklistId) return;

    try {
        const checklist = await Checklists.findById(task.checklistId)
            .populate("notifyOnCompletionUsers", "name email emailNotificationsEnabled")
            .populate("auditor", "name email emailNotificationsEnabled")
            .populate("assignedTo", "name email emailNotificationsEnabled");
        const recipients = [...new Set(
            (checklist?.notifyOnCompletionUsers || []).map(user => String(user._id || user))
        )];

        for (const recipient of recipients) {
            try {
                await Notification.create({
                    recipient,
                    task: task._id,
                    title: "Checklist task completed",
                    message: `The checklist task "${task.title}" has been completed.`,
                    type: "task_update"
                });
            } catch (error) {
                if (error.code !== 11000) {
                    console.error("Checklist completion notification error:", error);
                }
            }
        }

        if (checklist) {
            await notifyChecklistEvent({
                checklist,
                eventType: "completed",
                task,
                createInApp: false,
                senderUserId
            });
        }
    } catch (error) {
        console.error("Unable to load checklist completion recipients:", error);
    }
};

const getDueAt = (dueAt, dueDate, dueTime) => {
    if (dueAt) {
        const parsedDueAt = new Date(dueAt);
        if (Number.isNaN(parsedDueAt.getTime())) {
            throw new Error("A valid task due date and time are required.");
        }
        return parsedDueAt;
    }

    if (!dueDate) return null;

    const parsedDate = new Date(dueDate);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error("A valid task due date is required.");
    }

    const [hours = 11, minutes = 0] = String(dueTime || "11:00")
        .split(":")
        .map(Number);
    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        throw new Error("A valid task due time is required.");
    }

    return new Date(Date.UTC(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate(),
        hours,
        minutes
    ));
};

// Helper to generate a unique taskId
const generateTaskId = async () => {
    let unique = false;
    let newTaskId = "";
    while (!unique) {
        const random = Math.floor(1000 + Math.random() * 9000);
        newTaskId = `TSK-${random}`;
        const existing = await Tasks.findOne({ taskId: newTaskId });
        if (!existing) unique = true;
    }
    return newTaskId;
};

const add = async (req, res) => {
    try {
        const {
            title,
            description,
            taskType,
            relatedLead,
            instructions,
            assignedBy,
            assignedTo,
            dueDate,
            dueTime,
            dueAt,
            reminderMinutesBefore,
            priority,
            status,
            recurrence,
            taskId
        } = req.body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task title is required."
            });
        }

        let validatedLead = null;
        if (relatedLead && mongoose.isValidObjectId(relatedLead)) {
            validatedLead = relatedLead;
        }

        let validatedAssignedTo = null;
        if (assignedTo && mongoose.isValidObjectId(assignedTo)) {
            validatedAssignedTo = assignedTo;
        }

        // Auto-generate taskId if not passed
        let finalTaskId = taskId && taskId.trim() ? taskId.trim() : await generateTaskId();

        // Check if finalTaskId already exists
        const taskIdExists = await Tasks.findOne({ taskId: finalTaskId });
        if (taskIdExists) {
            finalTaskId = await generateTaskId();
        }

        const task = await Tasks.create({
            taskId: finalTaskId,
            title: title.trim(),
            description: description ? description.trim() : "",
            taskType: taskType || "Follow-up Call",
            relatedLead: validatedLead,
            instructions: instructions ? instructions.trim() : "",
            assignedBy: assignedBy && assignedBy.trim() ? assignedBy.trim() : "Olivia Carter · Sales Manager",
            assignedTo: validatedAssignedTo,
            dueDate: dueDate ? new Date(dueDate) : null,
            dueTime: dueTime,
            dueAt: getDueAt(dueAt, dueDate, dueTime),
            reminderMinutesBefore: reminderMinutesBefore === "" || reminderMinutesBefore === null
                ? null
                : reminderMinutesBefore,
            priority: priority || "High",
            status: status || "Pending",
            recurrence: recurrence || { enabled: false, frequency: "" }
        });

        const populatedTask = await Tasks.findById(task._id)
            .populate("relatedLead", "name phone email source interestedProduct status")
            .populate("assignedTo", "name email designation department role image");

        if (populatedTask?.assignedTo) {
            await notifyTaskEvent({
                task: populatedTask,
                eventType: "assigned",
                senderUserId: req.body.senderUserId
            });
        }

        return res.status(201).json({
            success: true,
            message: "Task added successfully.",
            data: populatedTask,
            task: populatedTask
        });
    } catch (error) {
        console.error("Error creating task:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while creating the task."
        });
    }
};
const getTask = async (req, res) => {
    try {
        const { search, status, priority, taskType, assignedTo } = req.query;
        const query = {};


        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            query.$or = [
                { title: searchRegex },
                { taskId: searchRegex },
                { description: searchRegex },
                { instructions: searchRegex }
            ];
        }

        // Status filter
        if (status && status !== "all") {
            query.status = new RegExp(`^${status.trim()}$`, "i");
        }

        // Priority filter
        if (priority && priority !== "all") {
            query.priority = new RegExp(`^${priority.trim()}$`, "i");
        }

        // Task Type filter
        if (taskType && taskType !== "all") {
            query.taskType = new RegExp(`^${taskType.trim()}$`, "i");
        }

        // AssignedTo filter
        if (assignedTo && assignedTo !== "all") {
            if (mongoose.isValidObjectId(assignedTo)) {
                query.assignedTo = assignedTo;
            }
        }

        const tasks = await Tasks.find(query)
            .populate("relatedLead", "name phone email source interestedProduct status")
            .populate("assignedTo", "name email designation department role image")
            .sort({ createdAt: -1 });

        // Ensure every task document has taskId and status for front-end stability
        const normalizedTasks = tasks.map((task) => {
            const obj = task.toObject();
            if (!obj.taskId) {
                obj.taskId = `TSK-${obj._id.toString().slice(-4).toUpperCase()}`;
            }
            if (!obj.status) {
                obj.status = "Pending";
            }
            return obj;
        });

        return res.status(200).json({
            success: true,
            message: "Tasks fetched successfully.",
            Tasks: normalizedTasks,
            tasks: normalizedTasks,
            count: normalizedTasks.length
        });
    } catch (error) {
        console.error("Error getting tasks:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while fetching tasks."
        });
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;

        let task = null;
        if (mongoose.isValidObjectId(id)) {
            task = await Tasks.findById(id)
                .populate("relatedLead", "name phone email source interestedProduct status")
                .populate("assignedTo", "name email designation department role image");
        }

        if (!task) {
            task = await Tasks.findOne({ taskId: id })
                .populate("relatedLead", "name phone email source interestedProduct status")
                .populate("assignedTo", "name email designation department role image");
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const obj = task.toObject();
        if (!obj.taskId) {
            obj.taskId = `TSK-${obj._id.toString().slice(-4).toUpperCase()}`;
        }
        if (!obj.status) {
            obj.status = "Pending";
        }

        return res.status(200).json({
            success: true,
            message: "Task fetched successfully.",
            Task: obj,
            task: obj,
            data: obj
        });
    } catch (error) {
        console.error("Error fetching task:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while fetching task details."
        });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;

        let task = null;
        if (mongoose.isValidObjectId(id)) {
            task = await Tasks.findById(id);
        }
        if (!task) {
            task = await Tasks.findOne({ taskId: id });
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const wasCompleted = isCompletedStatus(task.status);
        const previousAssignedTo = String(task.assignedTo || "");
        const {
            title,
            description,
            taskType,
            relatedLead,
            instructions,
            assignedBy,
            assignedTo,
            dueDate,
            dueTime,
            dueAt,
            reminderMinutesBefore,
            priority,
            status,
            recurrence,
            submission,
            submittedAt
        } = req.body;

        if (title !== undefined) task.title = title.trim();
        if (description !== undefined) task.description = description.trim();
        if (taskType !== undefined) task.taskType = taskType;
        if (instructions !== undefined) task.instructions = instructions.trim();
        if (assignedBy !== undefined) task.assignedBy = assignedBy.trim();
        if (dueTime !== undefined) task.dueTime = dueTime;
        if (reminderMinutesBefore !== undefined) {
            task.reminderMinutesBefore = reminderMinutesBefore === "" || reminderMinutesBefore === null
                ? null
                : reminderMinutesBefore;
        }
        if (priority !== undefined) task.priority = priority;
        if (status !== undefined) task.status = status;
        if (recurrence !== undefined) task.recurrence = recurrence;
        if (submission !== undefined) task.submission = submission;
        if (submittedAt !== undefined) task.submittedAt = submittedAt;

        if (relatedLead !== undefined) {
            task.relatedLead = relatedLead && mongoose.isValidObjectId(relatedLead) ? relatedLead : null;
        }

        if (assignedTo !== undefined) {
            task.assignedTo = assignedTo && mongoose.isValidObjectId(assignedTo) ? assignedTo : null;
        }

        if (dueDate !== undefined) {
            task.dueDate = dueDate ? new Date(dueDate) : null;
        }
        if (dueAt !== undefined || dueDate !== undefined || dueTime !== undefined) {
            task.dueAt = getDueAt(
                dueAt,
                dueDate !== undefined ? dueDate : task.dueDate,
                dueTime !== undefined ? dueTime : task.dueTime
            );
        }

        await task.save();
        if (!wasCompleted && isCompletedStatus(task.status)) {
            if (task.checklistId) {
                await notifyChecklistCompletion(task, req.body.senderUserId);
            } else {
                await notifyTaskEvent({
                    task,
                    eventType: "completed",
                    senderUserId: req.body.senderUserId
                });
            }
        }

        const updated = await Tasks.findById(task._id)
            .populate("relatedLead", "name phone email source interestedProduct status")
            .populate("assignedTo", "name email designation department role image");

        if (
            updated?.assignedTo &&
            String(updated.assignedTo._id || updated.assignedTo) !== previousAssignedTo
        ) {
            await notifyTaskEvent({
                task: updated,
                eventType: "assigned",
                senderUserId: req.body.senderUserId
            });
        }

        return res.status(200).json({
            success: true,
            message: "Task updated successfully.",
            data: updated,
            task: updated
        });
    } catch (error) {
        console.error("Error updating task:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while updating the task."
        });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, submission, submittedAt } = req.body;

        let task = null;
        if (mongoose.isValidObjectId(id)) {
            task = await Tasks.findById(id);
        }
        if (!task) {
            task = await Tasks.findOne({ taskId: id });
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        const wasCompleted = isCompletedStatus(task.status);
        if (status) {
            task.status = status;
        }

        if (submission) {
            task.submission = {
                summary: submission.summary || "",
                notes: submission.notes || "",
                evidenceUrl: submission.evidenceUrl || ""
            };
            task.submittedAt = submittedAt ? new Date(submittedAt) : new Date();
        }

        await task.save();
        if (!wasCompleted && isCompletedStatus(task.status)) {
            if (task.checklistId) {
                await notifyChecklistCompletion(task, req.body.senderUserId);
            } else {
                await notifyTaskEvent({
                    task,
                    eventType: "completed",
                    senderUserId: req.body.senderUserId
                });
            }
        }

        const updated = await Tasks.findById(task._id)
            .populate("relatedLead", "name phone email source interestedProduct status")
            .populate("assignedTo", "name email designation department role image");

        return res.status(200).json({
            success: true,
            message: "Task status updated successfully.",
            data: updated,
            task: updated
        });
    } catch (error) {
        console.error("Error updating task status:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while updating status."
        });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        let deleted = null;
        if (mongoose.isValidObjectId(id)) {
            deleted = await Tasks.findByIdAndDelete(id);
        }
        if (!deleted) {
            deleted = await Tasks.findOneAndDelete({ taskId: id });
        }

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Task not found or already deleted."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Task deleted successfully.",
            id: deleted._id,
            taskId: deleted.taskId
        });
    } catch (error) {
        console.error("Error deleting task:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while deleting the task."
        });
    }
};

module.exports = {
    add,
    getTask,
    getById,
    update,
    updateStatus,
    deleteTask,
    // seedTasks
};