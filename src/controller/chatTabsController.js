const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Users = require('../models/usermodel');
const jwt = require('jsonwebtoken');

// Helper to resolve authenticated user from Bearer Token or request headers
const resolveAuthUser = async (req) => {
    try {
        let userId = null;
        let role = null;
        let name = null;

        // 1. Try JWT Bearer token
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

        // 2. Check fallback headers passed by frontend
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

        // 3. Fallback virtual auth user if role/userId is available
        if (userId || role) {
            return {
                _id: userId ? new mongoose.Types.ObjectId(userId) : null,
                role: role || 'Admin',
                name: name || (role?.toLowerCase() === 'admin' ? 'Administrator' : 'Agent')
            };
        }
    } catch (err) {
        console.error('resolveAuthUser error:', err);
    }
    return null;
};

// Legacy dummy emails to purge (Only purges the original hardcoded dummy emails, never custom user chats)
const DUMMY_EMAILS = [
    'aisha.khan@luxurymail.in',
    'naeem.ali@gmail.com',
    'orders@ridajewellers.com',
    'hira.malik@outlook.com',
    'vikram.singhania@corp.in',
    'meera.rajput@gmail.com'
];

let hasPurgedLegacyDummies = false;

const purgeLegacyDummyData = async () => {
    try {
        const dummyConvs = await Conversation.find({
            clientEmail: { $in: DUMMY_EMAILS }
        }).select('_id');

        if (dummyConvs.length > 0) {
            const dummyIds = dummyConvs.map((d) => d._id);
            await Message.deleteMany({ conversation: { $in: dummyIds } });
            await Conversation.deleteMany({ _id: { $in: dummyIds } });
            console.log(`[CRM] Purged ${dummyConvs.length} legacy dummy conversations`);
        }
        hasPurgedLegacyDummies = true;
    } catch (err) {
        console.error('Purge dummy error:', err);
    }
};

// GET CONVERSATIONS
// - Admin sees ALL conversations (both client chats and internal team user chats)
// - Non-Admin sees ONLY conversations they are part of (assignedTo, createdBy, or participants)
const getConversations = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);

        // One-time auto purge of original hardcoded mock emails
        if (!hasPurgedLegacyDummies) {
            await purgeLegacyDummyData();
        }

        const {
            tab = 'all',
            search = '',
            page = 1,
            limit = 50
        } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 50));

        // Check Admin
        const role = (authUser?.role || req.headers['x-user-role'] || '').toLowerCase();
        const isAdmin = role === 'admin';

        // Base filter
        const filter = {
            status: 'active'
        };

        // Strict role-based filtering:
        // A regular non-admin employee only sees conversations they participate in!
        const userId = authUser?._id || req.headers['x-user-id'];
        if (!isAdmin && userId && mongoose.Types.ObjectId.isValid(userId)) {
            const userObjId = new mongoose.Types.ObjectId(userId);
            filter.$and = [
                {
                    $or: [
                        { assignedTo: userObjId },
                        { createdBy: userObjId },
                        { participants: userObjId }
                    ]
                }
            ];
        }

        // Search filter
        if (search && search.trim()) {
            const searchRegex = new RegExp(
                search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i'
            );

            const searchCondition = {
                $or: [
                    { clientName: searchRegex },
                    { clientEmail: searchRegex },
                    { clientPhone: searchRegex },
                    { lastMessage: searchRegex },
                    { location: searchRegex },
                    { clientType: searchRegex },
                    { createdByName: searchRegex },
                    { 'deal.name': searchRegex }
                ]
            };

            if (filter.$and) {
                filter.$and.push(searchCondition);
            } else {
                filter.$and = [searchCondition];
            }
        }

        // Tab filter
        if (tab === 'unread') {
            filter.unreadCount = { $gt: 0 };
        } else if (tab === 'vip') {
            const vipCondition = {
                $or: [
                    { isVIP: true },
                    { starred: true },
                    { clientType: 'VIP Client' }
                ]
            };
            if (filter.$and) {
                filter.$and.push(vipCondition);
            } else {
                filter.$and = [vipCondition];
            }
        } else if (tab !== 'all') {
            return res.status(400).json({
                success: false,
                message: 'Invalid conversation tab'
            });
        }

        // Count base using same access scope
        const countBase = { status: 'active' };
        if (!isAdmin && userId && mongoose.Types.ObjectId.isValid(userId)) {
            const userObjId = new mongoose.Types.ObjectId(userId);
            countBase.$or = [
                { assignedTo: userObjId },
                { createdBy: userObjId },
                { participants: userObjId }
            ];
        }

        const [allCount, unreadCount, vipCount] = await Promise.all([
            Conversation.countDocuments(countBase),
            Conversation.countDocuments({
                ...countBase,
                unreadCount: { $gt: 0 }
            }),
            Conversation.countDocuments({
                ...countBase,
                $or: [
                    { isVIP: true },
                    { starred: true },
                    { clientType: 'VIP Client' }
                ]
            })
        ]);

        // Fetch conversations
        const conversations = await Conversation.find(filter)
            .populate('assignedTo', 'name email designation department role')
            .populate('createdBy', 'name email designation department role')
            .populate('participants', 'name email designation department role image')
            .populate('lead', 'name phone email source interestedProduct status notes')
            .sort({ lastMessageAt: -1 })
            .skip((currentPage - 1) * pageLimit)
            .limit(pageLimit)
            .lean();

        const total = await Conversation.countDocuments(filter);

        return res.status(200).json({
            success: true,
            message: 'Conversations fetched successfully',
            isAdmin,
            authUser: authUser ? {
                id: authUser._id,
                name: authUser.name,
                role: authUser.role
            } : null,
            tabs: {
                all: allCount,
                unread: unreadCount,
                vip: vipCount
            },
            pagination: {
                currentPage,
                limit: pageLimit,
                total,
                totalPages: Math.ceil(total / pageLimit)
            },
            conversations
        });

    } catch (error) {
        console.error('Get Conversations Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations',
            error: error.message
        });
    }
};

