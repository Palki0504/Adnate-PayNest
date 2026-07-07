const {
  sendOverdraftUsedEmail,
  sendAllOverdraftChancesUsedEmail,
} = require('./emailService');
const OverdraftLog = require('../models/OverdraftLog');

const formatDateTime = (date = new Date()) => date.toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

const notifySuccessfulOverdraftUsage = async ({
  user,
  account,
  amountUsed,
  transactionId,
}) => {
  if (!user?.email || !account || Number(amountUsed || 0) <= 0) return;

  const monthlyUsageCount = Number(account.monthlyOverdraftCount || 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyUsage = await OverdraftLog.aggregate([
    {
      $match: {
        userId: user._id,
        accountId: account._id,
        status: { $ne: 'repaid' },
        createdAt: { $gte: monthStart },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const emailData = {
    toEmail: user.email,
    customerId: user.customerId || user._id,
    customerName: user.name,
    accountType: account.accountType
      ? account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)
      : 'Account',
    amountUsed: Number(amountUsed || 0),
    totalUsedThisMonth: Number(monthlyUsage[0]?.total || account.overdraftUsed || 0),
    outstandingAmount: Number(account.overdraftUsed || 0),
    monthlyUsageCount,
    transactionId,
    dateTime: formatDateTime(),
  };

  const emails = [sendOverdraftUsedEmail(emailData)];
  if (monthlyUsageCount >= 3) {
    emails.push(sendAllOverdraftChancesUsedEmail(emailData));
  }

  const results = await Promise.allSettled(emails);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Overdraft email failed:', result.reason?.message || result.reason);
    }
  });
};

module.exports = { notifySuccessfulOverdraftUsage };
