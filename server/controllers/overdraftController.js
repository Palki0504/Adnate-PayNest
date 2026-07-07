const Account = require('../models/Account');
const OverdraftLog = require('../models/OverdraftLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { notifySuccessfulOverdraftUsage } = require('../utils/overdraftEmailNotifier');

const MAX_MONTHLY_OD_USES = 3;

const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const getCurrentMonthEnd = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
};

const getMonthRange = (monthValue) => {
  const match = String(monthValue || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 1),
    dueDate: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
    isCurrent: year === now.getFullYear() && monthIndex === now.getMonth(),
  };
};

const accountPayload = (account) => ({
  _id: account._id,
  accountNumber: account.accountNumber,
  accountType: account.accountType,
  classification: account.classification,
  overdraftLimit: account.overdraftLimit || 0,
  overdraftUsed: account.overdraftUsed || 0,
  outstandingAmount: account.overdraftUsed || 0,
  penaltyAmount: account.overdraftPenalty || 0,
  totalAmountDue: (account.overdraftUsed || 0) + (account.overdraftPenalty || 0),
  availableOD: Math.max(0, (account.overdraftLimit || 0) - (account.overdraftUsed || 0)),
  availableOverdraft: Math.max(0, (account.overdraftLimit || 0) - (account.overdraftUsed || 0)),
  monthlyUsageCount: account.monthlyOverdraftCount || 0,
  remainingUsage: Math.max(0, MAX_MONTHLY_OD_USES - (account.monthlyOverdraftCount || 0)),
  overdraftStatus: (account.monthlyOverdraftCount || 0) >= MAX_MONTHLY_OD_USES ? 'DEACTIVATED' : 'ACTIVE',
  balance: account.balance || 0,
  overdraftDueDate: account.overdraftDueDate || getCurrentMonthEnd(),
  lastPenaltyCalculatedAt: account.lastPenaltyCalculatedAt,
  dailyPenaltyAmount: account.getOverdraftDailyPenalty ? account.getOverdraftDailyPenalty() : 0,
  interestRate: account.interestRate || 0,
  lastOverdraftDeactivatedAt: account.lastOverdraftDeactivatedAt,
});

const refreshAccountForOverdraft = async (account) => {
  await account.resetMonthlyCounters();
  return account;
};

const disabledReactivation = (req, res) => res.status(410).json({
  success: false,
  message: 'Overdraft reactivation requests have been removed. Repay the full outstanding amount, including penalties, to reactivate automatically.',
});

const disabledFixedLimit = (req, res) => res.status(400).json({
  success: false,
  message: 'Overdraft limits are fixed by customer classification and cannot be edited manually.',
});

const overdraftActivityQuery = { status: 'active' };

const hasLinkedCustomer = (account) => account.userId && account.userId.role === 'customer';

const getSummary = async (req, res, next) => {
  try {
    const accounts = (await Account.find(overdraftActivityQuery).populate('userId', 'role')).filter(hasLinkedCustomer);
    for (const account of accounts) await refreshAccountForOverdraft(account);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const customerIds = accounts.map((account) => account.userId._id);
    const monthlyODRequests = customerIds.length
      ? await OverdraftLog.countDocuments({ userId: { $in: customerIds }, status: 'active', createdAt: { $gte: firstOfMonth } })
      : 0;

    res.status(200).json({
      success: true,
      totalODAccounts: accounts.length,
      totalApprovedODLimit: accounts.reduce((sum, acc) => sum + (acc.overdraftLimit || 0), 0),
      totalODUtilized: accounts.reduce((sum, acc) => sum + (acc.overdraftUsed || 0), 0),
      totalPenaltyAmount: accounts.reduce((sum, acc) => sum + (acc.overdraftPenalty || 0), 0),
      totalOutstandingAmount: accounts.reduce((sum, acc) => sum + (acc.overdraftUsed || 0), 0),
      totalAmountDue: accounts.reduce((sum, acc) => sum + (acc.overdraftUsed || 0) + (acc.overdraftPenalty || 0), 0),
      monthlyODRequests,
    });
  } catch (err) {
    next(err);
  }
};

