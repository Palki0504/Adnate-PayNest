const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const LoanApplication = require('../models/LoanApplication');
const LoanApplicationDraft = require('../models/LoanApplicationDraft');
const Loan = require('../models/Loan');
const LoanConfig = require('../models/LoanConfig');
const LoanRule = require('../models/LoanRule');
const Account = require('../models/Account');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { ensureEMISchedule } = require('./loanController');
const {
  sendLoanApplicationStatusEmail,
  sendLoanRejectedEmail,
  sendLoanApprovedEmail,
} = require('../utils/emailService');

const UPLOAD_ROOT = path.join(__dirname, '..', 'private_uploads', 'loan-applications');
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const calculateEMI = (principal, annualRate, tenure) => {
  const rate = annualRate / 12 / 100;
  const emi = rate === 0
    ? principal / tenure
    : (principal * rate * (1 + rate) ** tenure) / ((1 + rate) ** tenure - 1);
  const totalRepayment = emi * tenure;
  return { estimatedEMI: emi, totalInterest: totalRepayment - principal, totalRepayment };
};

const getConfiguredInterestRate = (config) => Number(config?.interestRate || 0);

const getConfiguredMaxAmount = (config) => {
  const maxAmount = config?.maxAmount;
  if (typeof maxAmount === 'number') return Number(maxAmount || 0);
  const values = maxAmount?.get ? Array.from(maxAmount.values()) : Object.values(maxAmount || {});
  return Number(Math.max(0, ...values.map((amount) => Number(amount) || 0)));
};

const BLOCKING_LOAN_STATUSES = ['Pending', 'Submitted', 'Under Review', 'More Info Required', 'Approved', 'Active', 'Disbursed'];
const READ_ONLY_APPLICATION_STATUSES = ['Pending', 'Submitted', 'Under Review', 'Approved', 'Rejected'];

const duplicateLoanTypeMessage = (displayName) => (
  `You cannot apply for this loan type because you already have an active or pending ${displayName}. Please repay or close your existing ${displayName} before applying again.`
);

const isReadOnlyApplicationStatus = (status) => READ_ONLY_APPLICATION_STATUSES.includes(String(status || ''));
const withReadOnlyFlag = (application) => ({
  ...application,
  isReadOnly: isReadOnlyApplicationStatus(application.status),
});

const findBlockingLoanByType = async ({ userId, customerId, loanType }) => Loan.findOne({
  $or: [
    { userId },
    ...(customerId ? [{ customerId }] : []),
  ],
  loanType,
  status: { $in: BLOCKING_LOAN_STATUSES },
}).lean();

