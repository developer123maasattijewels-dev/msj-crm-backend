const mongoose = require("mongoose");
const Users = require("../models/usermodel");
const ActivityNotification = require("../models/activityNotificationModel");
const { sendNotificationEmail, isValidEmail } = require("./emailsender");

const STOP_WORDS = new Set(["and", "or", "the", "of", "for", "team", "department", "dept"]);

const DEPT_SYNONYM_GROUPS = [
    ["it", "mis", "development", "tech", "software", "support"],
    ["hr", "employees", "administration", "hiring", "talent", "payroll"],
    ["inventory", "stores", "store", "bullion", "vault", "stock"],
    ["production", "casting", "workshop", "manufacturing"],
    ["purchase", "vendors", "procurement", "po"],
    ["finance", "accounts", "billing", "gst"],
    ["quality", "qc", "control", "inspector"],
    ["dispatch", "logistics", "courier"],
    ["sales", "crm", "telecaller"],
    ["maintenance", "assets", "repair", "repairs"],
    ["pc"]
];

const tokenizeDepartment = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token && !STOP_WORDS.has(token));

const departmentsMatch = (targetDept, userDept) => {
    const a = String(targetDept || "").trim().toLowerCase();
    const b = String(userDept || "").trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;

    const tokensA = tokenizeDepartment(a);
    const tokensB = tokenizeDepartment(b);
    if (!tokensA.length || !tokensB.length) return false;

    if (tokensA.some((t) => tokensB.includes(t))) {
        return true;
    }

    return DEPT_SYNONYM_GROUPS.some(
        (group) =>
            tokensA.some((t) => group.includes(t)) &&
            tokensB.some((t) => group.includes(t))
    );
};

const cleanPersonName = (identifier) =>
    String(identifier || "")
        .split("·")[0]
        .replace(/\([^)]*\)/g, "")
        .trim();

const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const USER_SELECT = "_id name email department designation role emailNotificationsEnabled";

const findUsersByIdentifier = async (identifier) => {
    const raw = String(identifier || "").trim();
    if (!raw || /^unassigned$/i.test(raw)) return [];

    if (mongoose.isValidObjectId(raw)) {
        const byId = await Users.findById(raw).select(USER_SELECT).lean().catch(() => null);
        return byId ? [byId] : [];
    }

    if (isValidEmail(raw)) {
        const byEmail = await Users.find({ email: raw.toLowerCase() }).select(USER_SELECT).lean();
        if (byEmail.length) return byEmail;
    }

    const cleanedName = cleanPersonName(raw);
    if (!cleanedName) return [];

    const exactRegex = new RegExp(`^${escapeRegex(cleanedName)}$`, "i");
    const exactMatches = await Users.find({ name: exactRegex }).select(USER_SELECT).lean();
    if (exactMatches.length) return exactMatches;

    return [];
};

const findUsersByIds = async (ids = []) => {
    const validIds = [...new Set(ids.map(String).filter((id) => mongoose.isValidObjectId(id)))];
    if (!validIds.length) return [];
    return Users.find({ _id: { $in: validIds } }).select(USER_SELECT).lean();
};

const findUsersByDepartment = async (departmentName) => {
    const target = String(departmentName || "").trim();
    if (!target) return [];
    const allUsers = await Users.find({}).select(USER_SELECT).lean();
    return allUsers.filter((user) => departmentsMatch(target, user.department));
};

const findAdmins = async () =>
    Users.find({ role: /^admin$/i }).select(USER_SELECT).lean();

const deduplicateUsers = (userLists = []) => {
    const map = new Map();
    userLists.flat().forEach((user) => {
        if (user && user._id) {
            map.set(String(user._id), user);
        }
    });
    return [...map.values()];
};

const filterOutActor = (users = [], actorName = "") => {
    const cleanedActor = cleanPersonName(actorName).toLowerCase();
    if (!cleanedActor) return users;
    return users.filter(
        (u) =>
            cleanPersonName(u.name).toLowerCase() !== cleanedActor &&
            String(u.email || "").toLowerCase() !== cleanedActor
    );
};

const formatDateValue = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata"
    });
};

