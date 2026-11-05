const ChecklistResponse = require("../models/ChecklistResponse");

// CREATE RESPONSE
exports.createResponse = async (req, res) => {
  try {
    const {
      checklistId,
      status,
      completionPercentage,
      workDescription,
      result,
      issues,
      customResponses,
      startTime,
      endTime,
      department,
      taskName,
    } = req.body;

    if (!checklistId || !status) {
      return res.status(400).json({
        success: false,
        message: "Checklist ID and status are required",
      });
    }

    const percentage = Number(completionPercentage ?? 0);

    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        message: "Completion percentage must be between 0 and 100",
      });
    }

    if (status === "completed" && percentage !== 100) {
      return res.status(400).json({
        success: false,
        message: "Completed task must have 100% progress",
      });
    }

    const employeeId = req.user._id;

    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;

    if (
      (start && Number.isNaN(start.getTime())) ||
      (end && Number.isNaN(end.getTime())) ||
      (start && end && end < start)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or end time",
      });
    }

    const timeSpentMinutes =
      start && end
        ? Math.round((end - start) / 60000)
        : 0;

    const attachments = (req.files || []).map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/checklist-responses/${file.filename}`,
      fileType: file.mimetype,
    }));

    const response = await ChecklistResponse.create({
      checklistId,
      employeeId,
      department: req.user.department || department,
      taskName,
      status,
      completionPercentage: percentage,
      workDescription,
      result,
      issues: issues
        ? typeof issues === "string"
          ? JSON.parse(issues)
          : issues
        : {},
      customResponses: customResponses
        ? typeof customResponses === "string"
          ? JSON.parse(customResponses)
          : customResponses
        : [],
      attachments,
      startTime: start,
      endTime: end,
      timeSpentMinutes,
      history: [
        {
          action: "submitted",
          performedBy: employeeId,
          remarks: "Checklist response submitted",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Checklist response submitted successfully",
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET ALL RESPONSES
exports.getAllResponses = async (req, res) => {
  try {
    const {
      status,
      approvalStatus,
      department,
      employeeId,
      checklistId,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Employees can only see their own responses.
    if (req.user.role === "Employee") {
      filter.employeeId = req.user._id;
    } else {
      if (employeeId) filter.employeeId = employeeId;
      if (department) filter.department = department;
    }

    if (checklistId) filter.checklistId = checklistId;
    if (status) filter.status = status;
    if (approvalStatus) {
      filter["approval.status"] = approvalStatus;
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const [data, total] = await Promise.all([
      ChecklistResponse.find(filter)
        .populate("employeeId", "name email department designation")
        .populate("approval.reviewedBy", "name")
        .sort({ submittedAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),

      ChecklistResponse.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET SINGLE RESPONSE
exports.getResponseById = async (req, res) => {
  try {
    const response = await ChecklistResponse.findById(req.params.id)
      .populate("employeeId", "name email department designation")
      .populate("approval.reviewedBy", "name")
      .populate("history.performedBy", "name");

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    if (
      req.user.role === "Employee" &&
      response.employeeId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// UPDATE RESPONSE
exports.updateResponse = async (req, res) => {
  try {
    const response = await ChecklistResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    if (response.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot update another employee's response",
      });
    }

    if (!["pending", "rework", "rejected"].includes(response.approval.status)) {
      return res.status(400).json({
        success: false,
        message: "Only pending or returned responses can be updated",
      });
    }

    const allowedFields = [
      "status",
      "completionPercentage",
      "workDescription",
      "result",
      "issues",
      "customResponses",
      "startTime",
      "endTime",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        response[field] = req.body[field];
      }
    });

    if (response.completionPercentage < 0 || response.completionPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid completion percentage",
      });
    }

    if (
      response.startTime &&
      response.endTime &&
      response.endTime < response.startTime
    ) {
      return res.status(400).json({
        success: false,
        message: "End time cannot be before start time",
      });
    }

    response.timeSpentMinutes =
      response.startTime && response.endTime
        ? Math.round(
            (response.endTime - response.startTime) / 60000
          )
        : 0;

    response.approval.status = "pending";
    response.approval.reviewedBy = null;
    response.approval.reviewedAt = null;
    response.approval.remarks = "";

    response.history.push({
      action: "resubmitted",
      performedBy: req.user._id,
      remarks: "Employee updated and resubmitted response",
    });

    await response.save();

    res.json({
      success: true,
      message: "Response updated successfully",
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// MANAGER REVIEW
exports.reviewResponse = async (req, res) => {
  try {
    const { status, remarks, managerScore } = req.body;

    const allowedStatuses = ["approved", "rejected", "rework"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    if (remarks === undefined || !String(remarks).trim()) {
      return res.status(400).json({
        success: false,
        message: "Review remarks are required",
      });
    }

    if (
      managerScore !== undefined &&
      (!Number.isFinite(Number(managerScore)) ||
        Number(managerScore) < 0 ||
        Number(managerScore) > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Manager score must be between 0 and 100",
      });
    }

    const response = await ChecklistResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    if (response.approval.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Approved response cannot be reviewed again",
      });
    }

    response.approval.status = status;
    response.approval.reviewedBy = req.user._id;
    response.approval.remarks = remarks;
    response.approval.reviewedAt = new Date();

    if (managerScore !== undefined) {
      response.score.manager = Number(managerScore);
    }

    response.history.push({
      action: status,
      remarks,
      performedBy: req.user._id,
    });

    await response.save();

    res.json({
      success: true,
      message: `Response ${status} successfully`,
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET MY RESPONSES
exports.getMyResponses = async (req, res) => {
  try {
    const data = await ChecklistResponse.find({
      employeeId: req.user._id,
    }).sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET CHECKLIST HISTORY
exports.getChecklistResponses = async (req, res) => {
  try {
    const data = await ChecklistResponse.find({
      checklistId: req.params.checklistId,
    })
      .populate("employeeId", "name department")
      .sort({ submittedAt: -1 });

    const visibleData =
      req.user.role === "Employee"
        ? data.filter(
            (item) =>
              item.employeeId._id.toString() === req.user._id.toString()
          )
        : data;

    res.json({
      success: true,
      count: visibleData.length,
      data: visibleData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};