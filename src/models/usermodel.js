
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
            enum: ['Sales', 'Marketing', 'IT', 'MIS', 'ED', 'HR', 'Finance', 'CAD', 'Camming']
        },
        designation: {
            type: String,
            required: true,
            enum: ['Sales Executive', 'Marketing Manager', 'Software Developer', 'HR manager', 'Digital Marketing', 'Financial Analyst', 'Cad Desginer', 'Production']
        },
        role: {
            type: String,
            required: true,
            enum: ['Admin', 'Manager', 'Employee']
        },
        
    },
    {
        timestamps: true
    }
);


const Users = new mongoose.model('User', userSchema);

module.exports = Users
