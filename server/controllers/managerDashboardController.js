const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const ApprovalRequest = require('../models/ApprovalRequest');
const AccountTypeRequest = require('../models/AccountTypeRequest');
const TransferLimitRequest = require('../models/TransferLimitRequest');
const Notification = require('../models/Notification');
const Classification = require('../models/Classification');

const monthLabel = (date) => date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

const getLastTwelveMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: monthLabel(date),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  });
};

const getManagerDashboard = async (req, res, next) => {
  try {
    const months = getLastTwelveMonths();
    const trendStart = new Date(months[0].year, months[0].month - 1, 1);

    const [
      totalCustomers,
      totalActiveAccounts,
      activeOverdraftAccounts,
      totalTransactions,
      transferApprovalPending,
      transferLimitPending,
      accountTypePending,
      accountTypeCounts,
      monthlyTransactions,
      customerClassifications,
      classificationDefinitions,
      latestNotifications,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', approvalStatus: 'approved' }),
      Account.countDocuments({ status: 'active' }),
      Account.countDocuments({
        status: 'active',
        overdraftStatus: 'ACTIVE',
        overdraftLimit: { $gt: 0 },
      }),
      Transaction.countDocuments({}),
      ApprovalRequest.countDocuments({ status: 'pending' }),
      TransferLimitRequest.countDocuments({ status: 'pending' }),
      AccountTypeRequest.countDocuments({ status: 'Pending' }),
      Account.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$accountType', count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: 'customer', approvalStatus: 'approved' } },
        { $group: { _id: { $ifNull: ['$classification', 'PENDING'] }, count: { $sum: 1 } } },
      ]),
      Classification.find({}).select('name title isActive').lean(),
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const pendingApprovals = transferApprovalPending + transferLimitPending + accountTypePending;

    const accountTypes = accountTypeCounts.reduce(
      (acc, item) => ({ ...acc, [item._id || 'unknown']: item.count }),
      { savings: 0, current: 0, salary: 0 }
    );

    const trendMap = monthlyTransactions.reduce((acc, item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      acc[key] = { count: item.count || 0, amount: item.amount || 0 };
      return acc;
    }, {});

    const monthlyTrend = months.map((item) => ({
      label: item.label,
      count: trendMap[item.key]?.count || 0,
      amount: trendMap[item.key]?.amount || 0,
    }));

    const classificationCounts = customerClassifications.reduce((acc, item) => {
      const name = (item._id || 'PENDING').toUpperCase();
      acc[name] = item.count || 0;
      return acc;
    }, {});

    const definitionNames = classificationDefinitions
      .filter((item) => item.isActive !== false)
      .map((item) => (item.name || item.title || '').toUpperCase())
      .filter(Boolean);

    const allClassificationNames = Array.from(
      new Set([...definitionNames, ...Object.keys(classificationCounts)])
    ).sort((a, b) => {
      const order = ['GOLD', 'PLATINUM', 'SILVER', 'PENDING'];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }
      return a.localeCompare(b);
    });

    const classificationTotal = Object.values(classificationCounts).reduce((sum, count) => sum + count, 0);
    const classificationDistribution = allClassificationNames.map((name) => {
      const count = classificationCounts[name] || 0;
      return {
        name,
        count,
        percentage: classificationTotal ? Number(((count / classificationTotal) * 100).toFixed(1)) : 0,
      };
    });

    const notifications = latestNotifications
      .slice(0, 5)
      .map((item) => ({
      _id: item._id,
      title: item.title,
      message: item.message,
      priority: item.priority || 'low',
      type: item.type || 'info',
      isRead: item.isRead,
      createdAt: item.createdAt,
      senderName: item.senderName,
      senderRole: item.senderRole,
      link: item.link,
    }));

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      data: {
        kpis: {
          totalCustomers,
          totalActiveAccounts,
          pendingApprovals,
          activeOverdraftAccounts,
          totalTransactions,
        },
        pendingBreakdown: {
          transferApprovals: transferApprovalPending,
          transferLimitRequests: transferLimitPending,
          accountTypeRequests: accountTypePending,
        },
        monthlyTransactions: monthlyTrend,
        classificationDistribution,
        quickStatistics: {
          totalSavingsAccounts: accountTypes.savings || 0,
          totalCurrentAccounts: accountTypes.current || 0,
          totalSalaryAccounts: accountTypes.salary || 0,
        },
        notifications,
        hasMoreNotifications: latestNotifications.length > 5,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getManagerDashboard,
};
