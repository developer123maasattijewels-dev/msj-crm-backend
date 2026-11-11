const authenticateUser = require("./authenticateUser");

const requireAdmin = (req, res, next) => authenticateUser(req, res, () => {
    if (req.authUser?.role?.toLowerCase() !== "admin") {
        return res.status(403).json({ success: false, message: "Only administrators can manage access." });
    }
    return next();
});

module.exports = requireAdmin;