// GET SINGLE CONVERSATION BY ID
const getConversationById = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const { id } = req.params;

        const conversation = await Conversation.findById(id)
            .populate('assignedTo', 'name email designation department role')
            .populate('createdBy', 'name email designation department role')
            .populate('participants', 'name email designation department role image')
            .populate('lead', 'name phone email source interestedProduct status notes')
            .lean();

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
                (conversation.assignedTo && conversation.assignedTo._id?.toString() === uid) ||
                (conversation.createdBy && conversation.createdBy._id?.toString() === uid) ||
                (conversation.participants && conversation.participants.some((p) => (p._id || p).toString() === uid));

            if (!isParticipant) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to view this conversation.'
                });
            }
        }

        return res.status(200).json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Get Conversation By ID Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch conversation',
            error: error.message
        });
    }
};

// CREATE NEW CONVERSATION
const createConversation = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        let currentUserId = authUser?._id || null;
        let currentUserName = authUser?.name || 'Agent';

        // Check fallback headers
        if (!currentUserId && req.headers['x-user-id'] && mongoose.Types.ObjectId.isValid(req.headers['x-user-id'])) {
            currentUserId = new mongoose.Types.ObjectId(req.headers['x-user-id']);
        }
        if (req.headers['x-user-name']) {
            try { currentUserName = decodeURIComponent(req.headers['x-user-name']); } catch(e){}
        }

        const {
            chatType = 'client', // 'client' | 'internal'
            targetUserId = null,  // For internal team chats
            clientName = '',
            clientPhone = '',
            clientEmail = '',
            clientType = 'Customer',
            location = '',
            tier = 'Standard Client',
            initialMessage = '',
            deal = {},
            isVIP = false,
            starred = false,
            assignedTo = null,
            leadId = null,
            totalSpent = '',
            ordersCount = 0
        } = req.body;

        // --- 1. INTERNAL TEAM CHAT BETWEEN USERS ---
        if (chatType === 'internal') {
            if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
                return res.status(400).json({
                    success: false,
                    message: 'A valid target team user is required for internal team chat.'
                });
            }

            if (currentUserId && targetUserId.toString() === currentUserId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot start a chat with yourself.'
                });
            }

            const targetUser = await Users.findById(targetUserId).select('name email designation department role image');
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Target team member not found.'
                });
            }

            let existingInternal = null;
            if (currentUserId) {
                existingInternal = await Conversation.findOne({
                    chatType: 'internal',
                    status: 'active',
                    participants: { $all: [currentUserId, targetUser._id] }
                })
                    .populate('assignedTo', 'name email designation department role')
                    .populate('createdBy', 'name email designation department role')
                    .populate('participants', 'name email designation department role image');
            }

            if (existingInternal) {
                return res.status(200).json({
                    success: true,
                    message: 'Existing team chat found',
                    conversation: existingInternal,
                    isNew: false
                });
            }

            const participantsList = currentUserId
                ? [currentUserId, targetUser._id]
                : [targetUser._id];

            const newInternalConv = new Conversation({
                chatType: 'internal',
                participants: participantsList,
                createdBy: currentUserId,
                createdByName: currentUserName,
                clientName: targetUser.name,
                clientEmail: targetUser.email || '',
                clientPhone: '',
                clientType: 'Team Member',
                location: targetUser.department || 'Office',
                tier: targetUser.designation || targetUser.role || 'Team Member',
                avatarBg: '#2563eb',
                assignedTo: currentUserId || targetUser._id,
                isVIP: false,
                starred: false,
                online: true,
                lastMessage: initialMessage.trim() || '',
                lastMessageAt: new Date(),
                unreadCount: 0,
                deal: {
                    name: 'Internal Chat',
                    value: '—',
                    stage: 'Internal'
                },
                status: 'active'
            });

            await newInternalConv.save();

            if (initialMessage && initialMessage.trim()) {
                await Message.create({
                    conversation: newInternalConv._id,
                    senderType: 'agent',
                    senderName: currentUserName,
                    senderId: currentUserId,
                    content: initialMessage.trim(),
                    messageType: 'text',
                    status: 'delivered'
                });
            }

            const populatedConv = await Conversation.findById(newInternalConv._id)
                .populate('assignedTo', 'name email designation department role')
                .populate('createdBy', 'name email designation department role')
                .populate('participants', 'name email designation department role image');

            return res.status(201).json({
                success: true,
                message: `Team chat started with ${targetUser.name}`,
                conversation: populatedConv,
                isNew: true
            });
        }

        // --- 2. CLIENT / LEAD CONVERSATION ---
        if (!clientName || !clientName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Client name is required.'
            });
        }

        let existingClientConv = null;
        if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
            existingClientConv = await Conversation.findOne({
                lead: leadId,
                status: 'active'
            });
        }

        if (!existingClientConv && clientPhone && clientPhone.trim()) {
            existingClientConv = await Conversation.findOne({
                clientPhone: clientPhone.trim(),
                status: 'active'
            });
        }

        if (existingClientConv) {
            return res.status(200).json({
                success: true,
                message: 'Existing client conversation found',
                conversation: existingClientConv,
                isNew: false
            });
        }

        const bgColors = ['#a77b35', '#059669', '#7c3aed', '#be185d', '#0f766e', '#d97706'];
        const avatarBg = bgColors[Math.floor(Math.random() * bgColors.length)];

        const finalAssignedTo = assignedTo || currentUserId;
        const participantsList = currentUserId ? [currentUserId] : [];

        const conversation = new Conversation({
            chatType: 'client',
            participants: participantsList,
            createdBy: currentUserId,
            createdByName: currentUserName,
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            clientEmail: clientEmail.trim(),
            clientType,
            location: location.trim(),
            tier,
            avatarBg,
            isVIP: Boolean(isVIP || clientType === 'VIP Client'),
            starred: Boolean(starred || isVIP),
            online: false,
            lastMessage: initialMessage.trim() || '',
            lastMessageAt: new Date(),
            unreadCount: 0,
            totalSpent: totalSpent || '—',
            ordersCount: Number(ordersCount) || 0,
            deal: {
                name: deal.name || '',
                value: deal.value || '—',
                stage: deal.stage || 'Inquiry'
            },
            lead: leadId && mongoose.Types.ObjectId.isValid(leadId) ? leadId : null,
            assignedTo: finalAssignedTo,
            status: 'active'
        });

        await conversation.save();

        if (initialMessage && initialMessage.trim()) {
            await Message.create({
                conversation: conversation._id,
                senderType: 'agent',
                senderName: currentUserName,
                senderId: currentUserId,
                content: initialMessage.trim(),
                messageType: 'text',
                status: 'delivered'
            });
        }

        const populated = await Conversation.findById(conversation._id)
            .populate('assignedTo', 'name email designation department role')
            .populate('createdBy', 'name email designation department role')
            .populate('participants', 'name email designation department role image')
            .populate('lead', 'name phone email source interestedProduct status notes');

        return res.status(201).json({
            success: true,
            message: 'Conversation created successfully',
            conversation: populated,
            isNew: true
        });

    } catch (error) {
        console.error('Create Conversation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create conversation',
            error: error.message
        });
    }
};

