const Loan = require('../models/Loan');
const LoanApplication = require('../models/LoanApplication');
const EMIPayment = require('../models/EMIPayment');
const LoanConfig = require('../models/LoanConfig');
const { ensureDefaultLoanConfigs } = require('../models/LoanConfig');
const LoanRule = require('../models/LoanRule');
const XLSX = require('xlsx');
const Account = require('../models/Account');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const {
  sendLoanApprovedEmail,
  sendLoanRejectedEmail,
  sendLoanDisbursedEmail,
  sendEMIPaymentSuccessEmail,
  sendEMIPaymentFailedEmail,
  sendInvestmentEmail,
} = require('../utils/emailService');
const { getDisplayName } = require('../utils/nameFormat');

// ─── Helpers ────────────────────────────────────────────────────────────────────

const calculateEMIValues = (principal, annualRate, tenureMonths) => {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) {
    const emi = principal / tenureMonths;
    return { emi: Math.round(emi * 100) / 100, totalInterest: 0, totalRepayment: principal };
  }
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  const totalRepayment = Math.round(emi * tenureMonths * 100) / 100;
  const totalInterest = Math.round((totalRepayment - principal) * 100) / 100;
  return { emi: Math.round(emi * 100) / 100, totalInterest, totalRepayment };
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const getLoanPrepaymentChargePercent = async (loan) => {
  const rule = await LoanRule.findOne({ loanType: loan.loanType, status: 'Active' }).lean();
  if (rule) return Number(rule.prepaymentCharge ?? rule.foreclosureChargePercent ?? 0);
  const config = await LoanConfig.findOne({ loanType: loan.loanType }).lean();
  return Number(config?.prepaymentCharge ?? config?.foreclosureChargePercent ?? 0);
};

const buildFullRepaymentQuote = async (loan) => {
  await ensureEMISchedule(loan);
  const now = new Date();
  const unsettledStatuses = ['Pending', 'Failed', 'Missed', 'Processing', 'PartiallyPaid'];
  const unsettledEmis = await EMIPayment.find({
    loanId: loan._id,
    status: { $in: unsettledStatuses },
  }).sort({ emiNumber: 1 }).lean();
  const remainingPrincipal = roundMoney(loan.outstandingBalance || loan.approvedAmount || loan.amount || 0);
  const pendingInterest = roundMoney(unsettledEmis.reduce((sum, emi) => (
    sum + Math.max(0, Number(emi.interestAmount || 0) - Number(emi.interestPaid || 0))
  ), 0));
  const unpaidEmiAmount = roundMoney(unsettledEmis
    .filter((emi) => !emi.dueDate || new Date(emi.dueDate) <= now || ['Failed', 'Missed', 'PartiallyPaid'].includes(emi.status))
    .reduce((sum, emi) => sum + Math.max(0, Number(emi.emiAmount || 0) - Number(emi.principalPaid || 0) - Number(emi.interestPaid || 0)), 0));
  const lateFees = roundMoney(Number(loan.penaltyAmount || 0) + unsettledEmis.reduce((sum, emi) => sum + Number(emi.penalty || 0), 0));
  const prepaymentChargePercent = await getLoanPrepaymentChargePercent(loan);
  const closureCharge = roundMoney(remainingPrincipal * prepaymentChargePercent / 100);
  const totalClosureAmount = roundMoney(remainingPrincipal + pendingInterest + lateFees + closureCharge);
  return {
    loanId: loan._id,
    loanNumber: loan.loanNumber,
    remainingPrincipal,
    pendingInterest,
    unpaidEmiAmount,
    lateFees,
    prepaymentChargePercent,
    closureCharge,
    totalClosureAmount,
    unsettledEmiCount: unsettledEmis.length,
    calculatedAt: now,
  };
};

const toMonthLabel = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const ruleValueChanged = (before, after, key) => String(before?.[key] ?? '') !== String(after?.[key] ?? '');

const notifyAllCustomersOfLoanRuleChange = async ({ previousRule, updatedRule, action = 'updated' }) => {
  const fields = [
    ['Loan Type', 'displayName'],
    ['Status', 'status'],
    ['Interest Rate', 'interestRate'],
    ['Minimum Amount', 'minAmount'],
    ['Maximum Amount', 'maxAmount'],
    ['Minimum Tenure', 'tenureMin'],
    ['Maximum Tenure', 'tenureMax'],
    ['Tenure Unit', 'tenureUnit'],
    ['Late EMI Penalty', 'lateEmiPenalty'],
    ['Processing Fee', 'processingFee'],
    ['Prepayment Charge', 'prepaymentCharge'],
  ];
  const changedFields = action === 'deleted'
    ? ['Rule removed']
    : fields.filter(([, key]) => ruleValueChanged(previousRule, updatedRule, key)).map(([label]) => label);
  if (!changedFields.length) return { notifiedCustomers: 0, changedFields: [] };

  const customers = await User.find({ role: 'customer', isActive: true }).select('name email classification').lean();
  await Promise.all(customers.map(async (customer) => {
    await Notification.create({
      userId: customer._id,
      title: 'Loan Rules Updated',
      message: `${updatedRule?.displayName || previousRule?.displayName || 'Loan'} rules have been ${action}.`,
      type: 'info',
      priority: 'medium',
      link: '/customer-dashboard/loans',
    }).catch(() => {});
    if (customer.email) {
      await sendInvestmentEmail(customer.email, {
        subject: 'Loan Rules Updated - Adnate PayNest',
        heading: 'Loan Rules Updated',
        details: [
          ['Customer Name', getDisplayName(customer.name)],
          ['Classification', customer.classification || '-'],
          ['Loan Product', updatedRule?.displayName || previousRule?.displayName || updatedRule?.loanType || previousRule?.loanType || '-'],
          ['Updated Rule Fields', changedFields.join(', ')],
          ['Effective Date', new Date().toLocaleDateString('en-IN')],
        ],
        message: 'The bank administrator has revised loan rules. These updates apply to future loan requests and processing as per bank policy.',
      }).catch((error) => console.error('Loan rule update email error:', error.message));
    }
  }));
  return { notifiedCustomers: customers.length, changedFields };
};