const dispatchNotifications = async ({
    recipients = [],
    extraEmails = [],
    title,
    message,
    type,
    entityType = "system",
    entityId = "",
    route = "/dashboard",
    emailEyebrow,
    emailSubject,
    emailDetails = [],
    emailItems = [],
    footerNote,
    senderUserId,
    createInApp = true
}) => {
    const uniqueUsers = deduplicateUsers([recipients]);

    let inAppSent = 0;
    let inAppFailed = 0;

    if (createInApp && uniqueUsers.length && type) {
        const dbResults = await Promise.allSettled(
            uniqueUsers.map((user) =>
                ActivityNotification.create({
                    recipient: user._id,
                    title,
                    message,
                    type,
                    entityType,
                    entityId: String(entityId || ""),
                    route
                })
            )
        );
        dbResults.forEach((result) => {
            if (result.status === "fulfilled") {
                inAppSent += 1;
            } else {
                inAppFailed += 1;
                console.error("[NotificationService] In-app create error:", result.reason?.message || result.reason);
            }
        });
    }

    const userEmails = uniqueUsers
        .filter((user) => user.emailNotificationsEnabled !== false && isValidEmail(user.email))
        .map((user) => user.email.trim().toLowerCase());

    const combinedEmails = [
        ...new Set([
            ...userEmails,
            ...(Array.isArray(extraEmails) ? extraEmails : [extraEmails])
                .filter(isValidEmail)
                .map((e) => e.trim().toLowerCase())
        ])
    ];

    const emailResult = await sendNotificationEmail({
        to: combinedEmails,
        subject: emailSubject || title,
        eyebrow: emailEyebrow || "WORKSPACE NOTIFICATION",
        title,
        message,
        details: emailDetails,
        items: emailItems,
        footerNote,
        senderUserId
    });

    return {
        recipients: uniqueUsers.length,
        inAppSent,
        inAppFailed,
        email: emailResult
    };
};

// ─── Domain Helpers ──────────────────────────────────────────────────────────

