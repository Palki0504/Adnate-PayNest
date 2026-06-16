const Account = require('../models/Account');
const User = require('../models/User');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');
const { body } = require('express-validator');

const MAX_ACCOUNTS_PER_USER = 3;

const createAccountValidation = [
  body('accountType')
    .notEmpty().withMessage('Account type is required')
    .isIn(['savings', 'salary', 'current']).withMessage('Invalid account type'),
];

// ─── @desc    Get all accounts for the authenticated user
const getMyAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.user._id, status: 'active' }).sort({ createdAt: 1 });

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalOverdraftUsed = accounts.reduce((sum, acc) => sum + acc.overdraftUsed, 0);
    const totalOverdraftLimit = accounts.reduce((sum, acc) => sum + acc.overdraftLimit, 0);
    const totalAvailableOverdraft = accounts.reduce(
      (sum, acc) => sum + Math.max(0, acc.overdraftLimit - acc.overdraftUsed),
      0
    );

    res.status(200).json({
      success: true,
      summary: {
        totalBalance,
        totalOverdraftUsed,
        totalOverdraftLimit,
        totalAvailableOverdraft,
        totalAvailableBalance: totalBalance + totalAvailableOverdraft,
        accountCount: accounts.length,
        maxAccounts: MAX_ACCOUNTS_PER_USER,
      },
      accounts: accounts.map((acc) => {
        const availableOverdraft = Math.max(0, acc.overdraftLimit - acc.overdraftUsed);
        return {
          ...acc.toObject(),
          availableOverdraft,
          availableBalance: acc.balance + availableOverdraft,
          accountTypeLabel: formatAccountType(acc.accountType),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

const getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    res.status(200).json({ success: true, account });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Create additional bank account (max 2 per user)
const createAccount = async (req, res, next) => {
  try {
    if (req.user?.role === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Submit an account type request for manager approval.',
      });
    }

    const { accountType } = req.body;

    const existing = await Account.find({
      userId: req.user._id,
      status: { $ne: 'closed' },
    });

    if (existing.length >= MAX_ACCOUNTS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Maximum of ${MAX_ACCOUNTS_PER_USER} account types allowed.`,
      });
    }

    const duplicateType = existing.find((a) => a.accountType === accountType);
    if (duplicateType) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${formatAccountType(accountType)}. Choose a different account type.`,
      });
    }

    const fixedBalance = FIXED_ACCOUNT_BALANCES[accountType];
    if (fixedBalance === undefined) {
      return res.status(400).json({ success: false, message: 'Invalid account type selected.' });
    }

    const user = await User.findById(req.user._id).select('classification');
    const account = await Account.create({
      userId: req.user._id,
      customerId: req.user.customerId,
      accountType,
      balance: fixedBalance,
      classification: user?.classification || 'PENDING',
    });

    res.status(201).json({
      success: true,
      message: `${formatAccountType(accountType)} created successfully.`,
      account: {
        ...account.toObject(),
        accountTypeLabel: formatAccountType(accountType),
      },
    });
  } catch (error) {
    next(error);
  }
};

function formatAccountType(type) {
  const labels = { savings: 'Savings Account', salary: 'Salary Account', current: 'Current Account' };
  return labels[type] || type;
}

module.exports = {
  getMyAccounts,
  getAccountById,
  createAccount,
  createAccountValidation,
  MAX_ACCOUNTS_PER_USER,
};
