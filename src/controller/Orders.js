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
const getOrderForms = async (req, res) => {
    try {
        let forms = await OrderForm.find().sort({ createdAt: -1 });

        // If no forms exist yet, seed standard default templates so admin has initial forms ready
        if (forms.length === 0) {
            const defaultForms = [
                {
                    name: 'Bespoke Jewellery Order',
                    description: 'Custom jewellery manufacturing & design order form',
                    fields: [
                        { id: 'f_customer', label: 'Customer Name', type: 'text', placeholder: 'Enter customer name', required: true, options: [] },
                        { id: 'f_phone', label: 'Phone Number', type: 'tel', placeholder: 'Enter phone number', required: true, options: [] },
                        { id: 'f_email', label: 'Email Address', type: 'email', placeholder: 'Enter email address', required: false, options: [] },
                        { id: 'f_product', label: 'Product Name', type: 'text', placeholder: 'e.g. Diamond Solitaire Ring', required: true, options: [] },
                        { id: 'f_category', label: 'Category', type: 'select', placeholder: '', required: false, options: ['Rings', 'Necklaces', 'Bangles', 'Earrings', 'Pendants', 'Chains', 'Custom Bespoke'] },
                        { id: 'f_purity', label: 'Metal & Purity', type: 'select', placeholder: '', required: false, options: ['22K Gold (916)', '18K Gold (750)', '14K Gold (585)', '925 Sterling Silver', 'Platinum 950'] },
                        { id: 'f_weight', label: 'Gross Weight (g)', type: 'number', placeholder: 'e.g. 15.5', required: false, options: [] },
                        { id: 'f_amount', label: 'Total Amount (₹)', type: 'number', placeholder: '₹ Enter total amount', required: true, options: [] },
                        { id: 'f_advance', label: 'Advance Paid (₹)', type: 'number', placeholder: '₹ Enter advance paid', required: false, options: [] },
                        { id: 'f_delivery_date', label: 'Delivery Date', type: 'date', placeholder: '', required: false, options: [] },
                        { id: 'f_notes', label: 'Design Specifications / Notes', type: 'textarea', placeholder: 'Size, hallmark, stone specifications...', required: false, options: [] }
                    ]
                },
                {
                    name: 'Jewellery Repair & Polish',
                    description: 'Repair, resizing, stone replacement or polish job card',
                    fields: [
                        { id: 'f_customer', label: 'Customer Name', type: 'text', placeholder: 'Customer full name', required: true, options: [] },
                        { id: 'f_phone', label: 'Phone Number', type: 'tel', placeholder: 'Customer contact number', required: true, options: [] },
                        { id: 'f_product', label: 'Item / Product', type: 'text', placeholder: 'e.g. Gold Kada, Diamond Earring', required: true, options: [] },
                        { id: 'f_service_type', label: 'Service Type', type: 'select', placeholder: '', required: true, options: ['Polishing & Rhodium', 'Ring Resizing', 'Stone Replacement', 'Solder / Joint Fix', 'Laser Repair', 'Custom Modification'] },
                        { id: 'f_amount', label: 'Estimated Service Cost (₹)', type: 'number', placeholder: '₹ Estimated charges', required: true, options: [] },
                        { id: 'f_delivery_date', label: 'Due Date', type: 'date', placeholder: '', required: false, options: [] },
                        { id: 'f_description', label: 'Work Description', type: 'textarea', placeholder: 'Condition of piece, customer request', required: false, options: [] }
                    ]
                }
            ];

            try {
                forms = await OrderForm.insertMany(defaultForms);
            } catch (seedErr) {
                console.log('Seed form note:', seedErr.message);
                forms = defaultForms;
            }
        }

        res.status(200).json({
            success: true,
            data: forms
        });
    } catch (error) {
        res.status(500).json({
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
            createdBy
        } = req.body;

        const isReceipt = Boolean(
            hasReceipt === true ||
            hasReceipt === 'yes' ||
            generateReceipt === true ||
            generateReceipt === 'yes'
        );
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
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
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
