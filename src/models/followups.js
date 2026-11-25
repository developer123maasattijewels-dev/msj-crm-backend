
const mongoose = require('mongoose');

const { Schema } = mongoose;

const followUpSchema = new Schema(
  {
    // Follow Up Type
    followUpType: {
      type: String,
      required: true,
      enum: ['client', 'sales', 'excel', 'meeting', 'daily']
    },

    // Employee Details
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    employeeName: {
      type: String,
      default: ''
    },

    department: {
      type: String,
      default: ''
    },

    // Common Call Timing
    callStartTime: {
      type: String,
      default: ''
    },

    callEndTime: {
      type: String,
      default: ''
    },

    // Client Follow Up Details
    clientName: {
      type: String,
      default: ''
    },

    clientPhone: {
      type: String,
      default: ''
    },

    category: {
      type: String,
      enum: [
        'new-order',
        'sales',
        'payment',
        'order-status',
        'product-enquiry',
        'complaint',
        ''
      ],
      default: ''
    },

    orderType: {
      type: String,
      enum: ['company-order', 'my-order', ''],
      default: ''
    },

    orderNumber: {
      type: String,
      default: ''
    },

    orderAmount: {
      type: Number,
      default: 0
    },

    pendingPaymentAmount: {
      type: Number,
      default: 0
    },

    orderStatus: {
      type: String,
      default: ''
    },

    productName: {
      type: String,
      default: ''
    },

    salesDetails: {
      type: String,
      default: ''
    },

    complaintDetails: {
      type: String,
      default: ''
    },

    followUpDate: {
      type: Date
    },

    nextFollowUpDate: {
      type: Date
    },

    status: {
      type: String,
      enum: [
        'Pending',
        'Completed',
        'Interested',
        'Not Interested'
      ],
      default: 'Pending'
    },

    // Sales Person Follow Up Details
    salesPersonName: {
      type: String,
      default: ''
    },

    employeeId: {
      type: String,
      default: ''
    },

    activityType: {
      type: String,
      default: ''
    },

    target: {
      type: Number,
      default: 0
    },

    achievement: {
      type: Number,
      default: 0
    },

    performanceStatus: {
      type: String,
      enum: [
        'Pending',
        'On Track',
        'Completed',
        'Needs Improvement'
      ],
      default: 'Pending'
    },

    // Excel Working Details
    workName: {
      type: String,
      default: ''
    },

    excelFileName: {
      type: String,
      default: ''
    },

    workType: {
      type: String,
      default: ''
    },

    workDate: {
      type: Date
    },

    assignedTo: {
      type: String,
      default: ''
    },

    workStatus: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    },

    description: {
      type: String,
      default: ''
    },

    file: {
      type: String,
      default: ''
    },

    // Office Meeting Details
    meetingTitle: {
      type: String,
      default: ''
    },

    meetingDate: {
      type: Date
    },

    meetingTime: {
      type: String,
      default: ''
    },

    meetingType: {
      type: String,
      default: ''
    },

    organizer: {
      type: String,
      default: ''
    },

    participants: {
      type: [String],
      default: []
    },

    agenda: {
      type: String,
      default: ''
    },

    decisions: {
      type: String,
      default: ''
    },

    // Daily Working Details
    dailyWorks: [
      {
        workName: {
          type: String,
          default: ''
        },

        workDate: {
          type: String,
          default: ''
        },

        startTime: {
          type: String,
          default: ''
        },

        endTime: {
          type: String,
          default: ''
        },

        description: {
          type: String,
          default: ''
        },

        remarks: {
          type: String,
          default: ''
        }
      }
    ],

    // Common Remarks
    remarks: {
      type: String,
      default: ''
    }

  },
  {
    timestamps: true
  }
);

// Indexes
followUpSchema.index({ createdBy: 1, createdAt: -1 });
followUpSchema.index({ followUpType: 1, createdAt: -1 });

const FollowUp = mongoose.model('FollowUp', followUpSchema);

module.exports = FollowUp;
