const mongoose = require('mongoose');

const partPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, default: '' },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
}, { _id: true });

const loanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: String,
      trim: true,
    },
    loanNumber: {
      type: String,
      unique: true,
    },
    loanType: {
      type: String,
      required: [true, 'Loan type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [10000, 'Minimum loan amount is ₹10,000'],
    },
    approvedAmount: {
      type: Number,
      default: 0,
    },
    interestRate: {
      type: Number,
      default: 0,
    },
    tenure: {
      type: Number,
      required: [true, 'Loan tenure is required'],
      min: [3, 'Minimum tenure is 3 months'],
      max: [360, 'Maximum tenure is 360 months'],
    },
    monthlyEMI: {
      type: Number,
      default: 0,
    },
    totalInterest: {
      type: Number,
      default: 0,
    },
    totalRepayment: {
      type: Number,
      default: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    linkedAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Linked account is required'],
    },
    linkedAccountNumber: {
      type: String,
      trim: true,
    },
    monthlyIncome: {
      type: Number,
      required: [true, 'Monthly income is required'],
      min: [0, 'Monthly income cannot be negative'],
    },
    purpose: {
      type: String,
      required: [true, 'Loan purpose is required'],
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters'],
    },
    existingLiabilities: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ─── Status & Workflow ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'More Info Required', 'Approved', 'Rejected', 'Disbursed', 'Closed'],
      default: 'Submitted',
    },
    eligibilityScore: {
      type: Number,
      default: 0,
    },
    eligibilityDetails: {
      classificationScore: { type: Number, default: 0 },
      incomeScore: { type: Number, default: 0 },
      accountHistoryScore: { type: Number, default: 0 },
      overdraftScore: { type: Number, default: 0 },
      liabilitiesScore: { type: Number, default: 0 },
      isEligible: { type: Boolean, default: false },
      remarks: [{ type: String }],
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    managerNote: {
      type: String,
      trim: true,
      default: '',
    },
    additionalInfoRequest: {
      type: String,
      trim: true,
      default: '',
    },
    additionalInfoResponse: {
      type: String,
      trim: true,
      default: '',
    },
    // ─── Approval & Disbursement ────────────────────────────────────────
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: { type: Date },
    disbursedAt: { type: Date },
    closedAt: { type: Date },
    // ─── EMI Tracking ───────────────────────────────────────────────────
    nextEMIDueDate: { type: Date },
    emiStartDate: { type: Date },
    totalEMIsPaid: { type: Number, default: 0 },
    missedEMICount: { type: Number, default: 0 },
    penaltyAmount: { type: Number, default: 0 },
    // ─── Part Payments & Foreclosure ────────────────────────────────────
    partPayments: [partPaymentSchema],
    isForeclosed: { type: Boolean, default: false },
    foreclosureDate: { type: Date },
    foreclosureCharge: { type: Number, default: 0 },
    closureProcessing: { type: Boolean, default: false },
    // ─── Customer Classification at time of application ─────────────────
    customerClassification: {
      type: String,
      default: 'SILVER',
      uppercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate loan number before saving
loanSchema.pre('save', function (next) {
  if (!this.loanNumber) {
    this.loanNumber = `LN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// Indexes
loanSchema.index({ userId: 1, status: 1 });
loanSchema.index({ status: 1, nextEMIDueDate: 1 });
loanSchema.index(
  { userId: 1, linkedAccountId: 1, loanType: 1, amount: 1, tenure: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Submitted', 'Under Review', 'More Info Required'] } },
    name: 'unique_pending_loan_request',
  }
);

module.exports = mongoose.model('Loan', loanSchema);
