const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Beneficiary = require('../models/Beneficiary');

/**
 * Generate unique transaction ID
 */
const generateTransactionId = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${Date.now()}${rand}`;
};

/**
 * Validate beneficiary exists and is active
 */
const validateBeneficiary = async (beneficiaryId, userId) => {
  const beneficiary = await Beneficiary.findOne({
    _id: beneficiaryId,
    userId,
    isActive: true,
    status: 'active',
  });

  if (!beneficiary) {
    return {
      valid: false,
      reason: 'Beneficiary not found or is inactive.',
    };
  }

  if (!beneficiary.isVerified) {
    return {
      valid: false,
      reason: 'Beneficiary is not verified.',
    };
  }

  // Find the recipient user by customerId
  const User = require('../models/User');
  const recipientUser = await User.findOne({ customerId: beneficiary.customerId });
  if (!recipientUser) {
    return {
      valid: false,
      reason: 'Recipient user not found for given customer ID.',
    };
  }

  // Find the recipient's active account (assume primary account)
  const recipientAccount = await Account.findOne({ userId: recipientUser._id, status: 'active' });
  if (!recipientAccount) {
    return {
      valid: false,
      reason: 'Recipient account not found or inactive.',
    };
  }

  return {
    valid: true,
    beneficiary,
    recipientAccount,
  };
};

/**
 * Check if transfer exceeds daily limit
 */
const checkDailyTransferLimit = async (accountId, amount) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');

  const limits = account.getLimits();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get total transferred today (debit transactions only)
  const todayTransfers = await Transaction.aggregate([
    {
      $match: {
        fromAccount: account._id,
        type: { $in: ['debit', 'transfer'] },
        createdAt: { $gte: today },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  const totalToday = todayTransfers[0]?.totalAmount || 0;

  if (totalToday + amount > limits.dailyTransferLimit) {
    return {
      allowed: false,
      reason: `Daily transfer limit exceeded. Limit: ₹${limits.dailyTransferLimit}, Already spent: ₹${totalToday}, Requested: ₹${amount}`,
      limit: limits.dailyTransferLimit,
      used: totalToday,
      remaining: Math.max(0, limits.dailyTransferLimit - totalToday),
    };
  }

  return {
    allowed: true,
    limit: limits.dailyTransferLimit,
    used: totalToday,
    remaining: limits.dailyTransferLimit - totalToday - amount,
  };
};

/**
 * Check if transfer exceeds monthly limit
 */
const checkMonthlyTransferLimit = async (accountId, amount) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');

  // Reset monthly counters if needed
  await account.resetMonthlyCounters();

  const limits = account.getLimits();

  if (account.monthlyTransferTotal + amount > limits.monthlyTransferLimit) {
    return {
      allowed: false,
      reason: `Monthly transfer limit exceeded. Limit: ₹${limits.monthlyTransferLimit}, Already spent: ₹${account.monthlyTransferTotal}, Requested: ₹${amount}`,
      limit: limits.monthlyTransferLimit,
      used: account.monthlyTransferTotal,
      remaining: Math.max(0, limits.monthlyTransferLimit - account.monthlyTransferTotal),
    };
  }

  return {
    allowed: true,
    limit: limits.monthlyTransferLimit,
    used: account.monthlyTransferTotal,
    remaining: limits.monthlyTransferLimit - account.monthlyTransferTotal - amount,
  };
};

/**
 * Check if overdraft usage is allowed and not blocked
 */
const checkOverdraftAllowed = async (accountId, amount) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');

  // Reset monthly overdraft count if needed
  await account.resetMonthlyCounters();

  // If balance is sufficient, no overdraft needed
  if (amount <= account.balance) {
    return {
      allowed: true,
      usesOverdraft: false,
      balanceAmountUsed: amount,
      overdraftAmountUsed: 0,
      finalAccountBalance: account.balance - amount,
    };
  }

  // Monthly usage is authoritative even if a stale status value says ACTIVE.
  if (account.monthlyOverdraftCount >= 3) {
    return {
      allowed: false,
      reason: 'Monthly overdraft usage limit reached. Overdraft is deactivated for this month.',
      monthlyOverdraftCount: account.monthlyOverdraftCount,
    };
  }

  // Check if overdraft would be used
  // Ensure overdraft facility is active
  if (account.overdraftStatus !== 'ACTIVE' || account.overdraftLimit <= 0) {
    return {
      allowed: false,
      reason: 'Insufficient balance. Overdraft is not active for this account.',
    };
  }

  const odNeeded = amount - account.balance;
  const availableOverdraft = Math.max(0, account.overdraftLimit - account.overdraftUsed);
  if (odNeeded > availableOverdraft) {
    return {
      allowed: false,
      reason: 'Insufficient balance and overdraft limit exceeded.',
      availableOverdraft,
      overdraftAmountNeeded: odNeeded,
    };
  }

  return {
    allowed: true,
    usesOverdraft: true,
    balanceAmountUsed: account.balance,
    overdraftAmountUsed: odNeeded,
    finalAccountBalance: 0,
    monthlyOverdraftCount: account.monthlyOverdraftCount,
    monthlyOverdraftCountAfter: account.monthlyOverdraftCount + 1,
  };
};

/**
 * Check if transfer exceeds per-transaction limit
 */
const checkPerTransactionLimit = async (accountId, amount) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');

  const limits = account.getLimits();
  if (limits.perTransactionLimit && amount > limits.perTransactionLimit) {
    return {
      allowed: false,
      reason: `Transaction amount exceeds the per-transaction limit of ₹${limits.perTransactionLimit.toLocaleString('en-IN')} for ${account.accountType === 'savings' ? 'Savings' : account.accountType === 'salary' ? 'Salary' : 'Current'} accounts. Requested: ₹${amount.toLocaleString('en-IN')}`,
      limit: limits.perTransactionLimit,
    };
  }

  return {
    allowed: true,
  };
};

/**
 * Update account transfer and overdraft totals after successful transaction
 */
const updateAccountAfterTransfer = async (fromAccountId, amount, usesOverdraft = false) => {
  const account = await Account.findById(fromAccountId);
  if (!account) throw new Error('Account not found');

  // Reset monthly counters if needed
  await account.resetMonthlyCounters();

  // Update monthly transfer total
  account.monthlyTransferTotal += amount;

  // Increment overdraft count if overdraft was used
  if (usesOverdraft) {
    account.monthlyOverdraftCount += 1;
    // Auto-deactivate after 3rd monthly use
    if (account.monthlyOverdraftCount >= 3) {
      account.overdraftStatus = 'DEACTIVATED';
      account.lastOverdraftDeactivatedAt = new Date();
    }
  }

  return account.save();
};

module.exports = {
  generateTransactionId,
  validateBeneficiary,
  checkDailyTransferLimit,
  checkMonthlyTransferLimit,
  checkPerTransactionLimit,
  checkOverdraftAllowed,
  updateAccountAfterTransfer,
};
