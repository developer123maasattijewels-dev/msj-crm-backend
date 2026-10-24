const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    user: { type: String, default: 'Admin' },
    text: { type: String, required: true },
    time: {
      type: String,
      default: () =>
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
  {
    vendorName: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    reference: { type: String, default: '' },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, index: true },
    subject: { type: String, default: '' },
    type: {
      type: String,
      enum: [
        'help',
        'hiring',
        'internalStoreIssue',
        'maintenance',
        'demand',
        'po',
      ],
      required: true,
      default: 'help',
    },

    requester: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },

    requiredDate: { type: Date, default: null },
    description: { type: String, default: '' },

    // Type-specific form data (specifications, asset, hiring details, etc.)
    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    quotations: {
      type: [quotationSchema],
      default: [],
    },

    replies: {
      type: [replySchema],
      default: [],
    },

    approvalBy: { type: String, default: '' },
    assignee: { type: String, default: 'Unassigned' },

    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },
  },
  { timestamps: true }
);

const Tickets = mongoose.model('Ticket', ticketSchema);

module.exports = Tickets;