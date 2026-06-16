const mongoose = require('mongoose');

const approvalRequestSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    fromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    fromAccountNumber: { type: String, default: '' },
    toAccountNumber: { type: String, default: '' },
    beneficiaryName: { type: String, default: '' },
    amount: {
      type: Number,
      required: true,
    },
    transferType: {
      type: String,
      enum: ['own_account', 'beneficiary'],
      default: 'own_account',
    },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remark: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ customerId: 1, status: 1 });
approvalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);
