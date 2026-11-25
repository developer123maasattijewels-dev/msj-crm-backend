
const mongoose = require('mongoose');
const FollowUp = require('../models/followups');
const { notifyFollowUpEvent } = require('../comman/notificationService');

const getActorContext = (req) => {
  const userId = String(req.authUser?._id || req.headers['x-user-id'] || '').trim();
  const role = String(req.authUser?.role || req.headers['x-user-role'] || '').trim().toLowerCase();
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(role);
  const validUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;
  return { userId: validUserId, role, isAdmin };
};

const canAccessDailyFollowUp = (followUp, actor) => {
  if (!followUp || followUp.followUpType !== 'daily') return true;
  if (actor.isAdmin) return true;
  if (!actor.userId) return false;
  const creatorId = followUp.createdBy?._id
    ? String(followUp.createdBy._id)
    : followUp.createdBy
      ? String(followUp.createdBy)
      : '';
  return creatorId === actor.userId;
};


exports.createFollowUp = async (req, res) => {
  try {
    const  data  = req.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid follow up data'
      });
    }

    if (!data.followUpType) {
      return res.status(400).json({
        success: false,
        message: 'Follow Up Type is required'
      });
    }

    const followUp = await FollowUp.create(data);

    notifyFollowUpEvent({
      followUp,
      actorName: followUp.employeeName || '',
      senderUserId: followUp.createdBy || req.headers['x-user-id']
    }).catch((err) => console.error('Follow-up notification error:', err));

    res.status(201).json({
      success: true,
      message: 'Follow Up created successfully',
      data: followUp
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// =====================================
// GET ALL FOLLOW UPS
// =====================================
exports.getFollowUps = async (req, res) => {
  try {
    const {
      followUpType,
      createdBy,
      department,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    const actor = getActorContext(req);
    const andConditions = [];

    if (followUpType) filter.followUpType = followUpType;
    if (createdBy) filter.createdBy = createdBy;
    if (department) filter.department = department;

    // Daily working records are strictly private to Admin and the creator
    if (!actor.isAdmin) {
      if (followUpType === 'daily') {
        if (!actor.userId) {
          return res.status(200).json({
            success: true,
            message: 'Follow Ups fetched successfully',
            total: 0,
            page: 1,
            limit: Math.max(1, Math.min(100, Number(limit) || 10)),
            totalPages: 0,
            data: []
          });
        }
        filter.createdBy = actor.userId;
      } else if (!followUpType) {
        if (actor.userId) {
          andConditions.push({
            $or: [
              { followUpType: { $ne: 'daily' } },
              { followUpType: 'daily', createdBy: actor.userId }
            ]
          });
        } else {
          filter.followUpType = { $ne: 'daily' };
        }
      }
    }

    if (status) {
      andConditions.push({
        $or: [
          { status },
          { workStatus: status },
          { performanceStatus: status }
        ]
      });
    }

    // Date Filter
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const date = new Date(endDate);
        date.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = date;
      }
    }

    // Search Filter
    if (search) {
      const searchRegex = {
        $regex: search,
        $options: 'i'
      };

      andConditions.push({
        $or: [
          { employeeName: searchRegex },
          { clientName: searchRegex },
          { clientPhone: searchRegex },
          { salesPersonName: searchRegex },
          { meetingTitle: searchRegex },
          { workName: searchRegex },
          { orderNumber: searchRegex },
          { employeeId: searchRegex },
          { assignedTo: searchRegex }
        ]
      });
    }

    if (andConditions.length === 1) {
      filter.$or = andConditions[0].$or;
    } else if (andConditions.length > 1) {
      filter.$and = andConditions;
    }

    // Pagination
    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    const total = await FollowUp.countDocuments(filter);

    const followUps = await FollowUp.find(filter)
      .populate('createdBy', 'name email department designation')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageLimit)
      .limit(pageLimit);

    res.status(200).json({
      success: true,
      message: 'Follow Ups fetched successfully',
      total,
      page: currentPage,
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit),
      data: followUps
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// =====================================
// GET FOLLOW UP BY ID
// =====================================
exports.getFollowUpById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Follow Up ID'
      });
    }

    const followUp = await FollowUp.findById(id)
      .populate('createdBy', 'name email department designation');

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow Up not found'
      });
    }

    if (!canAccessDailyFollowUp(followUp, getActorContext(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creator can view this daily working record'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Follow Up fetched successfully',
      data: followUp
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// =====================================
// UPDATE FOLLOW UP
// =====================================
exports.updateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Follow Up ID'
      });
    }

    const rawBody = req.body;
    const data =
      rawBody && rawBody.data && typeof rawBody.data === 'object' && !Array.isArray(rawBody.data)
        ? rawBody.data
        : rawBody;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid update data'
      });
    }

    const existing = await FollowUp.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Follow Up not found'
      });
    }

    if (!canAccessDailyFollowUp(existing, getActorContext(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creator can update this daily working record'
      });
    }

    const followUp = await FollowUp.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,
        runValidators: true
      }
    ).populate('createdBy', 'name email department designation');

    if (!canAccessDailyFollowUp(followUp, getActorContext(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creator can view this daily working record'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Follow Up updated successfully',
      data: followUp
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// =====================================
// DELETE FOLLOW UP
// =====================================
exports.deleteFollowUp = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Follow Up ID'
      });
    }

    const existing = await FollowUp.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Follow Up not found'
      });
    }

    if (!canAccessDailyFollowUp(existing, getActorContext(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creator can delete this daily working record'
      });
    }

    await FollowUp.findByIdAndDelete(id);

    if (!canAccessDailyFollowUp(followUp, getActorContext(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creator can view this daily working record'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Follow Up deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
