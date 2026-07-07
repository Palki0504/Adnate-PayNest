const mongoose = require('mongoose');

const loanRuleSchema = new mongoose.Schema({
  loanType: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
  interestRate: { type: Number, default: 0, min: 0 },
  minAmount: { type: Number, default: 10000, min: 0 },
  maxAmount: { type: Number, default: 0, min: 0 },
  tenureMin: { type: Number, default: 3, min: 1 },
  tenureMax: { type: Number, default: 60, min: 1 },
  tenureUnit: { type: String, enum: ['months', 'years'], default: 'months' },
  lateEmiPenalty: { type: Number, default: 2, min: 0 },
  processingFee: { type: Number, default: 0, min: 0 },
  prepaymentCharge: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

loanRuleSchema.virtual('isActive').get(function () {
  return this.status === 'Active';
});

loanRuleSchema.set('toJSON', { virtuals: true });
loanRuleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LoanRule', loanRuleSchema);
