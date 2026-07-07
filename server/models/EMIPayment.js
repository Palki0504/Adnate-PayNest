const mongoose = require('mongoose');

const emiPaymentSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emiNumber: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    principalAmount: {
      type: Number,
      required: true,
    },
    interestAmount: {
      type: Number,
      required: true,
    },
    principalPaid: {
      type: Number,
      default: 0,
    },
    interestPaid: {
      type: Number,
      default: 0,
    },
    emiAmount: {
      type: Number,
      required: true,
    },
    outstandingAfter: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Missed', 'Failed', 'Processing', 'PartiallyPaid', 'Settled', 'Closed'],
      default: 'Pending',
    },
    paidAt: {
      type: Date,
    },
    paymentMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    paymentYear: {
      type: Number,
    },
    penalty: {
      type: Number,
      default: 0,
    },
    deductedFromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    transactionRef: {
      type: String,
      trim: true,
      default: '',
    },
    paymentMode: {
      type: String,
      trim: true,
      default: '',
    },
    failureReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
emiPaymentSchema.index({ loanId: 1, emiNumber: 1 });
emiPaymentSchema.index({ loanId: 1, status: 1 });
emiPaymentSchema.index({ userId: 1, status: 1, dueDate: 1 });
emiPaymentSchema.index({ dueDate: 1, status: 1 });
emiPaymentSchema.index(
  { loanId: 1, userId: 1, paymentMonth: 1, paymentYear: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'Paid',
      paymentMonth: { $exists: true },
      paymentYear: { $exists: true },
    },
    name: 'unique_paid_emi_per_loan_month',
  }
);

module.exports = mongoose.model('EMIPayment', emiPaymentSchema);
