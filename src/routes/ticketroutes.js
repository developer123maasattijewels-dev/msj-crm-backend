const express = require('express');
const { createTicket } = require('../controller/Ticket');
const router = express.Router();


router.post('/create', createTicket);

module.exports = router;