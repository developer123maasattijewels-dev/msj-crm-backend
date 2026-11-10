const mongoose = require("mongoose");

const Access = require("../models/Access");
const sidebarModules = require("../config/sidebarmodule");



const getModules = async (req, res) => {
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

        // Validate each module and permission
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

            // Any action permission requires view permission
            if (
                item.permissions.some(p => p !== "view") &&
                !item.permissions.includes("view")
            ) {
                return res.status(400).json({
                    success: false,
                    message: "View permission is required for other actions"
                });
            }

        }

        // Prevent duplicate modules
        const resourceKeys = accesses.map(
            item => item.resourceKey
        );

        if (new Set(resourceKeys).size !== resourceKeys.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate modules are not allowed"
            });
        }

        // Prepare bulk operations
        const operations = accesses.map(item => ({
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

        // Remove previously assigned modules
        // that are unchecked by Admin
        await Access.deleteMany({
            userId,
            resourceKey: {
                $nin: resourceKeys
            }
        });

        return res.status(200).json({
            success: true,
            message: "User access updated successfully"
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


module.exports = {
    getModules,
    assignAccess,
    getUserAccess
};