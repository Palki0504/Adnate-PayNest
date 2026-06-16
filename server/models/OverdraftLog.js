const mongoose = require('mongoose');

const overdraftLogSchema = new mongoose.Schema(
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
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    senderAccountNumber: {
      type: String,
      trim: true,
    },
    receiverAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    receiverAccountNumber: {
      type: String,
      trim: true,
    },
    receiverAccountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
    },
    receiverCustomerId: {
      type: String,
      trim: true,
    },
    receiverName: {
      type: String,
      trim: true,
    },
    transactionType: {
      type: String,
      default: 'Overdraft Transfer',
    },
    amount: {
      type: Number,
      required: true,
    },
    odLimitAtTime: {
      type: Number,
      required: true,
    },
    penaltyPerDayAtTime: {
      type: Number,
      default: 0,
    },
    odUsedAfter: {
      type: Number,
      required: true,
    },
    monthlyUsageAfter: {
      type: Number,
      default: 0,
    },
    penaltyAmountAfter: {
      type: Number,
      default: 0,
    },
    totalDueAfter: {
      type: Number,
      default: 0,
    },
    overdraftStatusAfter: {
      type: String,
      enum: ['ACTIVE', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'repaid'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

overdraftLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('OverdraftLog', overdraftLogSchema);
