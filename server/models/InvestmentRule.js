const mongoose = require('mongoose');

const classificationRateSchema = new mongoose.Schema(
  {
    classificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classification' },
    classificationName: { type: String, uppercase: true, trim: true },
    classification: { type: String, uppercase: true, trim: true },
    interestRate: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ALLOWED_TENURES = [6, 12, 24, 60];

const investmentRuleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['FD', 'RD'], required: true, unique: true },
    minAmount: { type: Number, default: 5000, min: 0 },
    maxAmount: { type: Number, default: 1000000, min: 0 },
    minMonthlyAmount: { type: Number, default: 500, min: 0 },
    maxMonthlyAmount: { type: Number, default: 100000, min: 0 },
    tenureOptions: { type: [Number], default: ALLOWED_TENURES },
    allowedTenures: { type: [Number], default: ALLOWED_TENURES },
    classificationInterestRates: { type: [classificationRateSchema], default: [] },
    prematurePenalty: { type: Number, default: 1, min: 0 },
    prematureWithdrawalPenalty: { type: Number, default: 1, min: 0 },
    prematureClosurePenalty: { type: Number, default: 1, min: 0 },
    missedInstallmentPenalty: { type: Number, default: 2, min: 0 },
    autoRenewalAllowed: { type: Boolean, default: true },
    autoDebitAllowed: { type: Boolean, default: true },
    updatedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

investmentRuleSchema.pre('validate', function (next) {
  const tenures = (this.allowedTenures?.length ? this.allowedTenures : this.tenureOptions || [])
    .map(Number)
    .filter((tenure) => ALLOWED_TENURES.includes(tenure));
  this.allowedTenures = tenures.length ? [...new Set(tenures)] : ALLOWED_TENURES;
  this.tenureOptions = this.allowedTenures;
  this.classificationInterestRates = (this.classificationInterestRates || []).map((item) => {
    const name = String(item.classificationName || item.classification || '').toUpperCase().trim();
    return {
      classificationId: item.classificationId,
      classificationName: name,
      classification: name,
      interestRate: item.interestRate,
    };
  });
  next();
});

investmentRuleSchema.methods.getRateForClassification = function (classification) {
  const key = String(classification || 'SILVER').toUpperCase();
  const match = this.classificationInterestRates.find((item) => (
    String(item.classificationName || item.classification || '').toUpperCase() === key
  ));
  return Number(match?.interestRate ?? this.classificationInterestRates[0]?.interestRate ?? 0);
};

const InvestmentRule = mongoose.model('InvestmentRule', investmentRuleSchema);

const ensureDefaultInvestmentRules = async () => {
  const defaults = [
    {
      type: 'FD',
      minAmount: 5000,
      maxAmount: 1000000,
      tenureOptions: ALLOWED_TENURES,
      allowedTenures: ALLOWED_TENURES,
      classificationInterestRates: [],
      prematurePenalty: 1,
      prematureWithdrawalPenalty: 1,
      missedInstallmentPenalty: 0,
      autoRenewalAllowed: true,
    },
    {
      type: 'RD',
      minAmount: 500,
      maxAmount: 100000,
      minMonthlyAmount: 500,
      maxMonthlyAmount: 100000,
      tenureOptions: ALLOWED_TENURES,
      allowedTenures: ALLOWED_TENURES,
      classificationInterestRates: [],
      prematurePenalty: 1,
      prematureClosurePenalty: 1,
      missedInstallmentPenalty: 2,
      autoRenewalAllowed: false,
      autoDebitAllowed: true,
    },
  ];

  for (const rule of defaults) {
    await InvestmentRule.findOneAndUpdate(
      { type: rule.type },
      { $setOnInsert: rule },
      { upsert: true, new: true }
    );
  }
};

module.exports = InvestmentRule;
module.exports.ensureDefaultInvestmentRules = ensureDefaultInvestmentRules;
module.exports.ALLOWED_TENURES = ALLOWED_TENURES;
