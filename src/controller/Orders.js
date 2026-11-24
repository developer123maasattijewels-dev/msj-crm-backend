const mongoose = require('mongoose');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const Order = require('../models/orders');
const OrderForm = require('../models/orderForm');
const { notifyOrderCreated, notifyInventoryVerified } = require('../comman/notificationService');

const getOrderQuery = (id) => {
    if (!id) return null;
    if (mongoose.Types.ObjectId.isValid(id)) {
        return { $or: [{ _id: id }, { orderId: id }] };
    }
    return { orderId: id };
};

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
        const query = getOrderQuery(req.params.id);
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findOne(query);

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
        const query = getOrderQuery(req.params.id);
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

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

        // If inventory status is being updated, sync with inventoryDetails
        if (updateData.inventoryStatus) {
            updateData['inventoryDetails.status'] = updateData.inventoryStatus;
            if (!updateData.customFields) {
                updateData.customFields = {};
            }
            updateData.customFields['Inventory Status'] = updateData.inventoryStatus;
        }

        const order = await Order.findOneAndUpdate(
            query,
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
        const query = getOrderQuery(req.params.id);
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findOneAndDelete(query);

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
        const query = getOrderQuery(id);
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const {
            inventoryDetails = {},
            inventoryStatus,
            submitToPC = true
        } = req.body;

        const actorName = req.headers['x-user-name']
            ? decodeURIComponent(req.headers['x-user-name'])
            : (inventoryDetails?.verifiedBy || 'Inventory Officer');
        const actorUserId = req.headers['x-user-id'] || null;

        const existingOrder = await Order.findOne(query);
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

        const updatedOrder = await Order.findOneAndUpdate(
            query,
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

// ── IMPORT ORDERS FROM EXCEL / CSV WITH EMBEDDED IMAGES ────────────────────
const importOrdersExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload an Excel or CSV file (.xlsx, .xls, .csv).'
            });
        }

        const isXlsx = /\.(xlsx)$/i.test(req.file.originalname || '');
        const rows = [];
        const rowImagesMap = new Map();

        // 1. If XLSX, use ExcelJS to parse worksheet and extract embedded drawing images
        if (isXlsx) {
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(req.file.buffer);
                const worksheet = workbook.worksheets[0];

                if (worksheet) {
                    // Extract embedded images from drawings
                    if (typeof worksheet.getImages === 'function') {
                        const drawingImages = worksheet.getImages();
                        for (let idx = 0; idx < drawingImages.length; idx++) {
                            const img = drawingImages[idx];
                            try {
                                const media = workbook.getImage(img.imageId);
                                if (!media || !media.buffer) continue;
                                const ext = (media.extension || 'png').toLowerCase();
                                const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
                                const dataUri = `data:${mime};base64,${Buffer.from(media.buffer).toString('base64')}`;

                                // Save copy to public/Uploads/ if folder exists
                                try {
                                    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'Uploads');
                                    if (fs.existsSync(uploadsDir)) {
                                        const fname = `order-excel-${Date.now()}-${idx}.${ext}`;
                                        fs.writeFileSync(path.join(uploadsDir, fname), media.buffer);
                                    }
                                } catch { }

                                const tl = img.range?.tl;
                                const nativeRow = tl?.nativeRow !== undefined ? tl.nativeRow : tl?.row;
                                if (nativeRow !== undefined && nativeRow !== null) {
                                    const rNum = Math.floor(Number(nativeRow));
                                    if (!rowImagesMap.has(rNum)) {
                                        rowImagesMap.set(rNum, []);
                                    }
                                    rowImagesMap.get(rNum).push(dataUri);
                                }
                            } catch (e) {
                                console.error('[Orders] Error extracting drawing image:', e);
                            }
                        }
                    }

                    // Extract headers from row 1
                    const headerRow = worksheet.getRow(1);
                    const colHeaders = [];
                    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                        colHeaders[colNumber] = String(cell.value || '').trim();
                    });

                    // Extract data rows starting from row 2
                    for (let r = 2; r <= worksheet.rowCount; r++) {
                        const row = worksheet.getRow(r);
                        if (!row || !row.hasValues) continue;

                        const rowObj = { _excelRowNumber: r };
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            const header = colHeaders[colNumber];
                            if (header) {
                                let val = cell.value;
                                if (val && typeof val === 'object') {
                                    if (val instanceof Date) {
                                        val = val.toISOString().split('T')[0];
                                    } else if (val.result !== undefined) {
                                        val = val.result;
                                    } else if (val.text !== undefined) {
                                        val = val.text;
                                    }
                                }
                                rowObj[header] = val !== undefined && val !== null ? String(val).trim() : '';
                            }
                        });
                        rows.push(rowObj);
                    }
                }
            } catch (excelJsErr) {
                console.warn('[Orders] ExcelJS load failed, falling back to XLSX:', excelJsErr.message);
            }
        }

        // 2. Fallback to SheetJS XLSX if rows empty or non-xlsx (e.g. .csv or .xls)
        if (!rows.length) {
            const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
            if (wb.SheetNames && wb.SheetNames.length) {
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                sheetRows.forEach((r, idx) => {
                    rows.push({ ...r, _excelRowNumber: idx + 2 });
                });
            }
        }

        if (!rows.length) {
            return res.status(400).json({
                success: false,
                message: 'The file is empty. Please ensure it has header and order rows.'
            });
        }

        if (rows.length > 2500) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 2500 rows allowed per upload.'
            });
        }

        // Helper: normalize column header name
        const normalize = (val) => String(val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

        const getValue = (row, aliases) => {
            const key = Object.keys(row).find(k => aliases.includes(normalize(k)));
            return key !== undefined && row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : '';
        };

        // If target formId is specified, fetch the template
        let matchedForm = null;
        if (req.body.formId) {
            try {
                matchedForm = await OrderForm.findById(req.body.formId);
            } catch { }
        }

        const validOrders = [];
        const invalidRows = [];
        const nowBase = Date.now();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const excelRowNum = row._excelRowNumber || (i + 2);

            // Extract core fields with aliases
            const customer = getValue(row, ['customer', 'customername', 'client', 'clientname', 'partyname', 'name', 'clientpartyname']);
            const product = getValue(row, ['product', 'productname', 'item', 'itemname', 'article', 'articlename']);
            const phone = getValue(row, ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber']);
            const rawAmount = getValue(row, ['amount', 'totalamount', 'price', 'total', 'orderamount', 'orderprice']);
            const amount = Number(String(rawAmount).replace(/[^\d.-]/g, '')) || 0;
            const rawAdvance = getValue(row, ['advance', 'advancepaid', 'advanceamount', 'adv']);
            const rawDate = getValue(row, ['date', 'orderdate', 'deliverydate', 'expecteddeliverydate', 'duedate']);
            const status = getValue(row, ['status', 'orderstatus']) || 'Processing';
            const payment = getValue(row, ['payment', 'paymentstatus']) || 'Pending';
            const notes = getValue(row, ['notes', 'ordernotes', 'remarks', 'specialinstructions', 'crmremark']);

            // Additional standard jewellery attributes
            const category = getValue(row, ['category', 'producttype', 'type']);
            const clientCode = getValue(row, ['clientcode', 'customercode', 'partycode']);
            const sku = getValue(row, ['sku', 'skucode', 'itemcode']);
            const metalPurity = getValue(row, ['metalpurity', 'metal', 'purity', 'goldpurity']);
            const weight = getValue(row, ['weight', 'grossweight', 'approxweight', 'goldweight']);
            const netWeight = getValue(row, ['netweight']);
            const quantity = getValue(row, ['quantity', 'qty', 'requiredquantity', 'pieces', 'pcs']) || '1';
            const modeOfOrder = getValue(row, ['modeoforder', 'mode']);
            const itemSize = getValue(row, ['itemsize', 'size']);
            const polkiQuality = getValue(row, ['polkiquality', 'polki', 'polkiquantity']);
            const diamondQuality = getValue(row, ['diamondquality', 'diamond', 'diamonddetails']);
            const colorStone = getValue(row, ['colorstone', 'stonecolor']);
            const typeOfPuwai = getValue(row, ['typeofpuwai', 'puwai']);
            const castingColor = getValue(row, ['castingcolor', 'casting']);
            const safaraType = getValue(row, ['safaratype', 'safara']);
            const crmName = getValue(row, ['crmname', 'agent', 'salesrep', 'salesperson']);

            // Require at least a customer name or product item
            if (!customer && !product) {
                invalidRows.push({
                    row: excelRowNum,
                    reason: 'Either Customer Name or Product Name is required.'
                });
                continue;
            }

            // Resolve images for this order row
            const orderImages = [];

            // Check drawing images anchored to this row in Excel (0-based nativeRow vs 1-based)
            const attachedFromDrawing = [
                ...(rowImagesMap.get(excelRowNum - 1) || []),
                ...(rowImagesMap.get(excelRowNum) || [])
            ];
            if (attachedFromDrawing.length > 0) {
                orderImages.push(...attachedFromDrawing);
            }

            // Single row sheet fallback: if only 1 data row and 1 image group in sheet, link them
            if (orderImages.length === 0 && rows.length === 1 && rowImagesMap.size === 1) {
                const singleImgs = Array.from(rowImagesMap.values())[0];
                if (singleImgs && singleImgs.length > 0) {
                    orderImages.push(...singleImgs);
                }
            }

            // Also check cell text under image columns (e.g. image upload, image, photo)
            const cellImageVal = getValue(row, ['imageupload', 'image', 'images', 'photo', 'picture', 'design']);
            if (cellImageVal && (cellImageVal.startsWith('data:image/') || cellImageVal.startsWith('http') || cellImageVal.startsWith('/uploads'))) {
                orderImages.push(cellImageVal);
            }

            // Build dynamic customFields from ALL columns in the row
            const customFields = {};
            Object.entries(row).forEach(([colHeader, colVal]) => {
                if (colHeader !== '_excelRowNumber' && colVal !== undefined && colVal !== null && String(colVal).trim() !== '') {
                    customFields[colHeader.trim()] = String(colVal).trim();
                }
            });

            // Ensure standard customFields keys are set
            if (customer) customFields['Customer Name'] = customer;
            if (product) customFields['Product Name'] = product;
            if (phone) customFields['Phone Number'] = phone;
            if (amount) customFields['Total Amount'] = String(amount);
            if (rawAdvance) customFields['Advance Paid'] = String(rawAdvance);
            if (rawDate) {
                customFields['Delivery Date'] = rawDate;
                customFields['Expected Delivery Date'] = rawDate;
            }
            if (clientCode) customFields['Client Code'] = clientCode;
            if (sku) customFields['SKU Code'] = sku;
            if (category) customFields['Category'] = category;
            if (metalPurity) customFields['Metal & Purity'] = metalPurity;
            if (weight) customFields['Gross Weight'] = weight;
            if (netWeight) customFields['Net Weight'] = netWeight;
            if (quantity) customFields['Quantity'] = quantity;
            if (modeOfOrder) customFields['Mode of Order'] = modeOfOrder;
            if (itemSize) customFields['Item Size'] = itemSize;
            if (polkiQuality) customFields['Polki Quality'] = polkiQuality;
            if (diamondQuality) customFields['Diamond Quality'] = diamondQuality;
            if (colorStone) customFields['Color Stone'] = colorStone;
            if (typeOfPuwai) customFields['Type of Puwai'] = typeOfPuwai;
            if (castingColor) customFields['Casting Color'] = castingColor;
            if (safaraType) customFields['Safara Type'] = safaraType;
            if (crmName) customFields['CRM Name'] = crmName;
            if (notes) customFields['Order Notes'] = notes;

            if (orderImages.length > 0) {
                customFields['image upload'] = orderImages[0];
                customFields['Image'] = orderImages[0];
            }

            const uniqueOrderId = `ORD-${nowBase}-${i + 1}`;

            validOrders.push({
                orderId: uniqueOrderId,
                formId: matchedForm ? matchedForm._id : (req.body.formId || null),
                formType: matchedForm ? matchedForm.name : (req.body.formType || 'Excel Import'),
                customer: customer || 'Customer',
                product: product || 'Jewellery',
                phone: phone || '',
                amount: amount || 0,
                date: rawDate || new Date().toISOString().split('T')[0],
                customFieldDefinitions: matchedForm ? matchedForm.fields : [],
                customFields,
                images: orderImages,
                status: status || 'Processing',
                inventoryStatus: 'Pending Verification',
                inventoryDetails: {
                    orderNumber: uniqueOrderId,
                    clientName: customer || '',
                    clientCode: clientCode || '',
                    skuCode: sku || '',
                    productName: product || '',
                    requiredQuantity: quantity || '1',
                    goldWeight: weight || '',
                    diamondDetails: diamondQuality || '',
                    status: 'Pending Verification',
                    remarks: '',
                    submittedToPC: false
                },
                payment: payment || 'Pending',
                hasReceipt: false,
                receiptNo: '',
                createdBy: req.headers['x-user-id'] || null
            });
        }

        if (!validOrders.length) {
            return res.status(400).json({
                success: false,
                message: 'No valid orders found in the Excel file.',
                invalidRows
            });
        }

        const insertedOrders = await Order.insertMany(validOrders);

        // Notify inventory department of the batch
        if (insertedOrders.length > 0) {
            notifyOrderCreated({
                order: insertedOrders[0],
                senderUserId: req.headers['x-user-id'] || null
            }).catch(err => console.error('[Orders] Bulk notify error:', err));
        }

        return res.status(201).json({
            success: true,
            message: `Successfully imported ${insertedOrders.length} order(s).`,
            totalRows: rows.length,
            imported: insertedOrders.length,
            skipped: invalidRows.length,
            invalidRows,
            data: insertedOrders
        });

    } catch (error) {
        console.error('Import Orders Excel Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to import Excel orders',
            error: error.message
        });
    }
};

