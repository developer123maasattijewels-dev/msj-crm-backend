
const Tickets = require('../models/ticketmodal');



const createTicket = async (req, res) => {
  try {
    const {
      type,
      requester,
      department,
      priority,
      requiredDate,
      description,
      details,
      quotations,
      approvalBy,
      assignee,
    } = req.body;

    // Required fields validation
    if (!type || !requester || !department) {
      return res.status(400).json({
        success: false,
        message: 'Ticket type, requester and department are required.',
      });
    }

    // Validate ticket type
    const allowedTypes = [
      'help',
      'hiring',
      'internalStoreIssue',
      'maintenance',
      'demand',
      'po',
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type.',
      });
    }

    // Demand requires at least 3 quotations
    if (
      type === 'demand' &&
      (!Array.isArray(quotations) || quotations.length < 3)
    ) {
      return res.status(400).json({
        success: false,
        message: 'At least 3 vendor quotations are required.',
      });
    }

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}`;

    // Create ticket
    const ticket = await Tickets.create({
      ticketNumber,
      type,
      requester: requester.trim(),
      department,
      priority: priority || 'Medium',
      requiredDate: requiredDate || null,
      description: description || '',
      details: details || {},
      quotations: quotations || [],
      approvalBy: approvalBy || '',
      assignee: assignee || 'Unassigned',
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      ticket,
    });
  } catch (error) {
    console.error('Create Ticket Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create ticket.',
      error: error.message,
    });
  }
};








module.exports = {createTicket}

