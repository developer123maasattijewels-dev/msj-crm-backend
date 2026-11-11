const mongoose = require("mongoose");

const emailProfileSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            unique: true,
            default: "default",
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: ""
        },
        appPassword: {
            type: String,
            trim: true,
            default: ""
        },
        senderName: {
            type: String,
            trim: true,
            default: "Maa Satti Jewels CRM"
        },
        enabled: {
            type: Boolean,
            default: true
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

const EmailProfile = mongoose.models.EmailProfile || mongoose.model("EmailProfile", emailProfileSchema);

module.exports = EmailProfile;