// ── EXPORT ORDERS TO EXCEL (.xlsx) WITH EMBEDDED IMAGES ────────────────────
const exportOrdersExcel = async (req, res) => {
    try {
        const { ids } = req.body || req.query || {};
        let query = {};
        if (ids) {
            const idList = Array.isArray(ids) ? ids : String(ids).split(',').map(s => s.trim()).filter(Boolean);
            if (idList.length > 0) {
                query = { $or: [{ _id: { $in: idList } }, { orderId: { $in: idList } }] };
            }
        }

        const orders = await Order.find(query).sort({ createdAt: -1 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MSJ Jewels CRM';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Orders', {
            views: [{ showGridLines: true }]
        });

        // Helper to extract all images for an order
        const extractOrderImagesBackend = (o) => {
            if (!o) return [];
            const imgs = [];
            if (Array.isArray(o.images)) {
                o.images.forEach(img => {
                    if (typeof img === 'string' && img.trim()) imgs.push(img.trim());
                });
            } else if (typeof o.images === 'string' && o.images.trim()) {
                try {
                    const parsed = JSON.parse(o.images);
                    if (Array.isArray(parsed)) parsed.forEach(p => typeof p === 'string' && imgs.push(p.trim()));
                    else imgs.push(o.images.trim());
                } catch {
                    imgs.push(o.images.trim());
                }
            }
            const cf = o.customFields || {};
            Object.entries(cf).forEach(([k, v]) => {
                if (!v) return;
                const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (kNorm.includes('image') || kNorm.includes('photo') || kNorm.includes('pic') || kNorm.includes('design') || kNorm.includes('upload')) {
                    if (Array.isArray(v)) {
                        v.forEach(item => typeof item === 'string' && item.trim() && imgs.push(item.trim()));
                    } else if (typeof v === 'string' && v.trim()) {
                        imgs.push(v.trim());
                    }
                } else if (typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('http') || v.startsWith('/uploads/') || v.startsWith('uploads/'))) {
                    imgs.push(v.trim());
                }
            });
            return [...new Set(imgs.filter(Boolean))];
        };

        const orderImagesList = orders.map(extractOrderImagesBackend);
        const maxImagesCount = Math.max(1, ...orderImagesList.map(l => l.length));

        const baseColumns = [
            { header: 'Order ID', key: 'orderId', width: 16 },
            { header: 'Order Date', key: 'date', width: 14 },
            { header: 'Order Status', key: 'status', width: 15 },
            { header: 'Payment Status', key: 'payment', width: 15 },
            { header: 'Client / Customer Name', key: 'customer', width: 22 },
            { header: 'Client Code', key: 'clientCode', width: 14 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Product Name', key: 'product', width: 24 },
            { header: 'SKU Code', key: 'sku', width: 15 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Total Amount', key: 'amount', width: 14 },
            { header: 'Advance Paid', key: 'advance', width: 14 },
            { header: 'Expected Delivery Date', key: 'deliveryDate', width: 18 },
            { header: 'Metal & Purity', key: 'metalPurity', width: 16 },
            { header: 'Gross Weight', key: 'weight', width: 14 },
            { header: 'Net Weight', key: 'netWeight', width: 14 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Mode of Order', key: 'modeOfOrder', width: 16 },
            { header: 'Item Size', key: 'itemSize', width: 14 },
            { header: 'Polki Quality', key: 'polkiQuality', width: 16 },
            { header: 'Diamond Quality', key: 'diamondQuality', width: 16 },
            { header: 'Color Stone', key: 'colorStone', width: 16 },
            { header: 'Type of Puwai', key: 'typeOfPuwai', width: 16 },
            { header: 'Casting Color', key: 'castingColor', width: 15 },
            { header: 'Safara Type', key: 'safaraType', width: 15 },
            { header: 'CRM Name', key: 'crmName', width: 16 },
            { header: 'Order Notes', key: 'notes', width: 28 }
        ];

        const imageColIndex = baseColumns.length;

        for (let imgIdx = 0; imgIdx < maxImagesCount; imgIdx++) {
            baseColumns.push({
                header: imgIdx === 0 ? 'image upload' : `image upload ${imgIdx + 1}`,
                key: `imageUpload_${imgIdx}`,
                width: 22
            });
        }

        worksheet.columns = baseColumns;

        // Format Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3B4C' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        for (let i = 0; i < orders.length; i++) {
            const o = orders[i];
            const cf = o.customFields || {};
            const rowIndex = i + 1; // 0-based row index in ExcelJS for addImage (row 1 is header)

            const rowData = {
                orderId: o.orderId || o._id,
                date: o.date || '',
                status: o.status || 'Processing',
                payment: o.payment || 'Pending',
                customer: o.customer || cf['Customer Name'] || '',
                clientCode: cf['Client Code'] || '',
                phone: o.phone || cf['Phone Number'] || '',
                product: o.product || cf['Product Name'] || '',
                sku: cf['SKU Code'] || '',
                category: cf['Category'] || '',
                amount: o.amount || 0,
                advance: cf['Advance Paid'] || '',
                deliveryDate: cf['Delivery Date'] || cf['Expected Delivery Date'] || '',
                metalPurity: cf['Metal & Purity'] || '',
                weight: cf['Gross Weight'] || '',
                netWeight: cf['Net Weight'] || '',
                quantity: cf['Quantity'] || '1',
                modeOfOrder: cf['Mode of Order'] || '',
                itemSize: cf['Item Size'] || '',
                polkiQuality: cf['Polki Quality'] || '',
                diamondQuality: cf['Diamond Quality'] || '',
                colorStone: cf['Color Stone'] || '',
                typeOfPuwai: cf['Type of Puwai'] || '',
                castingColor: cf['Casting Color'] || '',
                safaraType: cf['Safara Type'] || '',
                crmName: cf['CRM Name'] || '',
                notes: o.notes || cf['Order Notes'] || ''
            };

            const row = worksheet.addRow(rowData);
            row.height = 30;
            row.alignment = { vertical: 'middle', horizontal: 'left' };

            const currentImages = orderImagesList[i] || [];
            if (currentImages.length > 0) {
                row.height = 65; // Make cell tall enough to display all images clearly

                for (let imgIdx = 0; imgIdx < currentImages.length; imgIdx++) {
                    const imgSource = currentImages[imgIdx];
                    try {
                        let imgBuffer = null;
                        let extension = 'png';

                        if (imgSource.startsWith('data:image/')) {
                            const matches = imgSource.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
                            if (matches) {
                                extension = matches[1].toLowerCase();
                                if (extension === 'jpg') extension = 'jpeg';
                                imgBuffer = Buffer.from(matches[2], 'base64');
                            }
                        } else if (imgSource.startsWith('/uploads/') || imgSource.startsWith('uploads/')) {
                            const localPath = path.join(__dirname, '..', '..', 'public', imgSource.replace(/^\/?/, ''));
                            if (fs.existsSync(localPath)) {
                                imgBuffer = fs.readFileSync(localPath);
                                const ext = path.extname(localPath).replace('.', '').toLowerCase();
                                if (ext) extension = ext === 'jpg' ? 'jpeg' : ext;
                            }
                        }

                        if (imgBuffer) {
                            const imgId = workbook.addImage({
                                buffer: imgBuffer,
                                extension: extension === 'jpg' ? 'jpeg' : extension
                            });
                            worksheet.addImage(imgId, {
                                tl: { col: imageColIndex + imgIdx, row: rowIndex },
                                ext: { width: 55, height: 55 },
                                editAs: 'oneCell'
                            });
                        }
                    } catch (imgErr) {
                        console.error(`[Orders] Export image ${imgIdx + 1} embed error:`, imgErr);
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="msj_orders_with_images_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        console.error('Export Orders Excel Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export orders to Excel.',
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
    verifyInventory,
    importOrdersExcel,
    exportOrdersExcel
};
