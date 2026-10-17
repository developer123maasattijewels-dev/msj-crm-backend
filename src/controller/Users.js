const Users = require("../models/usermodel")

const add = async (req, res) => {
    try {
        const {
            name,
            email,
            department,
            designation,
            role,
            image
        } = req.body;

        if (!name || !email || !department || !designation || !role) {
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
            department,
            designation,
            role,
            image: image || null
        });

        return res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: user
        });

    } catch (error) {
        console.error('Create user error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while creating the user.'
        });
    }
};

const get = async (req, res) => {
    try {
        const get = await Users.find()
        res.status(201).json({ message: 'User Get Succesfully', User: get })
    } catch (error) {
        res.status(500).json({ message: 'User not Succesfully' })
    }
}

const getByid = async (req, res) => {
    try {
        const { id } = req.params

        const getUsers = await Users.findById(id)
        res.status(201).json({ message: 'User get Successfully', User: getUsers })
    } catch (error) {
        res.status(500).json({ message: 'User Not get Successfully', error })
    }
}

const update = async (req, res) => {
    try {
        const { id } = req.params;

        const allowedFields = [
            'name',
            'email',
            'department',
            'designation',
            'role'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
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

        const user = await Users.findByIdAndUpdate(
            id,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User updated successfully.',
            data: user
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



module.exports = { add, get, getByid , deleteUsers ,  update};