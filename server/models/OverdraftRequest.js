const mongoose = require('mongoose');

const overdraftRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    currentLimit: {
      type: Number,
      required: true,
      min: [0, 'Current limit cannot be negative'],
    },
    requestedLimit: {
      type: Number,
      required: true,
      min: [1, 'Requested limit must be greater than 0'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for increase is required'],
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

overdraftRequestSchema.index({ userId: 1, status: 1 });
overdraftRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('OverdraftRequest', overdraftRequestSchema);
