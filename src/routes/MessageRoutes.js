const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const {
    getMessages,
    sendMessage,
    uploadAttachment,
    markMessagesAsRead,
    clearConversationMessages
} = require('../controller/MessageController');

// Multer Storage Configuration for Chat Uploads
const uploadDirectory = path.resolve(__dirname, '../../public/Uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `chat-${uniqueSuffix}-${base}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Message Endpoints
router.get('/:conversationId', getMessages);
router.get('/conversation/:conversationId', getMessages);
router.post('/send', sendMessage);
router.post('/upload', upload.single('file'), uploadAttachment);
router.patch('/read/:conversationId', markMessagesAsRead);
router.delete('/clear/:conversationId', clearConversationMessages);

module.exports = router;

