const express = require('express');
const router = express.Router();

const {
    createFollowUp,
    getFollowUps,
    getFollowUpById,
    updateFollowUp,
    deleteFollowUp
} = require('../controller/followup');

// Create Follow Up
router.post('/add', createFollowUp);

// Get All Follow Ups
router.get('/followup', getFollowUps);

// Get Follow Up by ID
router.get('/followup/:id', getFollowUpById);

// Update Follow Up
router.put('/followup/:id', updateFollowUp);

// Delete Follow Up
router.delete('/followup/:id', deleteFollowUp);

module.exports = router;