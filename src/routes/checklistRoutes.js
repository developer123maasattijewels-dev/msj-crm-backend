const express = require("express");
const {
    addChecklist,
    getChecklists,
    getChecklistById,
    submitChecklistResponse,
    importChecklistsExcel,
    updateChecklist,
    deleteChecklist
} = require("../controller/checklistController");
const multer = require("multer");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
            return cb(new Error("Only Excel or CSV files are allowed."));
        }
        cb(null, true);
    }
});

const handleExcelUpload = (req, res, next) => {
    upload.single("file")(req, res, err => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || "Invalid Excel or CSV upload."
            });
        }
        next();
    });
};

router.post("/", addChecklist);
router.post("/import-excel", handleExcelUpload, importChecklistsExcel);
router.post("/:id/responses", submitChecklistResponse);
router.get("/", getChecklists);
router.get("/:id", getChecklistById);
router.put("/:id", updateChecklist);
router.delete("/:id", deleteChecklist);

module.exports = router;