const notifyTicketEvent = async ({
    ticket,
    eventType = "created", // 'created' | 'po_created' | 'status_updated' | 'reply' | 'assigned'
    actorName = "",
    noteText = "",
    oldStatus = "",
    senderUserId
}) => {
    try {
        if (!ticket) return null;

        const targetDept = ticket.details?.targetDepartment || ticket.department || "";
        const hiringDept = ticket.details?.hiringDepartment || "";

        const [assigneeUsers, requesterUsers, adminUsers, deptUsers] = await Promise.all([
            findUsersByIdentifier(ticket.assignee),
            findUsersByIdentifier(ticket.requesterEmail || ticket.requester),
            findAdmins(),
            !ticket.assignee || /^unassigned$/i.test(ticket.assignee)
                ? Promise.all([
                      findUsersByDepartment(targetDept),
                      hiringDept ? findUsersByDepartment(hiringDept) : Promise.resolve([])
                  ]).then(([a, b]) => deduplicateUsers([a, b]))
                : Promise.resolve([])
        ]);

        const extraEmails = [];
        if (isValidEmail(ticket.requesterEmail)) {
            extraEmails.push(ticket.requesterEmail);
        }

        let recipients = [];
        let type = "ticket_created";
        let eyebrow = "TICKET NOTIFICATION";
        let title = `New Ticket Generated: ${ticket.ticketNumber || ticket._id}`;
        let message = `${ticket.requester || "A team member"} created a ${ticket.type || "support"} ticket.`;

        if (eventType === "po_created" || (eventType === "created" && ticket.type === "po")) {
            type = "po_created";
            eyebrow = "PURCHASE ORDER NOTIFICATION";
            title = `New Purchase Order: ${ticket.ticketNumber || ticket.details?.poNumber || ""}`.trim();
            message = `${ticket.requester || "A team member"} raised a Purchase Order (${ticket.subject || "PO"}).`;
            const purchaseUsers = await findUsersByDepartment("Purchase & Vendors");
            recipients = deduplicateUsers([assigneeUsers, requesterUsers, deptUsers, purchaseUsers, adminUsers]);
        } else if (eventType === "created") {
            type = "ticket_created";
            eyebrow = ticket.type === "demand" ? "DEMAND TICKET NOTIFICATION" : "TICKET NOTIFICATION";
            title = `New Ticket Generated: ${ticket.ticketNumber || ""} — ${ticket.subject || "Support Request"}`;
            message = `${ticket.requester || "A team member"} generated a ${ticket.priority || "Medium"} priority ticket for ${targetDept || ticket.department}.`;
            recipients = deduplicateUsers([assigneeUsers, requesterUsers, deptUsers, adminUsers]);
        } else if (eventType === "status_updated") {
            type = "ticket_updated";
            eyebrow = "TICKET STATUS UPDATE";
            title = `Ticket ${ticket.ticketNumber || ""} Updated to ${ticket.status}`;
            message = `${actorName || "Support Team"} updated ticket "${ticket.subject || ticket.ticketNumber}"${oldStatus ? ` from "${oldStatus}"` : ""} to "${ticket.status}".`;
            recipients = filterOutActor(deduplicateUsers([requesterUsers, assigneeUsers, adminUsers]), actorName);
            if (!recipients.length) {
                recipients = deduplicateUsers([requesterUsers, assigneeUsers]);
            }
        } else if (eventType === "reply") {
            type = "ticket_reply";
            eyebrow = "TICKET REPLY";
            title = `New Reply on Ticket ${ticket.ticketNumber || ""}`;
            message = `${actorName || "Team Member"} posted a reply on "${ticket.subject || ticket.ticketNumber}":\n\n"${noteText}"`;
            recipients = filterOutActor(deduplicateUsers([requesterUsers, assigneeUsers]), actorName);
        } else if (eventType === "assigned") {
            type = "ticket_assigned";
            eyebrow = "TICKET ASSIGNMENT";
            title = `Ticket Assigned: ${ticket.ticketNumber || ""} — ${ticket.subject || ""}`;
            message = `Ticket "${ticket.subject || ticket.ticketNumber}" has been assigned to ${ticket.assignee}.`;
            recipients = deduplicateUsers([assigneeUsers, requesterUsers]);
        }

        const items =
            ticket.details?.demandItems ||
            ticket.details?.storeItems ||
            [];

        const details = [
            { label: "Ticket Number", value: ticket.ticketNumber || String(ticket._id || "") },
            { label: "Type", value: String(ticket.type || "help").toUpperCase() },
            { label: "Subject", value: ticket.subject || "-" },
            { label: "Priority", value: ticket.priority || "Medium" },
            { label: "Status", value: ticket.status || "Open" },
            { label: "Requester", value: ticket.requester || "-" },
            { label: "From Department", value: ticket.department || "-" },
            { label: "Target Department", value: targetDept || "-" },
            { label: "Assigned To", value: ticket.assignee || "Unassigned" },
            { label: "Required Date", value: formatDateValue(ticket.requiredDate) },
            ...(ticket.details?.poNumber ? [{ label: "PO Reference", value: ticket.details.poNumber }] : []),
            ...(ticket.details?.vendorName ? [{ label: "Vendor", value: ticket.details.vendorName }] : []),
            ...(ticket.details?.grandTotal ? [{ label: "Estimated Total", value: `₹ ${ticket.details.grandTotal}` }] : []),
            ...(ticket.description ? [{ label: "Description", value: ticket.description }] : [])
        ];

        return dispatchNotifications({
            recipients,
            extraEmails: eventType === "created" || eventType === "po_created" ? extraEmails : [],
            title,
            message,
            type,
            entityType: "ticket",
            entityId: ticket.ticketNumber || String(ticket._id || ""),
            route: "/tickets",
            emailEyebrow: eyebrow,
            emailSubject: `[MSJ CRM] ${title}`,
            emailDetails: details,
            emailItems: items,
            senderUserId
        });
    } catch (error) {
        console.error("[NotificationService] Ticket notification error:", error);
        return null;
    }
};