const parseDateRange = (query = {}) => {
  let startDate = query.startDate ? new Date(query.startDate) : null;
  let endDate = query.endDate ? new Date(query.endDate) : null;
  if (query.month && !startDate && !endDate) {
    const [year, month] = String(query.month).split('-').map(Number);
    if (year && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }
  }
  if (endDate) endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

const getMaxLoanAmount = (config) => {
  const maxAmount = config?.maxAmount;
  if (typeof maxAmount === 'number') return Number(maxAmount || 0);
  const values = maxAmount?.get ? Array.from(maxAmount.values()) : Object.values(maxAmount || {});
  return Number(Math.max(0, ...values.map((amount) => Number(amount) || 0)));
};

const DEFAULT_LOAN_RULE_TYPES = [
  { loanType: 'home', displayName: 'Home Loan', interestRate: 8.5, minAmount: 100000, maxAmount: 5000000, tenureMin: 5, tenureMax: 30, tenureUnit: 'years', lateEmiPenalty: 2, processingFee: 0.5, prepaymentCharge: 2 },
  { loanType: 'personal', displayName: 'Personal Loan', interestRate: 10.5, minAmount: 25000, maxAmount: 1000000, tenureMin: 6, tenureMax: 60, tenureUnit: 'months', lateEmiPenalty: 2.5, processingFee: 1, prepaymentCharge: 2 },
  { loanType: 'business', displayName: 'Business Loan', interestRate: 11, minAmount: 100000, maxAmount: 2500000, tenureMin: 12, tenureMax: 120, tenureUnit: 'months', lateEmiPenalty: 2.25, processingFee: 1.25, prepaymentCharge: 2.5 },
  { loanType: 'vehicle', displayName: 'Vehicle Loan', interestRate: 9.25, minAmount: 50000, maxAmount: 2000000, tenureMin: 6, tenureMax: 84, tenureUnit: 'months', lateEmiPenalty: 2, processingFee: 0.75, prepaymentCharge: 2 },
  { loanType: 'education', displayName: 'Education Loan', interestRate: 8.75, minAmount: 50000, maxAmount: 2000000, tenureMin: 12, tenureMax: 120, tenureUnit: 'months', lateEmiPenalty: 1.5, processingFee: 0.5, prepaymentCharge: 1 },
  { loanType: 'medical', displayName: 'Medical Loan', interestRate: 9.5, minAmount: 10000, maxAmount: 500000, tenureMin: 3, tenureMax: 48, tenureUnit: 'months', lateEmiPenalty: 1.5, processingFee: 0.5, prepaymentCharge: 0 },
];

const syncLoanRules = async () => {
  await ensureDefaultLoanConfigs();
  const configs = await LoanConfig.find().lean();

  for (const type of DEFAULT_LOAN_RULE_TYPES) {
    const config = configs.find((item) => item.loanType === type.loanType);
    const existing = await LoanRule.findOne({ loanType: type.loanType });
    const insertRule = {
      displayName: config?.displayName || type.displayName,
      interestRate: Number(config?.interestRate ?? type.interestRate),
      minAmount: Number(config?.minAmount || type.minAmount),
      maxAmount: Number(getMaxLoanAmount(config) || type.maxAmount),
      tenureMin: Number(config?.minTenure || type.tenureMin),
      tenureMax: Number(config?.maxTenure || type.tenureMax),
      tenureUnit: type.tenureUnit,
      lateEmiPenalty: Number(config?.penaltyRate || type.lateEmiPenalty),
      processingFee: Number(type.processingFee),
      prepaymentCharge: Number(config?.foreclosureChargePercent ?? type.prepaymentCharge),
      status: config?.isActive === false ? 'Inactive' : 'Active',
    };
    const missingFieldMigration = {};
    ['interestRate', 'maxAmount', 'processingFee', 'prepaymentCharge'].forEach((field) => {
      const value = existing?.[field];
      const needsRequiredValue = ['interestRate', 'maxAmount'].includes(field) && Number(value || 0) === 0;
      if (existing && (value === undefined || value === null || needsRequiredValue)) {
        missingFieldMigration[field] = insertRule[field];
      }
    });

    await LoanRule.findOneAndUpdate(
      { loanType: type.loanType },
      {
        $setOnInsert: insertRule,
        ...(Object.keys(missingFieldMigration).length ? { $set: missingFieldMigration } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return {
    rules: await LoanRule.find().sort({ displayName: 1 }).lean({ virtuals: true }),
  };
};

const getActiveLoanRule = async (loanType) => LoanRule.findOne({ loanType, status: 'Active' }).lean();

const BLOCKING_LOAN_STATUSES = ['Pending', 'Submitted', 'Under Review', 'More Info Required', 'Approved', 'Active', 'Disbursed'];

const duplicateLoanTypeMessage = (displayName) => (
  `You cannot apply for this loan type because you already have an active or pending ${displayName}. Please repay or close your existing ${displayName} before applying again.`
);

const findBlockingLoanByType = async ({ userId, customerId, loanType }) => Loan.findOne({
  $or: [
    { userId },
    ...(customerId ? [{ customerId }] : []),
  ],
  loanType,
  status: { $in: BLOCKING_LOAN_STATUSES },
}).lean();

const escapeCsv = (value) => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const sendCsvReport = (res, filename, title, rangeLabel, summaryRows, columns, rows) => {
  const lines = [
    ['Adnate PayNest Bank'].map(escapeCsv).join(','),
    [title].map(escapeCsv).join(','),
    [`Period: ${rangeLabel || 'All dates'}`].map(escapeCsv).join(','),
    [`Generated: ${new Date().toLocaleString('en-IN')}`].map(escapeCsv).join(','),
    '',
    ['Summary'].map(escapeCsv).join(','),
    ...summaryRows.map(([label, value]) => [label, value].map(escapeCsv).join(',')),
    '',
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(',')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(lines.join('\n'));
};

const sendXlsxReport = (res, filename, title, rangeLabel, summaryRows, columns, rows) => {
  const sheetRows = [
    ['Adnate PayNest Bank'],
    [title],
    [`Period: ${rangeLabel || 'All dates'}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['Summary'],
    ...summaryRows,
    [],
    ...(rows.length > 0
      ? [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ''))]
      : [['No records found for this month.']]),
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(14, String(column).length + 3) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Loans');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};

const generateAmortizationSchedule = (principal, annualRate, tenureMonths, startDate) => {
  const monthlyRate = annualRate / 12 / 100;
  const { emi } = calculateEMIValues(principal, annualRate, tenureMonths);
  const schedule = [];
  let balance = principal;
  const start = startDate ? new Date(startDate) : new Date();

  for (let i = 1; i <= tenureMonths; i++) {
    const interestAmount = Math.round(balance * monthlyRate * 100) / 100;
    const principalAmount = Math.round((emi - interestAmount) * 100) / 100;
    balance = Math.round((balance - principalAmount) * 100) / 100;
    if (balance < 0) balance = 0;

    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + (startDate ? i - 1 : i));

    schedule.push({
      emiNumber: i,
      dueDate,
      principalAmount,
      interestAmount,
      emiAmount: emi,
      outstandingAfter: balance,
    });
  }
  return schedule;
};

const ensureEMISchedule = async (loan) => {
  const existingPayments = await EMIPayment.find({ loanId: loan._id }).sort({ emiNumber: 1 });
  if (existingPayments.length > 0 || !['Approved', 'Disbursed'].includes(loan.status) || !loan.approvedAmount) {
    return existingPayments;
  }

  const firstDueDate = loan.emiStartDate
    ? new Date(loan.emiStartDate)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const schedule = generateAmortizationSchedule(
    loan.approvedAmount || loan.amount,
    loan.interestRate,
    loan.tenure,
    firstDueDate
  );
  const payments = await EMIPayment.insertMany(schedule.map((item) => ({
    loanId: loan._id,
    userId: loan.userId?._id || loan.userId,
    ...item,
    status: 'Pending',
    deductedFromAccount: loan.linkedAccountId?._id || loan.linkedAccountId,
  })));

  const updates = {};
  if (!loan.emiStartDate) updates.emiStartDate = firstDueDate;
  if (!loan.nextEMIDueDate) updates.nextEMIDueDate = firstDueDate;
  if (!loan.outstandingBalance) updates.outstandingBalance = loan.approvedAmount || loan.amount;
  if (Object.keys(updates).length > 0) {
    await Loan.updateOne({ _id: loan._id }, { $set: updates });
    Object.assign(loan, updates);
  }
  return payments;
};

const computeEligibility = async (user, account, loanAmount, monthlyIncome, existingLiabilities, loanConfig) => {
  const details = {
    classificationScore: 0,
    incomeScore: 0,
    accountHistoryScore: 0,
    overdraftScore: 0,
    liabilitiesScore: 0,
    isEligible: false,
    remarks: [],
  };

  // 1. Classification score
  const classification = (user.classification || 'SILVER').toUpperCase();
  if (classification === 'PLATINUM') {
    details.classificationScore = 35;
    details.remarks.push('Platinum classification — highest tier');
  } else if (classification === 'GOLD') {
    details.classificationScore = 25;
    details.remarks.push('Gold classification — enhanced tier');
  } else {
    details.classificationScore = 15;
    details.remarks.push('Silver classification — standard tier');
  }

  // 2. Income-to-EMI ratio
  const { emi } = calculateEMIValues(loanAmount, loanConfig.interestRate, 12); // rough EMI for 1yr
  const incomeRatio = monthlyIncome / emi;
  if (incomeRatio >= 3) {
    details.incomeScore = 25;
    details.remarks.push(`Strong income ratio (${incomeRatio.toFixed(1)}x)`);
  } else if (incomeRatio >= 2) {
    details.incomeScore = 15;
    details.remarks.push(`Adequate income ratio (${incomeRatio.toFixed(1)}x)`);
  } else {
    details.incomeScore = 5;
    details.remarks.push(`Low income ratio (${incomeRatio.toFixed(1)}x)`);
  }

  // 3. Account history (age in days)
  const accountAgeDays = account?.createdAt
    ? Math.floor((Date.now() - new Date(account.createdAt).getTime()) / 86400000)
    : 0;
  if (accountAgeDays > 365) {
    details.accountHistoryScore = 15;
    details.remarks.push(`Account age: ${accountAgeDays} days — excellent history`);
  } else if (accountAgeDays > 180) {
    details.accountHistoryScore = 10;
    details.remarks.push(`Account age: ${accountAgeDays} days — good history`);
  } else {
    details.accountHistoryScore = 5;
    details.remarks.push(`Account age: ${accountAgeDays} days — short history`);
  }

  // 4. Overdraft usage
  const overdraftUsedPercent = account?.overdraftLimit > 0
    ? ((account.overdraftUsed || 0) / account.overdraftLimit) * 100
    : 0;
  if (overdraftUsedPercent === 0) {
    details.overdraftScore = 15;
    details.remarks.push('No overdraft usage — excellent');
  } else if (overdraftUsedPercent < 50) {
    details.overdraftScore = 10;
    details.remarks.push(`Overdraft usage: ${overdraftUsedPercent.toFixed(0)}% — moderate`);
  } else {
    details.overdraftScore = 0;
    details.remarks.push(`Overdraft usage: ${overdraftUsedPercent.toFixed(0)}% — high risk`);
  }

  // 5. Existing liabilities ratio
  const liabilitiesRatio = monthlyIncome > 0 ? (existingLiabilities / monthlyIncome) * 100 : 100;
  if (liabilitiesRatio < 30) {
    details.liabilitiesScore = 10;
    details.remarks.push(`Liabilities ratio: ${liabilitiesRatio.toFixed(0)}% — low`);
  } else if (liabilitiesRatio < 50) {
    details.liabilitiesScore = 5;
    details.remarks.push(`Liabilities ratio: ${liabilitiesRatio.toFixed(0)}% — moderate`);
  } else {
    details.liabilitiesScore = 0;
    details.remarks.push(`Liabilities ratio: ${liabilitiesRatio.toFixed(0)}% — high risk`);
  }

  const totalScore = details.classificationScore + details.incomeScore +
    details.accountHistoryScore + details.overdraftScore + details.liabilitiesScore;

  details.isEligible = true;
  details.remarks.push(`Review score ${totalScore}/100 calculated for manager assessment`);

  const maxAmount = getMaxLoanAmount(loanConfig) || 500000;
  if (loanAmount > maxAmount) {
    details.isEligible = false;
    details.remarks.push(`Amount Rs.${loanAmount.toLocaleString('en-IN')} exceeds maximum Rs.${maxAmount.toLocaleString('en-IN')} for this loan type`);
  }

  // Check min income
  const minIncome = loanConfig.eligibilityRules?.minMonthlyIncome || 15000;
  if (monthlyIncome < minIncome) {
    details.isEligible = false;
    details.remarks.push(`Monthly income ₹${monthlyIncome.toLocaleString('en-IN')} below minimum ₹${minIncome.toLocaleString('en-IN')}`);
  }

  return { score: totalScore, details };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/loans/apply
const applyForLoan = async (req, res) => {
  try {
    const { loanType, amount, tenure, monthlyIncome, purpose, linkedAccountId, existingLiabilities } = req.body;

    if (!loanType || !amount || !tenure || !monthlyIncome || !purpose || !linkedAccountId) {
      return res.status(400).json({ success: false, message: 'All fields are required: loanType, amount, tenure, monthlyIncome, purpose, linkedAccountId.' });
    }

    // Verify linked account belongs to the user
    const account = await Account.findOne({ _id: linkedAccountId, userId: req.user._id, status: 'active' });
    if (!account) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive linked account.' });
    }
    const user = await User.findById(req.user._id);

    // Get loan config
    await ensureDefaultLoanConfigs();
    const config = await LoanConfig.findOne({ loanType, isActive: true });
    if (!config) {
      return res.status(400).json({ success: false, message: `Loan type "${loanType}" is not currently available.` });
    }
    await syncLoanRules();
    const activeRule = await getActiveLoanRule(loanType);
    const effectiveDisplayName = activeRule?.displayName || config.displayName;
    const effectiveInterestRate = Number(activeRule?.interestRate ?? config.interestRate);

    const minAmount = Number(activeRule?.minAmount || config.minAmount || 10000);
    const maxAmount = Number(activeRule?.maxAmount || getMaxLoanAmount(config) || 0);
    if (Number(amount) < minAmount) {
      return res.status(400).json({ success: false, message: `Minimum loan amount for ${config.displayName} is ₹${minAmount.toLocaleString('en-IN')}.` });
    }
    if (maxAmount && Number(amount) > maxAmount) {
      return res.status(400).json({ success: false, message: `Maximum loan amount for ${config.displayName} is Rs.${maxAmount.toLocaleString('en-IN')}.` });
    }

    // Validate tenure
    const effectiveMinTenure = Number(activeRule?.tenureMin || config.minTenure);
    const effectiveMaxTenure = Number(activeRule?.tenureMax || config.maxTenure);
    if (tenure < effectiveMinTenure || tenure > effectiveMaxTenure) {
      return res.status(400).json({
        success: false,
        message: `Tenure must be between ${config.minTenure} and ${config.maxTenure} months for ${config.displayName}.`,
      });
    }

    const customerId = user.customerId || user._id.toString();
    const blockingLoan = await findBlockingLoanByType({ userId: req.user._id, customerId, loanType });
    if (blockingLoan) {
      return res.status(409).json({
        success: false,
        message: duplicateLoanTypeMessage(effectiveDisplayName),
        existingLoan: blockingLoan,
      });
    }

    // Compute eligibility
    const effectiveConfig = {
      ...(config.toObject?.() || config),
      displayName: effectiveDisplayName,
      interestRate: effectiveInterestRate,
      minAmount,
      minTenure: effectiveMinTenure,
      maxTenure: effectiveMaxTenure,
      eligibilityRules: config.eligibilityRules?.toObject?.() || config.eligibilityRules || {},
      maxAmount,
    };
    const { score, details } = await computeEligibility(
      user, account, amount, monthlyIncome, existingLiabilities || 0, effectiveConfig
    );

    const loan = await Loan.create({
      userId: req.user._id,
      customerId: user.customerId || user._id.toString(),
      loanType,
      amount,
      tenure,
      monthlyIncome,
      purpose,
      existingLiabilities: existingLiabilities || 0,
      linkedAccountId,
      linkedAccountNumber: account.accountNumber,
      interestRate: effectiveInterestRate,
      eligibilityScore: score,
      eligibilityDetails: details,
      customerClassification: user.classification || 'SILVER',
    });

    // Notification to customer
    await Notification.create({
      userId: req.user._id,
      title: 'Loan Application Submitted',
      message: `Your ${config.displayName} application for ₹${amount.toLocaleString('en-IN')} (Loan #${loan.loanNumber}) has been submitted successfully.`,
      type: 'info',
      priority: 'medium',
    });

    // Notify managers
    const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
    for (const mgr of managers) {
      await Notification.create({
        userId: mgr._id,
        title: 'New Loan Application',
        message: `${user.name} (${user.customerId}) has applied for a ${config.displayName} of ₹${amount.toLocaleString('en-IN')}.`,
        type: 'info',
        priority: 'medium',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully.',
      loan: {
        _id: loan._id,
        loanNumber: loan.loanNumber,
        loanType: loan.loanType,
        amount: loan.amount,
        tenure: loan.tenure,
        status: loan.status,
        eligibilityScore: loan.eligibilityScore,
        eligibilityDetails: loan.eligibilityDetails,
        interestRate: loan.interestRate,
      },
    });
  } catch (error) {
    console.error('Apply for loan error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This request is already pending for manager approval.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to submit loan application.' });
  }
};

// GET /api/loans/my-loans
const getMyLoans = async (req, res) => {
  try {
    const { status, loanType, page = 1, limit = 20 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (loanType) filter.loanType = loanType;

    const total = await Loan.countDocuments(filter);
    const loans = await Loan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('linkedAccountId', 'accountNumber accountType balance')
      .lean();

    res.json({
      success: true,
      loans,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get my loans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loans.' });
  }
};

// GET /api/loans/:id
const getLoanDetails = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('linkedAccountId', 'accountNumber accountType balance')
      .populate('approvedBy', 'name email')
      .populate('userId', 'name email customerId classification phone')
      .lean();

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }

    // Only the owner, managers, or admins can view
    const isOwner = loan.userId._id.toString() === req.user._id.toString();
    const isManagerOrAdmin = ['manager', 'admin'].includes(req.user.role);
    if (!isOwner && !isManagerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const amortizationSchedule = (await ensureEMISchedule(loan)).map((payment) => (
      typeof payment.toObject === 'function' ? payment.toObject() : payment
    ));

    res.json({
      success: true,
      loan,
      amortizationSchedule,
    });
  } catch (error) {
    console.error('Get loan details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan details.' });
  }
};

// GET /api/loans/:id/emi-history
const getEMIHistory = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).lean();
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }

    const isOwner = loan.userId.toString() === req.user._id.toString();
    const isManagerOrAdmin = ['manager', 'admin'].includes(req.user.role);
    if (!isOwner && !isManagerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const payments = (await ensureEMISchedule(loan)).map((payment) => (
      typeof payment.toObject === 'function' ? payment.toObject() : payment
    ));

    res.json({ success: true, payments, loanNumber: loan.loanNumber });
  } catch (error) {
    console.error('Get EMI history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch EMI history.' });
  }
};

// POST /api/loans/:id/emis/:emiId/pay
const payEMI = async (req, res) => {
  let deductedAccountId = null;
  let deductedAmount = 0;
  let claimedEMI = null;
  let originalOutstandingAfter = null;
  let paymentCommitted = false;
  let transactionId = null;

  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'Please select an account to pay EMI.' });
    }

    const loan = await Loan.findOne({
      _id: req.params.id,
      userId: req.user._id,
      status: { $in: ['Approved', 'Disbursed'] },
    });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Active approved or disbursed loan not found.' });
    }

    await ensureEMISchedule(loan);
    const paymentDate = new Date();
    const paymentMonth = paymentDate.getMonth() + 1;
    const paymentYear = paymentDate.getFullYear();
    const monthStart = new Date(paymentYear, paymentMonth - 1, 1);
    const nextMonthStart = new Date(paymentYear, paymentMonth, 1);
    const alreadyPaidThisMonth = await EMIPayment.findOne({
      loanId: loan._id,
      userId: req.user._id,
      status: 'Paid',
      $or: [
        { paymentMonth, paymentYear },
        { paidAt: { $gte: monthStart, $lt: nextMonthStart } },
      ],
    }).lean();
    if (alreadyPaidThisMonth) {
      return res.status(409).json({
        success: false,
        message: 'EMI for this month is already paid.',
        payment: alreadyPaidThisMonth,
      });
    }

    claimedEMI = await EMIPayment.findOneAndUpdate(
      {
        _id: req.params.emiId,
        loanId: loan._id,
        userId: req.user._id,
        status: { $in: ['Pending', 'Failed'] },
      },
      { $set: { status: 'Processing', failureReason: '' } },
      { new: true }
    );
    if (!claimedEMI) {
      const existing = await EMIPayment.findOne({ _id: req.params.emiId, loanId: loan._id });
      const message = existing?.status === 'Paid'
        ? 'This EMI has already been paid.'
        : 'This EMI is not available for payment.';
      return res.status(409).json({ success: false, message });
    }

    const selectedAccount = await Account.findOne({
      _id: accountId,
      userId: req.user._id,
      status: 'active',
    }).select('_id accountNumber accountType balance');
    if (!selectedAccount) {
      claimedEMI.status = 'Pending';
      await claimedEMI.save();
      return res.status(400).json({ success: false, message: 'Selected account is invalid or inactive.' });
    }

    const account = await Account.findOneAndUpdate(
      {
        _id: selectedAccount._id,
        userId: req.user._id,
        status: 'active',
        balance: { $gte: claimedEMI.emiAmount },
      },
      { $inc: { balance: -claimedEMI.emiAmount } },
      { new: true }
    );

    const customer = await User.findById(req.user._id).select('name email');
    const formattedDueDate = claimedEMI.dueDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    if (!account) {
      const reason = 'Insufficient balance in selected account to pay EMI';
      claimedEMI.status = 'Failed';
      claimedEMI.failureReason = reason;
      await claimedEMI.save();

      await Notification.create({
        userId: req.user._id,
        title: 'EMI Payment Failed',
        message: 'EMI payment failed due to insufficient balance. Please add funds and try again.',
        type: 'alert',
        priority: 'high',
        link: '/customer-dashboard/loans',
      });
      if (customer?.email) {
        await sendEMIPaymentFailedEmail(customer.email, {
          emiNumber: claimedEMI.emiNumber,
          dueDate: formattedDueDate,
          emiAmount: claimedEMI.emiAmount,
          reason,
        }).catch((emailError) => console.error('Failed EMI email error:', emailError.message));
      }
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in selected account to pay EMI',
        payment: claimedEMI,
      });
    }

    deductedAccountId = account._id;
    deductedAmount = claimedEMI.emiAmount;
    const transactionRef = `EMI${Date.now()}${Math.floor(Math.random() * 1000)}`;
    originalOutstandingAfter = claimedEMI.outstandingAfter;
    const outstandingBalance = Math.max(
      0,
      Math.round(((loan.outstandingBalance || loan.approvedAmount) - claimedEMI.principalAmount) * 100) / 100
    );

    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: account._id,
      fromAccountNumber: account.accountNumber,
      amount: claimedEMI.emiAmount,
      type: 'debit',
      category: 'other',
      status: 'completed',
      description: `EMI No. ${claimedEMI.emiNumber} payment for loan ${loan.loanNumber}`,
      reference: transactionRef,
      balance_after: account.balance,
      finalAccountBalance: account.balance,
      metadata: {
        transactionType: 'Loan EMI Payment',
        loanId: String(loan._id),
        loanNumber: loan.loanNumber,
        emiPaymentId: String(claimedEMI._id),
        emiNumber: claimedEMI.emiNumber,
        principalPaid: claimedEMI.principalAmount,
        interestPaid: claimedEMI.interestAmount,
      },
    });
    transactionId = transaction._id;

    claimedEMI.status = 'Paid';
    claimedEMI.paidAt = paymentDate;
    claimedEMI.paymentMonth = paymentMonth;
    claimedEMI.paymentYear = paymentYear;
    claimedEMI.principalPaid = claimedEMI.principalAmount;
    claimedEMI.interestPaid = claimedEMI.interestAmount;
    claimedEMI.transactionRef = transactionRef;
    claimedEMI.paymentMode = 'Online Debit';
    claimedEMI.outstandingAfter = outstandingBalance;
    claimedEMI.failureReason = '';
    await claimedEMI.save();

    const nextEMI = await EMIPayment.findOne({
      loanId: loan._id,
      status: { $in: ['Pending', 'Failed'] },
    }).sort({ emiNumber: 1 });
    loan.outstandingBalance = outstandingBalance;
    loan.totalEMIsPaid = (loan.totalEMIsPaid || 0) + 1;
    loan.nextEMIDueDate = nextEMI?.dueDate || null;
    if (outstandingBalance <= 0 || !nextEMI) {
      loan.status = 'Closed';
      loan.closedAt = paymentDate;
      loan.nextEMIDueDate = null;
    }
    await loan.save();
    paymentCommitted = true;

    await Notification.create({
      userId: req.user._id,
      title: 'EMI Payment Successful',
      message: `Your EMI No. ${claimedEMI.emiNumber} of ₹${claimedEMI.emiAmount.toLocaleString('en-IN')} has been paid successfully. Outstanding balance is ₹${outstandingBalance.toLocaleString('en-IN')}.`,
      type: 'transaction',
      priority: 'medium',
      link: '/customer-dashboard/loans',
    }).catch((notificationError) => console.error('EMI success notification error:', notificationError.message));

    if (customer?.email) {
      await sendEMIPaymentSuccessEmail(customer.email, {
        emiNumber: claimedEMI.emiNumber,
        dueDate: formattedDueDate,
        principalPaid: claimedEMI.principalAmount,
        interestPaid: claimedEMI.interestAmount,
        emiAmount: claimedEMI.emiAmount,
        outstandingBalance,
        paymentDate: paymentDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      }).catch((emailError) => console.error('Successful EMI email error:', emailError.message));
    }

    return res.json({
      success: true,
      message: 'EMI payment processed successfully.',
      payment: claimedEMI,
      loan: {
        outstandingBalance: loan.outstandingBalance,
        totalEMIsPaid: loan.totalEMIsPaid,
        nextEMIDueDate: loan.nextEMIDueDate,
        status: loan.status,
      },
      accountBalance: account.balance,
      transaction,
    });
  } catch (error) {
    if (!paymentCommitted && transactionId) {
      await Transaction.deleteOne({ _id: transactionId }).catch(() => {});
    }
    if (!paymentCommitted && deductedAccountId && deductedAmount) {
      await Account.updateOne({ _id: deductedAccountId }, { $inc: { balance: deductedAmount } }).catch(() => {});
    }
    if (!paymentCommitted && claimedEMI) {
      claimedEMI.status = 'Pending';
      claimedEMI.paidAt = undefined;
      claimedEMI.paymentMonth = undefined;
      claimedEMI.paymentYear = undefined;
      claimedEMI.principalPaid = 0;
      claimedEMI.interestPaid = 0;
      claimedEMI.transactionRef = '';
      claimedEMI.paymentMode = '';
      if (originalOutstandingAfter !== null) claimedEMI.outstandingAfter = originalOutstandingAfter;
      await claimedEMI.save().catch(() => {});
    }
    console.error('Pay EMI error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'EMI for this month is already paid.' });
    }
    return res.status(500).json({ success: false, message: 'EMI payment could not be completed.' });
  }
};

