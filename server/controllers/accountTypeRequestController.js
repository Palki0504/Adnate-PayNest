const { body } = require('express-validator');
const Account = require('../models/Account');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');
const AccountTypeRequest = require('../models/AccountTypeRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { MAX_ACCOUNTS_PER_USER } = require('./accountController');
const { sendAccountTypeApprovedEmail } = require('../utils/emailService');

const VALID_ACCOUNT_TYPES = ['savings', 'current', 'salary'];

const accountTypeRequestValidation = [
  body('accountType')
    .notEmpty().withMessage('Account type is required')
    .isIn(VALID_ACCOUNT_TYPES).withMessage('Invalid account type'),
  body('reason')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
];

const managerCommentValidation = [
  body('comment')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
];

const formatAccountType = (type) => {
  const labels = { savings: 'Savings Account', salary: 'Salary Account', current: 'Current Account' };
  return labels[type] || type;
};

const toUserAccountEntry = (account, approvedAt) => {
  const limits = account.getLimits();
  return {
    accountId: account._id,
    accountType: account.accountType,
    accountNumber: account.accountNumber,
    dailyTransferLimit: limits.dailyTransferLimit,
    monthlyTransferLimit: limits.monthlyTransferLimit,
    accountStatus: account.status,
    approvedAt: approvedAt || account.createdAt || new Date(),
  };
};

const syncUserAccountSlots = async (user, accounts, approvalDateByAccountId = new Map()) => {
  if (accounts.length > MAX_ACCOUNTS_PER_USER) {
    throw new Error(`Customer cannot have more than ${MAX_ACCOUNTS_PER_USER} accounts.`);
  }

  const existingApprovalDates = new Map(
    ['account1', 'account2', 'account3']
      .map((slot) => user[slot])
      .filter((entry) => entry?.accountId && entry?.approvedAt)
      .map((entry) => [String(entry.accountId), entry.approvedAt])
  );
  const sortedAccounts = [...accounts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const update = { $set: {}, $unset: {} };
  for (let index = 0; index < MAX_ACCOUNTS_PER_USER; index += 1) {
    const account = sortedAccounts[index];
    const slot = `account${index + 1}`;
    if (account) {
      const accountId = String(account._id);
      update.$set[slot] = toUserAccountEntry(
        account,
        approvalDateByAccountId.get(accountId) || existingApprovalDates.get(accountId)
      );
    } else {
      update.$unset[slot] = 1;
    }
  }
  if (Object.keys(update.$unset).length === 0) delete update.$unset;
  await User.updateOne({ _id: user._id }, update);
};

const getActiveAccounts = (userId) =>
  Account.find({ userId, status: { $ne: 'closed' } }).sort({ createdAt: 1 });

const notifyManagers = async (customerName, accountType) => {
  const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
  const notifications = managers.map((manager) => ({
    userId: manager._id,
    title: 'Account Type Request',
    message: `${customerName} requested a ${formatAccountType(accountType)}.`,
    type: 'info',
    priority: 'medium',
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications).catch(() => {});
  }
};

const serializeRequest = (request) => {
  const obj = request.toObject ? request.toObject() : request;
  return {
    ...obj,
    requestedAccountTypeLabel: formatAccountType(obj.requestedAccountType),
    currentAccountTypeLabels: (obj.currentAccountTypes || []).map(formatAccountType),
  };
};

const submitAccountTypeRequest = async (req, res, next) => {
  try {
    const accountType = req.body.accountType;
    const reason = req.body.reason?.trim() || '';

    const accounts = await getActiveAccounts(req.user._id);
    const currentAccountTypes = accounts.map((account) => account.accountType);

    if (accounts.length >= MAX_ACCOUNTS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Maximum of ${MAX_ACCOUNTS_PER_USER} account types allowed.`,
      });
    }

    if (currentAccountTypes.includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${formatAccountType(accountType)}.`,
      });
    }

    const existingPending = await AccountTypeRequest.findOne({
      userId: req.user._id,
      requestedAccountType: accountType,
      status: 'Pending',
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: `A ${formatAccountType(accountType)} request is already pending manager approval.`,
      });
    }

    const request = await AccountTypeRequest.create({
      userId: req.user._id,
      requestedAccountType: accountType,
      currentAccountTypes,
      reason,
    });

    await notifyManagers(req.user.name, accountType);

    res.status(201).json({
      success: true,
      message: `${formatAccountType(accountType)} request submitted for manager approval.`,
      request: serializeRequest(request),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This account type request is already pending manager approval.',
      });
    }
    next(error);
  }
};

const getMyAccountTypeRequests = async (req, res, next) => {
  try {
    const requests = await AccountTypeRequest.find({ userId: req.user._id })
      .populate('reviewedBy', 'name adminId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requests: requests.map(serializeRequest),
    });
  } catch (error) {
    next(error);
  }
};