const notifyChecklistEvent = async ({
    checklist,
    eventType = "created", // 'created' | 'assigned' | 'due' | 'response' | 'completed'
    actorName = "",
    responseEntry = null,
    task = null,
    customRecipients = null,
    createInApp = true,
    senderUserId
}) => {
    try {
        if (!checklist) return null;

        let recipients = [];
        let type = "checklist_created";
        let eyebrow = "CHECKLIST NOTIFICATION";
        let title = `New Checklist Assigned: ${checklist.taskName}`;
        let message = `A checklist "${checklist.taskName}" has been created and assigned.`;

        if (eventType === "created" || eventType === "assigned") {
            const ids = [
                checklist.assignedTo?._id || checklist.assignedTo,
                checklist.auditor?._id || checklist.auditor,
                checklist.assignPC?._id || checklist.assignPC
            ].filter(Boolean);
            recipients = await findUsersByIds(ids);
            type = eventType === "created" ? "checklist_created" : "checklist_assigned";
            title = eventType === "created"
                ? `New Checklist Created: ${checklist.taskName}`
                : `Checklist Reassigned: ${checklist.taskName}`;
            message = `Checklist "${checklist.taskName}" (${checklist.frequency || "One Time"}) has been assigned by ${checklist.assignedBy || actorName || "Workspace Admin"}.`;
        } else if (eventType === "due") {
            const ids = [
                checklist.assignedTo?._id || checklist.assignedTo,
                checklist.assignPC?._id || checklist.assignPC
            ].filter(Boolean);
            recipients = await findUsersByIds(ids);
            type = "checklist_due";
            eyebrow = "RECURRING CHECKLIST DUE";
            title = `Checklist Task Due Today: ${checklist.taskName}`;
            message = `Today's scheduled checklist task "${checklist.taskName}" is ready for execution.`;
        } else if (eventType === "response") {
            recipients = Array.isArray(customRecipients) ? customRecipients : [];
            type = "checklist_created";
            eyebrow = "CHECKLIST RESPONSE SUBMITTED";
            title = `Checklist Response: ${checklist.taskName}`;
            message = `${responseEntry?.submittedBy || "A team member"} submitted a response for "${checklist.taskName}".\n\nResponse: ${responseEntry?.response || ""}${responseEntry?.details ? `\nDetails: ${responseEntry.details}` : ""}`;
        } else if (eventType === "completed") {
            const ids = [
                ...(checklist.notifyOnCompletionUsers || []).map((u) => u._id || u),
                checklist.auditor?._id || checklist.auditor,
                ...(checklist.selectNotifyDoerWhenTaskDone && task?.assignedTo
                    ? [task.assignedTo?._id || task.assignedTo]
                    : [])
            ].filter(Boolean);
            recipients = await findUsersByIds(ids);
            type = "task_completed";
            eyebrow = "CHECKLIST COMPLETED";
            title = `Checklist Task Completed: ${task?.title || checklist.taskName}`;
            message = `The checklist task "${task?.title || checklist.taskName}" has been marked as Completed.`;
        }

        const assigneeName = checklist.assignedTo?.name || (recipients.find((r) => String(r._id) === String(checklist.assignedTo?._id || checklist.assignedTo))?.name) || "";
        const details = [
            { label: "Checklist Task", value: checklist.taskName || task?.title || "-" },
            { label: "Frequency", value: checklist.frequency || "One Time" },
            { label: "Priority", value: checklist.priority || "Medium" },
            { label: "Planned Date", value: formatDateValue(checklist.plannedDate || task?.dueDate) },
            { label: "Reminder Time", value: checklist.reminderStartingTime || task?.dueTime || "-" },
            { label: "Assigned By", value: checklist.assignedBy || "-" },
            ...(assigneeName ? [{ label: "Assigned To", value: assigneeName }] : []),
            ...(checklist.groupName ? [{ label: "Group", value: checklist.groupName }] : []),
            ...(checklist.message ? [{ label: "Instructions", value: checklist.message }] : [])
        ];

        return dispatchNotifications({
            recipients,
            title,
            message,
            type,
            entityType: "checklist",
            entityId: String(checklist._id || ""),
            route: "/checklists",
            emailEyebrow: eyebrow,
            emailSubject: `[MSJ CRM] ${title}`,
            emailDetails: details,
            createInApp,
            senderUserId
        });
    } catch (error) {
        console.error("[NotificationService] Checklist notification error:", error);
        return null;
    }
};

