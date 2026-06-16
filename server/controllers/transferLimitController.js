const TransferLimitRequest = require('../models/TransferLimitRequest');
const Account = require('../models/Account');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendTransferLimitApprovedEmail } = require('../utils/emailService');

const syncUserAccountLimits = async (userId, account) => {
  const user = await User.findById(userId).select('account1 account2 account3');
  if (!user) return;

  const slot = ['account1', 'account2', 'account3'].find((name) =>
    String(user[name]?.accountId || '') === String(account._id));
  if (!slot) return;

  const limits = account.getLimits();
  await User.updateOne({ _id: userId }, {
    $set: {
      [`${slot}.accountType`]: account.accountType,
      [`${slot}.accountNumber`]: account.accountNumber,
      [`${slot}.dailyTransferLimit`]: limits.dailyTransferLimit,
      [`${slot}.monthlyTransferLimit`]: limits.monthlyTransferLimit,
      [`${slot}.accountStatus`]: account.status,
    },
  });
};

// ─── Customer: Submit a transfer limit increase request ──────────────────────
const submitLimitRequest = async (req, res, next) => {
  try {
    const { accountId, accountType, limitType, requestedLimit, requestedDailyLimit, requestedMonthlyLimit, reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for increase is required.' });
    }

    if (!accountId || !['savings', 'current', 'salary'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'A valid account and account type are required.' });
    }

    if (!['daily', 'monthly'].includes(limitType)) {
      return res.status(400).json({ success: false, message: 'Limit type must be daily or monthly.' });
    }

    const accountQuery = { userId: req.user._id, status: 'active' };
    accountQuery._id = accountId;

    const account = await Account.findOne(accountQuery).sort({ createdAt: 1 });
    if (!account) {
      return res.status(404).json({ success: false, message: 'No active account found for this request.' });
    }

    if (accountType && account.accountType !== accountType) {
      return res.status(400).json({ success: false, message: 'Selected account type does not match the account.' });
    }

    const limits = account.getLimits();

    const normalizedLimitType = limitType === 'monthly' ? 'monthly' : limitType === 'daily' ? 'daily' : null;

    if (normalizedLimitType) {
      const currentLimit = normalizedLimitType === 'daily' ? limits.dailyTransferLimit : limits.monthlyTransferLimit;
      const nextLimit = Number(requestedLimit);

      if (!nextLimit || Number.isNaN(nextLimit) || nextLimit <= 0) {
        return res.status(400).json({ success: false, message: 'Requested limit must be a valid positive amount.' });
      }

      if (nextLimit <= currentLimit) {
        return res.status(400).json({
          success: false,
          message: 'Requested limit must be greater than the current limit.',
        });
      }

      const requestPayload = {
        userId: req.user._id,
        accountId: account._id,
        accountType: account.accountType,
        limitType: normalizedLimitType,
        currentLimit,
        requestedLimit: nextLimit,
        currentDailyLimit: limits.dailyTransferLimit,
        requestedDailyLimit: normalizedLimitType === 'daily' ? nextLimit : limits.dailyTransferLimit,
        currentMonthlyLimit: limits.monthlyTransferLimit,
        requestedMonthlyLimit: normalizedLimitType === 'monthly' ? nextLimit : limits.monthlyTransferLimit,
        reason: reason.trim(),
        status: 'pending',
      };

      const newRequest = await TransferLimitRequest.create(requestPayload);

      const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
      const managerNotifications = managers.map((manager) => ({
        userId: manager._id,
        title: '🆕 Transfer Limit Increase Request',
        message: `Customer ${req.user.name} has requested a ${normalizedLimitType} transfer limit increase for their ${account.accountType} account.`,
        type: 'info',
        priority: 'medium',
      }));
      if (managerNotifications.length > 0) {
        await Notification.insertMany(managerNotifications).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        message: 'Transfer limit increase request submitted successfully.',
        request: newRequest,
      });
    }

    if (!accountId || !requestedDailyLimit || !requestedMonthlyLimit) {
      return res.status(400).json({ success: false, message: 'Limit type and requested limit are required.' });
    }

    if (Number(requestedDailyLimit) <= limits.dailyTransferLimit && Number(requestedMonthlyLimit) <= limits.monthlyTransferLimit) {
      return res.status(400).json({
        success: false,
        message: 'Requested limits must be greater than current daily or monthly limits.',
      });
    }

    const newRequest = await TransferLimitRequest.create({
      userId: req.user._id,
      accountId: account._id,
      accountType: account.accountType,
      currentDailyLimit: limits.dailyTransferLimit,
      requestedDailyLimit: Number(requestedDailyLimit),
      currentMonthlyLimit: limits.monthlyTransferLimit,
      requestedMonthlyLimit: Number(requestedMonthlyLimit),
      reason: reason.trim(),
      status: 'pending',
    });

    // Notify all active managers
    const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
    const managerNotifications = managers.map((manager) => ({
      userId: manager._id,
      title: '🆕 Transfer Limit Increase Request',
      message: `Customer ${req.user.name} has requested a transfer limit increase.`,
      type: 'info',
      priority: 'medium',
    }));
    if (managerNotifications.length > 0) {
      await Notification.insertMany(managerNotifications).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Transfer limit increase request submitted successfully.',
      request: newRequest,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Customer: Get my transfer limit increase requests ───────────────────────
const getMyLimitRequests = async (req, res, next) => {
  try {
    const requests = await TransferLimitRequest.find({ userId: req.user._id })
      .populate('accountId', 'accountNumber accountType')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

// ─── Manager: List transfer limit requests ───────────────────────────────────
const getPendingLimitRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const requests = await TransferLimitRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name customerId email')
      .populate('accountId', 'accountNumber accountType dailyTransferLimit monthlyTransferLimit')
      .populate('reviewedBy', 'name adminId');

    res.status(200).json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

// ─── Manager: Approve transfer limit request ─────────────────────────────────
const approveLimitRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { comment = '' } = req.body;

    const reqDoc = await TransferLimitRequest.findById(requestId).populate('userId', 'name email');
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found' });
    if (reqDoc.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    const account = reqDoc.accountId ? await Account.findById(reqDoc.accountId) : null;
    if (reqDoc.accountId && !account) return res.status(404).json({ success: false, message: 'Account not found' });

    if (reqDoc.limitType === 'daily' || reqDoc.limitType === 'monthly') {
      const update = reqDoc.limitType === 'daily'
        ? { dailyTransferLimit: reqDoc.requestedLimit }
        : { monthlyTransferLimit: reqDoc.requestedLimit };

      Object.assign(account, update);
      await account.save();
    } else {
      // Legacy requests updated both limits together.
      account.dailyTransferLimit = reqDoc.requestedDailyLimit;
      account.monthlyTransferLimit = reqDoc.requestedMonthlyLimit;
      await account.save();
    }

    await syncUserAccountLimits(reqDoc.userId._id, account);

    // Update request status
    reqDoc.status = 'approved';
    reqDoc.reviewedBy = req.user._id;
    reqDoc.reviewedAt = new Date();
    reqDoc.managerComment = comment;
    await reqDoc.save();

    const requestedAccountType = reqDoc.accountType || account?.accountType || 'selected';
    const approvedMessage = reqDoc.limitType
      ? `Your ${requestedAccountType} account ${reqDoc.limitType} transfer limit increase request has been approved! New limit: ₹${reqDoc.requestedLimit.toLocaleString('en-IN')}.${comment ? ` Manager comment: ${comment}` : ''}`
      : `Your transfer limit increase request has been approved! Daily: ₹${reqDoc.requestedDailyLimit.toLocaleString('en-IN')}, Monthly: ₹${reqDoc.requestedMonthlyLimit.toLocaleString('en-IN')}.${comment ? ` Manager comment: ${comment}` : ''}`;

    // Notify customer
    await Notification.create({
      userId: reqDoc.userId._id,
      title: '✅ Transfer Limit Increase Approved',
      message: approvedMessage,
      type: 'approval',
      priority: 'high',
    }).catch((error) => console.warn(`Transfer limit approval notification failed for request ${reqDoc._id}:`, error.message));

    const sendApprovalEmail = async () => {
      try {
      if (reqDoc.limitType) {
        await sendTransferLimitApprovedEmail(reqDoc.userId.email, {
          limitType: reqDoc.limitType,
          accountType: requestedAccountType,
          previousLimit: reqDoc.currentLimit,
          approvedLimit: reqDoc.requestedLimit,
          approvalDate: reqDoc.reviewedAt,
        });
      } else {
        const legacyEmails = [];
        if (Number(reqDoc.requestedDailyLimit) !== Number(reqDoc.currentDailyLimit)) {
          legacyEmails.push(sendTransferLimitApprovedEmail(reqDoc.userId.email, {
            limitType: 'daily',
            accountType: requestedAccountType,
            previousLimit: reqDoc.currentDailyLimit,
            approvedLimit: reqDoc.requestedDailyLimit,
            approvalDate: reqDoc.reviewedAt,
          }));
        }
        if (Number(reqDoc.requestedMonthlyLimit) !== Number(reqDoc.currentMonthlyLimit)) {
          legacyEmails.push(sendTransferLimitApprovedEmail(reqDoc.userId.email, {
            limitType: 'monthly',
            accountType: requestedAccountType,
            previousLimit: reqDoc.currentMonthlyLimit,
            approvedLimit: reqDoc.requestedMonthlyLimit,
            approvalDate: reqDoc.reviewedAt,
          }));
        }
        const results = await Promise.allSettled(legacyEmails);
        const failed = results.find((result) => result.status === 'rejected');
        if (failed) throw failed.reason;
      }
      } catch (error) {
        console.error(`Transfer limit approval email failed for request ${reqDoc._id}:`, error.message);
      }
    };
    setImmediate(sendApprovalEmail);

    res.status(200).json({ success: true, request: reqDoc, message: 'Transfer limits updated successfully.', emailError: null });
  } catch (err) {
    next(err);
  }
};

// ─── Manager: Reject transfer limit request ─────────────────────────────────
const rejectLimitRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { comment = '' } = req.body;

    if (!comment.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason (comment) is required.' });
    }

    const reqDoc = await TransferLimitRequest.findById(requestId).populate('userId', 'name email');
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found' });
    if (reqDoc.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    reqDoc.status = 'rejected';
    reqDoc.reviewedBy = req.user._id;
    reqDoc.reviewedAt = new Date();
    reqDoc.managerComment = comment;
    await reqDoc.save();

    // Notify customer
    await Notification.create({
      userId: reqDoc.userId._id,
      title: '❌ Transfer Limit Increase Rejected',
      message: `Your transfer limit increase request has been rejected. Reason: ${comment}`,
      type: 'rejection',
      priority: 'high',
    });

    res.status(200).json({ success: true, request: reqDoc, message: 'Limit request rejected.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitLimitRequest,
  getMyLimitRequests,
  getPendingLimitRequests,
  approveLimitRequest,
  rejectLimitRequest,
};
