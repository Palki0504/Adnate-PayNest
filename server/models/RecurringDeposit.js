const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema(
  {
    installmentNo: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    paidDate: Date,
    amount: { type: Number, required: true },
    penalty: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Paid', 'Missed', 'Failed'], default: 'Pending' },
    paymentMode: { type: String, trim: true, default: '' },
    failureReason: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const prematureClosureSchema = new mongoose.Schema(
  {
    requested: { type: Boolean, default: false },
    reason: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['None', 'Pending', 'Approved', 'Rejected'], default: 'None' },
    requestStatus: { type: String, enum: ['None', 'Pending Manager Approval', 'Approved', 'Rejected'], default: 'None' },
    rdId: { type: String, trim: true, default: '' },
    customerId: { type: String, trim: true, default: '' },
    customerName: { type: String, trim: true, default: '' },
    linkedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    linkedAccountNumber: { type: String, trim: true, default: '' },
    depositAmount: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0 },
    accruedInterest: { type: Number, default: 0 },
    penaltyRate: { type: Number, default: 0 },
    penaltyAmount: { type: Number, default: 0 },
    revisedPayoutAmount: { type: Number, default: 0 },
    calculationBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    requestedAt: Date,
    reviewedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    managerRemarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const renewalRequestSchema = new mongoose.Schema(
  {
    requested: { type: Boolean, default: false },
    status: { type: String, enum: ['None', 'Pending', 'Approved', 'Rejected'], default: 'None' },
    requestStatus: { type: String, enum: ['None', 'Pending Manager Approval', 'Approved', 'Rejected'], default: 'None' },
    rdId: { type: String, trim: true, default: '' },
    customerId: { type: String, trim: true, default: '' },
    customerName: { type: String, trim: true, default: '' },
    depositType: { type: String, trim: true, default: 'RD' },
    monthlyContribution: { type: Number, default: 0 },
    oldMaturityDate: Date,
    tenure: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0 },
    expectedMaturityAmount: { type: Number, default: 0 },
    requestedAt: Date,
    reviewedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    managerRemarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const renewalHistorySchema = new mongoose.Schema(
  {
    renewedAt: Date,
    oldMaturityDate: Date,
    newMaturityDate: Date,
    monthlyContribution: { type: Number, default: 0 },
    oldInterestRate: { type: Number, default: 0 },
    newInterestRate: { type: Number, default: 0 },
    tenure: { type: Number, default: 0 },
    expectedMaturityAmount: { type: Number, default: 0 },
    managerRemarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const rdSchema = new mongoose.Schema(
  {
    rdId: { type: String, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: String, trim: true },
    customerName: { type: String, trim: true },
    linkedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    linkedAccountNumber: { type: String, trim: true },
    accountType: { type: String, trim: true },
    classification: { type: String, uppercase: true, trim: true, default: 'SILVER' },
    monthlyContribution: { type: Number, required: true, min: 0 },
    interestRate: { type: Number, required: true, min: 0 },
    tenure: { type: Number, required: true, min: 1 },
    startDate: Date,
    monthlyDebitDate: Date,
    maturityDate: Date,
    totalDepositedAmount: { type: Number, default: 0 },
    interestEarned: { type: Number, default: 0 },
    maturityAmount: { type: Number, default: 0 },
    expectedMaturityAmount: { type: Number, default: 0 },
    installmentsPaid: { type: Number, default: 0 },
    missedInstallments: { type: Number, default: 0 },
    installmentHistory: { type: [installmentSchema], default: [] },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Rejected', 'Matured', 'Closed', 'Premature Closed', 'Renewed'],
      default: 'Pending',
    },
    autoDebitStatus: { type: Boolean, default: true },
    prematureClosureRequest: { type: prematureClosureSchema, default: () => ({}) },
    renewalRequest: { type: renewalRequestSchema, default: () => ({}) },
    renewalHistory: { type: [renewalHistorySchema], default: [] },
    penaltyAmount: { type: Number, default: 0 },
    revisedPayoutAmount: { type: Number, default: 0 },
    managerApprovalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    managerRemarks: { type: String, trim: true, default: '' },
    approvedAt: Date,
    rejectedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

rdSchema.pre('save', function (next) {
  if (!this.rdId) this.rdId = `RD${Date.now()}${Math.floor(Math.random() * 1000)}`;
  next();
});

rdSchema.index(
  { userId: 1, linkedAccountId: 1, monthlyContribution: 1, tenure: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Pending' },
    name: 'unique_pending_rd_request',
  }
);

module.exports = mongoose.model('RecurringDeposit', rdSchema);