const notifyTaskEvent = async ({
    task,
    eventType = "assigned", // 'assigned' | 'completed' | 'reminder' | 'overdue'
    customRecipients = null,
    createInApp = true,
    senderUserId
}) => {
    try {
        if (!task) return null;

        let recipients = Array.isArray(customRecipients) ? customRecipients : [];
        let type = "task_assigned";
        let eyebrow = "TASK NOTIFICATION";
        let title = `New Task Assigned: ${task.title}`;
        let message = `You have been assigned a task "${task.title}" by ${task.assignedBy || "Manager"}.`;

        if (eventType === "assigned") {
            if (!recipients.length && task.assignedTo) {
                recipients = await findUsersByIds([task.assignedTo._id || task.assignedTo]);
            }
            type = "task_assigned";
            eyebrow = "TASK ASSIGNED";
            title = `New Task Assigned: ${task.title}`;
            message = `${task.assignedBy || "A manager"} assigned you a ${task.priority || "High"} priority task: "${task.title}".`;
        } else if (eventType === "completed") {
            if (!recipients.length && task.assignedBy) {
                recipients = await findUsersByIdentifier(task.assignedBy);
            }
            type = "task_completed";
            eyebrow = "TASK COMPLETED";
            title = `Task Completed: ${task.title}`;
            message = `The task "${task.title}" (${task.taskId || ""}) has been marked as Completed.${task.submission?.summary ? `\n\nWork Summary: ${task.submission.summary}` : ""}`;
        } else if (eventType === "reminder") {
            eyebrow = "TASK REMINDER";
            title = `Task Reminder: ${task.title}`;
            message = `Reminder: Your task "${task.title}" is due soon.`;
        } else if (eventType === "overdue") {
            eyebrow = "TASK OVERDUE ALERT";
            title = `Task Overdue: ${task.title}`;
            message = `Action required: The task "${task.title}" is overdue. Please complete it as soon as possible.`;
        }

        const details = [
            { label: "Task ID", value: task.taskId || String(task._id || "") },
            { label: "Title", value: task.title || "-" },
            { label: "Task Type", value: task.taskType || "-" },
            { label: "Priority", value: task.priority || "Medium" },
            { label: "Status", value: task.status || "Pending" },
            { label: "Due Date", value: formatDateValue(task.dueAt || task.dueDate) },
            { label: "Due Time", value: task.dueTime || "-" },
            { label: "Assigned By", value: task.assignedBy || "-" },
            ...(task.instructions ? [{ label: "Instructions", value: task.instructions }] : []),
            ...(task.description ? [{ label: "Description", value: task.description }] : [])
        ];

        return dispatchNotifications({
            recipients,
            title,
            message,
            type,
            entityType: "task",
            entityId: String(task._id || task.taskId || ""),
            route: task._id ? `/tasks/taskview/${task._id}` : "/tasks",
            emailEyebrow: eyebrow,
            emailSubject: `[MSJ CRM] ${title}`,
            emailDetails: details,
            createInApp,
            senderUserId
        });
    } catch (error) {
        console.error("[NotificationService] Task notification error:", error);
        return null;
    }
};

const notifyInterviewEvent = async ({
    candidate,
    eventType = "created", // 'created' | 'updated'
    senderUserId
}) => {
    try {
        if (!candidate) return null;

        const [hrUsers, adminUsers, interviewerUsers] = await Promise.all([
            findUsersByDepartment("HR"),
            findAdmins(),
            candidate.interview?.interviewer
                ? findUsersByIdentifier(candidate.interview.interviewer)
                : Promise.resolve([])
        ]);

        const internalRecipients = deduplicateUsers([hrUsers, adminUsers, interviewerUsers]);
        const isCreated = eventType === "created";
        const status = candidate.hiringStatus || "New";

        const title = isCreated
            ? `New Candidate Application: ${candidate.candidateName}`
            : `Candidate Update (${status}): ${candidate.candidateName}`;
        const message = isCreated
            ? `${candidate.candidateName} applied for "${candidate.candidatePosition}" (${candidate.department}) via ${candidate.source}.`
            : `Candidate ${candidate.candidateName} (${candidate.candidatePosition}) hiring status is now "${status}".`;

        const details = [
            { label: "Candidate", value: candidate.candidateName },
            { label: "Email", value: candidate.candidateEmail },
            { label: "Phone", value: candidate.candidatePhone },
            { label: "Department", value: candidate.department },
            { label: "Position", value: candidate.candidatePosition },
            { label: "Hiring Status", value: status },
            ...(candidate.interview?.interviewDate
                ? [{ label: "Interview Date", value: formatDateValue(candidate.interview.interviewDate) }]
                : []),
            ...(candidate.interview?.interviewMode
                ? [{ label: "Interview Mode", value: candidate.interview.interviewMode }]
                : [])
        ];

        const internalResult = await dispatchNotifications({
            recipients: internalRecipients,
            title,
            message,
            type: isCreated ? "interview_created" : "interview_updated",
            entityType: "interview",
            entityId: String(candidate._id || ""),
            route: candidate._id ? `/hr-onboarding/candidate/${candidate._id}` : "/hr-onboarding",
            emailEyebrow: "HR & HIRING NOTIFICATION",
            emailSubject: `[MSJ CRM] ${title}`,
            emailDetails: details,
            senderUserId
        });

        // Also send polite confirmation/schedule email to the candidate when registered or scheduled/selected/approved
        const shouldEmailCandidate =
            isValidEmail(candidate.candidateEmail) &&
            (isCreated || ["Interview Scheduled", "Selected", "Approved", "Joined"].includes(status));

        if (shouldEmailCandidate) {
            const candidateSubject = isCreated
                ? `Application Received — ${candidate.candidatePosition} | Maa Satti Jewels`
                : `Application Update (${status}) — ${candidate.candidatePosition} | Maa Satti Jewels`;
            const candidateMessage = isCreated
                ? `Dear ${candidate.candidateName},\n\nThank you for applying for the ${candidate.candidatePosition} position in our ${candidate.department} department. Our HR team has received your profile and will review it shortly.`
                : `Dear ${candidate.candidateName},\n\nYour application status for ${candidate.candidatePosition} at Maa Satti Jewels has been updated to "${status}".`;

            await sendNotificationEmail({
                to: candidate.candidateEmail,
                subject: candidateSubject,
                eyebrow: "MAA SATTI JEWELS CAREERS",
                title: isCreated ? "Application Received" : `Application Status: ${status}`,
                message: candidateMessage,
                details: [
                    { label: "Position", value: candidate.candidatePosition },
                    { label: "Department", value: candidate.department },
                    { label: "Status", value: status },
                    ...(candidate.interview?.interviewDate
                        ? [{ label: "Interview Date", value: formatDateValue(candidate.interview.interviewDate) }]
                        : []),
                    ...(candidate.interview?.interviewMode
                        ? [{ label: "Interview Mode", value: candidate.interview.interviewMode }]
                        : [])
                ],
                senderUserId
            });
        }

        return internalResult;
    } catch (error) {
        console.error("[NotificationService] Interview notification error:", error);
        return null;
    }
};

