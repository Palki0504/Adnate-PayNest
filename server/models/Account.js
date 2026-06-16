const mongoose = require('mongoose');
const { getLimitsForClassification, PENDING_LIMITS } = require('../utils/classificationPolicy');

// â”€â”€â”€ Fixed opening balances by account type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FIXED_ACCOUNT_BALANCES = {
  savings: 40000,
  salary: 10000,
  current: 80000,
};

const ACCOUNT_TYPE_LIMITS = {
  savings: {
    dailyTransferLimit: 15000,
    monthlyTransferLimit: 50000,
    perTransactionLimit: 5000,
    overdraftLimit: 500,
  },
  salary: {
    dailyTransferLimit: 50000,
    monthlyTransferLimit: 200000,
    perTransactionLimit: 25000,
    overdraftLimit: 15000,
  },
  current: {
    dailyTransferLimit: 200000,
    monthlyTransferLimit: 1000000,
    perTransactionLimit: 100000,
    overdraftLimit: 100000,
  },
};

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: String,
      sparse: true,
    },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
      required: [true, 'Account type is required'],
    },
    accountNumber: {
      type: String,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdraftLimit: {
      type: Number,
      default: 0,
    },
    overdraftUsed: {
      type: Number,
      default: 0,
    },
    availableOverdraft: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdraftPenalty: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdraftDueDate: {
      type: Date,
    },
    lastPenaltyCalculatedAt: {
      type: Date,
    },
    overdraftPenaltyPerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'frozen', 'closed'],
      default: 'active',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    interestRate: {
      type: Number,
      default: 0,
    },
    classification: {
      type: String,
      default: 'PENDING',
      uppercase: true,
      trim: true,
    },
    dailyTransferLimit: {
      type: Number,
    },
    monthlyTransferLimit: {
      type: Number,
    },
    // Monthly transfer tracking
    monthlyTransferTotal: {
      type: Number,
      default: 0,
    },
    lastTransferResetDate: {
      type: Date,
      default: function () {
        return this.getFirstDayOfMonth();
      },
    },
    // Monthly overdraft usage count (0-3, block on 3rd)
    monthlyOverdraftCount: {
      type: Number,
      default: 0,
    },
    lastOverdraftResetDate: {
      type: Date,
      default: function () {
        return this.getFirstDayOfMonth();
      },
    },
    // Overdraft facility status: ACTIVE, DEACTIVATED, PENDING_REACTIVATION
    overdraftStatus: {
      type: String,
      enum: ['ACTIVE', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    lastOverdraftDeactivatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// â”€â”€â”€ Instance Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
accountSchema.methods.getFirstDayOfMonth = function () {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

accountSchema.methods.getLimits = function () {
  const typeLimits = ACCOUNT_TYPE_LIMITS[this.accountType] || ACCOUNT_TYPE_LIMITS.savings;

  return {
    dailyTransferLimit: this.dailyTransferLimit !== undefined && this.dailyTransferLimit !== null ? this.dailyTransferLimit : PENDING_LIMITS.dailyTransferLimit,
    monthlyTransferLimit: this.monthlyTransferLimit !== undefined && this.monthlyTransferLimit !== null ? this.monthlyTransferLimit : PENDING_LIMITS.monthlyTransferLimit,
    overdraftLimit: this.overdraftLimit,
    perTransactionLimit: typeLimits.perTransactionLimit,
  };
};

// Virtual field for limits
accountSchema.virtual('limits').get(function () {
  return this.getLimits();
});
accountSchema.virtual('outstandingOverdraftAmount').get(function () {
  return this.overdraftUsed || 0;
});

accountSchema.virtual('totalOverdraftDue').get(function () {
  return (this.overdraftUsed || 0) + (this.overdraftPenalty || 0);
});

accountSchema.methods.getOverdraftDailyPenalty = function () {
  return this.overdraftPenaltyPerDay || 0;
};

accountSchema.methods.refreshOverdraftPolicy = async function () {
  const classificationLimits = await getLimitsForClassification(this.classification);
  this.overdraftLimit = classificationLimits.overdraftLimit;
  this.overdraftPenaltyPerDay = classificationLimits.overdraftPenaltyPerDay || 0;
  this.availableOverdraft = Math.max(0, this.overdraftLimit - (this.overdraftUsed || 0));

  if ((this.overdraftUsed || 0) <= 0 && (this.overdraftPenalty || 0) <= 0) {
    this.overdraftUsed = 0;
    this.overdraftPenalty = 0;
    this.overdraftDueDate = undefined;
    this.lastPenaltyCalculatedAt = undefined;
    this.overdraftStatus = (this.monthlyOverdraftCount || 0) >= 3 ? 'DEACTIVATED' : 'ACTIVE';
    return this;
  }

  if (!this.overdraftDueDate) {
    const basis = this.updatedAt || this.createdAt || new Date();
    this.overdraftDueDate = new Date(basis.getFullYear(), basis.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const now = new Date();
  const due = new Date(this.overdraftDueDate);
  due.setHours(23, 59, 59, 999);

  if ((this.overdraftUsed || 0) > 0 && now > due) {
    const calculationStart = this.lastPenaltyCalculatedAt && this.lastPenaltyCalculatedAt > due
      ? new Date(this.lastPenaltyCalculatedAt)
      : new Date(due);
    calculationStart.setHours(23, 59, 59, 999);

    const elapsedDays = Math.floor((now - calculationStart) / 86400000);
    if (elapsedDays > 0) {
      this.overdraftPenalty = (this.overdraftPenalty || 0) + (elapsedDays * this.getOverdraftDailyPenalty());
      this.lastPenaltyCalculatedAt = now;
    }
  }

  if ((this.monthlyOverdraftCount || 0) >= 3) {
    this.overdraftStatus = 'DEACTIVATED';
    if (!this.lastOverdraftDeactivatedAt) this.lastOverdraftDeactivatedAt = new Date();
  } else {
    this.overdraftStatus = 'ACTIVE';
    this.lastOverdraftDeactivatedAt = undefined;
  }

  return this;
};

accountSchema.methods.resetMonthlyCounters = async function () {
  const firstDayOfMonth = this.getFirstDayOfMonth();
  if (this.lastTransferResetDate < firstDayOfMonth) {
    this.monthlyTransferTotal = 0;
    this.lastTransferResetDate = firstDayOfMonth;
  }
  if (this.lastOverdraftResetDate < firstDayOfMonth) {
    this.monthlyOverdraftCount = 0;
    this.lastOverdraftResetDate = firstDayOfMonth;
    this.overdraftStatus = 'ACTIVE';
    this.lastOverdraftDeactivatedAt = undefined;
  }
  await this.refreshOverdraftPolicy();
  return this.save();
};

// Generate account number before saving
accountSchema.pre('save', async function (next) {
  if (!this.accountNumber) {
    const prefix = this.accountType === 'savings' ? 'SAV' : this.accountType === 'current' ? 'CUR' : 'SAL';
    this.accountNumber = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  const classificationLimits = await getLimitsForClassification(this.classification);
  this.overdraftLimit = classificationLimits.overdraftLimit;
  this.overdraftPenaltyPerDay = classificationLimits.overdraftPenaltyPerDay || 0;
  this.availableOverdraft = Math.max(0, this.overdraftLimit - (this.overdraftUsed || 0));
  if (this.dailyTransferLimit === undefined || this.dailyTransferLimit === null || this.dailyTransferLimit === 0 || this.isModified('classification')) {
    this.dailyTransferLimit = classificationLimits.dailyTransferLimit;
  }
  if (this.monthlyTransferLimit === undefined || this.monthlyTransferLimit === null || this.monthlyTransferLimit === 0 || this.isModified('classification')) {
    this.monthlyTransferLimit = classificationLimits.monthlyTransferLimit;
  }
  next();
});

const syncAccountToUser = async (account) => {
  const User = mongoose.model('User');
  const user = await User.findById(account.userId).select('name customerId email phone');
  if (!user) return;

  const limits = account.getLimits();
  const entry = {
    accountId: account._id,
    accountType: account.accountType,
    accountNumber: account.accountNumber,
    customerName: user.name,
    customerId: user.customerId,
    email: user.email,
    phone: user.phone,
    dailyTransferLimit: limits.dailyTransferLimit,
    monthlyTransferLimit: limits.monthlyTransferLimit,
    balance: account.balance,
    accountStatus: account.status,
    status: account.status,
    createdAt: account.createdAt || new Date(),
    approvedAt: account.createdAt || new Date(),
  };

  const updated = await User.updateOne(
    { _id: account.userId, 'accounts.accountId': account._id },
    { $set: { 'accounts.$': entry } }
  );
  if (updated.matchedCount === 0) {
    await User.updateOne(
      { _id: account.userId, 'accounts.accountId': { $ne: account._id } },
      { $push: { accounts: entry } }
    );
  }

  for (const slot of ['account1', 'account2', 'account3']) {
    const existing = await User.updateOne(
      { _id: account.userId, [`${slot}.accountId`]: account._id },
      {
        $set: {
          [`${slot}.accountType`]: entry.accountType,
          [`${slot}.accountNumber`]: entry.accountNumber,
          [`${slot}.dailyTransferLimit`]: entry.dailyTransferLimit,
          [`${slot}.monthlyTransferLimit`]: entry.monthlyTransferLimit,
          [`${slot}.accountStatus`]: entry.accountStatus,
        },
      }
    );
    if (existing.matchedCount > 0) return;
  }

  for (const slot of ['account1', 'account2', 'account3']) {
    const inserted = await User.updateOne(
      {
        _id: account.userId,
        $or: [
          { [slot]: { $exists: false } },
          { [slot]: null },
          { [`${slot}.accountId`]: { $exists: false } },
        ],
      },
      { $set: { [slot]: entry } }
    );
    if (inserted.modifiedCount > 0) return;
  }
};

accountSchema.post('save', async function (account) {
  await syncAccountToUser(account);
});

accountSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], async function () {
  this.accountIdsToSync = await this.model.find(this.getFilter()).distinct('_id');
});

accountSchema.post(['updateOne', 'updateMany', 'findOneAndUpdate'], async function () {
  if (!this.accountIdsToSync?.length) return;
  const accounts = await this.model.find({ _id: { $in: this.accountIdsToSync } });
  for (const account of accounts) {
    await syncAccountToUser(account);
  }
});

accountSchema.pre('deleteOne', { document: false, query: true }, async function () {
  this.accountBeingDeleted = await this.model.findOne(this.getFilter()).select('_id userId');
});

accountSchema.post('deleteOne', { document: false, query: true }, async function () {
  if (!this.accountBeingDeleted) return;
  const User = mongoose.model('User');
  await User.updateOne(
    { _id: this.accountBeingDeleted.userId },
    { $pull: { accounts: { accountId: this.accountBeingDeleted._id } } }
  );
});

accountSchema.index({ userId: 1, accountType: 1 }, { unique: true });

const Account = mongoose.model('Account', accountSchema);
Account.syncToUser = syncAccountToUser;

module.exports = Account;
module.exports.FIXED_ACCOUNT_BALANCES = FIXED_ACCOUNT_BALANCES;



