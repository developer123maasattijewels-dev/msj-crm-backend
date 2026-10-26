const mongoose = require('mongoose');
const Tickets = require('../models/ticketmodal');

const generateTicketNumber = async () => {
  let unique = false;
  let newTicketNumber = '';
  let attempts = 0;

  while (!unique && attempts < 20) {
    attempts++;
    const random = Math.floor(1000 + Math.random() * 9000);
    newTicketNumber = `TKT-${random}`;
    const existing = await Tickets.findOne({ ticketNumber: newTicketNumber });
    if (!existing) unique = true;
  }

  if (!unique) {
    newTicketNumber = `TKT-${Date.now().toString().slice(-6)}`;
  }
  return newTicketNumber;
};

const createTicket = async (req, res) => {
  try {
    const {
      ticketNumber,
      type = 'help',
      subject,
      requester,
      department,
      category = '',
      priority = 'Medium',
      status = 'Open',
      requiredDate,
      description = '',
      details = {},
      quotations = [],
      approvalBy = '',
      assignee = 'Unassigned',
    } = req.body;

    // Required fields validation
    if (!requester || !department) {
      return res.status(400).json({
        success: false,
        message: 'Requester name and department are required.',
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

    const safeType = allowedTypes.includes(type) ? type : 'help';

    // Auto-generate subject if not explicitly supplied
    let computedSubject = (subject || '').trim();
    if (!computedSubject) {
      if (safeType === 'help') {
        computedSubject = details.helpSubject || description || 'IT & Technical Assistance';
      } else if (safeType === 'hiring') {
        computedSubject = `Hiring: ${details.designation || 'Staff Requirement'}`;
      } else if (safeType === 'internalStoreIssue') {
        computedSubject = `Material Request: ${details.storeItem || 'Store Issue'} (${details.storeQuantity || '1'} ${details.storeUnit || 'Grams'})`;
      } else if (safeType === 'maintenance') {
        computedSubject = `Maintenance: ${details.assetName || 'Equipment Repair'}`;
      } else if (safeType === 'demand') {
        computedSubject = `Demand Requisition: ${details.demandName || 'Material Supply'}`;
      } else if (safeType === 'po') {
        computedSubject = `PO Request: ${details.poItemName || 'Vendor Order'}${details.vendorName ? ` - ${details.vendorName}` : ''}`;
      } else {
        computedSubject = 'Support Ticket';
      }
    }

    // Generate unique ticket number if not provided
    const finalTicketNumber =
      ticketNumber && ticketNumber.trim()
        ? ticketNumber.trim()
        : await generateTicketNumber();

    const parsedDate = requiredDate ? new Date(requiredDate) : null;

    const ticket = await Tickets.create({
      ticketNumber: finalTicketNumber,
      type: safeType,
      subject: computedSubject,
      requester: requester.trim(),
      department: department.trim(),
      category: (category || details?.category || '').trim(),
      priority: priority || 'Medium',
      status: status || 'Open',
      requiredDate: parsedDate,
      description: description.trim(),
      details: details || {},
      quotations: Array.isArray(quotations) ? quotations : [],
      approvalBy: approvalBy || '',
      assignee: assignee || 'Unassigned',
      replies: [],
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      ticket,
      data: ticket,
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

const getAllTickets = async (req, res) => {
  try {
    const {
      search,
      status,
      priority,
      type,
      department,
      page = 1,
      limit = 100,
    } = req.query;

    const filter = {};

    // Filter by status
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    // Filter by type
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Filter by department
    if (department && department !== 'all') {
      filter.department = department;
    }

    // Search keyword across ticketNumber, subject, requester, department, description
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { ticketNumber: searchRegex },
        { subject: searchRegex },
        { requester: searchRegex },
        { department: searchRegex },
        { description: searchRegex },
        { assignee: searchRegex },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const skip = (pageNum - 1) * limitNum;

    // Fetch tickets sorted newest first
    const [tickets, totalCount] = await Promise.all([
      Tickets.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tickets.countDocuments(filter),
    ]);

    // Compute status counts for toolbar/dashboard tabs
    const [totalTickets, openCount, progressCount, resolvedCount, unassignedCount] =
      await Promise.all([
        Tickets.countDocuments(),
        Tickets.countDocuments({ status: 'Open' }),
        Tickets.countDocuments({ status: 'In Progress' }),
        Tickets.countDocuments({ status: { $in: ['Resolved', 'Closed'] } }),
        Tickets.countDocuments({ assignee: 'Unassigned' }),
      ]);

    const counts = {
      total: totalTickets,
      open: openCount,
      progress: progressCount,
      resolved: resolvedCount,
      unassigned: unassignedCount,
      myTickets: 0,
    };

    return res.status(200).json({
      success: true,
      tickets,
      data: tickets,
      counts,
      pagination: {
        total: totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Get All Tickets Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets.',
      error: error.message,
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    let ticket = null;
    if (mongoose.isValidObjectId(id)) {
      ticket = await Tickets.findById(id).lean();
    }

    if (!ticket) {
      ticket = await Tickets.findOne({ ticketNumber: id }).lean();
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    return res.status(200).json({
      success: true,
      ticket,
      data: ticket,
    });
  } catch (error) {
    console.error('Get Ticket By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket details.',
      error: error.message,
    });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, user = 'Admin' } = req.body;

    const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Open, In Progress, Resolved, Closed).',
      });
    }

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { ticketNumber: id };

    const ticket = await Tickets.findOne(query);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    // Add activity log reply for the status change
    const timeString = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    ticket.replies.push({
      user,
      text: `Status updated from "${oldStatus}" to "${status}".`,
      time: timeString,
      createdAt: new Date(),
    });

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}.`,
      ticket,
      data: ticket,
    });
  } catch (error) {
    console.error('Update Ticket Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket status.',
      error: error.message,
    });
  }
};

const addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, user = 'Admin', time } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply message cannot be empty.',
      });
    }

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { ticketNumber: id };

    const ticket = await Tickets.findOne(query);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const timeString =
      time ||
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

    const newReply = {
      user: user.trim(),
      text: text.trim(),
      time: timeString,
      createdAt: new Date(),
    };

    ticket.replies.push(newReply);
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: 'Note added to activity log.',
      reply: newReply,
      replies: ticket.replies,
      ticket,
    });
  } catch (error) {
    console.error('Add Ticket Reply Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add reply note.',
      error: error.message,
    });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { ticketNumber: id };

    const updatedTicket = await Tickets.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket updated successfully.',
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error('Update Ticket Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket.',
      error: error.message,
    });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.isValidObjectId(id) ? { _id: id } : { ticketNumber: id };

    const deleted = await Tickets.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Ticket Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete ticket.',
      error: error.message,
    });
  }
};

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicketStatus,
  addReply,
  updateTicket,
  deleteTicket,
};