const notifyLeadEvent = async ({ lead, senderUserId }) => {
    try {
        if (!lead || !lead.assignedTo) return null;
        const recipients = await findUsersByIdentifier(lead.assignedTo);
        if (!recipients.length) return null;

        return dispatchNotifications({
            recipients,
            title: `Lead Assigned: ${lead.name}`,
            message: `A sales lead "${lead.name}" (${lead.interestedProduct || "Jewellery"}) has been assigned to you.`,
            type: "lead_assigned",
            entityType: "lead",
            entityId: String(lead._id || ""),
            route: lead._id ? `/leads/profile/${lead._id}` : "/leads",
            emailEyebrow: "CRM LEAD NOTIFICATION",
            emailSubject: `[MSJ CRM] Lead Assigned: ${lead.name}`,
            emailDetails: [
                { label: "Lead Name", value: lead.name },
                { label: "Phone", value: lead.phone },
                { label: "Email", value: lead.email },
                { label: "Source", value: lead.source },
                { label: "Interested Product", value: lead.interestedProduct },
                { label: "Status", value: lead.status },
                { label: "Notes", value: lead.notes }
            ],
            senderUserId
        });
    } catch (error) {
        console.error("[NotificationService] Lead notification error:", error);
        return null;
    }
};

const notifyUserWelcome = async ({ user }) => {
    try {
        if (!user || !isValidEmail(user.email)) return null;

        return sendNotificationEmail({
            to: user.email,
            subject: "Welcome to Maa Satti Jewels CRM",
            eyebrow: "TEAM ONBOARDING",
            title: `Welcome aboard, ${user.name}!`,
            message: "Your Maa Satti Jewels CRM account has been created. You can sign in using your registered work email and assigned role.",
            details: [
                { label: "Name", value: user.name },
                { label: "Work Email", value: user.email },
                { label: "Department", value: user.department },
                { label: "Designation", value: user.designation || "-" },
                { label: "Role", value: user.role }
            ]
        });
    } catch (error) {
        console.error("[NotificationService] Welcome email error:", error);
        return null;
    }
};

module.exports = {
    findUsersByIdentifier,
    findUsersByIds,
    findUsersByDepartment,
    findAdmins,
    deduplicateUsers,
    dispatchNotifications,
    notifyTicketEvent,
    notifyChecklistEvent,
    notifyTaskEvent,
    notifyInterviewEvent,
    notifyLeadEvent,
    notifyUserWelcome
};

