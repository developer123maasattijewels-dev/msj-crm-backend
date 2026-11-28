const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
} = require("../controller/employeeController");

const router = express.Router();

const uploadDirectory = path.resolve(__dirname, "../../public/Uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

const employeeUpload = multer({
    storage: multer.diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
            const ext = path.extname(file.originalname || "").toLowerCase();
            callback(null, `emp-${randomUUID()}${ext}`);
        },
    }),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 15,
    },
    fileFilter: (req, file, callback) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(file.mimetype)) {
            return callback(new Error("Upload a valid image (JPG, PNG, WEBP) or PDF file."));
        }
        callback(null, true);
    },
});

const handleEmployeeUploads = (req, res, next) => {
    employeeUpload.any()(req, res, (error) => {
        if (error) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "Each uploaded file must be 10 MB or smaller."
                    : error.code === "LIMIT_FILE_COUNT"
                        ? "Too many files uploaded in a single request."
                        : error.message;
            return res.status(400).json({ success: false, message });
        }
        next();
    });
};

router.post("/add", handleEmployeeUploads, createEmployee);
router.post("/", handleEmployeeUploads, createEmployee);
router.get("/all", getAllEmployees);
router.get("/get", getAllEmployees);
router.get("/", getAllEmployees);
router.get("/:id", getEmployeeById);
router.put("/:id", handleEmployeeUploads, updateEmployee);
router.patch("/:id", handleEmployeeUploads, updateEmployee);
router.delete("/:id", deleteEmployee);

module.exports = router;
