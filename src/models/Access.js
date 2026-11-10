const mongoose = require("mongoose");

const accessSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },

    resourceKey: {
        type: String,
        required: true,
        trim: true
    },

    permissions: {
        type: [{
            type: String,
            enum: [
                "view",
                "create",
                "edit",
                "delete",
                "approve",
                "export"
            ]
        }],
        default: ["view"]
    }

}, {
    timestamps: true
});

// One user can have only one record per module
accessSchema.index(
    { userId: 1, resourceKey: 1 },
    { unique: true }
);

module.exports = mongoose.model("Access", accessSchema);