// POST /api/loans/:id/part-payment
const makePartPaymentLegacy = async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id, status: { $in: ['Approved', 'Disbursed'] } });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Active loan not found.' });
    }

    if (amount > loan.outstandingBalance) {
      return res.status(400).json({ success: false, message: `Amount exceeds outstanding balance of ₹${loan.outstandingBalance.toLocaleString('en-IN')}.` });
    }

    // Deduct from linked account
    const account = await Account.findById(loan.linkedAccountId);
    if (!account || account.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance in linked account.' });
    }

    const balanceBefore = loan.outstandingBalance;
    account.balance -= amount;
    await account.save();

    loan.outstandingBalance -= amount;
    loan.partPayments.push({
      amount,
      date: new Date(),
      note: note || 'Part payment',
      balanceBefore,
      balanceAfter: loan.outstandingBalance,
    });

    // Recalculate remaining EMIs
    const remainingEMIs = await EMIPayment.find({ loanId: loan._id, status: 'Pending' }).sort({ emiNumber: 1 });
    if (remainingEMIs.length > 0) {
      const newSchedule = generateAmortizationSchedule(
        loan.outstandingBalance, loan.interestRate, remainingEMIs.length, new Date()
      );
      for (let i = 0; i < remainingEMIs.length; i++) {
        if (newSchedule[i]) {
          remainingEMIs[i].principalAmount = newSchedule[i].principalAmount;
          remainingEMIs[i].interestAmount = newSchedule[i].interestAmount;
          remainingEMIs[i].emiAmount = newSchedule[i].emiAmount;
          remainingEMIs[i].outstandingAfter = newSchedule[i].outstandingAfter;
          await remainingEMIs[i].save();
        }
      }
      loan.monthlyEMI = newSchedule[0]?.emiAmount || loan.monthlyEMI;
    }

    if (loan.outstandingBalance <= 0) {
      loan.status = 'Closed';
      loan.closedAt = new Date();
      // Mark remaining pending EMIs as paid
      await EMIPayment.updateMany(
        { loanId: loan._id, status: 'Pending' },
        { $set: { status: 'Paid', paidAt: new Date() } }
      );
    }

    await loan.save();

    await Notification.create({
      userId: req.user._id,
      title: 'Part Payment Successful',
      message: `₹${amount.toLocaleString('en-IN')} part payment made on loan ${loan.loanNumber}. Outstanding: ₹${loan.outstandingBalance.toLocaleString('en-IN')}.`,
      type: 'transaction',
      priority: 'medium',
    });

    res.json({
      success: true,
      message: 'Part payment successful.',
      loan: {
        outstandingBalance: loan.outstandingBalance,
        status: loan.status,
        monthlyEMI: loan.monthlyEMI,
      },
    });
  } catch (error) {
    console.error('Part payment error:', error);
    res.status(500).json({ success: false, message: 'Part payment failed.' });
  }
};

