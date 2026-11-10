const jwt = require("jsonwebtoken");
const Users = require("../models/usermodel");

const authenticateUser = async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, message: "Server authentication is not configured." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded._id || decoded.userId;
        const user = userId && await Users.findById(userId).select("_id role");
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid authentication token." });
        }
        req.authUser = user;
        return next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ success: false, message: "Invalid or expired authentication token." });
        }
        return next(error);
    }
};

module.exports = authenticateUser;