const sanitizeFileName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const saveDocuments = async (documents, userId, applicationId) => {
  const folder = path.join(UPLOAD_ROOT, String(userId), String(applicationId));
  await fs.mkdir(folder, { recursive: true });
  const saved = [];

  for (const doc of documents || []) {
    if (!doc?.data || !doc?.name || !doc?.type) continue;
    const match = doc.data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !allowedMimeTypes.has(match[1])) throw new Error('Only PDF, JPG, and PNG documents are allowed.');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) throw new Error(`${doc.name} exceeds the 2 MB file limit.`);
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileName(doc.name)}`;
    const fullPath = path.join(folder, storedName);
    await fs.writeFile(fullPath, buffer, { flag: 'wx' });
    saved.push({
      type: doc.type,
      originalName: doc.name,
      storedName,
      path: fullPath,
      mimeType: match[1],
      size: buffer.length,
    });
  }
  return saved;
};

const getBootstrap = async (req, res) => {
  const [user, accounts, configs, draft, existingLoans] = await Promise.all([
    User.findById(req.user._id).select('+aadhaarNumber +panNumber').lean(),
    Account.find({ userId: req.user._id, status: 'active' }).lean(),
    LoanRule.find({ status: 'Active' }).lean().then((rules) => rules.length ? rules : LoanConfig.find({ isActive: true }).lean()),
    LoanApplicationDraft.findOne({ userId: req.user._id }).lean(),
    Loan.find({ userId: req.user._id, status: { $in: BLOCKING_LOAN_STATUSES } }).select('loanType loanNumber status customerId').lean(),
  ]);
  const profile = {
    customerId: user.customerId || String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    classification: user.classification,
  };
  const enrichedConfigs = configs.map((config) => ({
    ...config,
    interestRate: getConfiguredInterestRate(config),
    effectiveInterestRate: getConfiguredInterestRate(config),
    maxAmount: getConfiguredMaxAmount(config),
    lateEmiPenalty: config.lateEmiPenalty ?? config.penaltyRate ?? 0,
    processingFee: config.processingFee ?? 0,
    prepaymentCharge: config.prepaymentCharge ?? config.foreclosureChargePercent ?? 0,
    minTenure: config.minTenure ?? config.tenureMin,
    maxTenure: config.maxTenure ?? config.tenureMax,
  }));
  const loanTypes = enrichedConfigs.map((config) => config.displayName);
  const configByType = new Map(enrichedConfigs.map((config) => [config.loanType, config]));
  const activeLoanTypeLocks = existingLoans.map((loan) => {
    const config = configByType.get(loan.loanType);
    return {
      loanType: loan.loanType,
      displayName: config?.displayName || loan.loanType,
      status: loan.status,
      loanNumber: loan.loanNumber,
      message: duplicateLoanTypeMessage(config?.displayName || loan.loanType),
    };
  });
  const interestRates = configs.reduce((rates, config) => {
    rates[config.displayName] = getConfiguredInterestRate(config);
    return rates;
  }, {});

  res.json({
    success: true,
    profile,
    customer: {
      name: user.name,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      mobileNumber: user.phone,
      email: user.email,
      panNumber: user.panNumber || '',
      aadhaarNumber: user.aadhaarNumber || '',
      classification: user.classification,
      designation: user.designation || '',
    },
    accounts,
    configs: enrichedConfigs,
    loanTypes,
    interestRates,
    existingLoans,
    activeLoanTypeLocks,
    draft,
  });
};

const saveDraft = async (req, res) => {
  try {
    const { loanDetails } = req.body;
    if (!loanDetails) return res.status(400).json({ success: false, message: 'Loan details are required.' });

    const account = await Account.findOne({
      _id: loanDetails.linkedAccountId,
      userId: req.user._id,
      status: 'active',
    });
    if (!account) return res.status(400).json({ success: false, message: 'Select a valid active repayment account.' });

    const config = await LoanRule.findOne({ loanType: loanDetails.loanType, status: 'Active' }).lean()
      || await LoanConfig.findOne({ loanType: loanDetails.loanType, isActive: true });
    if (!config) return res.status(400).json({ success: false, message: 'Select a valid loan type.' });
    if (!['months', 'years'].includes(loanDetails.tenureUnit)) {
      return res.status(400).json({ success: false, message: 'Select a valid tenure unit.' });
    }
    if (!Number(loanDetails.tenure) || Number(loanDetails.tenure) <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid loan tenure.' });
    }

    const user = await User.findById(req.user._id).select('customerId classification');
    const customerId = user.customerId || String(user._id);
    const blockingLoan = await findBlockingLoanByType({ userId: req.user._id, customerId, loanType: loanDetails.loanType });
    if (blockingLoan) {
      return res.status(409).json({ success: false, message: duplicateLoanTypeMessage(config.displayName || loanDetails.loanType), existingLoan: blockingLoan });
    }
    const requestedAmount = Number(loanDetails.loanAmount);
    const minAmount = Number(config.minAmount || 10000);
    const maxAmount = getConfiguredMaxAmount(config);
    if (requestedAmount < minAmount) {
      return res.status(400).json({ success: false, message: `Minimum loan amount for ${config.displayName} is ₹${minAmount.toLocaleString('en-IN')}.` });
    }
    if (maxAmount && requestedAmount > maxAmount) {
      return res.status(400).json({ success: false, message: `Maximum loan amount for ${config.displayName} is Rs.${maxAmount.toLocaleString('en-IN')}.` });
    }
    const draft = await LoanApplicationDraft.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          customerId: user.customerId || String(user._id),
          currentStep: 2,
          loanDetails: {
            loanType: loanDetails.loanType,
            purpose: loanDetails.purpose,
            loanAmount: Number(loanDetails.loanAmount),
            tenure: Number(loanDetails.tenure),
            tenureUnit: loanDetails.tenureUnit,
            interestRate: getConfiguredInterestRate(config),
            linkedAccountId: account._id,
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: 'Loan details saved.', draft });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save loan details.' });
  }
};

const submitApplication = async (req, res) => {
  let savedDocuments = [];
  try {
    const { loanDetails, personalDetails, employmentDetails, studentDetails = {}, documents = [] } = req.body;
    if (!loanDetails || !personalDetails || !employmentDetails) {
      return res.status(400).json({ success: false, message: 'All five application steps are required.' });
    }

    const [user, account, config] = await Promise.all([
      User.findById(req.user._id).select('+aadhaarNumber +panNumber'),
      Account.findOne({ _id: loanDetails.linkedAccountId, userId: req.user._id, status: 'active' }),
      LoanRule.findOne({ loanType: loanDetails.loanType, status: 'Active' }).lean().then((rule) => rule || LoanConfig.findOne({ loanType: loanDetails.loanType, isActive: true })),
    ]);
    if (!account || !config) return res.status(400).json({ success: false, message: 'Invalid account or loan product.' });

    const requiredPersonalFields = ['name', 'dateOfBirth', 'gender', 'maritalStatus', 'mobileNumber', 'email', 'address', 'panNumber', 'aadhaarNumber'];
    const normalizedEmploymentType = String(employmentDetails.employmentType || '').trim().toLowerCase();
    const normalizedLoanType = String(loanDetails.loanType || '').trim().toLowerCase();
    const hasStudentDetails = Boolean(studentDetails.studentType || studentDetails.institutionName || studentDetails.classOrSemester || studentDetails.institutionAddress || studentDetails.city || studentDetails.state);
    const isStudentApplicant = normalizedEmploymentType === 'student' || (normalizedLoanType.includes('education') && hasStudentDetails);
    const normalizedEmploymentDetails = isStudentApplicant ? {
      ...employmentDetails,
      employmentType: 'Student',
      organizationName: '',
      designation: '',
      monthlyIncome: 0,
      workExperience: 0,
      officeAddress: '',
      existingEMI: 0,
      monthlyExpenses: 0,
      overdraftUtilization: 0,
    } : employmentDetails;
    const requiredEmploymentFields = isStudentApplicant
      ? ['employmentType']
      : ['employmentType', 'organizationName', 'designation', 'monthlyIncome', 'workExperience', 'officeAddress', 'existingEMI', 'monthlyExpenses', 'overdraftUtilization'];
    const requiredStudentFields = ['studentType', 'institutionName', 'classOrSemester', 'institutionAddress', 'city', 'state'];
    const missingPersonal = requiredPersonalFields.find((field) => personalDetails[field] === '' || personalDetails[field] === null || personalDetails[field] === undefined);
    const missingEmployment = requiredEmploymentFields.find((field) => normalizedEmploymentDetails[field] === '' || normalizedEmploymentDetails[field] === null || normalizedEmploymentDetails[field] === undefined);
    const missingStudent = isStudentApplicant
      ? requiredStudentFields.find((field) => studentDetails[field] === '' || studentDetails[field] === null || studentDetails[field] === undefined)
      : null;
    const requiredDocumentTypes = isStudentApplicant
      ? (studentDetails.studentType === 'School'
        ? ['aadhaarCard', 'studentIdCard', 'schoolAdmissionProof', 'guardianIncomeProof']
        : ['aadhaarCard', 'studentIdCard', 'admissionFeeProof', 'guardianIncomeProof'])
      : ['panCard', 'aadhaarCard', 'addressProof', 'bankStatement', 'salarySlip', 'itrForm16'];
    const uploadedTypes = new Set(documents.map((document) => document.type));
    if (missingPersonal) return res.status(400).json({ success: false, message: 'All personal details are mandatory.' });
    if (missingEmployment) return res.status(400).json({ success: false, message: 'All employment details are mandatory.' });
    if (isStudentApplicant && !['School', 'College'].includes(studentDetails.studentType)) {
      return res.status(400).json({ success: false, message: 'Select student type as School or College.' });
    }
    if (missingStudent) return res.status(400).json({ success: false, message: 'All student details are mandatory.' });
    if (requiredDocumentTypes.some((type) => !uploadedTypes.has(type))) {
      return res.status(400).json({ success: false, message: isStudentApplicant ? 'Upload all required student documents before submitting.' : 'All six required documents must be uploaded.' });
    }

    const principal = Number(loanDetails.loanAmount);
    const tenureValue = Number(loanDetails.tenure);
    const tenureUnit = loanDetails.tenureUnit;
    if (!['months', 'years'].includes(tenureUnit)) {
      return res.status(400).json({ success: false, message: 'Select tenure unit as Months or Years.' });
    }
    const tenure = tenureUnit === 'years' ? tenureValue * 12 : tenureValue;
    const minTenure = Number(config.tenureMin ?? config.minTenure ?? 1);
    const maxTenure = Number(config.tenureMax ?? config.maxTenure ?? 360);
    if (!tenureValue || tenureValue <= 0 || tenure < minTenure || tenure > maxTenure) {
      return res.status(400).json({
        success: false,
        message: `Tenure must be between ${minTenure} and ${maxTenure} months for ${config.displayName}.`,
      });
    }
    const minAmount = Number(config.minAmount || 10000);
    const maxAmount = getConfiguredMaxAmount(config);
    if (principal < minAmount) {
      return res.status(400).json({ success: false, message: `Minimum loan amount for ${config.displayName} is ₹${minAmount.toLocaleString('en-IN')}.` });
    }
    if (maxAmount && principal > maxAmount) {
      return res.status(400).json({ success: false, message: `Maximum loan amount for ${config.displayName} is Rs.${maxAmount.toLocaleString('en-IN')}.` });
    }
    const interestRate = getConfiguredInterestRate(config);
    const totals = calculateEMI(principal, interestRate, tenure);
    const customerId = user.customerId || String(user._id);
    const blockingLoan = await findBlockingLoanByType({ userId: user._id, customerId, loanType: loanDetails.loanType });
    if (blockingLoan) {
      return res.status(409).json({
        success: false,
        message: duplicateLoanTypeMessage(config.displayName || loanDetails.loanType),
        existingLoan: blockingLoan,
      });
    }
    const applicationId = new mongoose.Types.ObjectId();
    savedDocuments = await saveDocuments(documents, user._id, applicationId);

    const income = Number(normalizedEmploymentDetails.monthlyIncome || 0);
    const existingEMI = Number(normalizedEmploymentDetails.existingEMI || 0);
    const monthlyExpenses = Number(normalizedEmploymentDetails.monthlyExpenses || 0);
    const debtToIncomeRatio = income > 0 ? ((existingEMI + totals.estimatedEMI) / income) * 100 : 100;
    const disposableIncome = income - existingEMI - monthlyExpenses - totals.estimatedEMI;
    let score = 30;
    const eligibilityRules = config.eligibilityRules || {};
    if (income >= (eligibilityRules.minMonthlyIncome || 0)) score += 25;
    if (debtToIncomeRatio <= (eligibilityRules.maxLiabilitiesRatio || 60)) score += 25;
    if (Number(normalizedEmploymentDetails.overdraftUtilization || 0) <= (eligibilityRules.maxOverdraftUsagePercent || 80)) score += 20;
    const isEligible = true;

    const application = await LoanApplication.create({
      _id: applicationId,
      userId: user._id,
      customerId: user.customerId || String(user._id),
      customerName: personalDetails.name || user.name,
      email: personalDetails.email || user.email,
      phone: personalDetails.mobileNumber || user.phone,
      classification: user.classification || 'SILVER',
      accountNumber: account.accountNumber,
      linkedAccountId: account._id,
      loanType: loanDetails.loanType,
      purpose: loanDetails.purpose,
      loanAmount: principal,
      tenure,
      tenureValue,
      tenureUnit,
      interestRate,
      ...totals,
      personalDetails,
      employmentDetails: normalizedEmploymentDetails,
      studentDetails: isStudentApplicant ? {
        studentType: studentDetails.studentType,
        institutionName: studentDetails.institutionName,
        classOrSemester: studentDetails.classOrSemester,
        institutionAddress: studentDetails.institutionAddress,
        city: studentDetails.city,
        state: studentDetails.state,
      } : undefined,
      documents: savedDocuments,
      eligibilitySummary: {
        score, isEligible, debtToIncomeRatio, disposableIncome,
        remarks: [
          income >= (eligibilityRules.minMonthlyIncome || 0) ? 'Income meets the product minimum.' : 'Income is below the product minimum.',
          debtToIncomeRatio <= (eligibilityRules.maxLiabilitiesRatio || 60) ? 'Debt-to-income ratio is acceptable.' : 'Debt-to-income ratio is high.',
        ],
      },
    });

    const loan = await Loan.create({
      userId: user._id,
      customerId: user.customerId || String(user._id),
      loanType: loanDetails.loanType,
      amount: principal,
      tenure,
      monthlyIncome: income,
      purpose: loanDetails.purpose,
      existingLiabilities: existingEMI,
      linkedAccountId: account._id,
      linkedAccountNumber: account.accountNumber,
      interestRate,
      monthlyEMI: totals.estimatedEMI,
      totalInterest: totals.totalInterest,
      totalRepayment: totals.totalRepayment,
      eligibilityScore: score,
      eligibilityDetails: { isEligible, remarks: application.eligibilitySummary.remarks },
      customerClassification: user.classification || 'SILVER',
    });
    application.loanId = loan._id;
    await application.save();
    await LoanApplicationDraft.deleteOne({ userId: user._id });

    await Notification.create({
      userId: user._id,
      title: 'Loan Application Submitted',
      message: `Your ${config.displayName} application for ₹${principal.toLocaleString('en-IN')} has been submitted.`,
      type: 'info',
      priority: 'medium',
      link: '/customer-dashboard/loans',
    });
    const managers = await User.find({ role: 'manager', isActive: true }).select('_id');
    await Notification.insertMany(managers.map((manager) => ({
      userId: manager._id,
      title: 'New Loan Request',
      message: `${user.name} submitted a ${config.displayName} request for ₹${principal.toLocaleString('en-IN')}.`,
      type: 'info',
      priority: 'medium',
      link: '/manager-dashboard/loans',
    })));
    if (user.email) {
      await sendLoanApplicationStatusEmail(user.email, {
        heading: 'Loan Application Submitted',
        customerName: user.name,
        message: 'Your loan application has been received and is awaiting manager review.',
        details: [
          ['Loan Type', config.displayName],
          ['Loan Amount', `₹${principal.toLocaleString('en-IN')}`],
          ['Status', 'Submitted'],
        ],
      }).catch(() => {});
    }

    res.status(201).json({ success: true, message: 'Loan application submitted successfully.', application });
  } catch (error) {
    for (const doc of savedDocuments) await fs.unlink(doc.path).catch(() => {});
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This request is already pending for manager approval.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to submit loan application.' });
  }
};

const getMyApplications = async (req, res) => {
  const applications = await LoanApplication.find({ userId: req.user._id }).sort({ appliedAt: -1 }).lean();
  res.json({ success: true, applications: applications.map(withReadOnlyFlag) });
};

const getManagerApplications = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.loanType) filter.loanType = req.query.loanType;
  const applications = await LoanApplication.find(filter)
    .sort({ appliedAt: -1 })
    .populate('userId', 'name customerId email phone')
    .lean();
  res.json({ success: true, applications });
};

const getApplicationDetails = async (req, res) => {
  const application = await LoanApplication.findById(req.params.id).select('+documents.path').lean();
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  const canView = String(application.userId) === String(req.user._id) || ['manager', 'admin'].includes(req.user.role);
  if (!canView) return res.status(403).json({ success: false, message: 'Access denied.' });
  application.documents = application.documents.map(({ path: ignored, ...doc }) => doc);
  res.json({ success: true, application: withReadOnlyFlag(application) });
};

const updateCustomerApplication = async (req, res) => {
  const application = await LoanApplication.findOne({ _id: req.params.id, userId: req.user._id });
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  if (isReadOnlyApplicationStatus(application.status)) {
    return res.status(403).json({
      success: false,
      message: 'Submitted loan applications are read-only and cannot be modified.',
    });
  }

  return res.status(403).json({
    success: false,
    message: 'Loan application updates are not allowed after submission.',
  });
};

const getApplicationDocument = async (req, res) => {
  try {
    const application = await LoanApplication.findById(req.params.id).select('+documents.path');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    const canView = String(application.userId) === String(req.user._id) || ['manager', 'admin'].includes(req.user.role);
    if (!canView) return res.status(403).json({ success: false, message: 'Access denied.' });

    const document = application.documents.id(req.params.documentId);
    if (!document?.path) return res.status(404).json({ success: false, message: 'Document not found.' });

    const resolvedPath = path.resolve(document.path);
    const resolvedRoot = path.resolve(UPLOAD_ROOT);
    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      return res.status(400).json({ success: false, message: 'Invalid document path.' });
    }

    await fs.access(resolvedPath);
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    const safeName = sanitizeFileName(document.originalName);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Document file not found.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to open document.' });
  }
};

const updateStatus = async (req, res) => {
  const { action, comment, rejectionReason, approvedAmount } = req.body;
  const application = await LoanApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  const loan = await Loan.findById(application.loanId);
  const customer = await User.findById(application.userId);
  if (['Rejected', 'Disbursed'].includes(application.status) && ['review', 'more-info', 'reject', 'approve'].includes(action)) {
    return res.status(409).json({
      success: false,
      message: `This loan application is already ${application.status}.`,
    });
  }
  if (application.status === 'Approved' && ['review', 'more-info', 'reject'].includes(action)) {
    return res.status(409).json({
      success: false,
      message: 'This loan application is already approved.',
    });
  }
  application.reviewedAt = new Date();
  application.managerComment = comment || '';

  if (action === 'review') {
    application.status = 'Under Review';
    if (loan) loan.status = 'Under Review';
  } else if (action === 'more-info') {
    application.status = 'More Info Required';
    application.managerDecision = 'More Info Required';
    if (loan) {
      loan.status = 'More Info Required';
      loan.additionalInfoRequest = comment;
      loan.additionalInfoResponse = '';
    }
  } else if (action === 'reject') {
    if (!rejectionReason?.trim()) return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    application.status = 'Rejected';
    application.managerDecision = 'Rejected';
    application.rejectionReason = rejectionReason.trim();
    if (loan) {
      loan.status = 'Rejected';
      loan.rejectionReason = rejectionReason.trim();
    }
  } else if (action === 'approve') {
    if (!loan) return res.status(400).json({ success: false, message: 'Linked loan record was not found.' });
    if ((application.status === 'Approved' || loan.status === 'Approved') && loan.disbursedAt) {
      return res.status(409).json({ success: false, message: 'This loan application is already approved.' });
    }
    if (['Disbursed', 'Closed'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: 'This loan has already been disbursed.' });
    }
    const finalApprovedAmount = Number(approvedAmount || application.loanAmount);
    if (!Number.isFinite(finalApprovedAmount) || finalApprovedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid approved loan amount.' });
    }
    const disbursementAccount = await Account.findOne({
      _id: loan.linkedAccountId || application.linkedAccountId,
      userId: application.userId,
      status: 'active',
    });
    if (!disbursementAccount) {
      return res.status(400).json({ success: false, message: 'Linked customer account was not found. Loan cannot be disbursed.' });
    }
    const totals = calculateEMI(finalApprovedAmount, application.interestRate, application.tenure);
    const firstDueDate = new Date();
    firstDueDate.setMonth(firstDueDate.getMonth() + 1);
    const disbursedAt = new Date();

    application.status = 'Disbursed';
    application.managerDecision = 'Approved';
    application.emiStartDate = firstDueDate;
    application.disbursedAt = disbursedAt;
    application.estimatedEMI = totals.estimatedEMI;
    application.totalInterest = totals.totalInterest;
    application.totalRepayment = totals.totalRepayment;
    loan.status = 'Disbursed';
    loan.approvedAmount = finalApprovedAmount;
    loan.interestRate = application.interestRate;
    loan.monthlyEMI = totals.estimatedEMI;
    loan.totalInterest = totals.totalInterest;
    loan.totalRepayment = totals.totalRepayment;
    loan.outstandingBalance = finalApprovedAmount;
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    loan.disbursedAt = disbursedAt;
    loan.emiStartDate = firstDueDate;
    loan.nextEMIDueDate = firstDueDate;
    disbursementAccount.balance += finalApprovedAmount;
    await disbursementAccount.save();
  } else {
    return res.status(400).json({ success: false, message: 'Invalid manager action.' });
  }

  await Promise.all([application.save(), loan?.save()]);
  if (action === 'approve') {
    await ensureEMISchedule(loan);
    const creditedAccount = await Account.findById(loan.linkedAccountId || application.linkedAccountId).select('balance').lean();
    await Transaction.create({
      userId: application.userId,
      toAccount: loan.linkedAccountId || application.linkedAccountId,
      toAccountNumber: application.accountNumber || loan.linkedAccountNumber,
      amount: loan.approvedAmount,
      type: 'credit',
      category: 'other',
      status: 'completed',
      description: `Loan disbursement for ${loan.loanNumber}`,
      balance_after: creditedAccount?.balance,
      finalAccountBalance: creditedAccount?.balance,
      metadata: {
        loanId: loan._id,
        loanNumber: loan.loanNumber,
        source: 'loan_application_approval',
      },
    });
  }
  const statusMessage = action === 'reject'
    ? `Your loan application was rejected. Reason: ${application.rejectionReason}`
    : action === 'more-info'
      ? `More information is required: ${comment}`
      : action === 'approve'
        ? `Your loan application has been approved for ₹${Number(loan.approvedAmount).toLocaleString('en-IN')}.`
        : `Your loan application status is now ${application.status}.`;
  await Notification.create({
    userId: application.userId,
    title: `Loan ${application.status}`,
    message: statusMessage,
    type: action === 'reject' ? 'rejection' : action === 'approve' ? 'approval' : 'info',
    priority: ['reject', 'more-info', 'approve'].includes(action) ? 'high' : 'medium',
    link: '/customer-dashboard/loans',
  });

  res.json({ success: true, message: `Application updated to ${application.status}.`, application });

  if (customer?.email) {
    if (action === 'reject') {
      await sendLoanRejectedEmail(customer.email, {
        loanNumber: loan?.loanNumber || String(application._id),
        loanType: application.loanType,
        amount: application.loanAmount,
        reason: application.rejectionReason,
      }).catch(() => {});
    } else if (action === 'approve') {
      await sendLoanApprovedEmail(customer.email, {
        customerName: customer.name,
        loanNumber: loan.loanNumber,
        loanType: application.loanType,
        approvedAmount: loan.approvedAmount,
        interestRate: application.interestRate,
        tenure: application.tenure,
        monthlyEMI: application.estimatedEMI,
        totalRepayment: application.totalRepayment,
        firstEMIDate: loan.emiStartDate
          ? new Date(loan.emiStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
          : '',
        accountNumber: application.accountNumber,
      }).catch(() => {});
    } else {
      await sendLoanApplicationStatusEmail(customer.email, {
        heading: `Loan ${application.status}`,
        customerName: customer.name,
        message: statusMessage,
        details: [['Application', String(application._id)], ['Status', application.status]],
      }).catch(() => {});
    }
  }
};

module.exports = {
  getBootstrap,
  saveDraft,
  submitApplication,
  getMyApplications,
  getManagerApplications,
  getApplicationDetails,
  getApplicationDocument,
  updateCustomerApplication,
  updateStatus,
};


