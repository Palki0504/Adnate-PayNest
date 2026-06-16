const mongoose = require('mongoose');

const transferLimitRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
    },
    limitType: {
      type: String,
      enum: ['daily', 'monthly'],
    },
    currentLimit: {
      type: Number,
      min: 0,
    },
    requestedLimit: {
      type: Number,
      min: 0,
    },
    currentDailyLimit: {
      type: Number,
      min: 0,
    },
    requestedDailyLimit: {
      type: Number,
      min: 0,
    },
    currentMonthlyLimit: {
      type: Number,
      min: 0,
    },
    requestedMonthlyLimit: {
      type: Number,
      min: 0,
    },
    reason: {
      type: String,
      required: [true, 'Reason for limit increase is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
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

transferLimitRequestSchema.index({ userId: 1, status: 1 });
transferLimitRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TransferLimitRequest', transferLimitRequestSchema);
