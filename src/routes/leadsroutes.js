const express = require('express');
const { addLeads } = require('../controller/Leads');
const router = express.Router();


router.post('/', addLeads);




module.exports = router;