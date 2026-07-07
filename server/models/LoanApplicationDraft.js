const mongoose = require('mongoose');

const loanApplicationDraftSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  customerId: { type: String, trim: true },
  currentStep: { type: Number, default: 1, min: 1, max: 5 },
  loanDetails: {
    loanType: String,
    purpose: String,
    loanAmount: Number,
    tenure: Number,
    tenureUnit: { type: String, enum: ['months', 'years'] },
    interestRate: Number,
    linkedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  },
}, { timestamps: true });

module.exports = mongoose.model('LoanApplicationDraft', loanApplicationDraftSchema);
