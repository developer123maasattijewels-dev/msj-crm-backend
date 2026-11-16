const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const jwt = require('jsonwebtoken');
const Users = require('../models/usermodel');

// Helper to resolve authenticated user if token or headers are present
const resolveAuthUser = async (req) => {
    try {
        let userId = null;
        let role = null;
        let name = null;

        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (token) {
            let decoded = null;
            if (process.env.JWT_SECRET) {
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET);
                } catch (e1) {
                    try {
                        decoded = jwt.verify(token, 'msj_secret_fallback');
                    } catch (e2) {
                        decoded = jwt.decode(token);
                    }
                }
            } else {
                decoded = jwt.decode(token);
            }

            if (decoded) {
                userId = decoded.id || decoded._id || decoded.userId;
                role = decoded.role;
            }
        }

        if (!userId && req.headers['x-user-id']) {
            userId = req.headers['x-user-id'];
        }
        if (!role && req.headers['x-user-role']) {
            role = req.headers['x-user-role'];
        }
        if (req.headers['x-user-name']) {
            try {
                name = decodeURIComponent(req.headers['x-user-name']);
            } catch (e) {}
        }

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const user = await Users.findById(userId).select('_id role name email designation department');
            if (user) {
                if (!role && user.role) role = user.role;
                return user;
            }
        }

        if (userId || role) {
            return {
                _id: userId ? new mongoose.Types.ObjectId(userId) : null,
                role: role || 'Admin',
                name: name || (role?.toLowerCase() === 'admin' ? 'Administrator' : 'Agent')
            };
        }
    } catch (err) {
        console.error('resolveAuthUser error in MessageController:', err);
    }
    return null;
};

// Helper to format file size
const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// GET MESSAGES FOR A CONVERSATION
const getMessages = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const { conversationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid conversation ID format'
            });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const role = (authUser?.role || req.headers['x-user-role'] || '').toLowerCase();
        const isAdmin = role === 'admin';
        const userId = authUser?._id || req.headers['x-user-id'];

        if (!isAdmin && userId) {
            const uid = userId.toString();
            const isParticipant =
                (conversation.assignedTo && conversation.assignedTo.toString() === uid) ||
                (conversation.createdBy && conversation.createdBy.toString() === uid) ||
                (conversation.participants && conversation.participants.some((p) => (p._id || p).toString() === uid));

            if (!isParticipant) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to view messages in this conversation.'
                });
            }
        }

        const messages = await Message.find({
            conversation: conversationId,
            isDeleted: false
        })
            .populate('senderId', 'name email designation role image')
            .populate('replyTo', 'content senderName messageType')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: messages.length,
            messages
        });
    } catch (error) {
        console.error('Get Messages Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: error.message
        });
    }
};

