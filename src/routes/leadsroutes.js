const express = require('express');
const { addLeads } = require('../controller/leadscontroller');
const router = express.Router();


router.post('/add', addLeads);




module.exports = router;