const makePartPayment = async (req, res) => {
  let deductedAccountId = null;
  let deductedAmount = 0;
  let transactionId = null;
  try {
    const { amount, accountId, note } = req.body;
    const partPaymentAmount = roundMoney(amount);
    if (!partPaymentAmount || partPaymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'Please select an account for part payment.' });
    }

    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id, status: { $in: ['Approved', 'Disbursed'] } });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Active loan not found.' });
    }

    const currentOutstanding = roundMoney(loan.outstandingBalance || loan.approvedAmount || loan.amount || 0);
    if (partPaymentAmount > currentOutstanding) {
      return res.status(400).json({ success: false, message: `Amount exceeds outstanding balance of Rs. ${currentOutstanding.toLocaleString('en-IN')}.` });
    }

    const account = await Account.findOneAndUpdate(
      {
        _id: accountId,
        userId: req.user._id,
        status: 'active',
        balance: { $gte: partPaymentAmount },
      },
      { $inc: { balance: -partPaymentAmount } },
      { new: true }
    );
    if (!account) {
      return res.status(400).json({ success: false, message: 'Selected account is invalid or has insufficient balance.' });
    }
    deductedAccountId = account._id;
    deductedAmount = partPaymentAmount;

    const paymentDate = new Date();
    const transactionRef = `LOAN-PART-${loan.loanNumber}-${Date.now()}`;
    const balanceBefore = currentOutstanding;
    loan.outstandingBalance = roundMoney(Math.max(0, currentOutstanding - partPaymentAmount));
    loan.partPayments.push({
      amount: partPaymentAmount,
      date: paymentDate,
      note: note || 'Customer Part Payment',
      balanceBefore,
      balanceAfter: loan.outstandingBalance,
    });

    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: account._id,
      fromAccountNumber: account.accountNumber,
      amount: partPaymentAmount,
      type: 'debit',
      category: 'other',
      status: 'completed',
      description: `Loan part payment for ${loan.loanNumber}`,
      reference: transactionRef,
      balance_after: account.balance,
      finalAccountBalance: account.balance,
      metadata: {
        transactionType: 'Loan Part Payment',
        loanId: String(loan._id),
        loanNumber: loan.loanNumber,
        balanceBefore,
        balanceAfter: loan.outstandingBalance,
      },
    });
    transactionId = transaction._id;

    const remainingEMIs = await EMIPayment.find({
      loanId: loan._id,
      userId: req.user._id,
      status: { $in: ['Pending', 'Failed'] },
    }).sort({ emiNumber: 1 });

    if (loan.outstandingBalance > 0 && remainingEMIs.length > 0) {
      const newSchedule = generateAmortizationSchedule(
        loan.outstandingBalance,
        loan.interestRate,
        remainingEMIs.length,
        paymentDate
      );
      for (let i = 0; i < remainingEMIs.length; i += 1) {
        if (newSchedule[i]) {
          remainingEMIs[i].principalAmount = newSchedule[i].principalAmount;
          remainingEMIs[i].interestAmount = newSchedule[i].interestAmount;
          remainingEMIs[i].emiAmount = newSchedule[i].emiAmount;
          remainingEMIs[i].outstandingAfter = newSchedule[i].outstandingAfter;
          remainingEMIs[i].failureReason = '';
          await remainingEMIs[i].save();
        }
      }
      loan.monthlyEMI = newSchedule[0]?.emiAmount || loan.monthlyEMI;
      const nextEMI = await EMIPayment.findOne({ loanId: loan._id, status: { $in: ['Pending', 'Failed'] } }).sort({ dueDate: 1 }).lean();
      loan.nextEMIDueDate = nextEMI?.dueDate || loan.nextEMIDueDate;
    }

    if (loan.outstandingBalance <= 0) {
      loan.status = 'Closed';
      loan.closedAt = paymentDate;
      loan.nextEMIDueDate = null;
      await EMIPayment.updateMany(
        { loanId: loan._id, status: { $in: ['Pending', 'Failed', 'Missed', 'Processing', 'PartiallyPaid'] } },
        {
          $set: {
            status: 'Settled',
            paidAt: paymentDate,
            paymentMode: 'Loan Part Payment Closure',
            transactionRef,
            outstandingAfter: 0,
            failureReason: '',
          },
        }
      );
    }

    await loan.save();

    await Notification.create({
      userId: req.user._id,
      title: 'Part Payment Successful',
      message: `Rs. ${partPaymentAmount.toLocaleString('en-IN')} part payment made on loan ${loan.loanNumber}. Outstanding: Rs. ${loan.outstandingBalance.toLocaleString('en-IN')}.`,
      type: 'transaction',
      priority: 'medium',
      link: '/customer-dashboard/loans',
    }).catch((notificationError) => console.error('Loan part payment notification error:', notificationError.message));

    const customer = await User.findById(req.user._id).select('name email');
    if (customer?.email) {
      await sendInvestmentEmail(customer.email, {
        subject: 'Loan Part Payment Successful - Adnate PayNest',
        heading: 'Loan Part Payment Successful',
        details: [
          ['Customer Name', getDisplayName(customer.name)],
          ['Loan Number', loan.loanNumber],
          ['Part Payment Amount', `Rs. ${partPaymentAmount.toLocaleString('en-IN')}`],
          ['Paid From Account', account.accountNumber],
          ['Outstanding Before', `Rs. ${balanceBefore.toLocaleString('en-IN')}`],
          ['Outstanding After', `Rs. ${loan.outstandingBalance.toLocaleString('en-IN')}`],
          ['Payment Date', paymentDate.toLocaleDateString('en-IN')],
        ],
        message: loan.status === 'Closed'
          ? 'Your part payment has cleared the full outstanding balance and the loan has been closed.'
          : 'Your loan outstanding balance and remaining EMI schedule have been updated.',
      }).catch((emailError) => console.error('Loan part payment email error:', emailError.message));
    }

    res.json({
      success: true,
      message: loan.status === 'Closed' ? 'Part payment successful. Loan fully paid and closed.' : 'Part payment successful.',
      loan: {
        _id: loan._id,
        outstandingBalance: loan.outstandingBalance,
        status: loan.status,
        monthlyEMI: loan.monthlyEMI,
        nextEMIDueDate: loan.nextEMIDueDate,
      },
      transaction,
      accountBalance: account.balance,
    });
  } catch (error) {
    if (transactionId) await Transaction.deleteOne({ _id: transactionId }).catch(() => {});
    if (deductedAccountId && deductedAmount) await Account.updateOne({ _id: deductedAccountId }, { $inc: { balance: deductedAmount } }).catch(() => {});
    console.error('Part payment error:', error);
    res.status(500).json({ success: false, message: 'Part payment failed.' });
  }
};

const getFullRepaymentQuote = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id, status: { $in: ['Approved', 'Disbursed'] } });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Active loan not found.' });
    }
    const quote = await buildFullRepaymentQuote(loan);
    res.json({ success: true, quote });
  } catch (error) {
    console.error('Full repayment quote error:', error);
    res.status(500).json({ success: false, message: 'Unable to calculate full repayment amount.' });
  }
};