// SEND A MESSAGE
const sendMessage = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const {
            conversationId,
            content = '',
            messageType = 'text',
            attachments = [],
            senderType = 'agent',
            senderName,
            replyTo = null
        } = req.body;

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid conversationId is required'
            });
        }

        if (!content.trim() && (!attachments || attachments.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Message must have content or attachments'
            });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const role = (authUser?.role || req.headers['x-user-role'] || '').toLowerCase();
        const isAdmin = role === 'admin';
        const userId = authUser?._id || req.headers['x-user-id'];

        if (!isAdmin && userId) {
            const uid = userId.toString();
            const isParticipant =
                (conversation.assignedTo && conversation.assignedTo.toString() === uid) ||
                (conversation.createdBy && conversation.createdBy.toString() === uid) ||
                (conversation.participants && conversation.participants.some((p) => (p._id || p).toString() === uid));

            if (!isParticipant) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You cannot send messages in this conversation.'
                });
            }
        }

        let finalSenderName = authUser?.name || senderName || 'Agent';
        let finalSenderId = authUser?._id || null;

        if (senderType === 'client') {
            finalSenderName = senderName || conversation.clientName || 'Client';
            finalSenderId = null;
        }

        const newMessage = new Message({
            conversation: conversationId,
            senderType,
            senderId: finalSenderId,
            senderName: finalSenderName,
            content: content.trim(),
            messageType: attachments.length > 0 && messageType === 'text' ? 'attachment' : messageType,
            attachments,
            status: senderType === 'agent' ? 'delivered' : 'sent',
            replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null
        });

        await newMessage.save();

        // Update conversation summary
        const previewText = content.trim() || (attachments.length > 0 ? `Attached: ${attachments[0].fileName}` : '');
        conversation.lastMessage = previewText;
        conversation.lastMessageAt = new Date();

        if (senderType === 'client') {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        } else if (senderType === 'agent') {
            conversation.unreadCount = 0;
        }

        await conversation.save();

        // Socket broadcast
        try {
            const { getIO } = require('../sockets/socket');
            const io = getIO();
            if (io) {
                io.emit('chat:new_message', {
                    conversationId,
                    message: newMessage,
                    conversation
                });
            }
        } catch (socketErr) {
            // Socket optional
        }

        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
            conversation
        });
    } catch (error) {
        console.error('Send Message Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    }
};

// UPLOAD ATTACHMENT & OPTIONALLY CREATE MESSAGE
const uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const authUser = await resolveAuthUser(req);
        const file = req.file;
        const fileUrl = `/uploads/${encodeURIComponent(file.filename)}`;

        let fileType = 'other';
        const mime = file.mimetype || '';
        if (mime.startsWith('image/')) {
            fileType = 'image';
        } else if (mime.includes('pdf')) {
            fileType = 'pdf';
        } else if (
            mime.includes('word') ||
            mime.includes('document') ||
            mime.includes('presentation') ||
            mime.includes('sheet') ||
            mime.includes('excel')
        ) {
            fileType = 'document';
        }

        const attachmentMeta = {
            fileName: file.originalname,
            fileUrl,
            fileType,
            fileSize: formatFileSize(file.size)
        };

        const { conversationId, senderType = 'agent', senderName = 'Agent', content = '' } = req.body;

        if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                const newMessage = new Message({
                    conversation: conversationId,
                    senderType,
                    senderId: authUser?._id || null,
                    senderName: authUser?.name || senderName,
                    content: content.trim() || `Attached file: ${file.originalname}`,
                    messageType: 'attachment',
                    attachments: [attachmentMeta],
                    status: 'delivered'
                });

                await newMessage.save();

                conversation.lastMessage = `Attached file: ${file.originalname}`;
                conversation.lastMessageAt = new Date();
                if (senderType === 'agent') {
                    conversation.unreadCount = 0;
                }
                await conversation.save();

                return res.status(201).json({
                    success: true,
                    message: 'Attachment uploaded and message sent',
                    attachment: attachmentMeta,
                    data: newMessage,
                    conversation
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            attachment: attachmentMeta
        });
    } catch (error) {
        console.error('Upload Attachment Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload attachment',
            error: error.message
        });
    }
};

// MARK MESSAGES AS READ
const markMessagesAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid conversation ID is required'
            });
        }

        await Message.updateMany(
            {
                conversation: conversationId,
                senderType: 'client',
                status: { $ne: 'read' }
            },
            {
                $set: {
                    status: 'read',
                    readAt: new Date()
                }
            }
        );

        const conversation = await Conversation.findByIdAndUpdate(
            conversationId,
            { $set: { unreadCount: 0 } },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Conversation marked as read',
            conversation
        });
    } catch (error) {
        console.error('Mark Messages As Read Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark messages as read',
            error: error.message
        });
    }
};

// CLEAR CONVERSATION MESSAGES
const clearConversationMessages = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const { conversationId } = req.params;

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid conversation ID is required'
            });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const role = (authUser?.role || req.headers['x-user-role'] || '').toLowerCase();
        const isAdmin = role === 'admin';
        const userId = authUser?._id || req.headers['x-user-id'];

        if (!isAdmin && userId) {
            const uid = userId.toString();
            const isAuthorized =
                (conversation.assignedTo && conversation.assignedTo.toString() === uid) ||
                (conversation.createdBy && conversation.createdBy.toString() === uid);

            if (!isAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Only Admin or conversation creator can clear messages.'
                });
            }
        }

        await Message.deleteMany({ conversation: conversationId });

        await Conversation.findByIdAndUpdate(conversationId, {
            $set: {
                lastMessage: '',
                unreadCount: 0
            }
        });

        return res.status(200).json({
            success: true,
            message: 'All messages in conversation cleared successfully'
        });
    } catch (error) {
        console.error('Clear Messages Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear conversation messages',
            error: error.message
        });
    }
};

module.exports = {
    getMessages,
    sendMessage,
    uploadAttachment,
    markMessagesAsRead,
    clearConversationMessages
};
