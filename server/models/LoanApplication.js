const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  path: { type: String, required: true, select: false },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const loanApplicationSchema = new mongoose.Schema({
  customerId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
  customerName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  classification: { type: String, default: 'SILVER', uppercase: true },
  accountNumber: { type: String, required: true, trim: true },
  linkedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  loanType: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  loanAmount: { type: Number, required: true, min: 10000 },
  tenure: { type: Number, required: true, min: 1 },
  tenureValue: { type: Number, min: 1 },
  tenureUnit: { type: String, enum: ['months', 'years'], default: 'months' },
  interestRate: { type: Number, required: true, min: 0 },
  emiStartDate: Date,
  disbursedAt: Date,
  estimatedEMI: { type: Number, required: true },
  totalInterest: { type: Number, required: true },
  totalRepayment: { type: Number, required: true },
  personalDetails: {
    name: String,
    dateOfBirth: Date,
    gender: String,
    maritalStatus: String,
    mobileNumber: String,
    email: String,
    address: String,
    panNumber: String,
    aadhaarNumber: String,
  },
  employmentDetails: {
    employmentType: String,
    organizationName: String,
    designation: String,
    monthlyIncome: { type: Number, default: 0 },
    workExperience: { type: Number, default: 0 },
    officeAddress: String,
    existingEMI: { type: Number, default: 0 },
    monthlyExpenses: { type: Number, default: 0 },
    overdraftUtilization: { type: Number, default: 0 },
  },
  studentDetails: {
    studentType: { type: String, enum: ['School', 'College', ''] },
    institutionName: String,
    classOrSemester: String,
    institutionAddress: String,
    city: String,
    state: String,
  },
  documents: [documentSchema],
  eligibilitySummary: {
    score: { type: Number, default: 0 },
    isEligible: { type: Boolean, default: false },
    debtToIncomeRatio: { type: Number, default: 0 },
    disposableIncome: { type: Number, default: 0 },
    remarks: [{ type: String }],
  },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'More Info Required', 'Disbursed'],
    default: 'Submitted',
    index: true,
  },
  managerDecision: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  managerComment: { type: String, default: '' },
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
}, { timestamps: true });

loanApplicationSchema.index({ status: 1, appliedAt: -1 });
loanApplicationSchema.index(
  { userId: 1, linkedAccountId: 1, loanType: 1, loanAmount: 1, tenure: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Submitted', 'Under Review', 'More Info Required'] } },
    name: 'unique_pending_loan_application_request',
  }
);

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
