const mongoose = require("mongoose");

const Access = require("../models/Access");
const sidebarModules = require("../config/sidebarmodule");



const getModules = async (_req, res) => {
    try {

        return res.status(200).json({
            success: true,
            message: "Sidebar modules fetched successfully",
            data: sidebarModules
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


const assignAccess = async (req, res) => {
    try {

        const { userId, accesses } = req.body;

        // Validate required fields
        if (!userId || !Array.isArray(accesses)) {
            return res.status(400).json({
                success: false,
                message: "User ID and accesses are required"
            });
        }

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const isUserAdmin = req.authUser?.role?.toLowerCase() === "admin";
        if (!isUserAdmin && req.authUser?._id?.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only administrators can assign permissions."
            });
        }

        const validModules = sidebarModules.map(
            module => module.key
        );

        const validPermissions = [
            "view",
            "create",
            "edit",
            "delete",
            "approve",
            "export"
        ];

        // Prepare parent map to auto-grant view on parent if child subpage has view
        const parentMap = {};
        sidebarModules.forEach(mod => {
            if (mod.parentKey) {
                parentMap[mod.key] = mod.parentKey;
            }
        });

        // Filter and sanitize accesses
        const normalizedAccesses = [];
        const seenKeys = new Set();

        for (const item of accesses) {
            if (!item.resourceKey || !validModules.includes(item.resourceKey)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid module: ${item.resourceKey}`
                });
            }

            if (!Array.isArray(item.permissions)) {
                return res.status(400).json({
                    success: false,
                    message: "Permissions must be an array"
                });
            }

            if (
                item.permissions.some(
                    permission => !validPermissions.includes(permission)
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid permission for ${item.resourceKey}`
                });
            }

            // Remove duplicates from permissions array
            let cleanedPerms = [...new Set(item.permissions)];

            // Any action permission requires view permission
            if (
                cleanedPerms.some(p => p !== "view") &&
                !cleanedPerms.includes("view")
            ) {
                cleanedPerms = ["view", ...cleanedPerms];
            }

            if (cleanedPerms.length > 0) {
                if (seenKeys.has(item.resourceKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate module: ${item.resourceKey}`
                    });
                }
                seenKeys.add(item.resourceKey);
                normalizedAccesses.push({
                    resourceKey: item.resourceKey,
                    permissions: cleanedPerms
                });
            }
        }

        // Auto-ensure parent container has "view" if any subpage is granted
        for (const item of [...normalizedAccesses]) {
            const parentKey = parentMap[item.resourceKey];
            if (parentKey && !seenKeys.has(parentKey) && item.permissions.includes("view")) {
                normalizedAccesses.push({
                    resourceKey: parentKey,
                    permissions: ["view"]
                });
                seenKeys.add(parentKey);
            }
        }

        const resourceKeys = normalizedAccesses.map(
            item => item.resourceKey
        );

        // Prepare bulk operations
        const operations = normalizedAccesses.map(item => ({
            updateOne: {
                filter: {
                    userId,
                    resourceKey: item.resourceKey
                },
                update: {
                    $set: {
                        permissions: item.permissions
                    }
                },
                upsert: true
            }
        }));

        // Insert or update permissions
        if (operations.length > 0) {
            await Access.bulkWrite(operations);
        }

        // Remove previously assigned modules that are unchecked
        await Access.deleteMany({
            userId,
            resourceKey: {
                $nin: resourceKeys
            }
        });

        return res.status(200).json({
            success: true,
            message: "User access updated successfully",
            count: normalizedAccesses.length
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


const getUserAccess = async (req, res) => {
    try {

        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const accesses = await Access.find({ userId })
            .sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            message: "User access fetched successfully",
            data: accesses
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const getAllAccess = async (_req, res) => {
    try {
        const accesses = await Access.find().select("userId resourceKey permissions");
        return res.status(200).json({
            success: true,
            message: "Employee access fetched successfully",
            data: accesses
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    getModules,
    assignAccess,
    getUserAccess,
    getAllAccess
};
