const mongoose = require('mongoose');

const ACCOUNT_TYPES = ['savings', 'current', 'salary'];
const REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected'];

const accountTypeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedAccountType: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: [true, 'Requested account type is required'],
    },
    currentAccountTypes: [{
      type: String,
      enum: ACCOUNT_TYPES,
    }],
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'Pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    managerComment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

accountTypeRequestSchema.index({ userId: 1, status: 1 });
accountTypeRequestSchema.index({ status: 1, createdAt: -1 });
accountTypeRequestSchema.index(
  { userId: 1, requestedAccountType: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

module.exports = mongoose.model('AccountTypeRequest', accountTypeRequestSchema);
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