const closeFullLoan = async (req, res) => {
  let deductedAccountId = null;
  let deductedAmount = 0;
  let transactionId = null;
  let claimedLoanId = null;
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ success: false, message: 'Please select an account to close this loan.' });

    const loan = await Loan.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['Approved', 'Disbursed'] },
        outstandingBalance: { $gt: 0 },
        closureProcessing: { $ne: true },
      },
      { $set: { closureProcessing: true } },
      { new: true }
    );
    if (!loan) {
      const existingLoan = await Loan.findOne({ _id: req.params.id, userId: req.user._id }).select('status closureProcessing');
      if (existingLoan?.closureProcessing) {
        return res.status(409).json({ success: false, message: 'Full loan repayment is already processing for this loan.' });
      }
      if (existingLoan?.status === 'Closed') {
        return res.status(409).json({ success: false, message: 'This loan is already fully paid and closed.' });
      }
      return res.status(404).json({ success: false, message: 'Active loan not found.' });
    }
    claimedLoanId = loan._id;

    const quote = await buildFullRepaymentQuote(loan);
    const account = await Account.findOneAndUpdate(
      {
        _id: accountId,
        userId: req.user._id,
        status: 'active',
        balance: { $gte: quote.totalClosureAmount },
      },
      { $inc: { balance: -quote.totalClosureAmount } },
      { new: true }
    );
    if (!account) {
      await Loan.updateOne({ _id: loan._id }, { $set: { closureProcessing: false } });
      claimedLoanId = null;
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Total closure amount: Rs. ${quote.totalClosureAmount.toLocaleString('en-IN')}.`,
        quote,
      });
    }
    deductedAccountId = account._id;
    deductedAmount = quote.totalClosureAmount;

    const transactionRef = `FULL-LOAN-${loan.loanNumber}-${Date.now()}`;
    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: account._id,
      fromAccountNumber: account.accountNumber,
      amount: quote.totalClosureAmount,
      type: 'debit',
      category: 'other',
      status: 'completed',
      description: `Full loan repayment for ${loan.loanNumber}`,
      reference: transactionRef,
      balance_after: account.balance,
      finalAccountBalance: account.balance,
      metadata: {
        transactionType: 'Full Loan Repayment',
        loanId: String(loan._id),
        loanNumber: loan.loanNumber,
        remainingPrincipal: quote.remainingPrincipal,
        pendingInterest: quote.pendingInterest,
        unpaidEmiAmount: quote.unpaidEmiAmount,
        lateFees: quote.lateFees,
        closureCharge: quote.closureCharge,
      },
    });
    transactionId = transaction._id;

    const closedAt = new Date();
    loan.outstandingBalance = 0;
    loan.status = 'Closed';
    loan.closedAt = closedAt;
    loan.isForeclosed = true;
    loan.foreclosureDate = closedAt;
    loan.foreclosureCharge = quote.closureCharge;
    loan.penaltyAmount = 0;
    loan.nextEMIDueDate = null;
    loan.closureProcessing = false;
    await loan.save();
    claimedLoanId = null;

    await EMIPayment.updateMany(
      { loanId: loan._id, status: { $in: ['Pending', 'Failed', 'Missed', 'Processing', 'PartiallyPaid'] } },
      {
        $set: {
          status: 'Settled',
          paidAt: closedAt,
          paymentMode: 'Full Loan Closure',
          transactionRef,
          outstandingAfter: 0,
          failureReason: '',
        },
      }
    );

    try {
      const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
      await Notification.insertMany([
        {
          userId: req.user._id,
          title: 'Loan Fully Paid',
          message: `Loan ${loan.loanNumber} has been fully paid and closed. Total paid: Rs. ${quote.totalClosureAmount.toLocaleString('en-IN')}.`,
          type: 'transaction',
          priority: 'high',
          link: '/customer-dashboard/loans',
        },
        ...managers.map((manager) => ({
          userId: manager._id,
          title: 'Loan Fully Paid',
          message: `${req.user.name || 'A customer'} fully paid and closed loan ${loan.loanNumber}.`,
          type: 'info',
          priority: 'medium',
          link: '/manager-dashboard/loans',
        })),
      ]);
    } catch (notificationError) {
      console.error('Full repayment notification error:', notificationError.message);
    }

    const customer = await User.findById(req.user._id).select('name email');
    if (customer?.email) {
      await sendInvestmentEmail(customer.email, {
        subject: 'Loan Fully Paid - Adnate PayNest',
        heading: 'Loan Fully Paid / Closed',
        details: [
          ['Customer Name', getDisplayName(customer.name)],
          ['Loan Number', loan.loanNumber],
          ['Remaining Principal', `Rs. ${quote.remainingPrincipal.toLocaleString('en-IN')}`],
          ['Pending Interest', `Rs. ${quote.pendingInterest.toLocaleString('en-IN')}`],
          ['Unpaid EMI Amount', `Rs. ${quote.unpaidEmiAmount.toLocaleString('en-IN')}`],
          ['Late Fees / Penalties', `Rs. ${quote.lateFees.toLocaleString('en-IN')}`],
          ['Closure Charges', `Rs. ${quote.closureCharge.toLocaleString('en-IN')}`],
          ['Total Closure Amount', `Rs. ${quote.totalClosureAmount.toLocaleString('en-IN')}`],
          ['Paid From Account', account.accountNumber],
          ['Closure Date', closedAt.toLocaleDateString('en-IN')],
        ],
        message: 'Your loan has been fully repaid and closed successfully.',
      }).catch((emailError) => console.error('Full repayment email error:', emailError.message));
    }

    res.json({
      success: true,
      message: 'Loan fully paid and closed successfully.',
      quote,
      loan: { _id: loan._id, status: loan.status, outstandingBalance: loan.outstandingBalance, closedAt: loan.closedAt },
      transaction,
      accountBalance: account.balance,
    });
  } catch (error) {
    if (transactionId) await Transaction.deleteOne({ _id: transactionId }).catch(() => {});
    if (deductedAccountId && deductedAmount) await Account.updateOne({ _id: deductedAccountId }, { $inc: { balance: deductedAmount } }).catch(() => {});
    if (claimedLoanId) await Loan.updateOne({ _id: claimedLoanId }, { $set: { closureProcessing: false } }).catch(() => {});
    console.error('Full loan repayment error:', error);
    res.status(500).json({ success: false, message: 'Full loan repayment failed.' });
  }
};

// POST /api/loans/:id/foreclose
const forecloseLoan = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id, status: 'Disbursed' });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Active disbursed loan not found.' });
    }

    const config = await LoanConfig.findOne({ loanType: loan.loanType });
    const foreclosurePercent = Number(config?.foreclosureChargePercent || config?.prepaymentCharge || 0);
    const foreclosureCharge = Math.round(loan.outstandingBalance * foreclosurePercent / 100 * 100) / 100;
    const totalPayable = Math.round((loan.outstandingBalance + foreclosureCharge + loan.penaltyAmount) * 100) / 100;

    const account = await Account.findById(loan.linkedAccountId);
    if (!account || account.balance < totalPayable) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Total payable: ₹${totalPayable.toLocaleString('en-IN')} (Outstanding: ₹${loan.outstandingBalance.toLocaleString('en-IN')} + Foreclosure: ₹${foreclosureCharge.toLocaleString('en-IN')} + Penalties: ₹${loan.penaltyAmount.toLocaleString('en-IN')}).`,
        foreclosureDetails: { outstandingBalance: loan.outstandingBalance, foreclosureCharge, penalties: loan.penaltyAmount, totalPayable },
      });
    }

    // Deduct
    account.balance -= totalPayable;
    await account.save();

    loan.outstandingBalance = 0;
    loan.status = 'Closed';
    loan.closedAt = new Date();
    loan.isForeclosed = true;
    loan.foreclosureDate = new Date();
    loan.foreclosureCharge = foreclosureCharge;
    await loan.save();

    // Mark remaining EMIs
    await EMIPayment.updateMany(
      { loanId: loan._id, status: 'Pending' },
      { $set: { status: 'Paid', paidAt: new Date() } }
    );

    await Notification.create({
      userId: req.user._id,
      title: 'Loan Foreclosed',
      message: `Loan ${loan.loanNumber} has been foreclosed. Total paid: ₹${totalPayable.toLocaleString('en-IN')}.`,
      type: 'transaction',
      priority: 'high',
    });

    res.json({
      success: true,
      message: 'Loan foreclosed successfully.',
      foreclosureDetails: { totalPayable, foreclosureCharge, outstandingBalance: 0 },
    });
  } catch (error) {
    console.error('Foreclosure error:', error);
    res.status(500).json({ success: false, message: 'Foreclosure failed.' });
  }
};

// POST /api/loans/:id/respond-info
const respondToInfoRequest = async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) {
      return res.status(400).json({ success: false, message: 'Response text is required.' });
    }

    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }

    loan.additionalInfoResponse = response;
    if (loan.status === 'More Info Required') loan.status = 'Under Review';
    if (loan.status === 'Under Review') {
      // Keep Under Review — manager will re-evaluate
    }
    await loan.save();
    await LoanApplication.findOneAndUpdate(
      { loanId: loan._id },
      { $set: { status: 'Under Review', managerDecision: '' } }
    );

    // Notify managers
    const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
    for (const mgr of managers) {
      await Notification.create({
        userId: mgr._id,
        title: 'Customer Responded to Info Request',
        message: `${req.user.name} has responded to info request for loan ${loan.loanNumber}.`,
        type: 'info',
      });
    }

    res.json({ success: true, message: 'Response submitted successfully.' });
  } catch (error) {
    console.error('Respond info error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit response.' });
  }
};

// POST /api/loans/calculate-emi (pure calculator — no DB)
const calculateEMI = async (req, res) => {
  try {
    const { amount, interestRate, tenure } = req.body;
    if (!amount || !interestRate || !tenure) {
      return res.status(400).json({ success: false, message: 'amount, interestRate, and tenure are required.' });
    }

    const { emi, totalInterest, totalRepayment } = calculateEMIValues(Number(amount), Number(interestRate), Number(tenure));
    const schedule = generateAmortizationSchedule(Number(amount), Number(interestRate), Number(tenure), new Date());

    res.json({
      success: true,
      result: {
        monthlyEMI: emi,
        totalInterest,
        totalRepayment,
        principal: Number(amount),
        interestRate: Number(interestRate),
        tenure: Number(tenure),
      },
      amortizationSchedule: schedule,
    });
  } catch (error) {
    console.error('Calculate EMI error:', error);
    res.status(500).json({ success: false, message: 'Calculation failed.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/loans/manager/requests
const getAllLoanRequests = async (req, res) => {
  try {
    const { status, loanType, classification, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (loanType) filter.loanType = loanType;
    if (classification) filter.customerClassification = classification.toUpperCase();

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { loanNumber: searchRegex },
        { customerId: searchRegex },
        { purpose: searchRegex },
      ];
    }

    const total = await Loan.countDocuments(filter);
    const loans = await Loan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'name email customerId classification phone')
      .populate('linkedAccountId', 'accountNumber accountType balance overdraftUsed overdraftLimit')
      .lean();

    res.json({
      success: true,
      loans,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get loan requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan requests.' });
  }
};

// PUT /api/loans/manager/:id/review
const reviewLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });
    if (loan.status !== 'Submitted') {
      return res.status(400).json({ success: false, message: `Cannot review a loan with status "${loan.status}".` });
    }

    loan.status = 'Under Review';
    loan.managerNote = req.body.note || '';
    await loan.save();

    await Notification.create({
      userId: loan.userId,
      title: 'Loan Under Review',
      message: `Your loan application ${loan.loanNumber} is now under review by our team.`,
      type: 'info',
    });

    res.json({ success: true, message: 'Loan status updated to Under Review.', loan });
  } catch (error) {
    console.error('Review loan error:', error);
    res.status(500).json({ success: false, message: 'Failed to update loan status.' });
  }
};

// PUT /api/loans/manager/:id/approve
const approveLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });
    if (!['Submitted', 'Under Review'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: `Cannot approve a loan with status "${loan.status}".` });
    }

    const config = await LoanConfig.findOne({ loanType: loan.loanType });
    const activeRule = await getActiveLoanRule(loan.loanType);
    const interestRate = Number(activeRule?.interestRate ?? config?.interestRate ?? loan.interestRate);
    const approvedAmount = req.body.approvedAmount || loan.amount;

    const { emi, totalInterest, totalRepayment } = calculateEMIValues(approvedAmount, interestRate, loan.tenure);

    // Determine EMI start date (1st of next month)
    const now = new Date();
    const emiStartDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    loan.status = 'Approved';
    loan.approvedAmount = approvedAmount;
    loan.interestRate = interestRate;
    loan.monthlyEMI = emi;
    loan.totalInterest = totalInterest;
    loan.totalRepayment = totalRepayment;
    loan.outstandingBalance = approvedAmount;
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    loan.emiStartDate = emiStartDate;
    loan.nextEMIDueDate = emiStartDate;
    loan.managerNote = req.body.note || loan.managerNote;
    await loan.save();

    // Disburse into linked account
    const account = await Account.findById(loan.linkedAccountId);
    if (account) {
      account.balance += approvedAmount;
      await account.save();

      loan.status = 'Disbursed';
      loan.disbursedAt = new Date();
      await loan.save();
    }

    // Generate EMI payment records (amortization)
    const schedule = generateAmortizationSchedule(approvedAmount, interestRate, loan.tenure, emiStartDate);
    const emiDocs = schedule.map((s) => ({
      loanId: loan._id,
      userId: loan.userId,
      emiNumber: s.emiNumber,
      dueDate: s.dueDate,
      principalAmount: s.principalAmount,
      interestAmount: s.interestAmount,
      emiAmount: s.emiAmount,
      outstandingAfter: s.outstandingAfter,
      status: 'Pending',
      deductedFromAccount: loan.linkedAccountId,
    }));
    await EMIPayment.insertMany(emiDocs);

    // Notify customer
    const customer = await User.findById(loan.userId);
    await Notification.create({
      userId: loan.userId,
      title: 'Loan Approved & Disbursed! 🎉',
      message: `Your ${config?.displayName || loan.loanType} loan of ₹${approvedAmount.toLocaleString('en-IN')} has been approved and disbursed. Monthly EMI: ₹${emi.toLocaleString('en-IN')}. First EMI due: ${emiStartDate.toLocaleDateString('en-IN')}.`,
      type: 'approval',
      priority: 'high',
    });

    // Send email
    if (customer?.email) {
      try {
        await sendLoanApprovedEmail(customer.email, {
          customerName: customer.name,
          loanNumber: loan.loanNumber,
          loanType: config?.displayName || loan.loanType,
          approvedAmount,
          interestRate,
          tenure: loan.tenure,
          monthlyEMI: emi,
          totalRepayment,
          firstEMIDate: emiStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
          accountNumber: loan.linkedAccountNumber,
        });
      } catch (emailErr) {
        console.error('Loan approved email failed:', emailErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Loan approved and disbursed successfully.',
      loan: {
        _id: loan._id,
        loanNumber: loan.loanNumber,
        status: loan.status,
        approvedAmount,
        monthlyEMI: emi,
        disbursedAt: loan.disbursedAt,
      },
    });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve loan.' });
  }
};

