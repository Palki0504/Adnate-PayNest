const XLSX = require('xlsx');
const FixedDeposit = require('../models/FixedDeposit');
const RecurringDeposit = require('../models/RecurringDeposit');
const InvestmentRule = require('../models/InvestmentRule');
const { ensureDefaultInvestmentRules, ALLOWED_TENURES } = require('../models/InvestmentRule');
const Classification = require('../models/Classification');
const Account = require('../models/Account');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { sendInvestmentEmail } = require('../utils/emailService');
const { getDisplayName } = require('../utils/nameFormat');
const {
  calculateRDMaturity,
  calculateRDPrematureClosure,
} = require('../utils/rdCalculator');

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + Number(months), date.getDate());
const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const PREMATURE_PENALTY_MULTIPLIER = 2;
const parseStartDate = (value) => {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};
const isPastDate = (date) => startOfDay(date) < startOfDay(new Date());
const appliedPrematurePenaltyRate = (baseRate) => round(Number(baseRate || 0) * PREMATURE_PENALTY_MULTIPLIER);
const DAY_MS = 24 * 60 * 60 * 1000;

const diffDays = (from, to) => {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.max(0, Math.floor((end - start) / DAY_MS));
};

const completedPeriodLabel = (startDate, endDate) => {
  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  if (end <= start) return '0 days';
  let months = 0;
  let cursor = new Date(start);
  while (addMonths(cursor, 1) <= end) {
    cursor = addMonths(cursor, 1);
    months += 1;
  }
  const days = diffDays(cursor, end);
  return [
    months ? `${months} month${months === 1 ? '' : 's'}` : '',
    days ? `${days} day${days === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' and ') || '0 days';
};

const dailyInterest = (amount, annualRate, days) => round((Number(amount || 0) * Number(annualRate || 0) * Number(days || 0)) / 36500);

const buildFDPrematureCalculation = async (fd, withdrawalDate = new Date()) => {
  const rule = await getRule('FD');
  const requestDate = new Date(withdrawalDate);
  const startDate = fd.startDate || fd.approvedAt || fd.createdAt || requestDate;
  const totalDays = diffDays(startDate, requestDate);
  const principal = round(fd.depositAmount);
  const adminPenaltyRate = round(rule?.prematureWithdrawalPenalty ?? rule?.prematurePenalty ?? 0);
  const appliedPenaltyRate = appliedPrematurePenaltyRate(adminPenaltyRate);
  const accruedInterest = dailyInterest(principal, fd.interestRate, totalDays);
  const penaltyAmount = round(principal * appliedPenaltyRate / 100);
  const revisedPayoutAmount = round(Math.max(0, principal + accruedInterest - penaltyAmount));
  return {
    productType: 'FD',
    fdId: fd.fdId,
    principalAmount: principal,
    depositAmount: principal,
    startDate,
    withdrawalRequestDate: requestDate,
    completedDays: totalDays,
    completedPeriod: completedPeriodLabel(startDate, requestDate),
    interestRate: Number(fd.interestRate || 0),
    actualAccruedInterest: accruedInterest,
    accruedInterest,
    adminPenaltyRate,
    appliedPenaltyRate,
    penaltyMultiplier: PREMATURE_PENALTY_MULTIPLIER,
    penaltyAmount,
    revisedPayoutAmount,
    reason: fd.prematureWithdrawalRequest?.reason || '',
    penaltyBaseAmount: principal,
    formula: 'Principal + Actual Accrued Interest Till Withdrawal Date - Penalty Amount',
  };
};

const buildRDPrematureCalculation = async (rd, withdrawalDate = new Date()) => {
  const rule = await getRule('RD');
  const requestDate = new Date(withdrawalDate);
  const premature = calculateRDPrematureClosure({ rd, withdrawalDate: requestDate });
  const paidInstallments = premature.installmentBreakdown;
  const depositedAmount = premature.totalDepositedAmount;
  const startDate = rd.startDate || rd.approvedAt || rd.createdAt || requestDate;
  const totalDays = diffDays(startDate, requestDate);
  const adminPenaltyRate = round(rule?.prematureClosurePenalty ?? rule?.prematurePenalty ?? 0);
  const appliedPenaltyRate = appliedPrematurePenaltyRate(adminPenaltyRate);
  const accruedInterest = premature.interestEarned;
  const penaltyAmount = round(depositedAmount * appliedPenaltyRate / 100);
  const revisedPayoutAmount = round(Math.max(0, depositedAmount + accruedInterest - penaltyAmount));
  return {
    productType: 'RD',
    rdId: rd.rdId,
    totalDepositedAmount: depositedAmount,
    depositAmount: depositedAmount,
    paidInstallmentsCount: paidInstallments.length,
    installmentBreakdown: paidInstallments,
    startDate,
    withdrawalRequestDate: requestDate,
    completedDays: totalDays,
    completedPeriod: completedPeriodLabel(startDate, requestDate),
    interestRate: Number(rd.interestRate || 0),
    actualAccruedInterest: accruedInterest,
    accruedInterest,
    adminPenaltyRate,
    appliedPenaltyRate,
    penaltyMultiplier: PREMATURE_PENALTY_MULTIPLIER,
    penaltyBaseAmount: depositedAmount,
    penaltyAmount,
    revisedPayoutAmount,
    reason: rd.prematureClosureRequest?.reason || '',
    formula: 'Deposited Amount Till Date + Actual Accrued Interest Till Withdrawal Date - Penalty Amount',
  };
};

const fdMaturity = (amount, tenureMonths, annualRate) => {
  const principal = Number(amount || 0);
  const years = Number(tenureMonths || 0) / 12;
  const maturityAmount = round(principal * Math.pow(1 + (Number(annualRate || 0) / 100) / 4, 4 * years));
  return { maturityAmount, accruedInterest: round(maturityAmount - principal) };
};

const rdMaturity = (monthlyContribution, tenureMonths, annualRate, startDate = new Date()) => {
  return calculateRDMaturity({
    monthlyContribution,
    tenure: tenureMonths,
    annualRate,
    startDate,
  });
};

const getClassification = async (user, account) => (
  String(account?.classification || user?.classification || user?.customerClassification || 'SILVER').toUpperCase()
);

const getRule = async (type) => {
  await ensureDefaultInvestmentRules();
  return InvestmentRule.findOne({ type });
};

const getRuleTenures = (rule) => (
  (rule?.allowedTenures?.length ? rule.allowedTenures : rule?.tenureOptions || [])
    .map(Number)
    .filter((tenure) => ALLOWED_TENURES.includes(tenure))
);

const getRuleRate = (rule, classification) => {
  if (typeof rule.getRateForClassification === 'function') return rule.getRateForClassification(classification);
  const key = String(classification || 'SILVER').toUpperCase();
  const match = (rule.classificationInterestRates || []).find((item) => (
    String(item.classificationName || item.classification || '').toUpperCase() === key
  ));
  return Number(match?.interestRate ?? rule.classificationInterestRates?.[0]?.interestRate ?? 0);
};

const normalizeRule = (rule) => {
  if (!rule) return null;
  const doc = typeof rule.toObject === 'function' ? rule.toObject() : { ...rule };
  doc.allowedTenures = getRuleTenures(doc);
  doc.tenureOptions = doc.allowedTenures;
  doc.classificationInterestRates = (doc.classificationInterestRates || []).map((item) => ({
    classificationId: item.classificationId,
    classificationName: String(item.classificationName || item.classification || '').toUpperCase(),
    classification: String(item.classificationName || item.classification || '').toUpperCase(),
    interestRate: Number(item.interestRate || 0),
  }));
  return doc;
};

const monthRange = (month, year) => {
  const now = new Date();
  const numericMonth = Number(month || now.getMonth() + 1);
  const numericYear = Number(year || now.getFullYear());
  const start = new Date(numericYear, numericMonth - 1, 1);
  const end = new Date(numericYear, numericMonth, 1);
  return { start, end, label: `${numericYear}-${String(numericMonth).padStart(2, '0')}` };
};

const escapePdf = (value) => String(value ?? '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const createSimplePdf = (title, rows) => {
  const lines = [
    title,
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    '',
    ...(rows.length ? rows : [{ Message: 'No records found' }]).flatMap((row, index) => [
      `Record ${index + 1}`,
      ...Object.entries(row).map(([key, value]) => `${key}: ${value instanceof Date ? value.toLocaleDateString('en-IN') : value}`),
      '',
    ]),
  ];
  const pages = [];
  for (let index = 0; index < lines.length; index += 38) pages.push(lines.slice(index, index + 38));
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageRefs = [];
  pages.forEach((pageLines) => {
    const content = [
      'BT',
      '/F1 10 Tf',
      '40 790 Td',
      ...pageLines.map((line, lineIndex) => `${lineIndex === 0 ? '' : '0 -18 Td '}(${escapePdf(line).slice(0, 130)}) Tj`),
      'ET',
    ].join('\n');
    const contentId = objects.length;
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageId = objects.length;
    pageRefs.push(pageId);
    objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 2 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;
  const catalogId = objects.length;
  objects.push('<< /Type /Catalog /Pages 1 0 R >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf);
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const sameList = (left = [], right = []) => (
  [...left].map(Number).sort((a, b) => a - b).join(',') === [...right].map(Number).sort((a, b) => a - b).join(',')
);

const valuesDiffer = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) return !sameList(left || [], right || []);
  return String(left ?? '') !== String(right ?? '');
};

const notifyCustomers = async ({ customers, title, message, link, emailData }) => {
  await Promise.all(customers.map(async (customer) => {
    await Notification.create({
      userId: customer._id,
      title,
      message,
      type: 'info',
      priority: 'medium',
      link,
    }).catch(() => {});
    if (customer.email) {
      await sendInvestmentEmail(customer.email, emailData(customer)).catch((error) => {
        console.error('Investment rule update email error:', error.message);
      });
    }
  }));
};

const notifyInvestmentRuleChanges = async (previousRule, updatedRule) => {
  const ruleType = updatedRule.type;
  const previousRates = previousRule?.classificationInterestRates || [];
  const updatedRates = updatedRule.classificationInterestRates || [];
  const changedRates = updatedRates.filter((rate) => {
    const previous = previousRates.find((item) => item.classificationName === rate.classificationName);
    return previous && Number(previous.interestRate) !== Number(rate.interestRate);
  });
  const commonFields = ruleType === 'FD'
    ? [
        ['Minimum Amount', 'minAmount'],
        ['Maximum Amount', 'maxAmount'],
        ['Premature Withdrawal Penalty', 'prematureWithdrawalPenalty'],
        ['Auto Renewal Allowed', 'autoRenewalAllowed'],
        ['Allowed Tenures', 'allowedTenures'],
      ]
    : [
        ['Minimum Monthly Amount', 'minMonthlyAmount'],
        ['Maximum Monthly Amount', 'maxMonthlyAmount'],
        ['Premature Closure Penalty', 'prematureClosurePenalty'],
        ['Missed Installment Penalty', 'missedInstallmentPenalty'],
        ['Auto Debit Allowed', 'autoDebitAllowed'],
        ['Allowed Tenures', 'allowedTenures'],
      ];
  const changedCommonFields = previousRule
    ? commonFields.filter(([, key]) => valuesDiffer(previousRule[key], updatedRule[key]))
    : [];
  let notifiedCustomers = 0;

  if (changedCommonFields.length) {
    const customers = await User.find({ role: 'customer', isActive: true }).select('name email classification').lean();
    notifiedCustomers += customers.length;
    await notifyCustomers({
      customers,
      title: `${ruleType} Rules Updated`,
      message: `${ruleType} rules have been updated by the bank administrator.`,
      link: `/customer-dashboard/investments/${ruleType.toLowerCase()}`,
      emailData: (customer) => ({
        subject: `${ruleType} Rules Updated - Adnate PayNest`,
        heading: `${ruleType} Rules Updated`,
        details: [
          ['Customer Name', getDisplayName(customer.name)],
          ['Classification', customer.classification || '-'],
          ['Updated Rule Fields', changedCommonFields.map(([label]) => label).join(', ')],
          ['Effective Date', new Date().toLocaleDateString('en-IN')],
        ],
        message: `The common ${ruleType} rules have been revised. These changes apply to all customers for future requests and eligible updates as per bank policy.`,
      }),
    });
  }

  for (const rate of changedRates) {
    const previous = previousRates.find((item) => item.classificationName === rate.classificationName);
    const customers = await User.find({
      role: 'customer',
      isActive: true,
      classification: rate.classificationName,
    }).select('name email classification').lean();
    notifiedCustomers += customers.length;
    await notifyCustomers({
      customers,
      title: `${ruleType} Interest Rate Updated`,
      message: `${ruleType} interest rate for ${rate.classificationName} customers changed from ${previous.interestRate}% to ${rate.interestRate}%.`,
      link: `/customer-dashboard/investments/${ruleType.toLowerCase()}`,
      emailData: (customer) => ({
          subject: `${ruleType} Interest Rate Revised - Adnate PayNest`,
          heading: `${ruleType} Interest Rate Revised`,
          details: [
            ['Customer Name', getDisplayName(customer.name)],
            ['Classification', rate.classificationName],
            ['Previous Interest Rate', `${previous.interestRate}% p.a.`],
            ['Updated Interest Rate', `${rate.interestRate}% p.a.`],
            ['Effective Date', new Date().toLocaleDateString('en-IN')],
          ],
          message: `The ${ruleType} interest rate for your customer classification has been revised. New requests and eligible renewals will use the updated rate as per bank policy.`,
      }),
    });
  }
  return { changedRates, changedCommonFields, notifiedCustomers };
};

const notifyCustomer = async ({ userId, title, message, type = 'info', link }) => {
  const inferredLink = String(title || '').toUpperCase().includes('RD')
    ? '/customer-dashboard/investments/rd'
    : '/customer-dashboard/investments/fd';
  await Notification.create({ userId, title, message, type, priority: 'medium', link: link || inferredLink }).catch(() => {});
};

const notifyManagers = async ({ title, message }) => {
  const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
  await Promise.all(managers.map((manager) => Notification.create({
    userId: manager._id,
    title,
    message,
    type: 'approval',
    priority: 'high',
    link: '/manager-dashboard/investments',
  }).catch(() => {})));
};

const emailCustomer = async (user, subject, heading, details, message) => {
  if (!user?.email) return;
  await sendInvestmentEmail(user.email, { subject, heading, details, message }).catch((error) => {
    console.error('Investment email error:', error.message);
  });
};

const buildInstallments = (startDate, tenure, amount) => (
  Array.from({ length: Number(tenure || 0) }, (_, index) => ({
    installmentNo: index + 1,
    dueDate: addMonths(startDate, index),
    amount,
    status: 'Pending',
  }))
);

const getBootstrap = async (req, res) => {
  try {
    await ensureDefaultInvestmentRules();
    const [rules, classifications] = await Promise.all([
      InvestmentRule.find().sort({ type: 1 }).lean(),
      Classification.find({ isActive: true }).sort({ name: 1 }).lean(),
    ]);
    res.json({ success: true, rules: rules.map(normalizeRule), classifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load investment rules.' });
  }
};

const calculateFD = async (req, res) => {
  try {
    const { amount, tenure, classification, startDate } = req.body;
    const rule = await getRule('FD');
    if (!getRuleTenures(rule).includes(Number(tenure))) {
      return res.status(400).json({ success: false, message: 'Selected FD tenure is not available.' });
    }
    const interestRate = getRuleRate(rule, classification || req.user.classification || req.user.customerClassification);
    const result = fdMaturity(amount, tenure, interestRate);
    const effectiveStartDate = startDate ? new Date(startDate) : new Date();
    res.json({
      success: true,
      interestRate,
      startDate: effectiveStartDate,
      maturityDate: addMonths(effectiveStartDate, tenure),
      interestEarned: result.accruedInterest,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'FD calculation failed.' });
  }
};

const calculateRD = async (req, res) => {
  try {
    const { monthlyContribution, tenure, classification, startDate } = req.body;
    const rule = await getRule('RD');
    if (!getRuleTenures(rule).includes(Number(tenure))) {
      return res.status(400).json({ success: false, message: 'Selected RD tenure is not available.' });
    }
    const interestRate = getRuleRate(rule, classification || req.user.customerClassification);
    const effectiveStartDate = parseStartDate(startDate);
    if (Number.isNaN(effectiveStartDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Please select a valid RD start date.' });
    }
    if (isPastDate(effectiveStartDate)) {
      return res.status(400).json({ success: false, message: 'Start date cannot be in the past.' });
    }
    const result = rdMaturity(monthlyContribution, tenure, interestRate, effectiveStartDate);
    res.json({
      success: true,
      interestRate,
      startDate: result.startDate,
      monthlyDebitDate: result.startDate,
      maturityDate: result.maturityDate,
      totalDepositedAmount: result.totalDepositedAmount,
      interestEarned: result.interestEarned,
      accruedInterest: result.accruedInterest,
      expectedMaturityAmount: result.expectedMaturityAmount,
      maturityAmount: result.maturityAmount,
      installmentBreakdown: result.installmentBreakdown,
    });
  } catch (error) {
    console.error('RD calculation error:', error);
    res.status(500).json({ success: false, message: 'RD calculation failed.' });
  }
};

const createFD = async (req, res) => {
  try {
    const { linkedAccountId, depositAmount, tenure, startDate, autoRenewal = false, maturityInstruction } = req.body;
    const account = await Account.findOne({ _id: linkedAccountId, userId: req.user._id, status: 'active' });
    if (!account) return res.status(400).json({ success: false, message: 'Selected linked account is invalid.' });
    if (Number(account.balance || 0) < Number(depositAmount || 0)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance in selected account for this FD request.' });
    }
    const rule = await getRule('FD');
    if (depositAmount < rule.minAmount || depositAmount > rule.maxAmount) {
      return res.status(400).json({ success: false, message: `FD amount must be between ${money(rule.minAmount)} and ${money(rule.maxAmount)}.` });
    }
    if (!getRuleTenures(rule).includes(Number(tenure))) {
      return res.status(400).json({ success: false, message: 'Selected FD tenure is not available.' });
    }
    const duplicate = await FixedDeposit.findOne({
      userId: req.user._id,
      customerId: req.user.customerId,
      linkedAccountId: account._id,
      depositAmount: Number(depositAmount),
      tenure: Number(tenure),
      status: 'Pending',
      managerApprovalStatus: { $in: ['Pending', 'Pending Manager Approval', null] },
    }).lean();
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This request is already pending for manager approval.',
        existingRequest: duplicate,
      });
    }
    const classification = await getClassification(req.user, account);
    const interestRate = getRuleRate(rule, classification);
    const effectiveStartDate = parseStartDate(startDate);
    if (Number.isNaN(effectiveStartDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Please select a valid FD start date.' });
    }
    if (isPastDate(effectiveStartDate)) {
      return res.status(400).json({ success: false, message: 'Start date cannot be in the past.' });
    }
    const { maturityAmount, accruedInterest } = fdMaturity(depositAmount, tenure, interestRate);
    const fd = await FixedDeposit.create({
      userId: req.user._id,
      customerId: req.user.customerId,
      customerName: req.user.name,
      linkedAccountId: account._id,
      linkedAccountNumber: account.accountNumber,
      accountType: account.accountType,
      classification,
      depositAmount,
      interestRate,
      tenure,
      startDate: effectiveStartDate,
      maturityDate: addMonths(effectiveStartDate, tenure),
      maturityAmount,
      interestEarned: accruedInterest,
      accruedInterest,
      autoRenewal,
      maturityInstruction: maturityInstruction || 'Credit to linked account',
    });
    await notifyCustomer({ userId: req.user._id, title: 'FD Request Submitted', message: `Your FD request ${fd.fdId} for ${money(depositAmount)} has been sent for manager approval.` });
    await notifyManagers({ title: 'New FD Request', message: `${req.user.name} submitted FD request ${fd.fdId} for ${money(depositAmount)}.` });
    await emailCustomer(req.user, 'FD Request Submitted', 'Fixed Deposit Request Submitted', [
      ['FD ID', fd.fdId],
      ['Deposit Amount', money(fd.depositAmount)],
      ['Linked Account', fd.linkedAccountNumber],
      ['Tenure', `${fd.tenure} months`],
      ['Interest Rate', `${fd.interestRate}% p.a.`],
      ['Start Date', fd.startDate?.toLocaleDateString('en-IN')],
      ['Maturity Date', fd.maturityDate?.toLocaleDateString('en-IN')],
      ['Interest Earned', money(fd.interestEarned)],
      ['Maturity Amount', money(fd.maturityAmount)],
    ], 'Your FD request is pending manager approval.');
    res.status(201).json({ success: true, message: 'FD request submitted successfully and sent to Manager for approval.', fd });
  } catch (error) {
    console.error('Create FD error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This request is already pending for manager approval.' });
    }
    res.status(500).json({ success: false, message: 'Failed to create FD request.' });
  }
};

const createRD = async (req, res) => {
  try {
    const { linkedAccountId, monthlyContribution, tenure, startDate } = req.body;
    const account = await Account.findOne({ _id: linkedAccountId, userId: req.user._id, status: 'active' });
    if (!account) return res.status(400).json({ success: false, message: 'Selected linked account is invalid.' });
    const rule = await getRule('RD');
    const minMonthlyAmount = Number(rule.minMonthlyAmount ?? rule.minAmount ?? 0);
    const maxMonthlyAmount = Number(rule.maxMonthlyAmount ?? rule.maxAmount ?? Infinity);
    if (monthlyContribution < minMonthlyAmount || monthlyContribution > maxMonthlyAmount) {
      return res.status(400).json({ success: false, message: `RD contribution must be between ${money(minMonthlyAmount)} and ${money(maxMonthlyAmount)}.` });
    }
    if (!getRuleTenures(rule).includes(Number(tenure))) {
      return res.status(400).json({ success: false, message: 'Selected RD tenure is not available.' });
    }
    const duplicate = await RecurringDeposit.findOne({
      userId: req.user._id,
      customerId: req.user.customerId,
      linkedAccountId: account._id,
      monthlyContribution: Number(monthlyContribution),
      tenure: Number(tenure),
      status: 'Pending',
      managerApprovalStatus: { $in: ['Pending', 'Pending Manager Approval', null] },
    }).lean();
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This request is already pending for manager approval.',
        existingRequest: duplicate,
      });
    }
    const classification = await getClassification(req.user, account);
    const interestRate = getRuleRate(rule, classification);
    const effectiveStartDate = parseStartDate(startDate);
    if (Number.isNaN(effectiveStartDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Please select a valid RD start date.' });
    }
    if (isPastDate(effectiveStartDate)) {
      return res.status(400).json({ success: false, message: 'Start date cannot be in the past.' });
    }
    const rdCalculation = rdMaturity(monthlyContribution, tenure, interestRate, effectiveStartDate);
    const { expectedMaturityAmount, accruedInterest, totalDepositedAmount } = rdCalculation;
    const rd = await RecurringDeposit.create({
      userId: req.user._id,
      customerId: req.user.customerId,
      customerName: req.user.name,
      linkedAccountId: account._id,
      linkedAccountNumber: account.accountNumber,
      accountType: account.accountType,
      classification,
      monthlyContribution,
      interestRate,
      tenure,
      startDate: effectiveStartDate,
      monthlyDebitDate: effectiveStartDate,
      maturityDate: rdCalculation.maturityDate,
      totalDepositedAmount: 0,
      interestEarned: accruedInterest,
      maturityAmount: expectedMaturityAmount,
      expectedMaturityAmount,
    });
    await notifyCustomer({ userId: req.user._id, title: 'RD Request Submitted', message: `Your RD request ${rd.rdId} for ${money(monthlyContribution)} per month has been sent for manager approval.` });
    await emailCustomer(req.user, 'RD Request Submitted', 'Recurring Deposit Request Submitted', [
      ['RD ID', rd.rdId],
      ['Monthly Contribution', money(rd.monthlyContribution)],
      ['Tenure', `${rd.tenure} months`],
      ['Interest Rate', `${rd.interestRate}% p.a.`],
      ['Expected Maturity Amount', money(rd.expectedMaturityAmount)],
    ], 'Your RD request is pending manager approval.');
    res.status(201).json({ success: true, message: 'RD request submitted for manager approval.', rd });
  } catch (error) {
    console.error('Create RD error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This request is already pending for manager approval.' });
    }
    res.status(500).json({ success: false, message: 'Failed to create RD request.' });
  }
};

const getMyFDs = async (req, res) => {
  const fds = await FixedDeposit.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, fds });
};

const getMyRDs = async (req, res) => {
  const rds = await RecurringDeposit.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, rds });
};

const getFDWithdrawalPreview = async (req, res) => {
  try {
    const fd = await FixedDeposit.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!fd) return res.status(404).json({ success: false, message: 'FD not found.' });
    if (fd.status !== 'Active') return res.status(400).json({ success: false, message: 'Only active FD accounts can be previewed for premature withdrawal.' });
    if (fd.maturityDate && new Date(fd.maturityDate) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This FD has already matured and cannot be submitted for premature withdrawal.' });
    }
    const calculation = await buildFDPrematureCalculation(fd, new Date());
    res.json({ success: true, calculation });
  } catch (error) {
    console.error('FD withdrawal preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate FD premature withdrawal preview.' });
  }
};

const getRDClosurePreview = async (req, res) => {
  try {
    const rd = await RecurringDeposit.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!rd) return res.status(404).json({ success: false, message: 'RD not found.' });
    if (rd.status !== 'Active') return res.status(400).json({ success: false, message: 'Only active RD accounts can be previewed for premature closure.' });
    if (rd.maturityDate && new Date(rd.maturityDate) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This RD has already matured and cannot be submitted for premature withdrawal.' });
    }
    const calculation = await buildRDPrematureCalculation(rd, new Date());
    res.json({ success: true, calculation });
  } catch (error) {
    console.error('RD closure preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate RD premature closure preview.' });
  }
};

const requestFDWithdrawal = async (req, res) => {
  const { reason } = req.body;
  const fd = await FixedDeposit.findOne({ _id: req.params.id, userId: req.user._id });
  if (!fd) return res.status(404).json({ success: false, message: 'FD not found.' });
  if (fd.prematureWithdrawalRequest?.status === 'Pending') {
    return res.status(400).json({ success: false, message: 'A premature withdrawal request for this FD is already pending for manager approval.' });
  }
  if (fd.status !== 'Active') return res.status(400).json({ success: false, message: 'Only active FD accounts can be submitted for premature withdrawal.' });
  if (fd.maturityDate && new Date(fd.maturityDate) <= new Date()) {
    return res.status(400).json({ success: false, message: 'This FD has already matured and cannot be submitted for premature withdrawal.' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: 'Please enter a reason for premature withdrawal.' });
  }
  const requestedAt = new Date();
  const calculation = await buildFDPrematureCalculation(fd, requestedAt);
  calculation.reason = String(reason).trim();
  fd.penaltyAmount = calculation.penaltyAmount;
  fd.revisedPayoutAmount = calculation.revisedPayoutAmount;
  fd.prematureWithdrawalRequest = {
    requested: true,
    reason: String(reason).trim(),
    status: 'Pending',
    requestStatus: 'Pending Manager Approval',
    fdId: fd.fdId,
    customerId: fd.customerId,
    customerName: fd.customerName,
    linkedAccountId: fd.linkedAccountId,
    linkedAccountNumber: fd.linkedAccountNumber,
    depositAmount: calculation.principalAmount,
    interestRate: fd.interestRate,
    accruedInterest: calculation.actualAccruedInterest,
    penaltyRate: calculation.appliedPenaltyRate,
    penaltyAmount: fd.penaltyAmount,
    revisedPayoutAmount: fd.revisedPayoutAmount,
    calculationBreakdown: calculation,
    requestedAt,
  };
  await fd.save();
  await notifyManagers({ title: 'FD Premature Withdrawal Request', message: `${fd.customerName} requested premature withdrawal for FD ${fd.fdId}.` });
  res.json({ success: true, message: 'Premature withdrawal request has been sent to the Manager for approval.', fd });
};

const updateFDRenewal = async (req, res) => {
  const { autoRenewal, maturityInstruction } = req.body;
  const fd = await FixedDeposit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { autoRenewal: Boolean(autoRenewal), maturityInstruction } },
    { new: true }
  );
  if (!fd) return res.status(404).json({ success: false, message: 'FD not found.' });
  res.json({ success: true, message: 'Renewal instructions updated.', fd });
};

const requestFDRenewal = async (req, res) => {
  const fd = await FixedDeposit.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: 'Premature Closed',
  });
  if (!fd) return res.status(404).json({ success: false, message: 'Only premature closed FDs are eligible for renewal.' });
  if (fd.renewalRequest?.status === 'Pending') {
    return res.status(400).json({ success: false, message: 'Renewal request already sent and pending for approval.' });
  }

  fd.renewalRequest = {
    requested: true,
    status: 'Pending',
    requestStatus: 'Pending Manager Approval',
    fdId: fd.fdId,
    customerId: fd.customerId,
    customerName: fd.customerName,
    depositType: 'FD',
    depositAmount: fd.depositAmount,
    oldMaturityDate: fd.maturityDate,
    tenure: fd.tenure,
    interestRate: fd.interestRate,
    maturityAmount: fd.maturityAmount,
    requestedAt: new Date(),
  };
  await fd.save();

  await notifyManagers({
    title: 'FD Renewal Request',
    message: `${fd.customerName} requested renewal for FD ${fd.fdId}.`,
  });

  res.json({
    success: true,
    message: 'Renewal request sent to Manager for approval.',
    fd,
  });
};

const requestRDClosure = async (req, res) => {
  const { reason } = req.body;
  const rd = await RecurringDeposit.findOne({ _id: req.params.id, userId: req.user._id });
  if (!rd) return res.status(404).json({ success: false, message: 'RD not found.' });
  if (rd.prematureClosureRequest?.status === 'Pending') {
    return res.status(400).json({ success: false, message: 'A premature withdrawal request for this RD is already pending for manager approval.' });
  }
  if (rd.status !== 'Active') return res.status(400).json({ success: false, message: 'Only active RD accounts can be submitted for premature withdrawal.' });
  if (rd.maturityDate && new Date(rd.maturityDate) <= new Date()) {
    return res.status(400).json({ success: false, message: 'This RD has already matured and cannot be submitted for premature withdrawal.' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: 'Please enter a reason for premature withdrawal.' });
  }
  const requestedAt = new Date();
  const calculation = await buildRDPrematureCalculation(rd, requestedAt);
  calculation.reason = String(reason).trim();
  rd.penaltyAmount = calculation.penaltyAmount;
  rd.revisedPayoutAmount = calculation.revisedPayoutAmount;
  rd.prematureClosureRequest = {
    requested: true,
    reason: String(reason).trim(),
    status: 'Pending',
    requestStatus: 'Pending Manager Approval',
    rdId: rd.rdId,
    customerId: rd.customerId,
    customerName: rd.customerName,
    linkedAccountId: rd.linkedAccountId,
    linkedAccountNumber: rd.linkedAccountNumber,
    depositAmount: calculation.totalDepositedAmount,
    interestRate: rd.interestRate,
    accruedInterest: calculation.actualAccruedInterest,
    penaltyRate: calculation.appliedPenaltyRate,
    penaltyAmount: rd.penaltyAmount,
    revisedPayoutAmount: rd.revisedPayoutAmount,
    calculationBreakdown: calculation,
    requestedAt,
  };
  await rd.save();
  await notifyManagers({ title: 'RD Premature Withdrawal Request', message: `${rd.customerName} requested premature withdrawal for RD ${rd.rdId}.` });
  res.json({ success: true, message: 'Premature withdrawal request has been sent to the Manager for approval.', rd });
};

const requestRDRenewal = async (req, res) => {
  const rd = await RecurringDeposit.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: 'Premature Closed',
  });
  if (!rd) return res.status(404).json({ success: false, message: 'Only premature closed RDs are eligible for renewal.' });
  if (rd.renewalRequest?.status === 'Pending') {
    return res.status(400).json({ success: false, message: 'Renewal request already sent and pending for approval.' });
  }
  rd.renewalRequest = {
    requested: true,
    status: 'Pending',
    requestStatus: 'Pending Manager Approval',
    rdId: rd.rdId,
    customerId: rd.customerId,
    customerName: rd.customerName,
    depositType: 'RD',
    monthlyContribution: rd.monthlyContribution,
    oldMaturityDate: rd.maturityDate,
    tenure: rd.tenure,
    interestRate: rd.interestRate,
    expectedMaturityAmount: rd.expectedMaturityAmount || rd.maturityAmount,
    requestedAt: new Date(),
  };
  await rd.save();
  await notifyManagers({ title: 'RD Renewal Request', message: `${rd.customerName} requested renewal for RD ${rd.rdId}.` });
  res.json({ success: true, message: 'Renewal request sent to Manager for approval.', rd });
};

const getRDInstallments = async (req, res) => {
  const rd = await RecurringDeposit.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!rd) return res.status(404).json({ success: false, message: 'RD not found.' });
  res.json({ success: true, installments: rd.installmentHistory || [] });
};

const getManagerQueue = async (req, res) => {
  const [pendingFDs, fdWithdrawals, fdRenewals, pendingRDs, rdClosures, rdRenewals, missedRDs] = await Promise.all([
    FixedDeposit.find({ status: 'Pending' }).sort({ createdAt: -1 }).lean(),
    FixedDeposit.find({ 'prematureWithdrawalRequest.status': 'Pending' }).sort({ updatedAt: -1 }).lean(),
    FixedDeposit.find({ 'renewalRequest.status': 'Pending' }).sort({ updatedAt: -1 }).lean(),
    RecurringDeposit.find({ status: 'Pending' }).sort({ createdAt: -1 }).lean(),
    RecurringDeposit.find({ 'prematureClosureRequest.status': 'Pending' }).sort({ updatedAt: -1 }).lean(),
    RecurringDeposit.find({ 'renewalRequest.status': 'Pending' }).sort({ updatedAt: -1 }).lean(),
    RecurringDeposit.find({ 'installmentHistory.status': { $in: ['Missed', 'Failed'] } }).sort({ updatedAt: -1 }).lean(),
  ]);
  res.json({ success: true, pendingFDs, fdWithdrawals, fdRenewals, pendingRDs, rdClosures, rdRenewals, missedRDs });
};

const approveFD = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const fd = await FixedDeposit.findById(req.params.id);
  if (!fd || fd.status !== 'Pending') return res.status(404).json({ success: false, message: 'Pending FD request not found.' });
  const customer = await User.findById(fd.userId);
  if (action === 'reject') {
    fd.status = 'Rejected';
    fd.managerApprovalStatus = 'Rejected';
    fd.managerRemarks = remarks;
    fd.rejectedAt = new Date();
    await fd.save();
    await notifyCustomer({ userId: fd.userId, title: 'FD Rejected', message: `Your FD request ${fd.fdId} was rejected. ${remarks}` });
    await emailCustomer(customer, 'Fixed Deposit Request Rejected', 'Fixed Deposit Request Rejected', [
      ['Customer Name', getDisplayName(customer?.name || fd.customerName)],
      ['FD ID', fd.fdId],
      ['Deposit Amount', money(fd.depositAmount)],
      ['Linked Account', fd.linkedAccountNumber],
      ['Tenure', `${fd.tenure} months`],
      ['Interest Rate', `${fd.interestRate}% p.a.`],
      ['Start Date', fd.startDate?.toLocaleDateString('en-IN')],
      ['Maturity Date', fd.maturityDate?.toLocaleDateString('en-IN')],
      ['Interest Earned', money(fd.interestEarned || fd.accruedInterest)],
      ['Maturity Amount', money(fd.maturityAmount)],
      ['Rejection Reason', remarks || '-'],
    ], 'Your FD request was not approved. No amount has been debited from your account.');
    return res.json({ success: true, message: 'FD request rejected.', fd });
  }
  const account = await Account.findOneAndUpdate(
    { _id: fd.linkedAccountId, balance: { $gte: fd.depositAmount }, status: 'active' },
    { $inc: { balance: -fd.depositAmount } },
    { new: true }
  );
  if (!account) return res.status(400).json({ success: false, message: 'Insufficient balance in linked account.' });
  const startDate = fd.startDate || new Date();
  fd.status = 'Active';
  fd.managerApprovalStatus = 'Approved';
  fd.startDate = startDate;
  fd.maturityDate = addMonths(startDate, fd.tenure);
  fd.approvedAt = new Date();
  fd.managerRemarks = remarks;
  await fd.save();
  await Transaction.create({ userId: fd.userId, fromAccount: account._id, fromAccountNumber: account.accountNumber, amount: fd.depositAmount, type: 'debit', category: 'other', status: 'completed', description: `FD ${fd.fdId} creation`, reference: fd.fdId, balance_after: account.balance, finalAccountBalance: account.balance });
  await notifyCustomer({ userId: fd.userId, title: 'FD Approved', message: `Your FD ${fd.fdId} is active. ${money(fd.depositAmount)} has been debited.` });
  await emailCustomer(customer, 'Fixed Deposit Request Approved', 'Fixed Deposit Request Approved', [
    ['Customer Name', getDisplayName(customer?.name || fd.customerName)],
    ['FD ID', fd.fdId],
    ['Deposit Amount', money(fd.depositAmount)],
    ['Linked Account', fd.linkedAccountNumber],
    ['Tenure', `${fd.tenure} months`],
    ['Interest Rate', `${fd.interestRate}% p.a.`],
    ['Start Date', fd.startDate?.toLocaleDateString('en-IN')],
    ['Maturity Date', fd.maturityDate?.toLocaleDateString('en-IN')],
    ['Interest Earned', money(fd.interestEarned || fd.accruedInterest)],
    ['Maturity Amount', money(fd.maturityAmount)],
    ['Approval Date', fd.approvedAt?.toLocaleDateString('en-IN')],
  ], 'Your FD is now active and the deposit amount has been debited from your linked account.');
  res.json({ success: true, message: 'FD approved and activated.', fd });
};

const approveRD = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const rd = await RecurringDeposit.findById(req.params.id);
  if (!rd || rd.status !== 'Pending') return res.status(404).json({ success: false, message: 'Pending RD request not found.' });
  const customer = await User.findById(rd.userId);
  if (action === 'reject') {
    rd.status = 'Rejected';
    rd.managerApprovalStatus = 'Rejected';
    rd.managerRemarks = remarks;
    rd.rejectedAt = new Date();
    await rd.save();
    await notifyCustomer({ userId: rd.userId, title: 'RD Rejected', message: `Your RD request ${rd.rdId} was rejected. ${remarks}` });
    await emailCustomer(customer, 'RD Request Rejected', 'Recurring Deposit Rejected', [['RD ID', rd.rdId], ['Contribution', money(rd.monthlyContribution)], ['Remarks', remarks || '-']], 'Your RD request was not approved.');
    return res.json({ success: true, message: 'RD request rejected.', rd });
  }
  const startDate = rd.startDate && !isPastDate(new Date(rd.startDate)) ? startOfDay(new Date(rd.startDate)) : startOfDay(new Date());
  const rdCalculation = rdMaturity(rd.monthlyContribution, rd.tenure, rd.interestRate, startDate);
  rd.status = 'Active';
  rd.managerApprovalStatus = 'Approved';
  rd.startDate = startDate;
  rd.monthlyDebitDate = startDate;
  rd.maturityDate = rdCalculation.maturityDate;
  rd.installmentHistory = buildInstallments(startDate, rd.tenure, rd.monthlyContribution);
  rd.interestEarned = rdCalculation.interestEarned;
  rd.expectedMaturityAmount = rdCalculation.expectedMaturityAmount;
  rd.maturityAmount = rdCalculation.expectedMaturityAmount;
  rd.approvedAt = startDate;
  rd.managerRemarks = remarks;
  await rd.save();
  await notifyCustomer({ userId: rd.userId, title: 'RD Approved', message: `Your RD ${rd.rdId} is active. Monthly auto-debit will run from your linked account.` });
  await emailCustomer(customer, 'RD Approved', 'Recurring Deposit Approved', [['RD ID', rd.rdId], ['Monthly Contribution', money(rd.monthlyContribution)], ['Maturity Amount', money(rd.expectedMaturityAmount)]], 'Your RD is now active.');
  res.json({ success: true, message: 'RD approved and activated.', rd });
};

const approveFDWithdrawal = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const fd = await FixedDeposit.findById(req.params.id);
  if (!fd || fd.prematureWithdrawalRequest?.status !== 'Pending') return res.status(404).json({ success: false, message: 'Pending FD withdrawal not found.' });
  const customer = await User.findById(fd.userId);
  if (action === 'reject') {
    fd.prematureWithdrawalRequest.status = 'Rejected';
    fd.prematureWithdrawalRequest.requestStatus = 'Rejected';
    fd.prematureWithdrawalRequest.reviewedAt = new Date();
    fd.prematureWithdrawalRequest.rejectedAt = new Date();
    fd.prematureWithdrawalRequest.managerRemarks = remarks;
    await fd.save();
    await notifyCustomer({ userId: fd.userId, title: 'FD Withdrawal Rejected', message: `Your FD ${fd.fdId} withdrawal request was rejected.` });
    await emailCustomer(customer, 'FD Withdrawal Rejected', 'FD Premature Withdrawal Rejected', [['FD ID', fd.fdId], ['Remarks', remarks || '-']], 'Your request was rejected.');
    return res.json({ success: true, message: 'Withdrawal request rejected.', fd });
  }
  const calculation = fd.prematureWithdrawalRequest.calculationBreakdown
    || await buildFDPrematureCalculation(fd, fd.prematureWithdrawalRequest.requestedAt || new Date());
  calculation.reason = fd.prematureWithdrawalRequest.reason || calculation.reason || '';
  fd.penaltyAmount = calculation.penaltyAmount;
  fd.revisedPayoutAmount = calculation.revisedPayoutAmount;
  fd.prematureWithdrawalRequest.depositAmount = calculation.principalAmount;
  fd.prematureWithdrawalRequest.accruedInterest = calculation.actualAccruedInterest;
  fd.prematureWithdrawalRequest.penaltyRate = calculation.appliedPenaltyRate;
  fd.prematureWithdrawalRequest.penaltyAmount = fd.penaltyAmount;
  fd.prematureWithdrawalRequest.revisedPayoutAmount = fd.revisedPayoutAmount;
  fd.prematureWithdrawalRequest.calculationBreakdown = calculation;
  const account = await Account.findByIdAndUpdate(fd.linkedAccountId, { $inc: { balance: fd.revisedPayoutAmount } }, { new: true });
  if (!account) return res.status(400).json({ success: false, message: 'Linked account not found.' });
  fd.status = 'Premature Closed';
  fd.closedAt = new Date();
  fd.prematureWithdrawalRequest.status = 'Approved';
  fd.prematureWithdrawalRequest.requestStatus = 'Approved';
  fd.prematureWithdrawalRequest.reviewedAt = new Date();
  fd.prematureWithdrawalRequest.approvedAt = new Date();
  fd.prematureWithdrawalRequest.managerRemarks = remarks;
  await fd.save();
  await Transaction.create({ userId: fd.userId, toAccount: account._id, toAccountNumber: account.accountNumber, amount: fd.revisedPayoutAmount, type: 'credit', category: 'other', status: 'completed', description: `FD ${fd.fdId} premature payout`, reference: `${fd.fdId}-PAYOUT`, balance_after: account.balance, finalAccountBalance: account.balance });
  await notifyCustomer({ userId: fd.userId, title: 'FD Withdrawal Approved', message: `Your FD ${fd.fdId} payout ${money(fd.revisedPayoutAmount)} has been credited.` });
  await emailCustomer(customer, 'FD Withdrawal Approved', 'FD Premature Withdrawal Approved', [
    ['FD ID', fd.fdId],
    ['Principal Amount', money(calculation.principalAmount)],
    ['Start Date', new Date(calculation.startDate).toLocaleDateString('en-IN')],
    ['Withdrawal Request Date', new Date(calculation.withdrawalRequestDate).toLocaleDateString('en-IN')],
    ['Completed Period', calculation.completedPeriod],
    ['Interest Rate', `${calculation.interestRate}% p.a.`],
    ['Actual Accrued Interest Till Date', money(calculation.actualAccruedInterest)],
    ['Admin Penalty Rate', `${calculation.adminPenaltyRate}%`],
    ['Applied Penalty Rate', `${calculation.appliedPenaltyRate}% (2x)`],
    ['Penalty Amount', money(fd.penaltyAmount)],
    ['Revised Payout Amount', money(fd.revisedPayoutAmount)],
    ['Manager Remarks', remarks || '-'],
  ], 'The revised payout has been credited to your linked account.');
  res.json({ success: true, message: 'Withdrawal approved and payout credited.', fd });
};

const approveFDRenewal = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const fd = await FixedDeposit.findById(req.params.id);
  if (!fd || fd.renewalRequest?.status !== 'Pending') {
    return res.status(404).json({ success: false, message: 'Pending FD renewal request not found.' });
  }

  const customer = await User.findById(fd.userId);
  if (action === 'reject') {
    fd.renewalRequest.status = 'Rejected';
    fd.renewalRequest.requestStatus = 'Rejected';
    fd.renewalRequest.reviewedAt = new Date();
    fd.renewalRequest.rejectedAt = new Date();
    fd.renewalRequest.managerRemarks = remarks;
    await fd.save();

    await notifyCustomer({
      userId: fd.userId,
      title: 'FD Renewal Rejected',
      message: `Your FD ${fd.fdId} renewal request was rejected. ${remarks || ''}`,
    });
    await emailCustomer(customer, 'FD Renewal Rejected', 'FD Renewal Rejected', [
      ['Customer Name', getDisplayName(customer?.name || fd.customerName)],
      ['FD ID', fd.fdId],
      ['FD Amount', money(fd.depositAmount)],
      ['Old Maturity Date', fd.maturityDate?.toLocaleDateString('en-IN')],
      ['Remarks', remarks || '-'],
    ], 'Your FD renewal request was not approved. Your FD details remain unchanged.');

    return res.json({ success: true, message: 'FD renewal request rejected.', fd });
  }

  const rule = await getRule('FD');
  const renewedAt = new Date();
  const oldMaturityDate = fd.maturityDate;
  const oldInterestRate = fd.interestRate;
  const newInterestRate = getRuleRate(rule, fd.classification);
  const { maturityAmount, accruedInterest } = fdMaturity(fd.depositAmount, fd.tenure, newInterestRate);
  const newMaturityDate = addMonths(renewedAt, fd.tenure);

  fd.status = 'Active';
  fd.startDate = renewedAt;
  fd.maturityDate = newMaturityDate;
  fd.interestRate = newInterestRate;
  fd.maturityAmount = maturityAmount;
  fd.interestEarned = accruedInterest;
  fd.accruedInterest = accruedInterest;
  fd.renewalRequest.status = 'Approved';
  fd.renewalRequest.requestStatus = 'Approved';
  fd.renewalRequest.reviewedAt = renewedAt;
  fd.renewalRequest.approvedAt = renewedAt;
  fd.renewalRequest.managerRemarks = remarks;
  fd.renewalHistory.push({
    renewedAt,
    oldMaturityDate,
    newMaturityDate,
    principalAmount: fd.depositAmount,
    oldInterestRate,
    newInterestRate,
    tenure: fd.tenure,
    maturityAmount,
    managerRemarks: remarks,
  });
  await fd.save();

  await notifyCustomer({
    userId: fd.userId,
    title: 'FD Renewal Approved',
    message: `Your FD ${fd.fdId} has been renewed until ${newMaturityDate.toLocaleDateString('en-IN')}.`,
  });
  await emailCustomer(customer, 'FD Renewal Approved', 'FD Renewal Approved', [
    ['Customer Name', getDisplayName(customer?.name || fd.customerName)],
    ['FD ID', fd.fdId],
    ['Renewed Amount', money(fd.depositAmount)],
    ['Tenure', `${fd.tenure} months`],
    ['New Interest Rate', `${newInterestRate}% p.a.`],
    ['New Start Date', renewedAt.toLocaleDateString('en-IN')],
    ['New Maturity Date', newMaturityDate.toLocaleDateString('en-IN')],
    ['Interest Earned', money(accruedInterest)],
    ['New Maturity Amount', money(maturityAmount)],
    ['Approval Date', renewedAt.toLocaleDateString('en-IN')],
  ], 'Your FD renewal request has been approved by the manager.');

  res.json({ success: true, message: 'FD renewal approved and updated.', fd });
};

const approveRDClosure = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const rd = await RecurringDeposit.findById(req.params.id);
  if (!rd || rd.prematureClosureRequest?.status !== 'Pending') return res.status(404).json({ success: false, message: 'Pending RD closure not found.' });
  const customer = await User.findById(rd.userId);
  if (action === 'reject') {
    rd.prematureClosureRequest.status = 'Rejected';
    rd.prematureClosureRequest.requestStatus = 'Rejected';
    rd.prematureClosureRequest.reviewedAt = new Date();
    rd.prematureClosureRequest.rejectedAt = new Date();
    rd.prematureClosureRequest.managerRemarks = remarks;
    await rd.save();
    await notifyCustomer({ userId: rd.userId, title: 'RD Closure Rejected', message: `Your RD ${rd.rdId} closure request was rejected.` });
    await emailCustomer(customer, 'RD Closure Rejected', 'RD Premature Closure Rejected', [['RD ID', rd.rdId], ['Remarks', remarks || '-']], 'Your request was rejected.');
    return res.json({ success: true, message: 'RD closure request rejected.', rd });
  }
  const calculation = rd.prematureClosureRequest.calculationBreakdown
    || await buildRDPrematureCalculation(rd, rd.prematureClosureRequest.requestedAt || new Date());
  calculation.reason = rd.prematureClosureRequest.reason || calculation.reason || '';
  rd.penaltyAmount = calculation.penaltyAmount;
  rd.revisedPayoutAmount = calculation.revisedPayoutAmount;
  rd.prematureClosureRequest.depositAmount = calculation.totalDepositedAmount;
  rd.prematureClosureRequest.accruedInterest = calculation.actualAccruedInterest;
  rd.prematureClosureRequest.penaltyRate = calculation.appliedPenaltyRate;
  rd.prematureClosureRequest.penaltyAmount = rd.penaltyAmount;
  rd.prematureClosureRequest.revisedPayoutAmount = rd.revisedPayoutAmount;
  rd.prematureClosureRequest.calculationBreakdown = calculation;
  const account = await Account.findByIdAndUpdate(rd.linkedAccountId, { $inc: { balance: rd.revisedPayoutAmount } }, { new: true });
  if (!account) return res.status(400).json({ success: false, message: 'Linked account not found.' });
  rd.status = 'Premature Closed';
  rd.closedAt = new Date();
  rd.prematureClosureRequest.status = 'Approved';
  rd.prematureClosureRequest.requestStatus = 'Approved';
  rd.prematureClosureRequest.reviewedAt = new Date();
  rd.prematureClosureRequest.approvedAt = new Date();
  rd.prematureClosureRequest.managerRemarks = remarks;
  await rd.save();
  await Transaction.create({ userId: rd.userId, toAccount: account._id, toAccountNumber: account.accountNumber, amount: rd.revisedPayoutAmount, type: 'credit', category: 'other', status: 'completed', description: `RD ${rd.rdId} premature payout`, reference: `${rd.rdId}-PAYOUT`, balance_after: account.balance, finalAccountBalance: account.balance });
  await notifyCustomer({ userId: rd.userId, title: 'RD Closure Approved', message: `Your RD ${rd.rdId} payout ${money(rd.revisedPayoutAmount)} has been credited.` });
  await emailCustomer(customer, 'RD Closure Approved', 'RD Premature Closure Approved', [
    ['RD ID', rd.rdId],
    ['Total Deposited Amount Till Date', money(calculation.totalDepositedAmount)],
    ['Paid Installments Included', calculation.paidInstallmentsCount],
    ['Start Date', new Date(calculation.startDate).toLocaleDateString('en-IN')],
    ['Withdrawal Request Date', new Date(calculation.withdrawalRequestDate).toLocaleDateString('en-IN')],
    ['Completed Period', calculation.completedPeriod],
    ['Interest Rate', `${calculation.interestRate}% p.a.`],
    ['Actual Accrued Interest Till Date', money(calculation.actualAccruedInterest)],
    ['Admin Penalty Rate', `${calculation.adminPenaltyRate}%`],
    ['Applied Penalty Rate', `${calculation.appliedPenaltyRate}% (2x)`],
    ['Penalty Amount', money(rd.penaltyAmount)],
    ['Revised Payout Amount', money(rd.revisedPayoutAmount)],
    ['Manager Remarks', remarks || '-'],
  ], 'The revised payout has been credited to your linked account.');
  res.json({ success: true, message: 'RD closure approved and payout credited.', rd });
};

const approveRDRenewal = async (req, res) => {
  const { action, remarks = '' } = req.body;
  const rd = await RecurringDeposit.findById(req.params.id);
  if (!rd || rd.renewalRequest?.status !== 'Pending') {
    return res.status(404).json({ success: false, message: 'Pending RD renewal request not found.' });
  }
  const customer = await User.findById(rd.userId);
  if (action === 'reject') {
    rd.renewalRequest.status = 'Rejected';
    rd.renewalRequest.requestStatus = 'Rejected';
    rd.renewalRequest.reviewedAt = new Date();
    rd.renewalRequest.rejectedAt = new Date();
    rd.renewalRequest.managerRemarks = remarks;
    await rd.save();
    await notifyCustomer({ userId: rd.userId, title: 'RD Renewal Rejected', message: `Your RD ${rd.rdId} renewal request was rejected. ${remarks || ''}` });
    await emailCustomer(customer, 'RD Renewal Rejected', 'Recurring Deposit Renewal Rejected', [['RD ID', rd.rdId], ['Remarks', remarks || '-']], 'Your RD renewal request was not approved.');
    return res.json({ success: true, message: 'RD renewal request rejected.', rd });
  }

  const rule = await getRule('RD');
  const renewedAt = new Date();
  const oldMaturityDate = rd.maturityDate;
  const oldInterestRate = rd.interestRate;
  const newInterestRate = getRuleRate(rule, rd.classification);
  const newMaturityDate = addMonths(renewedAt, rd.tenure);
  const rdCalculation = rdMaturity(rd.monthlyContribution, rd.tenure, newInterestRate, renewedAt);
  const { expectedMaturityAmount, accruedInterest, totalDepositedAmount } = rdCalculation;

  rd.status = 'Active';
  rd.startDate = renewedAt;
  rd.monthlyDebitDate = renewedAt;
  rd.maturityDate = rdCalculation.maturityDate || newMaturityDate;
  rd.interestRate = newInterestRate;
  rd.installmentsPaid = 0;
  rd.missedInstallments = 0;
  rd.installmentHistory = buildInstallments(renewedAt, rd.tenure, rd.monthlyContribution);
  rd.totalDepositedAmount = 0;
  rd.interestEarned = accruedInterest;
  rd.expectedMaturityAmount = expectedMaturityAmount;
  rd.maturityAmount = expectedMaturityAmount;
  rd.renewalRequest.status = 'Approved';
  rd.renewalRequest.requestStatus = 'Approved';
  rd.renewalRequest.reviewedAt = renewedAt;
  rd.renewalRequest.approvedAt = renewedAt;
  rd.renewalRequest.managerRemarks = remarks;
  rd.renewalHistory.push({
    renewedAt,
    oldMaturityDate,
    newMaturityDate,
    monthlyContribution: rd.monthlyContribution,
    oldInterestRate,
    newInterestRate,
    tenure: rd.tenure,
    expectedMaturityAmount,
    managerRemarks: remarks,
  });
  await rd.save();
  await notifyCustomer({ userId: rd.userId, title: 'RD Renewal Approved', message: `Your RD ${rd.rdId} has been renewed until ${newMaturityDate.toLocaleDateString('en-IN')}.` });
  await emailCustomer(customer, 'RD Renewal Approved', 'RD Renewal Approved', [
    ['Customer Name', getDisplayName(customer?.name || rd.customerName)],
    ['RD ID', rd.rdId],
    ['Renewed Amount', money(rd.monthlyContribution)],
    ['Tenure', `${rd.tenure} months`],
    ['New Interest Rate', `${newInterestRate}% p.a.`],
    ['New Start Date', renewedAt.toLocaleDateString('en-IN')],
    ['New Maturity Date', newMaturityDate.toLocaleDateString('en-IN')],
    ['New Maturity Amount', money(expectedMaturityAmount)],
    ['Approval Date', renewedAt.toLocaleDateString('en-IN')],
  ], 'Your RD renewal request has been approved by the manager.');
  res.json({ success: true, message: 'RD renewal approved and updated.', rd });
};

const getManagerMonitoring = async (req, res) => {
  const [fds, rds] = await Promise.all([
    FixedDeposit.find().sort({ maturityDate: 1 }).lean(),
    RecurringDeposit.find().sort({ maturityDate: 1 }).lean(),
  ]);
  res.json({ success: true, fds, rds });
};

const getAdminOverview = async (req, res) => {
  const [fds, rds, rules] = await Promise.all([
    FixedDeposit.find().sort({ createdAt: -1 }).lean(),
    RecurringDeposit.find().sort({ createdAt: -1 }).lean(),
    InvestmentRule.find().sort({ type: 1 }).lean(),
  ]);
  const summary = {
    totalFDs: fds.length,
    totalRDs: rds.length,
    activeFDs: fds.filter((item) => item.status === 'Active').length,
    activeRDs: rds.filter((item) => item.status === 'Active').length,
    fdPortfolio: fds.reduce((sum, item) => sum + Number(item.depositAmount || 0), 0),
    rdPortfolio: rds.reduce((sum, item) => sum + Number(item.monthlyContribution || 0) * Number(item.installmentsPaid || 0), 0),
  };
  res.json({ success: true, summary, fds, rds, rules: rules.map(normalizeRule) });
};

const getAdminClassifications = async (req, res) => {
  const classifications = await Classification.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ success: true, classifications });
};

const getAdminRule = async (req, res) => {
  const type = String(req.params.type || '').toUpperCase();
  if (!['FD', 'RD'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid investment rule type.' });
  const rule = await getRule(type);
  res.json({ success: true, rule: normalizeRule(rule) });
};

const upsertRule = async (req, res) => {
  const {
    type,
    minAmount,
    maxAmount,
    minMonthlyAmount,
    maxMonthlyAmount,
    allowedTenures,
    tenureOptions,
    classificationInterestRates,
    prematurePenalty,
    prematureWithdrawalPenalty,
    prematureClosurePenalty,
    missedInstallmentPenalty,
    autoRenewalAllowed,
    autoDebitAllowed,
  } = req.body;
  const ruleType = String(type || '').toUpperCase();
  if (!['FD', 'RD'].includes(ruleType)) return res.status(400).json({ success: false, message: 'Invalid investment rule type.' });
  const previousRule = await InvestmentRule.findOne({ type: ruleType }).lean();
  const normalizedPreviousRule = normalizeRule(previousRule);
  const tenures = (allowedTenures || tenureOptions || ALLOWED_TENURES)
    .map(Number)
    .filter((tenure) => ALLOWED_TENURES.includes(tenure));
  const rates = (classificationInterestRates || []).map((item) => {
    const name = String(item.classificationName || item.classification || '').toUpperCase().trim();
    return {
      classificationId: item.classificationId,
      classificationName: name,
      classification: name,
      interestRate: Number(item.interestRate || 0),
    };
  }).filter((item) => item.classificationName && item.interestRate >= 0);

  const update = {
    type: ruleType,
    allowedTenures: tenures.length ? tenures : ALLOWED_TENURES,
    tenureOptions: tenures.length ? tenures : ALLOWED_TENURES,
    classificationInterestRates: rates,
    missedInstallmentPenalty: Number(missedInstallmentPenalty || 0),
    updatedByAdmin: req.user._id,
    updatedBy: req.user._id,
  };

  if (ruleType === 'FD') {
    update.minAmount = Number(minAmount || 0);
    update.maxAmount = Number(maxAmount || 0);
    update.prematurePenalty = Number(prematureWithdrawalPenalty ?? prematurePenalty ?? 0);
    update.prematureWithdrawalPenalty = Number(prematureWithdrawalPenalty ?? prematurePenalty ?? 0);
    update.autoRenewalAllowed = Boolean(autoRenewalAllowed);
  } else {
    update.minAmount = Number(minMonthlyAmount ?? minAmount ?? 0);
    update.maxAmount = Number(maxMonthlyAmount ?? maxAmount ?? 0);
    update.minMonthlyAmount = Number(minMonthlyAmount ?? minAmount ?? 0);
    update.maxMonthlyAmount = Number(maxMonthlyAmount ?? maxAmount ?? 0);
    update.prematurePenalty = Number(prematureClosurePenalty ?? prematurePenalty ?? 0);
    update.prematureClosurePenalty = Number(prematureClosurePenalty ?? prematurePenalty ?? 0);
    update.autoDebitAllowed = Boolean(autoDebitAllowed);
  }

  const rule = await InvestmentRule.findOneAndUpdate(
    { type: ruleType },
    update,
    { upsert: true, new: true, runValidators: true }
  );
  const normalizedRule = normalizeRule(rule);
  let notificationResult = { changedRates: [], notifiedCustomers: 0 };
  if (['FD', 'RD'].includes(ruleType)) {
    notificationResult = await notifyInvestmentRuleChanges(normalizedPreviousRule, normalizedRule);
  }
  res.json({
    success: true,
    message: ruleType === 'FD' ? 'FD Rules Updated Successfully.' : `${ruleType} rules updated successfully.`,
    rule: normalizedRule,
    rateChangeNotifications: notificationResult,
  });
};

const getAdminFDAccounts = async (req, res) => {
  const { search = '', status = '', page = 1, limit = 10 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(String(search).trim(), 'i');
    const matchedUsers = await User.find({
      role: 'customer',
      $or: [{ email: regex }, { name: regex }, { customerId: regex }],
    }).select('_id').lean();
    const userIds = matchedUsers.map((user) => user._id);
    query.$or = [
      { customerName: regex },
      { customerId: regex },
      { fdId: regex },
      { linkedAccountNumber: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [fds, total] = await Promise.all([
    FixedDeposit.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    FixedDeposit.countDocuments(query),
  ]);
  res.json({ success: true, fds, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
};

const getAdminRDAccounts = async (req, res) => {
  const { search = '', status = '', page = 1, limit = 10 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(String(search).trim(), 'i');
    query.$or = [
      { customerName: regex },
      { customerId: regex },
      { rdId: regex },
      { linkedAccountNumber: regex },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [rds, total] = await Promise.all([
    RecurringDeposit.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    RecurringDeposit.countDocuments(query),
  ]);
  res.json({ success: true, rds, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
};

const fdReportRows = (fds, reportType) => {
  const base = fds.map((fd) => ({
    CustomerName: getDisplayName(fd.customerName),
    CustomerID: fd.customerId,
    Classification: fd.classification,
    LinkedAccount: fd.linkedAccountNumber,
    FDID: fd.fdId,
    DepositAmount: fd.depositAmount,
    InterestRate: fd.interestRate,
    TenureMonths: fd.tenure,
    StartDate: fd.startDate,
    MaturityDate: fd.maturityDate,
    MaturityAmount: fd.maturityAmount,
    InterestEarned: fd.interestEarned || fd.accruedInterest,
    Status: fd.status,
    CreatedDate: fd.createdAt,
  }));
  if (reportType === 'amount-summary') return base.map(({ FDID, CustomerName, DepositAmount, MaturityAmount, Status }) => ({ FDID, CustomerName, DepositAmount, MaturityAmount, Status }));
  if (reportType === 'interest-earnings') return base.map(({ FDID, CustomerName, Classification, DepositAmount, InterestRate, InterestEarned }) => ({ FDID, CustomerName, Classification, DepositAmount, InterestRate, InterestEarned }));
  if (reportType === 'maturity-forecast') return base.map(({ FDID, CustomerName, MaturityDate, MaturityAmount, Status }) => ({ FDID, CustomerName, MaturityDate, MaturityAmount, Status }));
  if (reportType === 'premature-withdrawal') return fds.filter((fd) => fd.status === 'Premature Closed' || fd.prematureWithdrawalRequest?.requested).map((fd) => ({ FDID: fd.fdId, CustomerName: getDisplayName(fd.customerName), DepositAmount: fd.depositAmount, PenaltyAmount: fd.penaltyAmount, PayoutAmount: fd.revisedPayoutAmount, RequestStatus: fd.prematureWithdrawalRequest?.status, ClosedAt: fd.closedAt }));
  return base;
};

const rdReportRows = (rds, reportType) => {
  const base = rds.map((rd) => ({
    CustomerName: getDisplayName(rd.customerName),
    CustomerID: rd.customerId,
    Classification: rd.classification,
    LinkedAccount: rd.linkedAccountNumber,
    RDID: rd.rdId,
    MonthlyContribution: rd.monthlyContribution,
    InterestRate: rd.interestRate,
    TenureMonths: rd.tenure,
    InstallmentsPaid: rd.installmentsPaid,
    MissedInstallments: rd.missedInstallments,
    StartDate: rd.startDate,
    MaturityDate: rd.maturityDate,
    ExpectedMaturityAmount: rd.expectedMaturityAmount,
    Status: rd.status,
    CreatedDate: rd.createdAt,
  }));
  if (reportType === 'amount-summary') return base.map(({ RDID, CustomerName, MonthlyContribution, InstallmentsPaid, ExpectedMaturityAmount, Status }) => ({ RDID, CustomerName, MonthlyContribution, InstallmentsPaid, ExpectedMaturityAmount, Status }));
  if (reportType === 'missed-installment') return rds.filter((rd) => Number(rd.missedInstallments || 0) > 0).map((rd) => ({ RDID: rd.rdId, CustomerName: getDisplayName(rd.customerName), MissedInstallments: rd.missedInstallments, MonthlyContribution: rd.monthlyContribution, Status: rd.status }));
  if (reportType === 'maturity-forecast') return base.map(({ RDID, CustomerName, MaturityDate, ExpectedMaturityAmount, Status }) => ({ RDID, CustomerName, MaturityDate, ExpectedMaturityAmount, Status }));
  if (reportType === 'premature-closure') return rds.filter((rd) => rd.status === 'Premature Closed' || rd.prematureClosureRequest?.requested).map((rd) => ({ RDID: rd.rdId, CustomerName: getDisplayName(rd.customerName), Contribution: rd.monthlyContribution, PenaltyAmount: rd.penaltyAmount, PayoutAmount: rd.revisedPayoutAmount, RequestStatus: rd.prematureClosureRequest?.status, ClosedAt: rd.closedAt }));
  return base;
};

const downloadMonthlyReport = async (req, res) => {
  const product = String(req.params.product || '').toUpperCase();
  const reportType = String(req.params.reportType || 'full').toLowerCase();
  const format = String(req.query.format || 'excel').toLowerCase();
  const { start, end, label } = monthRange(req.query.month, req.query.year);
  const dateQuery = { createdAt: { $gte: start, $lt: end } };
  const records = product === 'FD'
    ? await FixedDeposit.find(dateQuery).sort({ createdAt: -1 }).lean()
    : await RecurringDeposit.find(dateQuery).sort({ createdAt: -1 }).lean();
  const rows = product === 'FD' ? fdReportRows(records, reportType) : rdReportRows(records, reportType);
  if (format === 'pdf') {
    const buffer = createSimplePdf(`Adnate PayNest ${product} Monthly Report ${label}`, rows);
    res.setHeader('Content-Disposition', `attachment; filename="Adnate_PayNest_${product}_${reportType}_${label}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(buffer);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: `No ${product} records found for ${label}` }]), 'Report');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="Adnate_PayNest_${product}_${reportType}_${label}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};

const downloadReport = async (req, res) => {
  req.params.product = String(req.params.type || 'FD').toUpperCase();
  req.params.reportType = 'full';
  return downloadMonthlyReport(req, res);
};

const processRDInstallments = async () => {
  const now = new Date();
  const rule = await getRule('RD');
  const rds = await RecurringDeposit.find({ status: 'Active', autoDebitStatus: true, 'installmentHistory.status': 'Pending' });
  for (const rd of rds) {
    const installment = rd.installmentHistory.find((item) => item.status === 'Pending' && item.dueDate <= now);
    if (!installment) continue;
    const account = await Account.findById(rd.linkedAccountId);
    const customer = await User.findById(rd.userId);
    if (account && account.balance >= installment.amount) {
      account.balance -= installment.amount;
      await account.save();
      installment.status = 'Paid';
      installment.paidDate = now;
      installment.paymentMode = 'Auto Debit';
      rd.installmentsPaid += 1;
      rd.totalDepositedAmount = round(Number(rd.totalDepositedAmount || 0) + Number(installment.amount || 0));
      await Transaction.create({ userId: rd.userId, fromAccount: account._id, fromAccountNumber: account.accountNumber, amount: installment.amount, type: 'debit', category: 'other', status: 'completed', description: `RD ${rd.rdId} installment ${installment.installmentNo}`, reference: `${rd.rdId}-${installment.installmentNo}`, balance_after: account.balance, finalAccountBalance: account.balance });
      await notifyCustomer({ userId: rd.userId, title: 'RD Installment Debited', message: `RD ${rd.rdId} installment ${installment.installmentNo} of ${money(installment.amount)} was debited.` });
      await emailCustomer(customer, 'RD Installment Debited', 'RD Installment Auto-Debited', [['RD ID', rd.rdId], ['Installment', installment.installmentNo], ['Amount', money(installment.amount)]], 'Your RD installment was debited successfully.');
    } else {
      const penalty = round(installment.amount * Number(rule.missedInstallmentPenalty || 0) / 100);
      installment.status = 'Missed';
      installment.penalty = penalty;
      installment.paymentMode = 'Auto Debit';
      installment.failureReason = 'Insufficient balance';
      rd.missedInstallments += 1;
      await notifyCustomer({ userId: rd.userId, title: 'RD Installment Missed', message: `RD ${rd.rdId} installment ${installment.installmentNo} was missed. Penalty ${money(penalty)} applied.` });
      await emailCustomer(customer, 'RD Installment Missed', 'RD Installment Missed', [['RD ID', rd.rdId], ['Installment', installment.installmentNo], ['Penalty', money(penalty)]], 'Please fund your linked account to avoid future missed installments.');
    }
    if (rd.installmentsPaid >= rd.tenure) {
      rd.status = 'Matured';
      rd.closedAt = now;
      rd.maturityAmount = rd.expectedMaturityAmount;
      await notifyCustomer({ userId: rd.userId, title: 'RD Matured', message: `Your RD ${rd.rdId} has matured with expected payout ${money(rd.expectedMaturityAmount)}.` });
      await emailCustomer(customer, 'RD Matured', 'Recurring Deposit Maturity Completed', [['RD ID', rd.rdId], ['Maturity Amount', money(rd.expectedMaturityAmount)]], 'Your RD has completed its tenure.');
    }
    await rd.save();
  }
};

module.exports = {
  getBootstrap,
  calculateFD,
  calculateRD,
  createFD,
  createRD,
  getMyFDs,
  getMyRDs,
  getFDWithdrawalPreview,
  getRDClosurePreview,
  requestFDWithdrawal,
  updateFDRenewal,
  requestFDRenewal,
  requestRDRenewal,
  requestRDClosure,
  getRDInstallments,
  getManagerQueue,
  approveFD,
  approveRD,
  approveFDWithdrawal,
  approveFDRenewal,
  approveRDClosure,
  approveRDRenewal,
  getManagerMonitoring,
  getAdminOverview,
  getAdminClassifications,
  getAdminRule,
  upsertRule,
  getAdminFDAccounts,
  getAdminRDAccounts,
  downloadMonthlyReport,
  downloadReport,
  processRDInstallments,
};
