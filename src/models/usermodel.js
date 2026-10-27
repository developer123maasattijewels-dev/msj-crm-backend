
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        department: {
            type: String,
            required: true,
            trim: true
        },
        designation: {
            type: String,
            trim: true
        },
        role: {
            type: String,
            required: true,
            enum: ['Admin', 'Manager', 'Employee']
        },
        image: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);


const Users = new mongoose.model('User', userSchema);

module.exports = Users
