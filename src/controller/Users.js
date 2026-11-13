const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Users = require("../models/usermodel");
const { notifyUserWelcome } = require("../comman/notificationService");
const { isValidEmail } = require("../comman/emailsender");

const sanitizeUser = (user) => {
    if (!user) return null;
    const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
    const hasAppPassword = Boolean(obj.appPassword && String(obj.appPassword).trim());
    delete obj.password;
    obj.senderEmail = obj.senderEmail || "";
    obj.appPassword = "";
    obj.hasAppPassword = hasAppPassword;
    obj.emailNotificationsEnabled = obj.emailNotificationsEnabled !== false;
    return obj;
};

const add = async (req, res) => {
    try {
        const {
            name,
            email,
            department,
            designation,
            subCategory,
            role,
            password,
            image,
            senderEmail,
            appPassword,
            emailNotificationsEnabled
        } = req.body;

        const finalDesignation = (designation || subCategory || "").trim();

        if (!name || !email || !department || !finalDesignation || !role || !password) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided.'
            });
        }
        const existingUser = await Users.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        const user = await Users.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            department: department.trim(),
            designation: finalDesignation,
            role,
            password,
            image: typeof image === "string" ? image.trim() : "",
            senderEmail: typeof senderEmail === "string" ? senderEmail.trim().toLowerCase() : "",
            appPassword: typeof appPassword === "string" ? appPassword.trim() : "",
            emailNotificationsEnabled: emailNotificationsEnabled !== false
        });

        notifyUserWelcome({ user }).catch((err) => {
            console.error("Welcome email error:", err);
        });

        return res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: sanitizeUser(user)
        });

    } catch (error) {
        console.error('Create user error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while creating the user.'
        });
    }
};

const get = async (_req, res) => {
    try {
        const users = await Users.find().select('-password');
        const sanitized = users.map(sanitizeUser);
        res.status(200).json({ message: 'User Get Succesfully', User: sanitized });
    } catch (error) {
        res.status(500).json({ message: 'User not Succesfully' });
    }
};

const getByid = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }

        const user = await Users.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.status(200).json({
            success: true,
            message: 'User get Successfully',
            User: sanitizeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'User Not get Successfully', error: error.message });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }

        const allowedFields = [
            'name',
            'email',
            'department',
            'designation',
            'role',
            'image',
            'senderEmail',
            'emailNotificationsEnabled'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (req.body.clearAppPassword === true) {
            updates.appPassword = '';
        } else if (typeof req.body.appPassword === 'string' && req.body.appPassword.trim()) {
            updates.appPassword = req.body.appPassword.trim();
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one valid field is required to update.'
            });
        }

        if (updates.name !== undefined) {
            if (typeof updates.name !== 'string' || !updates.name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Name must be a valid non-empty string.'
                });
            }
            updates.name = updates.name.trim();
        }

        if (updates.email !== undefined) {
            if (typeof updates.email !== 'string' || !updates.email.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Email must be a valid non-empty string.'
                });
            }
            updates.email = updates.email.trim().toLowerCase();
        }

        if (updates.senderEmail !== undefined) {
            if (typeof updates.senderEmail !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Sender email must be a string.'
                });
            }
            const trimmedSender = updates.senderEmail.trim().toLowerCase();
            if (trimmedSender && !isValidEmail(trimmedSender)) {
                return res.status(400).json({
                    success: false,
                    message: 'Enter a valid sender email address.'
                });
            }
            updates.senderEmail = trimmedSender;
        }

        if (updates.emailNotificationsEnabled !== undefined) {
            updates.emailNotificationsEnabled = Boolean(updates.emailNotificationsEnabled);
        }

        for (const field of ['department', 'designation', 'role']) {
            if (updates[field] !== undefined) {
                if (typeof updates[field] !== 'string' || !updates[field].trim()) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} must be a valid non-empty string.`
                    });
                }
                updates[field] = updates[field].trim();
            }
        }

        if (updates.image !== undefined && typeof updates.image !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Image must be a valid URL string.'
            });
        }

        const user = await Users.findByIdAndUpdate(
            id,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User updated successfully.',
            data: sanitizeUser(user)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while updating the user.'
        });
    }
};

const deleteUsers = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await Users.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User deleted successfully.'
        });

    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID.'
            });
        }

        console.error('Delete user error:', error);

        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while deleting the user.'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password, role, department, category, designation } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Server authentication is not configured. Set JWT_SECRET.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await Users.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Role verification (if role is specified and not auto/all)
        const isRoleFilter = role &&
            role.toLowerCase() !== 'all' &&
            role.toLowerCase() !== 'auto' &&
            role.toLowerCase() !== 'auto-detect';

        if (isRoleFilter && user.role && user.role.toLowerCase() !== role.trim().toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Selected role '${role}' does not match your account role ('${user.role}').`
            });
        }

        // Department verification (if department is specified and not auto/all)
        const isDeptFilter = department &&
            department.toLowerCase() !== 'all' &&
            department.toLowerCase() !== 'all departments' &&
            department.toLowerCase() !== 'auto' &&
            department.toLowerCase() !== 'auto-detect';

        if (isDeptFilter && user.department && user.department.toLowerCase() !== department.trim().toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Selected department '${department}' does not match your account department ('${user.department}').`
            });
        }

        const isValid = user.password === password;

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const userObj = sanitizeUser(user);

        // Ensure category and designation are always populated for downstream pages
        userObj.category = userObj.category || userObj.designation || category || designation || '';
        userObj.designation = userObj.designation || userObj.category || designation || category || '';

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token: jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '12h' }),
            user: userObj
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred during login.'
        });
    }
};

const registerAdmin = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            department,
            designation,
            image,
            senderEmail,
            appPassword
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required for admin registration.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await Users.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        const adminUser = await Users.create({
            name: name.trim(),
            email: normalizedEmail,
            password: String(password).trim(),
            department: (department || 'Administration').trim(),
            designation: (designation || 'Administrator').trim(),
            role: 'Admin',
            image: typeof image === "string" ? image.trim() : "",
            senderEmail: typeof senderEmail === "string" ? senderEmail.trim().toLowerCase() : "",
            appPassword: typeof appPassword === "string" ? appPassword.trim() : "",
            emailNotificationsEnabled: true
        });

        const token = jwt.sign(
            { id: adminUser._id.toString(), role: 'Admin' },
            process.env.JWT_SECRET || 'msj_secret_fallback',
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            success: true,
            message: 'Admin registered successfully.',
            token,
            user: sanitizeUser(adminUser)
        });
    } catch (error) {
        console.error('Admin register error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'An unexpected error occurred during admin registration.'
        });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await Users.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        if (user.role?.toLowerCase() !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to administrators only.'
            });
        }

        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            { id: user._id.toString(), role: 'Admin' },
            process.env.JWT_SECRET || 'msj_secret_fallback',
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Admin login successful.',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred during admin login.'
        });
    }
};

module.exports = {
    add,
    get,
    getByid,
    deleteUsers,
    update,
    login,
    registerAdmin,
    loginAdmin,
    sanitizeUser
};
