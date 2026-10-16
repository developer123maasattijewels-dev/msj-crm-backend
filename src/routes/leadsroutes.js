const express = require('express');
const { addLeads, getLeads, getLeadsId, updateLeads, leadsDelete, leadsfilter, searchLeads, getLeadHistory } = require('../controller/leadscontroller');
const router = express.Router();


router.post('/add', addLeads);
router.get('/get', getLeads);
router.get('/get/:id', getLeadsId);
router.patch('/update/:id', updateLeads);
router.delete('/delete/:id', leadsDelete);
router.get('/filter', leadsfilter);
router.get('/search', searchLeads);
router.get('/history/:leadId', getLeadHistory);

module.exports = router;