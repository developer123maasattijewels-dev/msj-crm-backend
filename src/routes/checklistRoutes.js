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

router.post("/", addChecklist);
router.post("/import-excel", upload.single("file"), importChecklistsExcel);
router.post("/:id/responses", submitChecklistResponse);
router.get("/", getChecklists);
router.get("/:id", getChecklistById);
router.put("/:id", updateChecklist);
router.delete("/:id", deleteChecklist);

module.exports = router;
