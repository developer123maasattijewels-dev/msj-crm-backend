const express = require('express');
const { addLeads, getLeads, getLeadsId, updateLeads, leadsDelete, leadsfilter, searchLeads, getLeadHistory, importLeadsExcel } = require('../controller/leadscontroller');
const router = express.Router();
const multer = require("multer");


router.post('/add', addLeads);
router.get('/get', getLeads);
router.get('/get/:id', getLeadsId);
router.patch('/update/:id', updateLeads);
router.delete('/delete/:id', leadsDelete);
router.get('/filter', leadsfilter);
router.get('/search', searchLeads);
router.get('/history/:leadId', getLeadHistory);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = /\.(xlsx|xls|csv)$/i;

        if (!allowedExtensions.test(file.originalname)) {
            return cb(
                new Error("Only Excel or CSV files are allowed")
            );
        }

        cb(null, true);
    }
});

// Excel se multiple leads import
router.post(
    "/import-excel",
    upload.single("file"),
    importLeadsExcel
);


module.exports = router;