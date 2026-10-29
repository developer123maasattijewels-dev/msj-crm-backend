const express = require('express');
const {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicketStatus,
  addReply,
  updateTicket,
  deleteTicket,
  createDemandTicket,
} = require('../controller/Ticket');

const router = express.Router();

// Create Ticket
router.post('/create', createTicket);
router.post('/add', createTicket);

// Get All Tickets (supports query parameters: search, status, priority, type, department, page, limit)
router.get('/get', getAllTickets);
router.get('/all', getAllTickets);
router.get('/', getAllTickets);

// Get Single Ticket by ID or ticketNumber
router.get('/get/:id', getTicketById);

// Update Status
router.put('/status/:id', updateTicketStatus);
router.patch('/status/:id', updateTicketStatus);

// Add Activity Log / Reply Note
router.post('/reply/:id', addReply);

// Update Ticket Details
router.put('/update/:id', updateTicket);

// Delete Ticket
router.delete('/delete/:id', deleteTicket);

// Demand Ticket — dedicated endpoint
router.post('/demand/create', createDemandTicket);

module.exports = router;