const getMonthlyUsageTrend = async (req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const activeAccounts = (await Account.find(overdraftActivityQuery).populate('userId', 'role')).filter(hasLinkedCustomer);
    const customerIds = activeAccounts.map((account) => account.userId._id);
    if (customerIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const data = await OverdraftLog.aggregate([
      { $match: { userId: { $in: customerIds }, status: 'active', createdAt: { $gte: start } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, totalOD: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getAccounts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const regex = search ? new RegExp(search, 'i') : null;
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    const allAccounts = (await Account.find(overdraftActivityQuery)
      .populate('userId', 'name email customerId role')
      .sort({ overdraftUsed: -1 })
    ).filter(hasLinkedCustomer);

    for (const account of allAccounts) await refreshAccountForOverdraft(account);

    const filtered = regex
      ? allAccounts.filter((account) => (
          regex.test(account.accountNumber || '') ||
          regex.test(account.customerId || '') ||
          regex.test(account.userId?.customerId || '') ||
          regex.test(account.userId?.name || '') ||
          regex.test(account.classification || '')
        ))
      : allAccounts;

    const accounts = filtered
      .slice((pageNum - 1) * pageSize, pageNum * pageSize)
      .map((account) => ({
        ...accountPayload(account),
        customerId: account.userId?.customerId || account.customerId,
        customerName: account.userId?.name,
        customerEmail: account.userId?.email,
      }));

    res.status(200).json({ success: true, accounts, pagination: { total: filtered.length, page: pageNum, limit: pageSize } });
  } catch (err) {
    next(err);
  }
};

const getCustomerOverdraftDetails = async (req, res, next) => {
  try {
    const monthRange = getMonthRange(req.query.month);
    const accounts = await Account.find({ userId: req.user._id, status: 'active' }).sort({ createdAt: 1 });
    if (accounts.length === 0) return res.status(404).json({ success: false, message: 'No active accounts found' });
    for (const account of accounts) await refreshAccountForOverdraft(account);
    let accountRecords;

    if (monthRange.isCurrent) {
      accountRecords = accounts.map(accountPayload);
    } else {
      const logs = await OverdraftLog.find({
        userId: req.user._id,
        accountId: { $in: accounts.map((account) => account._id) },
        createdAt: { $gte: monthRange.start, $lt: monthRange.end },
      }).sort({ createdAt: 1 });
      const logsByAccount = new Map();
      for (const log of logs) {
        const key = String(log.accountId);
        if (!logsByAccount.has(key)) logsByAccount.set(key, []);
        logsByAccount.get(key).push(log);
      }

      accountRecords = accounts
        .filter((account) => logsByAccount.has(String(account._id)))
        .map((account) => {
          const accountLogs = logsByAccount.get(String(account._id));
          const usageLogs = accountLogs.filter((log) => log.status === 'active');
          const lastLog = accountLogs[accountLogs.length - 1];
          const monthlyUsageCount = lastLog.monthlyUsageAfter || usageLogs.length;
          const overdraftUsed = usageLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
          const outstandingAmount = Math.max(0, lastLog.odUsedAfter || 0);
          const overdraftLimit = lastLog.odLimitAtTime || account.overdraftLimit || 0;
          const penaltyAmount = lastLog.penaltyAmountAfter || 0;
          const totalAmountDue = lastLog.totalDueAfter || outstandingAmount + penaltyAmount;

          return {
            ...accountPayload(account),
            overdraftLimit,
            overdraftUsed,
            outstandingAmount,
            availableOD: Math.max(0, overdraftLimit - outstandingAmount),
            availableOverdraft: Math.max(0, overdraftLimit - outstandingAmount),
            monthlyUsageCount,
            remainingUsage: Math.max(0, MAX_MONTHLY_OD_USES - monthlyUsageCount),
            overdraftStatus: monthlyUsageCount >= MAX_MONTHLY_OD_USES ? 'DEACTIVATED' : 'ACTIVE',
            penaltyAmount,
            totalAmountDue,
            dailyPenaltyAmount: lastLog.penaltyPerDayAtTime || account.getOverdraftDailyPenalty(),
            overdraftDueDate: monthRange.dueDate,
          };
        });
    }
    res.status(200).json({
      success: true,
      selectedMonth: monthRange.key,
      accounts: accountRecords,
      liveAccounts: accounts.map(accountPayload),
      summary: {
        totalOverdraftLimit: accountRecords.reduce((sum, account) => sum + account.overdraftLimit, 0),
        totalOverdraftUsed: accountRecords.reduce((sum, account) => sum + account.overdraftUsed, 0),
        totalAvailableOverdraft: accountRecords.reduce((sum, account) => sum + account.availableOD, 0),
        totalPenaltyAmount: accountRecords.reduce((sum, account) => sum + account.penaltyAmount, 0),
        totalAmountDue: accountRecords.reduce((sum, account) => sum + account.totalAmountDue, 0),
        activeAccounts: accountRecords.filter((account) => account.overdraftStatus === 'ACTIVE').length,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getCustomerOverdraftHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      OverdraftLog.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('transactionId', 'reference description'),
      OverdraftLog.countDocuments({ userId: req.user._id }),
    ]);
    res.status(200).json({
      success: true,
      logs,
      pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    });
  } catch (err) {
    next(err);
  }
};

const getCustomerOverdraftChart = async (req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const data = await OverdraftLog.aggregate([
      { $match: { userId: req.user._id, status: 'active', createdAt: { $gte: start } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, totalOD: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const resolveReceiver = async (req, res, next) => {
  try {
    const customerId = String(req.query.customerId || '').trim().toUpperCase();
    const accountNumber = String(req.query.accountNumber || '').trim().toUpperCase();
    const accountType = String(req.query.accountType || '').trim().toLowerCase();

    if (!customerId && !accountNumber) {
      return res.status(400).json({ success: false, message: 'Enter a receiver customer ID or account number.' });
    }
    if (accountType && !['savings', 'current', 'salary'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'Invalid receiver account type.' });
    }

    let receiverUser;
    let selectedAccount;

    if (accountNumber) {
      selectedAccount = await Account.findOne({ accountNumber, status: 'active' });
      if (!selectedAccount) {
        return res.status(404).json({ success: false, message: 'Receiver account was not found or is inactive.' });
      }
      receiverUser = await User.findOne({ _id: selectedAccount.userId, role: 'customer', isActive: true });
      if (!receiverUser) {
        return res.status(404).json({ success: false, message: 'Receiver customer was not found or is inactive.' });
      }
      if (customerId && receiverUser.customerId !== customerId) {
        return res.status(400).json({ success: false, message: 'Receiver customer ID does not match the account number.' });
      }
      if (accountType && selectedAccount.accountType !== accountType) {
        return res.status(400).json({ success: false, message: 'Receiver account type does not match the account number.' });
      }
    } else {
      receiverUser = await User.findOne({ customerId, role: 'customer', isActive: true });
      if (!receiverUser) {
        return res.status(404).json({ success: false, message: 'Receiver customer ID was not found or is inactive.' });
      }
    }

    if (String(receiverUser._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot transfer overdraft funds to your own account.' });
    }

    const accountQuery = { userId: receiverUser._id, status: 'active' };
    if (accountType) accountQuery.accountType = accountType;
    const accounts = await Account.find(accountQuery).sort({ createdAt: 1 });
    if (accounts.length === 0) {
      return res.status(404).json({ success: false, message: 'No active receiver account matches these details.' });
    }
    if (!selectedAccount && accounts.length === 1) selectedAccount = accounts[0];

    res.status(200).json({
      success: true,
      verified: Boolean(selectedAccount),
      receiver: {
        name: receiverUser.name,
        customerId: receiverUser.customerId,
        accounts: accounts.map((account) => ({
          _id: account._id,
          accountType: account.accountType,
          accountNumber: account.accountNumber,
        })),
        selectedAccount: selectedAccount ? {
          _id: selectedAccount._id,
          accountType: selectedAccount.accountType,
          accountNumber: selectedAccount.accountNumber,
        } : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

const repayOverdraft = async (req, res, next) => {
  try {
    const { accountId, amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Repayment amount must be greater than 0' });

    const account = await Account.findOne({ _id: accountId, userId: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    await refreshAccountForOverdraft(account);

    const totalDue = (account.overdraftUsed || 0) + (account.overdraftPenalty || 0);
    if (totalDue <= 0) return res.status(400).json({ success: false, message: 'No outstanding overdraft to repay' });

    const repayAmount = Math.min(Number(amount), totalDue);
    if (account.balance < repayAmount) {
      return res.status(400).json({ success: false, message: `Insufficient balance to repay. Available: ${formatINR(account.balance)}, Required: ${formatINR(repayAmount)}` });
    }

    account.balance -= repayAmount;
    let remainingPayment = repayAmount;

    const penaltyPaid = Math.min(account.overdraftPenalty || 0, remainingPayment);
    account.overdraftPenalty = Math.max(0, (account.overdraftPenalty || 0) - penaltyPaid);
    remainingPayment -= penaltyPaid;

    const overdraftPaid = Math.min(account.overdraftUsed || 0, remainingPayment);
    account.overdraftUsed = Math.max(0, (account.overdraftUsed || 0) - overdraftPaid);

    if ((account.overdraftUsed || 0) <= 0 && (account.overdraftPenalty || 0) <= 0) {
      account.overdraftUsed = 0;
      account.overdraftPenalty = 0;
      account.overdraftDueDate = undefined;
      account.lastPenaltyCalculatedAt = undefined;
      account.overdraftStatus = (account.monthlyOverdraftCount || 0) >= MAX_MONTHLY_OD_USES ? 'DEACTIVATED' : 'ACTIVE';
      if (account.overdraftStatus === 'ACTIVE') account.lastOverdraftDeactivatedAt = undefined;
    }

    await account.save();

    await OverdraftLog.create({
      userId: req.user._id,
      accountId: account._id,
      amount: repayAmount,
      odLimitAtTime: account.overdraftLimit,
      penaltyPerDayAtTime: account.getOverdraftDailyPenalty(),
      odUsedAfter: account.overdraftUsed,
      monthlyUsageAfter: account.monthlyOverdraftCount || 0,
      penaltyAmountAfter: account.overdraftPenalty || 0,
      totalDueAfter: (account.overdraftUsed || 0) + (account.overdraftPenalty || 0),
      overdraftStatusAfter: account.overdraftStatus,
      description: `Overdraft repayment of ${formatINR(repayAmount)}`,
      status: 'repaid',
    });

    res.status(200).json({ success: true, message: `Overdraft repayment of ${formatINR(repayAmount)} successful`, account: accountPayload(account) });
  } catch (err) {
    next(err);
  }
};

const useOverdraft = async (req, res, next) => {
  try {
    const { accountId, amount } = req.body;
    const requestedAmount = Number(amount);
    if (!requestedAmount || requestedAmount <= 0) return res.status(400).json({ success: false, message: 'Requested amount must be greater than 0' });

    const account = await Account.findOne({ _id: accountId, userId: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    await refreshAccountForOverdraft(account);

    if ((account.monthlyOverdraftCount || 0) >= MAX_MONTHLY_OD_USES) {
      account.overdraftStatus = 'DEACTIVATED';
      account.lastOverdraftDeactivatedAt = new Date();
      await account.save();
      return res.status(400).json({ success: false, message: 'Monthly overdraft usage limit reached. Overdraft is deactivated for this month.' });
    }

    if (account.overdraftStatus !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Overdraft facility is deactivated. Repay the full outstanding amount to reactivate automatically.' });
    }

    const availableOD = Math.max(0, (account.overdraftLimit || 0) - (account.overdraftUsed || 0));
    if (requestedAmount > availableOD) {
      return res.status(400).json({ success: false, message: `Requested amount exceeds available limit. Available: ${formatINR(availableOD)}` });
    }

    account.balance += requestedAmount;
    const hadNoOutstandingOD = (account.overdraftUsed || 0) <= 0;
    account.overdraftUsed = (account.overdraftUsed || 0) + requestedAmount;
    account.monthlyOverdraftCount = (account.monthlyOverdraftCount || 0) + 1;

    if (hadNoOutstandingOD || !account.overdraftDueDate) {
      const now = new Date();
      account.overdraftDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      account.lastPenaltyCalculatedAt = undefined;
    }

    if (account.monthlyOverdraftCount >= MAX_MONTHLY_OD_USES) {
      account.overdraftStatus = 'DEACTIVATED';
      account.lastOverdraftDeactivatedAt = new Date();
    }

    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: null,
      toAccount: account._id,
      toAccountNumber: account.accountNumber,
      amount: requestedAmount,
      type: 'overdraft',
      category: 'other',
      status: 'completed',
      description: `Overdraft withdrawal of ${formatINR(requestedAmount)}`,
      balance_after: account.balance,
      metadata: { usedOverdraft: true },
    });

    await OverdraftLog.create({
      userId: req.user._id,
      accountId: account._id,
      transactionId: transaction._id,
      amount: requestedAmount,
      odLimitAtTime: account.overdraftLimit,
      penaltyPerDayAtTime: account.getOverdraftDailyPenalty(),
      odUsedAfter: account.overdraftUsed,
      monthlyUsageAfter: account.monthlyOverdraftCount || 0,
      penaltyAmountAfter: account.overdraftPenalty || 0,
      totalDueAfter: (account.overdraftUsed || 0) + (account.overdraftPenalty || 0),
      overdraftStatusAfter: account.overdraftStatus,
      description: `Overdraft withdrawal of ${formatINR(requestedAmount)}`,
      status: 'active',
    });

    await account.save();
    setImmediate(() => notifySuccessfulOverdraftUsage({
      user: req.user,
      account,
      amountUsed: requestedAmount,
      transactionId: transaction.reference || transaction._id,
    }).catch(() => {}));

    res.status(200).json({ success: true, message: `Successfully used ${formatINR(requestedAmount)} from overdraft`, account: accountPayload(account) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSummary,
  getMonthlyUsageTrend,
  getAccounts,
  getCustomerOverdraftDetails,
  getCustomerOverdraftHistory,
  getCustomerOverdraftChart,
  resolveReceiver,
  repayOverdraft,
  useOverdraft,
  createReactivationRequest: disabledReactivation,
  listReactivationRequests: disabledReactivation,
  approveReactivation: disabledReactivation,
  rejectReactivation: disabledReactivation,
  editOverdraftLimit: disabledFixedLimit,
  submitLimitIncreaseRequest: disabledFixedLimit,
  getMyLimitRequests: disabledFixedLimit,
  listLimitIncreaseRequests: disabledFixedLimit,
  approveLimitIncrease: disabledFixedLimit,
  rejectLimitIncrease: disabledFixedLimit,
};