const getAccountTypeRequests = async (req, res, next) => {
  try {
    const { status = 'Pending' } = req.query;
    const filter = status && status !== 'all' ? { status } : {};

    const requests = await AccountTypeRequest.find(filter)
      .populate('userId', 'name customerId email')
      .populate('reviewedBy', 'name adminId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requests: requests.map(serializeRequest),
    });
  } catch (error) {
    next(error);
  }
};

const approveAccountTypeRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const comment = req.body.comment?.trim() || '';

    const request = await AccountTypeRequest.findById(requestId).populate('userId', 'name email customerId classification account1 account2 account3 accounts');
    if (!request) return res.status(404).json({ success: false, message: 'Account type request not found.' });
    if (request.status !== 'Pending') return res.status(400).json({ success: false, message: 'Request already processed.' });

    const accounts = await getActiveAccounts(request.userId._id);
    if (accounts.length >= MAX_ACCOUNTS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Customer already has the maximum of ${MAX_ACCOUNTS_PER_USER} account types.`,
      });
    }

    if (accounts.some((account) => account.accountType === request.requestedAccountType)) {
      return res.status(400).json({
        success: false,
        message: `Customer already has a ${formatAccountType(request.requestedAccountType)}.`,
      });
    }

    const openingBalance = FIXED_ACCOUNT_BALANCES[request.requestedAccountType];
    if (openingBalance === undefined) {
      return res.status(400).json({ success: false, message: 'Invalid account type selected.' });
    }

    const approvedAt = new Date();
    let account;
    try {
      account = await Account.create({
        userId: request.userId._id,
        customerId: request.userId.customerId,
        accountType: request.requestedAccountType,
        balance: openingBalance,
        classification: request.userId.classification || 'PENDING',
      });

      const allAccounts = [...accounts, account];
      await syncUserAccountSlots(
        request.userId,
        allAccounts,
        new Map([[String(account._id), approvedAt]])
      );

      request.status = 'Approved';
      request.reviewedBy = req.user._id;
      request.reviewedAt = approvedAt;
      request.managerComment = comment;
      await request.save();
    } catch (approvalError) {
      if (account?._id) await Account.deleteOne({ _id: account._id }).catch(() => {});
      await syncUserAccountSlots(request.userId, accounts).catch(() => {});
      throw approvalError;
    }

    const updatedCustomer = await User.findById(request.userId._id).select('account1 account2 account3 accounts');

    await Notification.create({
      userId: request.userId._id,
      title: 'Account Type Request Approved',
      message: `Your ${formatAccountType(request.requestedAccountType)} request has been approved.${comment ? ` Manager comment: ${comment}` : ''}`,
      type: 'approval',
      priority: 'high',
    }).catch((error) => console.warn(`Account type approval notification failed for request ${request._id}:`, error.message));

    const sendApprovalEmail = async () => {
      try {
      const previousAccountType = request.currentAccountTypes.length
        ? request.currentAccountTypes.map(formatAccountType).join(', ')
        : 'No active account type';
      await sendAccountTypeApprovedEmail(request.userId.email, {
        previousAccountType,
        newAccountType: formatAccountType(request.requestedAccountType),
        approvalDate: request.reviewedAt,
      });
      } catch (error) {
        console.error(`Account type approval email failed for request ${request._id}:`, error.message);
      }
    };
    setImmediate(sendApprovalEmail);

    res.status(200).json({
      success: true,
      message: `${formatAccountType(request.requestedAccountType)} added to customer profile.`,
      request: serializeRequest(request),
      account: {
        ...account.toObject(),
        accountTypeLabel: formatAccountType(account.accountType),
      },
      customerAccounts: updatedCustomer?.accounts || [updatedCustomer?.account1, updatedCustomer?.account2, updatedCustomer?.account3].filter(Boolean),
      emailError: null,
    });
  } catch (error) {
    next(error);
  }
};

const rejectAccountTypeRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const comment = req.body.comment?.trim() || '';

    if (!comment) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const request = await AccountTypeRequest.findById(requestId).populate('userId', 'name email');
    if (!request) return res.status(404).json({ success: false, message: 'Account type request not found.' });
    if (request.status !== 'Pending') return res.status(400).json({ success: false, message: 'Request already processed.' });

    request.status = 'Rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.managerComment = comment;
    await request.save();

    await Notification.create({
      userId: request.userId._id,
      title: 'Account Type Request Rejected',
      message: `Your ${formatAccountType(request.requestedAccountType)} request was rejected. Reason: ${comment}`,
      type: 'rejection',
      priority: 'high',
    });

    res.status(200).json({
      success: true,
      message: 'Account type request rejected.',
      request: serializeRequest(request),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  accountTypeRequestValidation,
  managerCommentValidation,
  submitAccountTypeRequest,
  getMyAccountTypeRequests,
  getAccountTypeRequests,
  approveAccountTypeRequest,
  rejectAccountTypeRequest,
};
