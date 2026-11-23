const Order = require('../models/orders');
const OrderForm = require('../models/orderForm');
const { notifyOrderCreated, notifyInventoryVerified } = require('../comman/notificationService');

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

        let orderImages = [];
        if (Array.isArray(images) && images.length > 0) {
            orderImages = images;
        } else if (typeof images === 'string' && images.trim()) {
            orderImages = [images.trim()];
        } else if (Array.isArray(customFields?.images) && customFields.images.length > 0) {
            orderImages = customFields.images;
        } else if (typeof customFields?.image === 'string' && customFields.image.trim()) {
            orderImages = [customFields.image.trim()];
        }

        if (orderImages.length === 0 && customFields && typeof customFields === 'object') {
            for (const [k, v] of Object.entries(customFields)) {
                if (!v) continue;
                const kLower = k.toLowerCase();
                if (kLower.includes('image') || kLower.includes('photo') || kLower.includes('design') || kLower.includes('pic') || kLower.includes('cad')) {
                    if (Array.isArray(v)) {
                        orderImages.push(...v.filter(Boolean));
                    } else if (typeof v === 'string' && v.trim()) {
                        orderImages.push(v.trim());
                    }
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
            images: orderImages,
            status: status || 'Processing',
            inventoryStatus: 'Pending Verification',
            inventoryDetails: {
                orderNumber: orderId,
                clientName: custName,
                clientCode: customFields?.['Client Code'] || customFields?.['client code'] || customFields?.clientCode || '',
                skuCode: customFields?.['SKU Code'] || customFields?.['sku code'] || customFields?.sku || '',
                productName: prodName,
                requiredQuantity: customFields?.['Quantity'] || customFields?.['quantity'] || customFields?.qty || '1',
                goldWeight: customFields?.['Gold Weight'] || customFields?.['gross weight'] || customFields?.weight || '',
                diamondDetails: customFields?.['Diamond Details'] || customFields?.['diamond quality'] || '',
                status: 'Pending Verification',
                remarks: '',
                submittedToPC: false
            },
            payment: payment || 'Pending',
            hasReceipt: isReceipt,
            receiptNo: assignedReceiptNo,
            receiptDate: isReceipt ? new Date() : null,
            createdBy: createdBy || null
        });

        // Trigger notification to Inventory Department
        notifyOrderCreated({
            order,
            senderUserId: createdBy || req.headers['x-user-id'] || null
        }).catch(err => console.error('[Orders] Error notifying inventory department:', err));

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

        // If inventory was verified and submitToPC is set, notify PC
        if (updateData.submitToPC && order) {
            const actorName = req.headers['x-user-name']
                ? decodeURIComponent(req.headers['x-user-name'])
                : (order.inventoryDetails?.verifiedBy || 'Inventory Officer');
            const actorUserId = req.headers['x-user-id'] || null;

            notifyInventoryVerified({
                order,
                inventoryDetails: order.inventoryDetails || {},
                senderUserId: actorUserId,
                actorName
            }).catch(err => console.error('[Orders] Error sending PC notification on update:', err));
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

// VERIFY INVENTORY & NOTIFY PC
const verifyInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            inventoryDetails = {},
            inventoryStatus,
            submitToPC = true
        } = req.body;

        const actorName = req.headers['x-user-name']
            ? decodeURIComponent(req.headers['x-user-name'])
            : (inventoryDetails?.verifiedBy || 'Inventory Officer');
        const actorUserId = req.headers['x-user-id'] || null;

        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const currentDetails = existingOrder.inventoryDetails || {};
        const mergedDetails = {
            ...currentDetails,
            ...inventoryDetails,
            verifiedBy: actorName,
            verifiedAt: new Date(),
            submittedToPC: Boolean(submitToPC)
        };

        const resolvedStatus = inventoryStatus || mergedDetails.status || (submitToPC ? 'Verified' : 'Draft');
        mergedDetails.status = resolvedStatus;

        const updatedCustomFields = {
            ...(existingOrder.customFields || {}),
            'Inventory Status': resolvedStatus,
            'Inventory Remarks': mergedDetails.remarks || '',
            'Inventory Available Qty': mergedDetails.availableQuantity || '',
            'Inventory Shortage Qty': mergedDetails.shortageQuantity || '',
            'Inventory Verified By': actorName,
            'Inventory Verified Date': new Date().toISOString()
        };

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            {
                inventoryStatus: resolvedStatus,
                inventoryDetails: mergedDetails,
                customFields: updatedCustomFields
            },
            { new: true, runValidators: true }
        );

        if (submitToPC) {
            notifyInventoryVerified({
                order: updatedOrder,
                inventoryDetails: mergedDetails,
                senderUserId: actorUserId,
                actorName
            }).catch(err => console.error('[Orders] Error sending PC notification:', err));
        }

        return res.status(200).json({
            success: true,
            message: submitToPC
                ? 'Inventory verification submitted and PC Department notified successfully!'
                : 'Inventory draft saved successfully.',
            data: updatedOrder
        });

    } catch (error) {
        console.error('Verify Inventory Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update inventory verification',
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
    deleteOrder,
    verifyInventory
};