// UPDATE CONVERSATION
const updateConversation = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const { id } = req.params;
        const updates = req.body;

        const role = (authUser?.role || req.headers['x-user-role'] || '').toLowerCase();
        const isAdmin = role === 'admin';
        const existing = await Conversation.findById(id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const userId = authUser?._id || req.headers['x-user-id'];
        if (!isAdmin && userId) {
            const uid = userId.toString();
            const isAuthorized =
                (existing.assignedTo && existing.assignedTo.toString() === uid) ||
                (existing.createdBy && existing.createdBy.toString() === uid) ||
                (existing.participants && existing.participants.some((p) => p.toString() === uid));

            if (!isAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You cannot edit this conversation.'
                });
            }
        }

        const conversation = await Conversation.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('assignedTo', 'name email designation department role')
            .populate('createdBy', 'name email designation department role')
            .populate('participants', 'name email designation department role image');

        return res.status(200).json({
            success: true,
            message: 'Conversation updated successfully',
            conversation
        });
    } catch (error) {
        console.error('Update Conversation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update conversation',
            error: error.message
        });
    }
};

// TOGGLE STARRED / VIP STATUS
const toggleStarConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await Conversation.findById(id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        conversation.starred = !conversation.starred;
        if (conversation.starred) {
            conversation.isVIP = true;
        }

        await conversation.save();

        return res.status(200).json({
            success: true,
            message: conversation.starred ? 'Conversation starred' : 'Conversation unstarred',
            starred: conversation.starred,
            isVIP: conversation.isVIP,
            conversation
        });
    } catch (error) {
        console.error('Toggle Star Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle star status',
            error: error.message
        });
    }
};

// DELETE CONVERSATION & ALL ITS MESSAGES
const deleteConversation = async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        const { id } = req.params;

        const conversation = await Conversation.findById(id);
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
                    message: 'Access denied: Only Admin or the conversation creator can delete this chat.'
                });
            }
        }

        await Conversation.findByIdAndDelete(id);
        await Message.deleteMany({ conversation: id });

        return res.status(200).json({
            success: true,
            message: 'Conversation and all messages deleted successfully'
        });
    } catch (error) {
        console.error('Delete Conversation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete conversation',
            error: error.message
        });
    }
};

// PURGE DUMMY CONVERSATIONS ENDPOINT
const purgeDummyConversations = async (req, res) => {
    try {
        await purgeLegacyDummyData();
        return res.status(200).json({
            success: true,
            message: 'All dummy test conversations purged from database'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to purge dummy conversations',
            error: error.message
        });
    }
};

module.exports = {
    getConversations,
    getConversationById,
    createConversation,
    updateConversation,
    toggleStarConversation,
    deleteConversation,
    purgeDummyConversations
};
