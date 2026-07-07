const mongoose = require('mongoose');

const eligibilityRulesSchema = new mongoose.Schema({
  minMonthlyIncome: { type: Number, default: 15000 },
  maxLiabilitiesRatio: { type: Number, default: 50 }, // % of income
  minAccountAgeDays: { type: Number, default: 90 },
  maxOverdraftUsagePercent: { type: Number, default: 70 },
}, { _id: false });

const loanConfigSchema = new mongoose.Schema(
  {
    loanType: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    maxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    minAmount: {
      type: Number,
      default: 10000,
      min: 0,
    },
    minTenure: {
      type: Number,
      default: 3,
      min: 1,
    },
    maxTenure: {
      type: Number,
      default: 60,
      min: 1,
    },
    penaltyRate: {
      type: Number,
      default: 2, // % of EMI for missed payment
      min: 0,
    },
    foreclosureChargePercent: {
      type: Number,
      default: 4, // % of outstanding balance
      min: 0,
    },
    eligibilityRules: {
      type: eligibilityRulesSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Default configurations
const DEFAULT_LOAN_CONFIGS = [
  {
    loanType: 'personal',
    displayName: 'Personal Loan',
    interestRate: 12,
    maxAmount: 1500000,
    minTenure: 3,
    maxTenure: 60,
    penaltyRate: 2,
    foreclosureChargePercent: 4,
    eligibilityRules: {
      minMonthlyIncome: 15000,
      maxLiabilitiesRatio: 50,
      minAccountAgeDays: 90,
      maxOverdraftUsagePercent: 70,
    },
  },
  {
    loanType: 'home',
    displayName: 'Home Loan',
    interestRate: 8.5,
    maxAmount: 10000000,
    minTenure: 12,
    maxTenure: 360,
    penaltyRate: 1.5,
    foreclosureChargePercent: 3,
    eligibilityRules: {
      minMonthlyIncome: 25000,
      maxLiabilitiesRatio: 60,
      minAccountAgeDays: 180,
      maxOverdraftUsagePercent: 50,
    },
  },
  {
    loanType: 'vehicle',
    displayName: 'Vehicle Loan',
    interestRate: 9.5,
    maxAmount: 3000000,
    minTenure: 6,
    maxTenure: 84,
    penaltyRate: 2,
    foreclosureChargePercent: 3.5,
    eligibilityRules: {
      minMonthlyIncome: 20000,
      maxLiabilitiesRatio: 50,
      minAccountAgeDays: 120,
      maxOverdraftUsagePercent: 60,
    },
  },
  {
    loanType: 'education',
    displayName: 'Education Loan',
    interestRate: 7.5,
    maxAmount: 5000000,
    minTenure: 12,
    maxTenure: 120,
    penaltyRate: 1,
    foreclosureChargePercent: 2,
    eligibilityRules: {
      minMonthlyIncome: 10000,
      maxLiabilitiesRatio: 60,
      minAccountAgeDays: 60,
      maxOverdraftUsagePercent: 80,
    },
  },
];

const ensureDefaultLoanConfigs = async () => {
  const LoanConfig = mongoose.model('LoanConfig');
  for (const config of DEFAULT_LOAN_CONFIGS) {
    await LoanConfig.findOneAndUpdate(
      { loanType: config.loanType },
      { $setOnInsert: config },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

module.exports = mongoose.model('LoanConfig', loanConfigSchema);
module.exports.ensureDefaultLoanConfigs = ensureDefaultLoanConfigs;
module.exports.DEFAULT_LOAN_CONFIGS = DEFAULT_LOAN_CONFIGS;
