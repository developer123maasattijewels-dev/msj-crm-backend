const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const nodemailer = require("nodemailer");
const EmailProfile = require("../models/emailProfileModel");
const Users = require("../models/usermodel");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value) =>
    typeof value === "string" && EMAIL_REGEX.test(value.trim());

const normalizeEmail = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const getEmailCredentials = async ({ auth, senderUserId } = {}) => {
    const defaultSenderName = "Maa Satti Jewels CRM";

    if (isValidEmail(auth?.user) && auth?.pass?.trim()) {
        return {
            configured: true,
            enabled: true,
            email: normalizeEmail(auth.user),
            appPassword: String(auth.pass).replace(/\s+/g, ""),
            senderName: (auth.senderName || defaultSenderName).trim() || defaultSenderName
        };
    }

    const emailProfile = await EmailProfile.findOne({ key: "default" }).lean().catch(() => null);
    if (emailProfile && emailProfile.enabled === false) {
        return {
            configured: false,
            enabled: false,
            email: "",
            appPassword: "",
            senderName: emailProfile.senderName || defaultSenderName
        };
    }

    const senderName = (emailProfile?.senderName || defaultSenderName).trim() || defaultSenderName;

    if (senderUserId) {
        const user = await Users.findById(senderUserId)
            .select("name senderEmail appPassword")
            .lean()
            .catch(() => null);

        if (isValidEmail(user?.senderEmail) && user?.appPassword?.trim()) {
            return {
                configured: true,
                enabled: true,
                email: normalizeEmail(user.senderEmail),
                appPassword: String(user.appPassword).replace(/\s+/g, ""),
                senderName: user.name ? `${user.name} · ${senderName}` : senderName
            };
        }
    }

    if (isValidEmail(emailProfile?.email) && emailProfile?.appPassword?.trim()) {
        return {
            configured: true,
            enabled: true,
            email: normalizeEmail(emailProfile.email),
            appPassword: String(emailProfile.appPassword).replace(/\s+/g, ""),
            senderName
        };
    }

    const envEmail = normalizeEmail(process.env.EMAIL_USER || "");
    const envPass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "");

    if (isValidEmail(envEmail) && envPass) {
        return {
            configured: true,
            enabled: true,
            email: envEmail,
            appPassword: envPass,
            senderName
        };
    }

    return {
        configured: false,
        enabled: true,
        email: "",
        appPassword: "",
        senderName
    };
};

const createTransporter = (email, appPassword) =>
    nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: email,
            pass: appPassword
        }
    });

