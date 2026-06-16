const Classification = require('../models/Classification');

const DEFAULT_CLASSIFICATIONS = [
  {
    name: 'SILVER',
    title: 'Silver',
    description: 'Standard customer classification',
    dailyTransferLimit: 15000,
    monthlyTransferLimit: 100000,
    overdraftLimit: 25000,
    overdraftPenaltyPerDay: 100,
    transferPrivileges: [],
    isActive: true,
  },
  {
    name: 'GOLD',
    title: 'Gold',
    description: 'Enhanced customer classification',
    dailyTransferLimit: 50000,
    monthlyTransferLimit: 250000,
    overdraftLimit: 50000,
    overdraftPenaltyPerDay: 200,
    transferPrivileges: [],
    isActive: true,
  },
  {
    name: 'PLATINUM',
    title: 'Platinum',
    description: 'Premium customer classification',
    dailyTransferLimit: 100000,
    monthlyTransferLimit: 500000,
    overdraftLimit: 100000,
    overdraftPenaltyPerDay: 500,
    transferPrivileges: [],
    isActive: true,
  },
];

const PENDING_LIMITS = {
  dailyTransferLimit: 0,
  monthlyTransferLimit: 0,
  overdraftLimit: 0,
  overdraftPenaltyPerDay: 0,
};

const normalizeClassificationName = (name) => String(name || '').trim().toUpperCase();

const ensureDefaultClassifications = async () => {
  await Promise.all(
    DEFAULT_CLASSIFICATIONS.map(async (definition) => {
      await Classification.findOneAndUpdate(
        { name: definition.name },
        { $setOnInsert: definition },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await Classification.updateOne(
        { name: definition.name, overdraftPenaltyPerDay: { $exists: false } },
        { $set: { overdraftPenaltyPerDay: definition.overdraftPenaltyPerDay } }
      );
    }
    )
  );
};

const getClassificationByName = async (name, options = {}) => {
  const normalized = normalizeClassificationName(name);
  if (!normalized || normalized === 'PENDING') return null;
  if (options.ensureDefaults !== false) await ensureDefaultClassifications();
  return Classification.findOne({ name: normalized, isActive: { $ne: false } });
};

const getLimitsForClassification = async (name) => {
  const normalized = normalizeClassificationName(name);
  if (!normalized || normalized === 'PENDING') return PENDING_LIMITS;
  const classification = await getClassificationByName(normalized);
  if (!classification) return PENDING_LIMITS;
  return {
    dailyTransferLimit: classification.dailyTransferLimit,
    monthlyTransferLimit: classification.monthlyTransferLimit,
    overdraftLimit: classification.overdraftLimit,
    overdraftPenaltyPerDay: classification.overdraftPenaltyPerDay || 0,
  };
};

const syncAccountsForClassification = async (name, limits) => {
  const Account = require('../models/Account');
  const normalized = normalizeClassificationName(name);
  if (!normalized || normalized === 'PENDING') return { matchedCount: 0, modifiedCount: 0 };
  return Account.updateMany(
    { classification: normalized },
    {
      $set: {
        dailyTransferLimit: limits.dailyTransferLimit,
        monthlyTransferLimit: limits.monthlyTransferLimit,
        overdraftLimit: limits.overdraftLimit,
        overdraftPenaltyPerDay: limits.overdraftPenaltyPerDay || 0,
      },
    }
  );
};

module.exports = {
  DEFAULT_CLASSIFICATIONS,
  PENDING_LIMITS,
  normalizeClassificationName,
  ensureDefaultClassifications,
  getClassificationByName,
  getLimitsForClassification,
  syncAccountsForClassification,
};
