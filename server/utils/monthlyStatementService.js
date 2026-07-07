const XLSX = require('xlsx');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const MonthlyStatementDelivery = require('../models/MonthlyStatementDelivery');
const { sendMonthlyTransactionStatementEmail } = require('./emailService');
const { getDisplayName } = require('./nameFormat');

const consolidatedTransactionQuery = {
  reference: { $not: /-CR$/ },
};

const getPreviousMonthPeriod = (now = new Date()) => {
  const indiaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const currentYear = Number(indiaDate.find((part) => part.type === 'year').value);
  const currentMonth = Number(indiaDate.find((part) => part.type === 'month').value);
  const targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const indiaOffsetMs = 5.5 * 60 * 60 * 1000;
  const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1) - indiaOffsetMs);
  const endDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1) - indiaOffsetMs);

  return {
    month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
    monthLabel: new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(startDate),
    startDate,
    endDate,
  };
};

const createTransactionWorkbook = (transactions) => {
  const columns = [
    'Date',
    'Time',
    'Description',
    'From Account',
    'To Account',
    'Category',
    'Type',
    'Status',
    'Amount',
    'Reference',
    'Receiver Name',
    'Receiver Customer ID',
  ];
  const rows = transactions.map((transaction) => ({
    Date: new Date(transaction.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }),
    Time: new Date(transaction.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }),
    Description: transaction.description || '',
    'From Account': transaction.fromAccountNumber || '',
    'To Account': transaction.toAccountNumber || '',
    Category: transaction.category || '',
    Type: transaction.type || '',
    Status: transaction.status || '',
    Amount: transaction.amount || 0,
    Reference: transaction.reference || '',
    'Receiver Name': getDisplayName(transaction.metadata?.receiverName || transaction.metadata?.beneficiaryName, ''),
    'Receiver Customer ID': transaction.metadata?.receiverCustomerId || '',
  }));

  const worksheet = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: columns })
    : XLSX.utils.aoa_to_sheet([columns]);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 36 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const claimDelivery = async (userId, month) => {
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000);

  try {
    return await MonthlyStatementDelivery.findOneAndUpdate(
      {
        userId,
        month,
        $or: [
          { status: { $in: ['failed'] } },
          { status: 'sending', updatedAt: { $lt: staleBefore } },
          { status: { $exists: false } },
        ],
      },
      {
        $set: { status: 'sending', error: '' },
        $inc: { attempts: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const sendMonthlyStatements = async (now = new Date()) => {
  const period = getPreviousMonthPeriod(now);
  const customers = await User.find({
    role: 'customer',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: { $lt: period.endDate },
  }).select('_id customerId name email');

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    const delivery = await claimDelivery(customer._id, period.month);
    if (!delivery) continue;

    try {
      const accountIds = await Account.find({ userId: customer._id }).distinct('_id');
      const transactions = await Transaction.find({
        ...consolidatedTransactionQuery,
        $or: [
          { userId: customer._id },
          { toAccount: { $in: accountIds } },
        ],
        createdAt: { $gte: period.startDate, $lt: period.endDate },
      }).sort({ createdAt: -1 });
      const attachment = createTransactionWorkbook(transactions);

      await sendMonthlyTransactionStatementEmail({
        toEmail: customer.email,
        userName: getDisplayName(customer.name),
        monthLabel: period.monthLabel,
        filename: `transactions-${customer.customerId || customer._id}-${period.month}.xlsx`,
        attachment,
      });

      delivery.status = 'sent';
      delivery.sentAt = new Date();
      delivery.error = '';
      await delivery.save();
      sent += 1;
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = String(error.message || error).slice(0, 1000);
      await delivery.save().catch(() => {});
      failed += 1;
      console.error(`Monthly statement email failed for ${customer.email}:`, error.message);
    }
  }

  return { month: period.month, customers: customers.length, sent, failed };
};

module.exports = {
  createTransactionWorkbook,
  getPreviousMonthPeriod,
  sendMonthlyStatements,
};
