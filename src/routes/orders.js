const express = require('express');
const router = express.Router();

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
    deleteOrder
} = require('../controller/Orders');

// Order Form Template Routes (must be declared before /:id)
router.post('/forms', createOrderForm);
router.get('/forms', getOrderForms);
router.get('/forms/:id', getOrderFormById);
router.put('/forms/:id', updateOrderForm);
router.delete('/forms/:id', deleteOrderForm);

// Orders Routes
router.post('/add', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

module.exports = router;