// PUT /api/loans/manager/:id/reject
const rejectLoan = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required.' });

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });
    if (!['Submitted', 'Under Review'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: `Cannot reject a loan with status "${loan.status}".` });
    }

    loan.status = 'Rejected';
    loan.rejectionReason = reason;
    await loan.save();

    const customer = await User.findById(loan.userId);
    await Notification.create({
      userId: loan.userId,
      title: 'Loan Application Rejected',
      message: `Your loan application ${loan.loanNumber} has been rejected. Reason: ${reason}`,
      type: 'rejection',
      priority: 'high',
    });

    if (customer?.email) {
      try {
        await sendLoanRejectedEmail(customer.email, {
          customerName: customer.name,
          loanNumber: loan.loanNumber,
          loanType: loan.loanType,
          amount: loan.amount,
          reason,
        });
      } catch (emailErr) {
        console.error('Loan rejected email failed:', emailErr.message);
      }
    }

    res.json({ success: true, message: 'Loan rejected.', loan });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject loan.' });
  }
};

// PUT /api/loans/manager/:id/request-info
const requestAdditionalInfo = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Info request message is required.' });

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });

    loan.additionalInfoRequest = message;
    loan.additionalInfoResponse = '';
    if (loan.status === 'Submitted') loan.status = 'Under Review';
    await loan.save();

    await Notification.create({
      userId: loan.userId,
      title: 'Additional Information Requested',
      message: `The manager has requested additional information for your loan ${loan.loanNumber}: "${message}"`,
      type: 'alert',
      priority: 'high',
    });

    res.json({ success: true, message: 'Info request sent to customer.' });
  } catch (error) {
    console.error('Request info error:', error);
    res.status(500).json({ success: false, message: 'Failed to send info request.' });
  }
};

