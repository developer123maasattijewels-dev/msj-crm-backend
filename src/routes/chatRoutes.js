const express = require('express');
const router = express.Router();

const {
    getConversations,
    getConversationById,
    createConversation,
    updateConversation,
    toggleStarConversation,
    deleteConversation,
    purgeDummyConversations
} = require('../controller/chatTabsController');

const messageRoutes = require('./MessageRoutes');

// Mount message routes under /chat/messages
router.use('/messages', messageRoutes);

// Conversation management routes
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.post('/conversations/purge-dummy', purgeDummyConversations);
router.get('/conversations/:id', getConversationById);
router.patch('/conversations/:id', updateConversation);
router.patch('/conversations/:id/star', toggleStarConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;
