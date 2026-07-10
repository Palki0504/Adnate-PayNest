const Account = require('../models/Account');
const Loan = require('../models/Loan');
const EMIPayment = require('../models/EMIPayment');
const FixedDeposit = require('../models/FixedDeposit');
const RecurringDeposit = require('../models/RecurringDeposit');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { ensureEMISchedule } = require('./loanController');
const { getActiveAccountsForUser } = require('../utils/accountRecovery');

const activeLoanStatuses = ['Disbursed'];
const activeInvestmentStatuses = ['Active'];

const sumBy = (items, selector) =>
  items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);

const toPlain = (doc) => (typeof doc?.toObject === 'function' ? doc.toObject() : doc);

const monthRange = (date = new Date()) => ({
  start: new Date(date.getFullYear(), date.getMonth(), 1),
  end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
  month: date.getMonth() + 1,
  year: date.getFullYear(),
});

const getCustomerDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { start, end, month, year } = monthRange();

    const accounts = (await getActiveAccountsForUser(req.user)).map((account) => account.toObject());
    const accountIds = accounts.map((account) => account._id);

    const [loans, fixedDeposits, recurringDeposits, transactions, notifications, unreadCount] = await Promise.all([
      Loan.find({ userId }).sort({ createdAt: -1 }).populate('linkedAccountId', 'accountNumber accountType balance').lean(),
      FixedDeposit.find({ userId }).sort({ createdAt: -1 }).lean(),
      RecurringDeposit.find({ userId }).sort({ createdAt: -1 }).lean(),
      Transaction.find({
        $or: [{ userId }, { toAccount: { $in: accountIds } }],
        status: { $ne: 'rejected' },
      }).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    const activeLoans = loans.filter((loan) => activeLoanStatuses.includes(loan.status));
    const activeFDs = fixedDeposits.filter((fd) => activeInvestmentStatuses.includes(fd.status));
    const activeRDs = recurringDeposits.filter((rd) => activeInvestmentStatuses.includes(rd.status));

    for (const loan of activeLoans) {
      await ensureEMISchedule(loan);
    }

    const emiPayments = await EMIPayment.find({
      userId,
      loanId: { $in: activeLoans.map((loan) => loan._id) },
    }).sort({ dueDate: 1 }).populate('loanId', 'loanNumber loanType monthlyEMI linkedAccountId status outstandingBalance').lean();

    const currentMonthPayments = emiPayments.filter((emi) => {
      const dueDate = emi.dueDate ? new Date(emi.dueDate) : null;
      const paidDate = emi.paidAt ? new Date(emi.paidAt) : null;
      return (
        (dueDate && dueDate >= start && dueDate <= end) ||
        (paidDate && paidDate >= start && paidDate <= end) ||
        (emi.paymentMonth === month && emi.paymentYear === year)
      );
    });

    const payableCurrentMonth = currentMonthPayments.find((emi) =>
      ['Pending', 'Failed', 'Missed'].includes(emi.status)
    );
    const paidCurrentMonth = currentMonthPayments.some((emi) => emi.status === 'Paid');

    let emiReminder = { status: 'none', message: 'No EMI is due for this month.' };
    if (payableCurrentMonth) {
      const linkedLoan = payableCurrentMonth.loanId || {};
      emiReminder = {
        status: 'due',
        loanId: linkedLoan._id || payableCurrentMonth.loanId,
        emiId: payableCurrentMonth._id,
        loanNumber: linkedLoan.loanNumber,
        loanType: linkedLoan.loanType,
        emiAmount: payableCurrentMonth.emiAmount,
        dueDate: payableCurrentMonth.dueDate,
        accountId: linkedLoan.linkedAccountId,
        message: 'Current month EMI is due.',
      };
    } else if (paidCurrentMonth) {
      emiReminder = { status: 'paid', message: 'This month EMI is already paid.' };
    }

    const cashBalance = sumBy(accounts, (account) => account.balance);
    const overdraftUsed = sumBy(accounts, (account) => account.overdraftUsed);
    const overdraftLimit = sumBy(accounts, (account) => account.overdraftLimit);
    const availableODLimit = sumBy(accounts, (account) =>
      Math.max(0, Number(account.overdraftLimit || 0) - Number(account.overdraftUsed || 0))
    );
    const fdInvestment = sumBy(activeFDs, (fd) => fd.depositAmount);
    const rdInvestment = sumBy(activeRDs, (rd) =>
      rd.totalDepositedAmount || (rd.monthlyContribution || 0) * (rd.installmentsPaid || 0)
    );

    res.json({
      success: true,
      customer: {
        name: req.user.name,
        customerId: req.user.customerId || req.user._id,
        kycStatus: req.user.kycStatus || 'Not Started',
        kycApprovedAt: req.user.kycApprovedAt || null,
      },
      kpis: {
        cashBalance,
        overdraftUsed,
        availableODLimit,
        overdraftLimit,
        activeLoans: activeLoans.length,
        fdInvestment,
        rdInvestment,
        totalBalance: cashBalance + fdInvestment + rdInvestment,
      },
      accounts,
      emiReminder,
      transactions,
      notifications,
      unreadCount,
      investmentSummary: {
        fdCount: activeFDs.length,
        rdCount: activeRDs.length,
        fdInvestment,
        rdInvestment,
        nextFDMaturity: activeFDs.filter((fd) => fd.maturityDate).sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate))[0] || null,
        nextRDMaturity: activeRDs.filter((rd) => rd.maturityDate).sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate))[0] || null,
      },
      loanSummary: {
        activeLoans: activeLoans.map((loan) => ({ ...loan, linkedAccountId: toPlain(loan.linkedAccountId) })),
        outstandingBalance: sumBy(activeLoans, (loan) => loan.outstandingBalance),
        monthlyEMI: sumBy(activeLoans, (loan) => loan.monthlyEMI),
        paidThisMonth: currentMonthPayments.filter((emi) => emi.status === 'Paid').length,
        pendingThisMonth: currentMonthPayments.filter((emi) => ['Pending', 'Failed', 'Missed'].includes(emi.status)).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerDashboard,
};
