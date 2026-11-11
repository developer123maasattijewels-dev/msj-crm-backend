const EmailProfile = require("../models/emailProfileModel");
const Users = require("../models/usermodel");
const Access = require("../models/Access");
const { isValidEmail, testEmailConnection } = require("../comman/emailsender");

const formatEmailProfileResponse = (doc) => ({
    email: doc?.email || "",
    appPassword: "",
    hasAppPassword: Boolean(doc?.appPassword && doc.appPassword.trim()),
    senderName: doc?.senderName || "Maa Satti Jewels CRM",
    enabled: doc?.enabled !== false,
    updatedAt: doc?.updatedAt || null
});

const requireEmailProfileAccess = async (req, res, next) => {
    const user = req.authUser;
    if (!user) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (String(user.role || "").toLowerCase() === "admin") {
        return next();
    }
    const settingsAccess = await Access.findOne({
        userId: user._id,
        resourceKey: "settings",
        permissions: "edit"
    }).lean();

    if (!settingsAccess) {
        return res.status(403).json({
            success: false,
            message: "Only administrators or authorized settings editors can update email profile."
        });
    }
    return next();
};

const getEmailProfile = async (_req, res) => {
    try {
        const doc = await EmailProfile.findOne({ key: "default" }).lean();
        return res.status(200).json({
            success: true,
            data: formatEmailProfileResponse(doc)
        });
    } catch (error) {
        console.error("Get email profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load email profile."
        });
    }
};

const updateEmailProfile = async (req, res) => {
    try {
        const {
            email,
            appPassword,
            clearAppPassword = false,
            senderName,
            enabled
        } = req.body || {};

        const updates = {};

        if (email !== undefined) {
            if (typeof email !== "string") {
                return res.status(400).json({ success: false, message: "Email must be a string." });
            }
            const trimmedEmail = email.trim().toLowerCase();
            if (trimmedEmail && !isValidEmail(trimmedEmail)) {
                return res.status(400).json({ success: false, message: "Enter a valid sender email address." });
            }
            updates.email = trimmedEmail;
        }

        if (clearAppPassword === true) {
            updates.appPassword = "";
        } else if (typeof appPassword === "string" && appPassword.trim()) {
            updates.appPassword = appPassword.trim();
        }

        if (senderName !== undefined) {
            updates.senderName = String(senderName || "").trim() || "Maa Satti Jewels CRM";
        }

        if (enabled !== undefined) {
            updates.enabled = Boolean(enabled);
        }

        if (req.authUser?._id) {
            updates.updatedBy = req.authUser._id;
        }

        const doc = await EmailProfile.findOneAndUpdate(
            { key: "default" },
            { $set: { key: "default", ...updates } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

        return res.status(200).json({
            success: true,
            message: "Email profile updated successfully.",
            data: formatEmailProfileResponse(doc)
        });
    } catch (error) {
        console.error("Update email profile error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to update email profile."
        });
    }
};

const testEmailProfile = async (req, res) => {
    try {
        const { to, email, appPassword, senderName } = req.body || {};
        let recipient = typeof to === "string" ? to.trim().toLowerCase() : "";

        if (!recipient && req.authUser?._id) {
            const authRecord = await Users.findById(req.authUser._id).select("email").lean();
            recipient = authRecord?.email || "";
        }

        const result = await testEmailConnection({
            to: recipient,
            email: typeof email === "string" ? email.trim().toLowerCase() : undefined,
            appPassword: typeof appPassword === "string" ? appPassword.trim() : undefined,
            senderName,
            senderUserId: req.authUser?._id
        });

        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error("Test email profile error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to test email configuration."
        });
    }
};

module.exports = {
    getEmailProfile,
    updateEmailProfile,
    testEmailProfile,
    requireEmailProfileAccess
};
