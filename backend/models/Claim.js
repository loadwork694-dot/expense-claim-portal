const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['Submitted', 'Manager Approved', 'Accounts Approved', 'Paid', 'Rejected'],
    required: true
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  byName: { type: String, required: true },
  role: { type: String, required: true },
  comment: { type: String, default: '' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const claimSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  department: { type: String, required: true, trim: true, index: true },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  receiptUrl: { type: String, required: true },
  receiptPublicId: { type: String, default: '' },
  limitExceeded: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Submitted', 'Manager Approved', 'Accounts Approved', 'Paid', 'Rejected'],
    default: 'Submitted',
    index: true
  },
  rejectReason: { type: String, trim: true, default: '' },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

claimSchema.index({ date: -1, status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
