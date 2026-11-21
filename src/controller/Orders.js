const Order = require('../models/orders');
const OrderForm = require('../models/orderForm');

// ── ORDER FORM TEMPLATES CRUD ──────────────────────────────────────────────

// CREATE ORDER FORM TEMPLATE
const createOrderForm = async (req, res) => {
    try {
        const { name, description = '', fields = [], createdBy } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Form name is required'
            });
        }

        if (!Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please add at least one field to the form'
            });
        }

        const orderForm = await OrderForm.create({
            name: name.trim(),
            description: description ? description.trim() : '',
            fields,
            createdBy: createdBy || null
        });

        res.status(201).json({
            success: true,
            message: 'Order form created successfully',
            data: orderForm
        });
    } catch (error) {
        console.error('Create Order Form Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order form',
            error: error.message
        });
    }
};

// GET ALL ORDER FORMS

// GET ALL ORDER FORMS
const getOrderForms = async (req, res) => {
    try {
        const forms = await OrderForm.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: forms
        });

    } catch (error) {
        console.error('Get Order Forms Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch order forms',
            error: error.message
        });
    }
};


// GET SINGLE ORDER FORM
const getOrderFormById = async (req, res) => {
    try {
        const form = await OrderForm.findById(req.params.id);
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Order form not found'
            });
        }

        res.status(200).json({
            success: true,
            data: form
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order form',
            error: error.message
        });
    }
};

// UPDATE ORDER FORM
const updateOrderForm = async (req, res) => {
    try {
        const form = await OrderForm.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Order form not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order form updated successfully',
            data: form
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update order form',
            error: error.message
        });
    }
};

// DELETE ORDER FORM
const deleteOrderForm = async (req, res) => {
    try {
        const form = await OrderForm.findByIdAndDelete(req.params.id);

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Order form not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order form deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete order form',
            error: error.message
        });
    }
};

// ── ORDERS CRUD ────────────────────────────────────────────────────────────

// CREATE ORDER
const createOrder = async (req, res) => {
    try {
        const {
            formId,
            formType,
            customer,
            product,
            phone,
            amount,
            date,
            customFieldDefinitions = [],
            customFields = {},
            status,
            payment,
            hasReceipt,
            generateReceipt,
            receiptNo,
            images = [],
            createdBy
        } = req.body;

        let isReceipt = Boolean(
            hasReceipt === true ||
            hasReceipt === 'yes' ||
            generateReceipt === true ||
            generateReceipt === 'yes'
        );

        if (!isReceipt && customFields && typeof customFields === 'object') {
            for (const [key, val] of Object.entries(customFields)) {
                if (val === undefined || val === null || val === '') continue;
                const kLower = key.toLowerCase();
                if (kLower.includes('receipt') || kLower.includes('recipt')) {
                    const vLower = String(val).trim().toLowerCase();
                    if (vLower === 'yes' || vLower === 'true' || vLower === '1' || vLower === 'generate') {
                        isReceipt = true;
                        break;
                    }
                }
            }
        }

        const assignedReceiptNo = receiptNo || (isReceipt ? `RCP-${Date.now().toString().slice(-6)}` : '');
        const orderId = `ORD-${Date.now()}`;

        // Ensure key values are extracted from customFields if not provided at root
        let custName = customer || '';
        let prodName = product || '';
        let ph = phone || '';
        let amt = Number(amount) || 0;

        if (!custName || !prodName || !amt) {
            for (const [key, val] of Object.entries(customFields)) {
                if (val === undefined || val === null || val === '') continue;
                const kLower = key.toLowerCase();
                if (!custName && (kLower.includes('customer') || kLower.includes('client') || kLower === 'name')) {
                    custName = String(val);
                }
                if (!prodName && (kLower.includes('product') || kLower.includes('item') || kLower.includes('article'))) {
                    prodName = String(val);
                }
                if (!ph && (kLower.includes('phone') || kLower.includes('mobile') || kLower.includes('contact'))) {
                    ph = String(val);
                }
                if (!amt && (kLower.includes('amount') || kLower.includes('total') || kLower.includes('price'))) {
                    amt = Number(String(val).replace(/[^\d.-]/g, '')) || 0;
                }
            }
        }

        const orderImages = Array.isArray(images) && images.length > 0
            ? images
            : (Array.isArray(customFields?.images) ? customFields.images : []);

        const order = await Order.create({
            orderId,
            formId: formId || null,
            formType: formType || '',
            customer: custName,
            product: prodName,
            phone: ph,
            amount: amt,
            date: date || new Date().toISOString().split('T')[0],
            customFieldDefinitions,
            customFields,
            images: orderImages,
            status: status || 'Processing',
            payment: payment || 'Pending',
            hasReceipt: isReceipt,
            receiptNo: assignedReceiptNo,
            receiptDate: isReceipt ? new Date() : null,
            createdBy: createdBy || null
        });

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: error.message
        });
    }
};

// GET ALL ORDERS
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: orders
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
};

// GET SINGLE ORDER
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
};

// UPDATE ORDER
const updateOrder = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.hasReceipt === true || updateData.generateReceipt === true) {
            updateData.hasReceipt = true;
            if (!updateData.receiptNo) {
                updateData.receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
            }
            if (!updateData.receiptDate) {
                updateData.receiptDate = new Date();
            }
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order updated successfully',
            data: order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update order',
            error: error.message
        });
    }
};

// DELETE ORDER
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete order',
            error: error.message
        });
    }
};

module.exports = {
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
};
