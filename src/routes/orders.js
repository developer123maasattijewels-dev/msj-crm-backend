const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
    createOrderForm,
    getOrderForms,
    getOrderFormById,
    updateOrderForm,
    deleteOrderForm,
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    verifyInventory,
    importOrdersExcel,
    exportOrdersExcel
} = require('../controller/Orders');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
            return cb(new Error('Only Excel or CSV files (.xlsx, .xls, .csv) are allowed.'));
        }
        cb(null, true);
    }
});

// Order Form Template Routes (must be declared before /:id)
router.post('/forms', createOrderForm);
router.get('/forms', getOrderForms);
router.get('/forms/:id', getOrderFormById);
router.put('/forms/:id', updateOrderForm);
router.delete('/forms/:id', deleteOrderForm);

// Orders Routes
router.post('/add', createOrder);
router.post('/import-excel', upload.single('file'), importOrdersExcel);
router.get('/export-excel', exportOrdersExcel);
router.post('/export-excel', exportOrdersExcel);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);
router.put('/:id/inventory', verifyInventory);
router.post('/:id/inventory-verify', verifyInventory);
router.delete('/:id', deleteOrder);

module.exports = router;