// GET /api/loans/manager/monitoring
const getLoanMonitoring = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    // Active loans
    const activeLoans = await Loan.countDocuments({ status: 'Disbursed' });

    // Total outstanding
    const outstandingAgg = await Loan.aggregate([
      { $match: { status: 'Disbursed' } },
      { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
    ]);
    const totalOutstanding = outstandingAgg[0]?.total || 0;

    // Upcoming EMIs (next 7 days)
    const upcomingEMIs = await EMIPayment.find({
      status: 'Pending',
      dueDate: { $gte: now, $lte: sevenDaysFromNow },
    })
      .populate('loanId', 'loanNumber loanType')
      .populate('userId', 'name customerId')
      .sort({ dueDate: 1 })
      .limit(50)
      .lean();

    // Missed EMIs
    const missedEMIs = await EMIPayment.find({ status: 'Missed' })
      .populate('loanId', 'loanNumber loanType')
      .populate('userId', 'name customerId')
      .sort({ dueDate: -1 })
      .limit(50)
      .lean();

    const missedEMICount = await EMIPayment.countDocuments({ status: 'Missed' });

    // Delinquent accounts (loans with 2+ missed EMIs)
    const delinquentLoans = await Loan.find({ status: 'Disbursed', missedEMICount: { $gte: 2 } })
      .populate('userId', 'name customerId email classification')
      .select('loanNumber loanType outstandingBalance missedEMICount penaltyAmount')
      .lean();

    // Collection performance (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const collectionPerformance = await EMIPayment.aggregate([
      { $match: { dueDate: { $gte: sixMonthsAgo }, status: { $in: ['Paid', 'Missed'] } } },
      {
        $group: {
          _id: { year: { $year: '$dueDate' }, month: { $month: '$dueDate' } },
          totalCollected: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$emiAmount', 0] } },
          totalMissed: { $sum: { $cond: [{ $eq: ['$status', 'Missed'] }, '$emiAmount', 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
          missedCount: { $sum: { $cond: [{ $eq: ['$status', 'Missed'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Customer-wise outstanding
    const customerOutstanding = await Loan.aggregate([
      { $match: { status: 'Disbursed' } },
      {
        $group: {
          _id: '$userId',
          totalOutstanding: { $sum: '$outstandingBalance' },
          totalPenalties: { $sum: '$penaltyAmount' },
          loanCount: { $sum: 1 },
          missedEMIs: { $sum: '$missedEMICount' },
        },
      },
      { $sort: { totalOutstanding: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          customerId: '$user.customerId',
          name: '$user.name',
          email: '$user.email',
          classification: '$user.classification',
          totalOutstanding: 1,
          totalPenalties: 1,
          loanCount: 1,
          missedEMIs: 1,
        },
      },
    ]);

    res.json({
      success: true,
      monitoring: {
        activeLoans,
        totalOutstanding,
        upcomingEMIs,
        missedEMIs,
        missedEMICount,
        delinquentLoans,
        collectionPerformance,
        customerOutstanding,
      },
    });
  } catch (error) {
    console.error('Loan monitoring error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monitoring data.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/loans/admin/analytics
const getLoanAnalytics = async (req, res) => {
  try {
    const [
      totalApplications,
      approvedCount,
      rejectedCount,
      activeCount,
      closedCount,
      disbursedAgg,
      outstandingAgg,
      emiCollectionsAgg,
      missedEMIAccounts,
      penaltyAgg,
    ] = await Promise.all([
      Loan.countDocuments(),
      Loan.countDocuments({ status: { $in: ['Approved', 'Disbursed'] } }),
      Loan.countDocuments({ status: 'Rejected' }),
      Loan.countDocuments({ status: 'Disbursed' }),
      Loan.countDocuments({ status: 'Closed' }),
      Loan.aggregate([
        { $match: { status: { $in: ['Disbursed', 'Closed'] } } },
        { $group: { _id: null, total: { $sum: '$approvedAmount' } } },
      ]),
      Loan.aggregate([
        { $match: { status: 'Disbursed' } },
        { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
      ]),
      EMIPayment.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$emiAmount' } } },
      ]),
      Loan.countDocuments({ status: 'Disbursed', missedEMICount: { $gte: 1 } }),
      Loan.aggregate([
        { $match: { penaltyAmount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$penaltyAmount' } } },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        totalApplications,
        approvedLoans: approvedCount,
        rejectedLoans: rejectedCount,
        activeLoans: activeCount,
        closedLoans: closedCount,
        totalDisbursed: disbursedAgg[0]?.total || 0,
        totalOutstanding: outstandingAgg[0]?.total || 0,
        totalEMICollections: emiCollectionsAgg[0]?.total || 0,
        missedEMIAccounts,
        totalPenalties: penaltyAgg[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('Loan analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

// GET /api/loans/admin/charts
const getLoanChartData = async (req, res) => {
  try {
    // Loan distribution by type
    const loanDistribution = await Loan.aggregate([
      { $group: { _id: '$loanType', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]);

    // EMI collection trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const emiTrends = await EMIPayment.aggregate([
      { $match: { dueDate: { $gte: twelveMonthsAgo }, status: { $in: ['Paid', 'Missed'] } } },
      {
        $group: {
          _id: { year: { $year: '$dueDate' }, month: { $month: '$dueDate' } },
          collected: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$emiAmount', 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'Missed'] }, '$emiAmount', 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
          missedCount: { $sum: { $cond: [{ $eq: ['$status', 'Missed'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Repayment analytics (status distribution)
    const repaymentAnalytics = await EMIPayment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$emiAmount' } } },
    ]);

    // Loan status distribution
    const statusDistribution = await Loan.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Monthly loan applications trend
    const applicationTrends = await Loan.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          applications: { $sum: 1 },
          approvedAmount: {
            $sum: { $cond: [{ $in: ['$status', ['Approved', 'Disbursed', 'Closed']] }, '$approvedAmount', 0] },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      charts: {
        loanDistribution,
        emiTrends,
        repaymentAnalytics,
        statusDistribution,
        applicationTrends,
      },
    });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data.' });
  }
};

// GET /api/loans/admin/configs
const getLoanConfigs = async (req, res) => {
  try {
    const { rules } = await syncLoanRules();
    res.json({ success: true, configs: rules, rules });
  } catch (error) {
    console.error('Get loan configs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch configs.' });
  }
};

// POST/PUT /api/loans/admin/configs
const upsertLoanConfig = async (req, res) => {
  try {
    const {
      _id, loanType, displayName, interestRate, minAmount, maxAmount,
      tenureMin, tenureMax, tenureUnit, lateEmiPenalty, processingFee,
      prepaymentCharge, status, isActive,
    } = req.body;
    const targetId = req.params.id || _id;
    if (!loanType && !targetId) return res.status(400).json({ success: false, message: 'loanType is required.' });

    await syncLoanRules();
    const previousRule = targetId
      ? await LoanRule.findById(targetId).lean()
      : await LoanRule.findOne({ loanType: String(loanType || '').trim().toLowerCase().replace(/\s+/g, '-') }).lean();
    const normalizedLoanType = loanType ? String(loanType).trim().toLowerCase().replace(/\s+/g, '-') : undefined;
    const update = {};
    if (normalizedLoanType) update.loanType = normalizedLoanType;
    if (displayName !== undefined) update.displayName = displayName;
    if (!targetId && !displayName && normalizedLoanType) {
      update.displayName = `${normalizedLoanType.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} Loan`;
    }
    const setNumber = (field, value) => {
      if (value !== undefined && value !== '') update[field] = Number(value);
    };
    setNumber('interestRate', interestRate);
    setNumber('minAmount', minAmount);
    setNumber('maxAmount', maxAmount);
    setNumber('tenureMin', tenureMin);
    setNumber('tenureMax', tenureMax);
    if (tenureUnit !== undefined) update.tenureUnit = tenureUnit;
    setNumber('lateEmiPenalty', lateEmiPenalty);
    setNumber('processingFee', processingFee);
    setNumber('prepaymentCharge', prepaymentCharge);
    if (status !== undefined) update.status = status;
    if (isActive !== undefined) update.status = isActive ? 'Active' : 'Inactive';

    const rule = await LoanRule.findOneAndUpdate(
      targetId ? { _id: targetId } : { loanType: normalizedLoanType },
      { $set: update },
      { new: true, upsert: !targetId, setDefaultsOnInsert: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: 'Loan rule not found.' });
    const notificationResult = await notifyAllCustomersOfLoanRuleChange({
      previousRule,
      updatedRule: rule.toObject ? rule.toObject() : rule,
      action: previousRule ? 'updated' : 'created',
    });

    res.json({ success: true, message: 'Loan rule saved successfully.', config: rule, rule, ruleNotifications: notificationResult });
  } catch (error) {
    console.error('Upsert loan config error:', error);
    res.status(500).json({ success: false, message: 'Failed to update config.' });
  }
};

const deleteLoanConfig = async (req, res) => {
  try {
    const config = await LoanRule.findByIdAndDelete(req.params.id);
    if (!config) return res.status(404).json({ success: false, message: 'Loan rule not found.' });
    const notificationResult = await notifyAllCustomersOfLoanRuleChange({
      previousRule: config.toObject ? config.toObject() : config,
      updatedRule: null,
      action: 'deleted',
    });
    res.json({ success: true, message: 'Loan rule deleted successfully.', ruleNotifications: notificationResult });
  } catch (error) {
    console.error('Delete loan config error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete loan rule.' });
  }
};

const getAdminLoanOverview = async (req, res) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const [
      activeLoanCustomers,
      totalLoanAmountAgg,
      totalEmiCollectedAgg,
      disbursementTrend,
      loanDistribution,
      emiCollectionTrend,
    ] = await Promise.all([
      Loan.distinct('userId', { status: { $in: ['Approved', 'Disbursed'] } }),
      Loan.aggregate([
        { $match: { status: { $in: ['Approved', 'Disbursed', 'Closed'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$approvedAmount', '$amount'] } } } },
      ]),
      EMIPayment.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$emiAmount' } } },
      ]),
      Loan.aggregate([
        { $match: { disbursedAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { year: { $year: '$disbursedAt' }, month: { $month: '$disbursedAt' } }, amount: { $sum: '$approvedAmount' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Loan.aggregate([
        { $group: { _id: '$loanType', count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$approvedAmount', '$amount'] } } } },
        { $sort: { count: -1 } },
      ]),
      EMIPayment.aggregate([
        { $match: { paidAt: { $gte: twelveMonthsAgo }, status: 'Paid' } },
        { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, amount: { $sum: '$emiAmount' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      overview: {
        activeLoanCustomers: activeLoanCustomers.length,
        totalLoanAmount: totalLoanAmountAgg[0]?.total || 0,
        totalEmiCollected: totalEmiCollectedAgg[0]?.total || 0,
        disbursementTrend: disbursementTrend.map((item) => ({ month: toMonthLabel(item._id.year, item._id.month), amount: item.amount, count: item.count })),
        loanDistribution: loanDistribution.map((item) => ({ loanType: item._id || 'unknown', count: item.count, amount: item.amount })),
        emiCollectionTrend: emiCollectionTrend.map((item) => ({ month: toMonthLabel(item._id.year, item._id.month), amount: item.amount, count: item.count })),
      },
    });
  } catch (error) {
    console.error('Admin loan overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan overview.' });
  }
};

const buildAdminLoanFilter = async (query = {}) => {
  const filter = {};
  const { startDate, endDate } = parseDateRange(query);
  if (query.status === 'Overdue') {
    filter.status = 'Disbursed';
    filter.nextEMIDueDate = { $lt: new Date() };
    filter.outstandingBalance = { $gt: 0 };
  } else if (query.status) {
    filter.status = query.status === 'Pending' ? 'Submitted' : query.status;
  }
  if (query.loanType) filter.loanType = query.loanType;
  if (query.classification) filter.customerClassification = String(query.classification).toUpperCase();
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }
  if (query.search) {
    const searchRegex = new RegExp(String(query.search).trim(), 'i');
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { customerId: searchRegex },
      ],
    }).select('_id').lean();
    filter.$or = [
      { loanNumber: searchRegex },
      { customerId: searchRegex },
      { userId: { $in: users.map((user) => user._id) } },
    ];
  }
  return filter;
};

const getAdminCustomerLoans = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
    const filter = await buildAdminLoanFilter(req.query);
    const loans = await Loan.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('userId', 'name email customerId classification')
      .lean();
    const total = await Loan.countDocuments(filter);
    res.json({ success: true, loans, pagination: { total, page: pageNumber, limit: pageSize, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error('Admin customer loans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer loans.' });
  }
};

const buildAdminEmiFilter = async (query = {}) => {
  const filter = {};
  const { startDate, endDate } = parseDateRange(query);
  if (query.status === 'Overdue') {
    filter.status = { $in: ['Pending', 'Failed', 'Missed'] };
    filter.dueDate = { $lt: new Date() };
  } else if (query.status) {
    filter.status = query.status;
  }
  if (startDate || endDate) {
    filter.dueDate = filter.dueDate || {};
    if (startDate) filter.dueDate.$gte = startDate;
    if (endDate) filter.dueDate.$lte = endDate;
  }
  let searchLoanIds = null;
  let searchUserIds = null;
  if (query.loanType || query.search) {
    const loanSearch = query.search ? new RegExp(String(query.search).trim(), 'i') : null;
    const loanFilter = {};
    if (query.loanType) loanFilter.loanType = query.loanType;
    if (loanSearch) loanFilter.$or = [{ loanNumber: loanSearch }];
    const loans = await Loan.find(loanFilter).select('_id').lean();
    const loanIds = loans.map((loan) => loan._id);
    if (query.loanType) filter.loanId = { $in: loanIds };
    if (query.search) searchLoanIds = loanIds;
  }
  const customerTerm = query.customer || query.search;
  if (customerTerm) {
    const userRegex = new RegExp(String(customerTerm).trim(), 'i');
    const users = await User.find({
      $or: [
        { name: userRegex },
        { customerId: userRegex },
        { email: userRegex },
      ],
    }).select('_id').lean();
    const userIds = users.map((user) => user._id);
    if (query.customer) filter.userId = { $in: userIds };
    if (query.search) searchUserIds = userIds;
  }
  if (query.search) {
    filter.$or = [
      ...(searchLoanIds?.length ? [{ loanId: { $in: searchLoanIds } }] : []),
      ...(searchUserIds?.length ? [{ userId: { $in: searchUserIds } }] : []),
    ];
    if (filter.$or.length === 0) filter._id = null;
  }
  return filter;
};

const getAdminEMIRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
    const filter = await buildAdminEmiFilter(req.query);

    const records = await EMIPayment.find(filter)
      .sort({ dueDate: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('loanId', 'loanNumber loanType status')
      .populate('userId', 'name customerId email classification')
      .lean();
    const total = await EMIPayment.countDocuments(filter);
    const summaryAgg = await EMIPayment.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$emiAmount' } } },
    ]);
    const summary = summaryAgg.reduce((acc, item) => {
      acc[item._id] = { count: item.count, amount: item.amount };
      return acc;
    }, {});
    const overdueCount = await EMIPayment.countDocuments({ ...filter, status: { $in: ['Pending', 'Failed', 'Missed'] }, dueDate: { $lt: new Date() } });
    res.json({
      success: true,
      emis: records,
      pagination: { total, page: pageNumber, limit: pageSize, pages: Math.ceil(total / pageSize) },
      summary: {
        totalEmis: total,
        byStatus: summary,
        overdueCount,
      },
    });
  } catch (error) {
    console.error('Admin EMI records error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch EMI records.' });
  }
};

const downloadAdminCustomerLoansReport = async (req, res) => {
  try {
    const filter = await buildAdminLoanFilter(req.query);
    const loans = await Loan.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email customerId classification').lean();
    const columns = ['Customer Name', 'Customer ID', 'Email', 'Classification', 'Loan Number', 'Loan Type', 'Requested Amount', 'Approved Amount', 'Outstanding Balance', 'Interest Rate', 'Tenure', 'Status', 'Applied Date', 'Disbursed Date', 'Next EMI Date'];
    const rows = loans.map((loan) => ({
      'Customer Name': getDisplayName(loan.userId?.name),
      'Customer ID': loan.userId?.customerId || loan.customerId || '-',
      Email: loan.userId?.email || '-',
      Classification: loan.userId?.classification || loan.customerClassification || '-',
      'Loan Number': loan.loanNumber,
      'Loan Type': loan.loanType,
      'Requested Amount': loan.amount,
      'Approved Amount': loan.approvedAmount || 0,
      'Outstanding Balance': loan.outstandingBalance || 0,
      'Interest Rate': loan.interestRate,
      Tenure: loan.tenure,
      Status: loan.status,
      'Applied Date': loan.createdAt ? loan.createdAt.toISOString().slice(0, 10) : '',
      'Disbursed Date': loan.disbursedAt ? loan.disbursedAt.toISOString().slice(0, 10) : '',
      'Next EMI Date': loan.nextEMIDueDate ? loan.nextEMIDueDate.toISOString().slice(0, 10) : '',
    }));
    const totalApproved = loans.reduce((sum, loan) => sum + Number(loan.approvedAmount || 0), 0);
    const totalOutstanding = loans.reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0);
    const range = req.query.month || `${req.query.startDate || 'Start'} to ${req.query.endDate || 'Today'}`;
    sendXlsxReport(res, 'adnate-customer-loans-report.xlsx', 'Customer Loans Report', range, [
      ['Total Records', loans.length],
      ['Total Approved Amount', totalApproved],
      ['Total Outstanding Balance', totalOutstanding],
    ], columns, rows);
  } catch (error) {
    console.error('Customer loans report error:', error);
    res.status(500).json({ success: false, message: 'Failed to download customer loans report.' });
  }
};

const downloadAdminEMIReport = async (req, res) => {
  try {
    const filter = await buildAdminEmiFilter(req.query);
    const emis = await EMIPayment.find(filter)
      .sort({ dueDate: -1 })
      .populate('loanId', 'loanNumber loanType')
      .populate('userId', 'name customerId email classification')
      .lean();
    const filtered = emis.filter((emi) => (!req.query.loanType || emi.loanId?.loanType === req.query.loanType)
      && (!req.query.customer || new RegExp(req.query.customer, 'i').test(`${emi.userId?.name || ''} ${emi.userId?.customerId || ''} ${emi.userId?.email || ''}`)));
    const columns = ['Customer Name', 'Customer ID', 'Loan Number', 'Loan Type', 'EMI No', 'Due Date', 'Principal Paid', 'Interest Paid', 'EMI Amount', 'Outstanding Balance', 'Status', 'Paid Date', 'Payment Mode'];
    const rows = filtered.map((emi) => ({
      'Customer Name': getDisplayName(emi.userId?.name),
      'Customer ID': emi.userId?.customerId || '-',
      'Loan Number': emi.loanId?.loanNumber || '-',
      'Loan Type': emi.loanId?.loanType || '-',
      'EMI No': emi.emiNumber,
      'Due Date': emi.dueDate ? emi.dueDate.toISOString().slice(0, 10) : '',
      'Principal Paid': emi.principalPaid || 0,
      'Interest Paid': emi.interestPaid || 0,
      'EMI Amount': emi.emiAmount || 0,
      'Outstanding Balance': emi.outstandingAfter || 0,
      Status: emi.status,
      'Paid Date': emi.paidAt ? emi.paidAt.toISOString().slice(0, 10) : '',
      'Payment Mode': emi.transactionRef ? 'Auto/Online Debit' : '-',
    }));
    const countByStatus = (status) => filtered.filter((emi) => emi.status === status).length;
    const totalCollection = filtered.filter((emi) => emi.status === 'Paid').reduce((sum, emi) => sum + Number(emi.emiAmount || 0), 0);
    const overdue = filtered.filter((emi) => ['Pending', 'Failed', 'Missed'].includes(emi.status) && new Date(emi.dueDate) < new Date()).length;
    const range = req.query.month || `${req.query.startDate || 'Start'} to ${req.query.endDate || 'Today'}`;
    sendCsvReport(res, 'adnate-emi-report.csv', 'EMI Management Report', range, [
      ['Total Records', filtered.length],
      ['EMIs Collected', countByStatus('Paid')],
      ['Pending EMIs', countByStatus('Pending')],
      ['Missed EMIs', countByStatus('Missed')],
      ['Failed EMIs', countByStatus('Failed')],
      ['Overdue EMIs', overdue],
      ['Total Collection Amount', totalCollection],
    ], columns, rows);
  } catch (error) {
    console.error('EMI report error:', error);
    res.status(500).json({ success: false, message: 'Failed to download EMI report.' });
  }
};

const parseMonthRange = (month) => {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) return null;
  return {
    startDate: new Date(year, monthNumber - 1, 1),
    endDate: new Date(year, monthNumber, 0, 23, 59, 59, 999),
    label: `${year}-${String(monthNumber).padStart(2, '0')}`,
  };
};

const downloadAdminCustomerLoansMonthlyReport = async (req, res) => {
  try {
    const range = parseMonthRange(req.query.month);
    if (!range) return res.status(400).json({ success: false, message: 'Valid month is required in YYYY-MM format.' });

    const monthFilter = {
      $or: [
        { createdAt: { $gte: range.startDate, $lte: range.endDate } },
        { approvedAt: { $gte: range.startDate, $lte: range.endDate } },
        { disbursedAt: { $gte: range.startDate, $lte: range.endDate } },
        { closedAt: { $gte: range.startDate, $lte: range.endDate } },
        { status: 'Rejected', updatedAt: { $gte: range.startDate, $lte: range.endDate } },
      ],
    };
    const loans = await Loan.find(monthFilter).sort({ createdAt: -1 }).populate('userId', 'name email customerId classification').lean();
    const columns = ['Customer Name', 'Customer ID', 'Email', 'Classification', 'Loan Number', 'Loan Type', 'Requested Amount', 'Approved Amount', 'Outstanding Balance', 'Interest Rate', 'Tenure', 'Status', 'Applied Date', 'Approved Date', 'Rejected Date', 'Disbursed Date', 'Next EMI Date'];
    const rows = loans.map((loan) => ({
      'Customer Name': getDisplayName(loan.userId?.name),
      'Customer ID': loan.userId?.customerId || loan.customerId || '-',
      Email: loan.userId?.email || '-',
      Classification: loan.userId?.classification || loan.customerClassification || '-',
      'Loan Number': loan.loanNumber || '-',
      'Loan Type': loan.loanType || '-',
      'Requested Amount': loan.amount || 0,
      'Approved Amount': loan.approvedAmount || 0,
      'Outstanding Balance': loan.outstandingBalance || 0,
      'Interest Rate': loan.interestRate || 0,
      Tenure: loan.tenure || 0,
      Status: loan.status || '-',
      'Applied Date': loan.createdAt ? loan.createdAt.toISOString().slice(0, 10) : '',
      'Approved Date': loan.approvedAt ? loan.approvedAt.toISOString().slice(0, 10) : '',
      'Rejected Date': loan.status === 'Rejected' && loan.updatedAt ? loan.updatedAt.toISOString().slice(0, 10) : '',
      'Disbursed Date': loan.disbursedAt ? loan.disbursedAt.toISOString().slice(0, 10) : '',
      'Next EMI Date': loan.nextEMIDueDate ? loan.nextEMIDueDate.toISOString().slice(0, 10) : '',
    }));
    const countByStatus = (status) => loans.filter((loan) => loan.status === status).length;
    sendXlsxReport(res, `adnate-customer-loans-monthly-${range.label}.xlsx`, 'Monthly Customer Loans Report', range.label, [
      ['Total Applications', loans.length],
      ['Approved Loans', countByStatus('Approved')],
      ['Rejected Loans', countByStatus('Rejected')],
      ['Disbursed Loans', countByStatus('Disbursed')],
      ['Closed Loans', countByStatus('Closed')],
      ['Total Requested Amount', loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0)],
      ['Total Approved Amount', loans.reduce((sum, loan) => sum + Number(loan.approvedAmount || 0), 0)],
      ['Total Outstanding Amount', loans.reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0)],
    ], columns, rows);
  } catch (error) {
    console.error('Monthly customer loans report error:', error);
    res.status(500).json({ success: false, message: 'Failed to download monthly customer loans report.' });
  }
};

const downloadAdminEMIMonthlyReport = async (req, res) => {
  try {
    const range = parseMonthRange(req.query.month);
    if (!range) return res.status(400).json({ success: false, message: 'Valid month is required in YYYY-MM format.' });

    const monthFilter = {
      $or: [
        { dueDate: { $gte: range.startDate, $lte: range.endDate } },
        { paidAt: { $gte: range.startDate, $lte: range.endDate } },
      ],
    };
    const emis = await EMIPayment.find(monthFilter)
      .sort({ dueDate: -1 })
      .populate('loanId', 'loanNumber loanType')
      .populate('userId', 'name customerId email classification')
      .lean();
    const columns = ['Customer Name', 'Customer ID', 'Loan Number', 'Loan Type', 'EMI No', 'Due Date', 'Principal Paid', 'Interest Paid', 'EMI Amount', 'Outstanding Balance', 'Status', 'Paid Date', 'Payment Mode'];
    const rows = emis.map((emi) => ({
      'Customer Name': getDisplayName(emi.userId?.name),
      'Customer ID': emi.userId?.customerId || '-',
      'Loan Number': emi.loanId?.loanNumber || '-',
      'Loan Type': emi.loanId?.loanType || '-',
      'EMI No': emi.emiNumber,
      'Due Date': emi.dueDate ? emi.dueDate.toISOString().slice(0, 10) : '',
      'Principal Paid': emi.principalPaid || 0,
      'Interest Paid': emi.interestPaid || 0,
      'EMI Amount': emi.emiAmount || 0,
      'Outstanding Balance': emi.outstandingAfter || 0,
      Status: emi.status || '-',
      'Paid Date': emi.paidAt ? emi.paidAt.toISOString().slice(0, 10) : '',
      'Payment Mode': emi.transactionRef ? 'Auto/Online Debit' : '-',
    }));
    const countByStatus = (status) => emis.filter((emi) => emi.status === status).length;
    const overdue = emis.filter((emi) => ['Pending', 'Failed', 'Missed'].includes(emi.status) && new Date(emi.dueDate) < new Date()).length;
    sendXlsxReport(res, `adnate-emi-monthly-${range.label}.xlsx`, 'Monthly EMI Report', range.label, [
      ['Total EMIs', emis.length],
      ['Paid EMIs', countByStatus('Paid')],
      ['Pending EMIs', countByStatus('Pending')],
      ['Missed EMIs', countByStatus('Missed')],
      ['Overdue EMIs', overdue],
      ['Total EMI Amount', emis.reduce((sum, emi) => sum + Number(emi.emiAmount || 0), 0)],
      ['Total Collected Amount', emis.filter((emi) => emi.status === 'Paid').reduce((sum, emi) => sum + Number(emi.emiAmount || 0), 0)],
      ['Total Outstanding Amount', emis.reduce((sum, emi) => sum + Number(emi.outstandingAfter || 0), 0)],
    ], columns, rows);
  } catch (error) {
    console.error('Monthly EMI report error:', error);
    res.status(500).json({ success: false, message: 'Failed to download monthly EMI report.' });
  }
};

// GET /api/loans/admin/delinquent
const getDelinquentReport = async (req, res) => {
  try {
    const delinquentLoans = await Loan.find({
      status: 'Disbursed',
      missedEMICount: { $gte: 1 },
    })
      .populate('userId', 'name customerId email classification phone')
      .select('loanNumber loanType amount approvedAmount outstandingBalance missedEMICount penaltyAmount monthlyEMI nextEMIDueDate')
      .sort({ missedEMICount: -1 })
      .lean();

    res.json({ success: true, delinquentLoans });
  } catch (error) {
    console.error('Delinquent report error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delinquent report.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMI AUTOMATION (called from server/index.js scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

const processAutomatedEMIDeductions = async () => {
  const now = new Date();
  console.log(`[EMI Scheduler] Running automated EMI deductions at ${now.toISOString()}`);

  try {
    // Find all pending EMIs that are due
    const dueEMIs = await EMIPayment.find({
      status: 'Pending',
      dueDate: { $lte: now },
    }).sort({ dueDate: 1 });

    let processed = 0;
    let paid = 0;
    let missed = 0;

    for (const emi of dueEMIs) {
      try {
        const loan = await Loan.findById(emi.loanId);
        if (!loan || loan.status !== 'Disbursed') continue;

        const account = await Account.findById(loan.linkedAccountId);
        if (!account) continue;

        const dueMonthStart = new Date(emi.dueDate.getFullYear(), emi.dueDate.getMonth(), 1);
        const dueMonthEnd = new Date(emi.dueDate.getFullYear(), emi.dueDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const alreadyPaidThisMonth = await EMIPayment.findOne({
          _id: { $ne: emi._id },
          loanId: loan._id,
          status: 'Paid',
          $or: [
            { dueDate: { $gte: dueMonthStart, $lte: dueMonthEnd } },
            { paidAt: { $gte: dueMonthStart, $lte: dueMonthEnd } },
          ],
        }).select('_id');
        if (alreadyPaidThisMonth) continue;

        processed++;

        if (account.balance >= emi.emiAmount) {
          // Sufficient balance — deduct EMI
          account.balance -= emi.emiAmount;
          await account.save();

          emi.status = 'Paid';
          emi.paidAt = new Date();
          emi.principalPaid = emi.principalAmount;
          emi.interestPaid = emi.interestAmount;
          emi.transactionRef = `EMI-${loan.loanNumber}-${emi.emiNumber}`;
          emi.paymentMode = 'Auto Debit';
          emi.deductedFromAccount = account._id;
          emi.failureReason = '';
          emi.outstandingAfter = Math.max(0, Math.round(((loan.outstandingBalance || loan.approvedAmount) - emi.principalAmount) * 100) / 100);
          await emi.save();

          loan.outstandingBalance = emi.outstandingAfter;
          loan.totalEMIsPaid = (loan.totalEMIsPaid || 0) + 1;

          // Set next EMI due date
          const nextEMI = await EMIPayment.findOne({
            loanId: loan._id,
            status: 'Pending',
            emiNumber: { $gt: emi.emiNumber },
          }).sort({ emiNumber: 1 });

          if (nextEMI) {
            loan.nextEMIDueDate = nextEMI.dueDate;
          } else {
            // All EMIs paid — close the loan
            loan.status = 'Closed';
            loan.closedAt = new Date();
            loan.nextEMIDueDate = null;
          }
          await loan.save();

          // Dashboard notification
          await Notification.create({
            userId: loan.userId,
            title: 'EMI Deducted Successfully',
            message: `EMI #${emi.emiNumber} of ₹${emi.emiAmount.toLocaleString('en-IN')} for loan ${loan.loanNumber} has been deducted. Outstanding: ₹${loan.outstandingBalance.toLocaleString('en-IN')}.`,
            type: 'transaction',
          });

          paid++;
        } else {
          // Insufficient balance — mark as missed
          const config = await LoanConfig.findOne({ loanType: loan.loanType });
          const penaltyRate = config?.penaltyRate || 2;
          const penalty = Math.round(emi.emiAmount * penaltyRate / 100 * 100) / 100;

          emi.status = 'Missed';
          emi.penalty = penalty;
          await emi.save();

          loan.missedEMICount = (loan.missedEMICount || 0) + 1;
          loan.penaltyAmount = (loan.penaltyAmount || 0) + penalty;
          await loan.save();

          // Dashboard notification
          await Notification.create({
            userId: loan.userId,
            title: '⚠️ EMI Payment Missed',
            message: `EMI #${emi.emiNumber} of ₹${emi.emiAmount.toLocaleString('en-IN')} for loan ${loan.loanNumber} could not be deducted due to insufficient balance. A penalty of ₹${penalty.toLocaleString('en-IN')} has been applied.`,
            type: 'alert',
            priority: 'high',
          });

          // Send email
          const customer = await User.findById(loan.userId);
          if (customer?.email) {
            try {
              const { sendEMIMissedEmail } = require('../utils/emailService');
              await sendEMIMissedEmail(customer.email, {
                customerName: customer.name,
                loanNumber: loan.loanNumber,
                emiNumber: emi.emiNumber,
                emiAmount: emi.emiAmount,
                penalty,
                outstandingBalance: loan.outstandingBalance,
                dueDate: emi.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
              });
            } catch (emailErr) {
              console.error(`EMI missed email failed for ${customer.email}:`, emailErr.message);
            }
          }

          missed++;
        }
      } catch (emiErr) {
        console.error(`EMI processing failed for EMI ${emi._id}:`, emiErr.message);
      }
    }

    if (processed > 0) {
      console.log(`[EMI Scheduler] Processed ${processed} EMIs: ${paid} paid, ${missed} missed.`);
    }
  } catch (error) {
    console.error('[EMI Scheduler] Fatal error:', error.message);
  }
};

module.exports = {
  // Customer
  applyForLoan,
  getMyLoans,
  getLoanDetails,
  getEMIHistory,
  payEMI,
  makePartPayment,
  forecloseLoan,
  getFullRepaymentQuote,
  closeFullLoan,
  respondToInfoRequest,
  calculateEMI,
  // Manager
  getAllLoanRequests,
  reviewLoan,
  approveLoan,
  rejectLoan,
  requestAdditionalInfo,
  getLoanMonitoring,
  // Admin
  getLoanAnalytics,
  getLoanChartData,
  getAdminLoanOverview,
  getLoanConfigs,
  upsertLoanConfig,
  deleteLoanConfig,
  getAdminCustomerLoans,
  getAdminEMIRecords,
  downloadAdminCustomerLoansReport,
  downloadAdminEMIReport,
  downloadAdminCustomerLoansMonthlyReport,
  downloadAdminEMIMonthlyReport,
  getDelinquentReport,
  // Automation
  ensureEMISchedule,
  processAutomatedEMIDeductions,
};