const buildEmailTemplate = ({
    eyebrow = "NOTIFICATION",
    title = "Notification",
    message = "",
    details = [],
    items = [],
    actionUrl = "",
    actionLabel = "Open in Maa Satti Jewels CRM",
    footerNote = "Maa Satti Jewels CRM · Automated Workspace Notification"
}) => {
    const validDetails = (Array.isArray(details) ? details : []).filter(
        (d) => d && d.label && d.value !== undefined && d.value !== null && String(d.value).trim() !== ""
    );

    const sentAt = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata"
    });

    const detailsHtml = validDetails
        .map(
            (d, idx) => `
            <tr style="background:${idx % 2 === 0 ? "#fcfbf8" : "#ffffff"};">
                <td style="padding:10px 14px;border-bottom:1px solid #ece7dc;color:#64748b;font-size:12.5px;font-weight:600;width:36%;vertical-align:top;">${escapeHtml(d.label)}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #ece7dc;color:#0f172a;font-size:13px;font-weight:500;vertical-align:top;">${escapeHtml(d.value)}</td>
            </tr>`
        )
        .join("");

    const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const itemsHtml = validItems.length
        ? `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;border:1px solid #e6dfd1;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background:#f5efe3;">
                    <th align="left" style="padding:9px 12px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#6b4e1b;border-bottom:1px solid #e6dfd1;">Item</th>
                    <th align="left" style="padding:9px 12px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#6b4e1b;border-bottom:1px solid #e6dfd1;">Category</th>
                    <th align="left" style="padding:9px 12px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#6b4e1b;border-bottom:1px solid #e6dfd1;">Qty</th>
                    <th align="left" style="padding:9px 12px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#6b4e1b;border-bottom:1px solid #e6dfd1;">Purpose</th>
                </tr>
            </thead>
            <tbody>
                ${validItems
                    .map(
                        (item) => `
                        <tr>
                            <td style="padding:9px 12px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1ede4;">${escapeHtml(item.itemName || item.name || "-")}</td>
                            <td style="padding:9px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1ede4;">${escapeHtml(item.category || "-")}</td>
                            <td style="padding:9px 12px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1ede4;">${escapeHtml(`${item.quantity ?? ""} ${item.unit || ""}`.trim() || "-")}</td>
                            <td style="padding:9px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1ede4;">${escapeHtml(item.purpose || "-")}</td>
                        </tr>`
                    )
                    .join("")}
            </tbody>
           </table>`
        : "";

    const ctaHtml = actionUrl
        ? `<div style="margin-top:22px;">
            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:11px 22px;background:#a77b35;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;border-radius:8px;letter-spacing:0.2px;">${escapeHtml(actionLabel)} &rarr;</a>
           </div>`
        : "";

    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f1ea;padding:28px 16px;color:#1e293b;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd1;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
            <div style="padding:20px 26px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-bottom:3px solid #b8862d;">
                <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td>
                            <div style="display:inline-block;padding:3px 9px;border-radius:999px;background:rgba(184,134,45,0.18);border:1px solid rgba(226,189,112,0.4);font-size:10.5px;font-weight:700;letter-spacing:1px;color:#e8c77b;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
                            <div style="font-size:19px;font-weight:700;color:#ffffff;margin-top:8px;letter-spacing:-0.2px;">Maa Satti Jewels CRM</div>
                        </td>
                        <td align="right" style="vertical-align:top;font-size:11.5px;color:#cbd5e1;white-space:nowrap;">
                            ${escapeHtml(sentAt)} IST
                        </td>
                    </tr>
                </table>
            </div>
            <div style="padding:26px;">
                <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.35;">${escapeHtml(title)}</h2>
                ${message ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(message).replace(/\n/g, "<br/>")}</p>` : ""}
                ${detailsHtml ? `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #ece7dc;border-radius:8px;overflow:hidden;">${detailsHtml}</table>` : ""}
                ${itemsHtml}
                ${ctaHtml}
            </div>
            <div style="padding:14px 26px;background:#faf8f3;border-top:1px solid #ece7dc;font-size:12px;color:#64748b;line-height:1.5;">
                ${escapeHtml(footerNote)}
            </div>
        </div>
    </div>`;

    const text = [
        `[${eyebrow}] Maa Satti Jewels CRM`,
        title,
        "",
        message,
        "",
        ...validDetails.map((d) => `${d.label}: ${d.value}`),
        ...(actionUrl ? ["", `${actionLabel}: ${actionUrl}`] : []),
        "",
        footerNote
    ].join("\n");

    return { html, text };
};

const sendEmail = async (toOrOptions, maybeSubject, maybeText, maybeHtml) => {
    const options =
        typeof toOrOptions === "object" && toOrOptions !== null && !Array.isArray(toOrOptions)
            ? toOrOptions
            : {
                to: toOrOptions,
                subject: maybeSubject,
                text: maybeText,
                html: maybeHtml
            };

    const rawList = Array.isArray(options.to) ? options.to : [options.to];
    const recipients = [...new Set(rawList.map(normalizeEmail).filter(isValidEmail))];

    if (!recipients.length) {
        return { sent: 0, failed: 0, skipped: true, reason: "No valid recipient email addresses." };
    }

    const creds = await getEmailCredentials({
        auth: options.auth,
        senderUserId: options.senderUserId
    });

    if (!creds.enabled) {
        return { sent: 0, failed: 0, skipped: true, reason: "Email notifications are disabled." };
    }
    if (!creds.configured) {
        return { sent: 0, failed: 0, skipped: true, reason: "Email and App Password are not set." };
    }

    const transporter = createTransporter(creds.email, creds.appPassword);
    const from = `"${creds.senderName.replace(/"/g, "")}" <${creds.email}>`;

    const results = await Promise.allSettled(
        recipients.map((email) =>
            transporter.sendMail({
                from,
                to: email,
                subject: options.subject || "Maa Satti Jewels CRM Notification",
                text: options.text || "",
                html: options.html || undefined
            })
        )
    );

    let sent = 0;
    let failed = 0;
    const errors = [];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            sent += 1;
        } else {
            failed += 1;
            const email = recipients[index];
            const message = result.reason?.message || String(result.reason || "Unknown email error");
            errors.push({ email, error: message });
            console.error(`[EmailSender] Failed (${email}):`, message);
        }
    });

    return { sent, failed, skipped: false, errors };
};

const sendNotificationEmail = async ({
    to,
    subject,
    eyebrow,
    title,
    message,
    details = [],
    items = [],
    actionUrl = "",
    actionLabel,
    footerNote,
    senderUserId,
    auth
}) => {
    const { html, text } = buildEmailTemplate({
        eyebrow,
        title,
        message,
        details,
        items,
        actionUrl,
        actionLabel,
        footerNote
    });

    return sendEmail({
        to,
        subject: subject || title,
        html,
        text,
        senderUserId,
        auth
    });
};

const testEmailConnection = async ({ to, email, appPassword, senderName, senderUserId }) => {
    const creds = await getEmailCredentials({
        auth: email && appPassword ? { user: email, pass: appPassword, senderName } : undefined,
        senderUserId
    });

    if (!creds.configured) {
        return {
            success: false,
            message: "Email and App Password are blank. Enter both to send a test email."
        };
    }

    const targetEmail = isValidEmail(to) ? normalizeEmail(to) : creds.email;

    try {
        const transporter = createTransporter(creds.email, creds.appPassword);
        await transporter.verify();

        const result = await sendNotificationEmail({
            to: targetEmail,
            subject: "Maa Satti Jewels CRM — Test Email Successful",
            eyebrow: "EMAIL TEST",
            title: "Nodemailer Email Setup Verified",
            message: "Your Gmail address and App Password are working properly. Notifications will be sent to this inbox.",
            details: [
                { label: "Sender Email", value: creds.email },
                { label: "Tested At", value: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) }
            ],
            auth: {
                user: creds.email,
                pass: creds.appPassword,
                senderName: creds.senderName
            }
        });

        if (result.sent > 0) {
            return { success: true, message: `Test email sent successfully to ${targetEmail}.` };
        }
        return { success: false, message: result.errors?.[0]?.error || "Unable to send test email." };
    } catch (error) {
        return { success: false, message: error.message || "Email verification failed." };
    }
};

const sendEmailExport = sendEmail;
sendEmailExport.sendEmail = sendEmail;
sendEmailExport.sendNotificationEmail = sendNotificationEmail;
sendEmailExport.buildEmailTemplate = buildEmailTemplate;
sendEmailExport.getEmailCredentials = getEmailCredentials;
sendEmailExport.testEmailConnection = testEmailConnection;
sendEmailExport.isValidEmail = isValidEmail;
sendEmailExport.normalizeEmail = normalizeEmail;

module.exports = sendEmailExport;
    