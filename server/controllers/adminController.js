const User = require('../models/User');
const Account = require('../models/Account');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');
const Transaction = require('../models/Transaction');
const ApprovalRequest = require('../models/ApprovalRequest');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const XLSX = require('xlsx');
const { createUniqueUserId } = require('../utils/idGenerator');
const { normalizeGuardianDetails, validateGuardianForCustomer } = require('../utils/guardianValidation');
const { normalizeEmail } = require('../utils/emailValidation');

const consolidatedTransactionQuery = {
  reference: { $not: /-CR$/ },
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatReportDate = (date) => {
  if (!date) return 'Not provided';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Not provided';
  return `${String(value.getDate()).padStart(2, '0')}-${shortMonthNames[value.getMonth()]}-${value.getFullYear()}`;
};

const getMonthlyRange = (year, month) => {
  const numericYear = Number.parseInt(year, 10);
  const numericMonth = Number.parseInt(month, 10);
  if (!numericYear || numericMonth < 1 || numericMonth > 12) return null;

  return {
    start: new Date(numericYear, numericMonth - 1, 1),
    end: new Date(numericYear, numericMonth, 1),
    year: numericYear,
    month: numericMonth,
    label: `${monthNames[numericMonth - 1]} ${numericYear}`,
  };
};

// ─── Validation ───────────────────────────────────────────────────────────────
const createUserValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required').isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().withMessage('Please enter a valid email address').customSanitizer(normalizeEmail),
  body('phone').trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['customer', 'manager']).withMessage('Role must be customer or manager'),
  body('accountType').if(body('role').equals('customer')).isIn(['savings', 'current', 'salary']).withMessage('Account type is required for customers'),
  body('dateOfBirth').if(body('role').equals('customer')).notEmpty().withMessage('Date of birth is required').isISO8601().withMessage('Date of birth must be a valid date'),
  body('guardianDetails.name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Guardian name must be 2-100 characters'),
  body('guardianDetails.relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Guardian relationship is required'),
  body('guardianDetails.phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid guardian phone number'),
  body('guardianDetails.dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Guardian date of birth must be a valid date'),
];

// ─── @desc    Get system stats
// ─── @route   GET /api/admin/stats
// ─── @access  Protected (admin)
const getSystemStats = async (req, res, next) => {
  try {
    const approvedCustomerIds = await User.find({
      role: 'customer',
      isActive: true,
      approvalStatus: 'approved',
    }).distinct('_id');

    const activeManagerQuery = { role: 'manager', isActive: true };
    const transactionQuery = {
      ...consolidatedTransactionQuery,
      userId: { $in: approvedCustomerIds },
    };
    const overdraftActivityQuery = {
      userId: { $in: approvedCustomerIds },
      $or: [
        { overdraftUsed: { $gt: 0 } },
        { overdraftPenalty: { $gt: 0 } },
        { monthlyOverdraftCount: { $gt: 0 } },
        { overdraftStatus: 'DEACTIVATED' },
      ],
    };

    const [
      totalManagers,
      totalTransactions,
      customerClassifications,
      overdraftAccounts,
      overdueAggregation,
      recentTransactions,
      recentLogins,
    ] = await Promise.all([
      User.countDocuments(activeManagerQuery),
      Transaction.countDocuments(transactionQuery),
      User.aggregate([
        { $match: { _id: { $in: approvedCustomerIds } } },
        { $group: { _id: '$classification', count: { $sum: 1 } } },
      ]),
      Account.countDocuments(overdraftActivityQuery),
      Account.aggregate([
        { $match: overdraftActivityQuery },
        { $group: { _id: null, totalOverdraftUsed: { $sum: '$overdraftUsed' }, totalOverdraftLimit: { $sum: '$overdraftLimit' } } },
      ]),
      Transaction.find(transactionQuery)
        .populate('userId', 'name customerId')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AuditLog.find({ action: 'login', userId: { $exists: true, $ne: null } })
        .populate('userId', 'name customerId adminId role')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const totalCustomers = approvedCustomerIds.length;

    const classificationCounts = customerClassifications.reduce((acc, entry) => {
      if (entry._id) acc[entry._id] = entry.count;
      return acc;
    }, {});

    const rawTransactions = await Transaction.find(transactionQuery).select('amount createdAt').sort({ createdAt: 1 }).lean();

    const dailyDataMap = {};
    const weeklyDataMap = {};
    const monthlyDataMap = {};

    rawTransactions.forEach((tx) => {
      const date = new Date(tx.createdAt);
      const dailyLabel = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const weekDate = new Date(date);
      weekDate.setHours(0, 0, 0, 0);
      weekDate.setDate(weekDate.getDate() + 4 - (weekDate.getDay() || 7));
      const yearStart = new Date(weekDate.getFullYear(), 0, 1);
      const weekNumber = Math.ceil((((weekDate - yearStart) / 86400000) + 1) / 7);
      const weeklyLabel = `W${weekNumber.toString().padStart(2, '0')} ${weekDate.getFullYear()}`;

      const addToMap = (map, key) => {
        if (!map[key]) map[key] = { amount: 0, count: 0 };
        map[key].amount += tx.amount || 0;
        map[key].count += 1;
      };

      addToMap(dailyDataMap, dailyLabel);
      addToMap(weeklyDataMap, weeklyLabel);
      addToMap(monthlyDataMap, monthLabel);
    });

    const toSeries = (map) => Object.entries(map).map(([label, values]) => ({ label, ...values }));

    const charts = {
      daily: toSeries(dailyDataMap),
      weekly: toSeries(weeklyDataMap),
      monthly: toSeries(monthlyDataMap),
    };

    const overdraftSummary = {
      totalOverdraftUsed: overdueAggregation[0]?.totalOverdraftUsed || 0,
      totalOverdraftLimit: overdueAggregation[0]?.totalOverdraftLimit || 0,
      availableOverdraft: Math.max((overdueAggregation[0]?.totalOverdraftLimit || 0) - (overdueAggregation[0]?.totalOverdraftUsed || 0), 0),
      totalOverdraftAccounts: overdraftAccounts,
    };

    const recentLoginData = recentLogins.filter((log) => log.userId).slice(0, 5).map((log) => ({
      _id: log._id,
      userName: log.userName || log.userId.name,
      userId: log.userId.customerId || log.userId.adminId || log.userId._id.toString(),
      role: log.userId.role || log.userRole,
      createdAt: log.createdAt,
    }));

    const recentTransactionData = recentTransactions.map((tx) => ({
      _id: tx._id,
      reference: tx.reference,
      amount: tx.amount,
      status: tx.status,
      type: tx.type,
      createdAt: tx.createdAt,
      userName: tx.userId.name,
      senderName: tx.metadata?.senderName || tx.userId.name,
      receiverName: tx.metadata?.receiverName || tx.metadata?.receiverNickname || tx.toAccountNumber || '-',
      fromAccountNumber: tx.fromAccountNumber,
      toAccountNumber: tx.toAccountNumber,
    }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCustomers,
          totalManagers,
          totalTransactions,
        },
        charts,
        classifications: classificationCounts,
        overdraft: overdraftSummary,
        recentTransactions: recentTransactionData,
        recentLogins: recentLoginData,
      },
      stats: {
        totalCustomers,
        totalManagers,
        totalTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get all users (customers + managers)
// ─── @route   GET /api/admin/users
// ─── @access  Protected (admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', role } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = { role: { $in: ['customer', 'manager'] } };
    if (role && ['customer', 'manager'].includes(role)) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), total },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Create user (customer or manager only — not admin)
// ─── @route   POST /api/admin/users
// ─── @access  Protected (admin)
const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, accountType, dateOfBirth, guardianDetails } = req.body;

    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot create another admin account.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const guardianCheck = validateGuardianForCustomer({ role, dateOfBirth, guardianDetails });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      customerId: role === 'customer' ? await createUniqueUserId('customer') : undefined,
      primaryAccountType: role === 'customer' ? accountType : undefined,
      dateOfBirth: dateOfBirth || null,
      guardianDetails: role === 'customer' ? normalizeGuardianDetails(guardianDetails) : undefined,
    });

    // Create default accounts for customers
    if (role === 'customer') {
      await Account.create({
        userId: user._id,
        customerId: user.customerId,
        accountType,
        balance: FIXED_ACCOUNT_BALANCES[accountType],
        classification: 'PENDING',
      });

      await Notification.create({
        userId: user._id,
        title: 'Welcome to Adnate PayNest! 🎉',
        message: `Hello ${name}, your account has been created by the administrator. Your default accounts are ready.`,
        type: 'info',
        priority: 'high',
      });
    }

    res.status(201).json({
      success: true,
      message: `${role === 'customer' ? 'Customer' : 'Manager'} account created successfully.`,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Update user role/status
// ─── @route   PUT /api/admin/users/:id
// ─── @access  Protected (admin)
const updateUser = async (req, res, next) => {
  try {
    const { role, isActive, name, phone } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify the admin account.' });
    }

    if (role && ['customer', 'manager'].includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save({ validateBeforeSave: false });

    const changedFields = [
      role && ['customer', 'manager'].includes(role) ? 'role' : null,
      isActive !== undefined ? 'status' : null,
      name ? 'name' : null,
      phone ? 'phone' : null,
    ].filter(Boolean);

    if (user.role === 'customer' && changedFields.length > 0) {
      await Notification.create({
        userId: user._id,
        title: 'Profile Updated',
        message: `An admin updated your profile (${changedFields.join(', ')}). Please review your profile details.`,
        type: 'info',
        priority: 'medium',
        senderId: req.user._id,
        senderName: req.user.name || 'Admin',
        senderRole: 'admin',
        link: '/customer-dashboard/profile',
      }).catch((notifErr) => {
        console.warn('Customer profile update notification failed:', notifErr.message);
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Toggle user active/inactive
// ─── @route   PUT /api/admin/users/:id/toggle-status
// ─── @access  Protected (admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot deactivate the admin account.' });
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      isActive: user.isActive,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get all transactions (system-wide)
// ─── @route   GET /api/admin/transactions
// ─── @access  Protected (admin)
const getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = { ...consolidatedTransactionQuery };
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }

    const customerIds = await User.find({ role: 'customer' }).distinct('_id');
    query.userId = { $in: customerIds };

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), total },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Send system-wide notification
// ─── @route   POST /api/admin/notifications/send
// ─── @access  Protected (admin)
const sendSystemNotification = async (req, res, next) => {
  try {
    const { title, message, targetRole, priority = 'medium' } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    const userQuery = { isActive: true };
    if (targetRole && ['customer', 'manager'].includes(targetRole)) {
      userQuery.role = targetRole;
    } else {
      userQuery.role = { $in: ['customer', 'manager'] };
    }

    const users = await User.find(userQuery).select('_id');

    const notifications = users.map((u) => ({
      userId: u._id,
      title,
      message,
      type: 'system',
      priority,
    }));

    await Notification.insertMany(notifications);

    res.status(200).json({
      success: true,
      message: `Notification sent to ${users.length} user(s).`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get system analytics
// ─── @route   GET /api/admin/analytics
// ─── @access  Protected (admin)
const getSystemAnalytics = async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [monthlyTx, approvalStats, accountTypeStats] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, type: '$type' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      ApprovalRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      ]),
      Account.aggregate([
        { $group: { _id: '$accountType', count: { $sum: 1 }, totalBalance: { $sum: '$balance' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      monthlyTransactions: monthlyTx,
      approvalStats,
      accountTypeStats,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get all accounts (for overdraft monitoring)
// ─── @route   GET /api/admin/accounts
// ─── @access  Protected (admin, manager)
const getAllAccounts = async (req, res, next) => {
  try {
    const { overdraftOnly } = req.query;
    const query = { status: { $ne: 'closed' } };
    if (overdraftOnly === 'true') query.overdraftUsed = { $gt: 0 };

    const accounts = await Account.find(query)
      .populate('userId', 'name email')
      .sort({ overdraftUsed: -1 });

    res.status(200).json({ success: true, accounts });
  } catch (error) {
    next(error);
  }
};

const buildCustomerMonitoringQuery = async ({ year, month, search = '', status = 'all' }) => {
  const range = getMonthlyRange(year, month);
  const query = {
    role: 'customer',
    approvalStatus: 'approved',
  };

  if (range) query.createdAt = { $gte: range.start, $lt: range.end };
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i');
    const matchingAccountUserIds = await Account.find({ accountNumber: regex }).distinct('userId');
    query.$or = [
      { name: regex },
      { customerId: regex },
      { email: regex },
      { _id: { $in: matchingAccountUserIds } },
    ];
  }

  return { query, range };
};

const buildCustomersWithStats = async (customers) => {
  const customerIds = customers.map((c) => c._id);
  const accounts = await Account.find({ userId: { $in: customerIds } }).lean();
  const accountsByCustomerId = accounts.reduce((acc, account) => {
    const key = account.userId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {});

  const maskAadhaar = (value) => (value ? `XXXX XXXX ${String(value).slice(-4)}` : '');
  const maskPan = (value) => (value ? `XXXXXX${String(value).slice(-4)}` : '');

  return customers.map((c) => {
    const customer = c.toObject ? c.toObject() : c;
    const userAccounts = accountsByCustomerId[customer._id.toString()] || [];
    const totalBalance = userAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalODUsed = userAccounts.reduce((s, a) => s + (a.overdraftUsed || 0), 0);
    const hasAadhaar = !!customer.aadhaarNumber;
    const hasPan = !!customer.panNumber;
    const hasDateOfBirth = !!customer.dateOfBirth;
    const isKycComplete = hasAadhaar && hasPan && hasDateOfBirth;

    return {
      ...customer,
      aadhaarNumber: undefined,
      panNumber: undefined,
      maskedAadhaarNumber: maskAadhaar(customer.aadhaarNumber),
      maskedPanNumber: maskPan(customer.panNumber),
      hasAadhaar,
      hasPan,
      hasDateOfBirth,
      isKycComplete,
      accounts: userAccounts,
      totalBalance,
      totalODUsed,
    };
  });
};

// ─── @desc    Get all customers (for manager customer monitoring)
// ─── @route   GET /api/admin/customers
// ─── @access  Protected (admin, manager)
const getAllCustomers = async (req, res, next) => {
  try {
    const { query, range } = await buildCustomerMonitoringQuery(req.query);
    const customers = await User.find(query)
      .select('-password +aadhaarNumber +panNumber')
      .sort({ createdAt: -1 });
    const customersWithStats = await buildCustomersWithStats(customers);

    res.status(200).json({
      success: true,
      customers: customersWithStats,
      filters: range ? { year: range.year, month: range.month, label: range.label } : null,
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerRegistrationYears = async (req, res, next) => {
  try {
    const years = await User.aggregate([
      { $match: { role: 'customer', approvalStatus: 'approved', createdAt: { $exists: true } } },
      { $group: { _id: { $year: '$createdAt' } } },
      { $sort: { _id: -1 } },
    ]);

    const currentYear = new Date().getFullYear();
    const result = years.map((item) => item._id).filter(Boolean);
    if (!result.includes(currentYear)) result.unshift(currentYear);

    res.status(200).json({ success: true, years: result });
  } catch (error) {
    next(error);
  }
};

const downloadCustomerMonthlyReport = async (req, res, next) => {
  try {
    const { query, range } = await buildCustomerMonitoringQuery(req.query);
    if (!range) {
      return res.status(400).json({ success: false, message: 'Valid year and month are required.' });
    }

    const customers = await User.find(query)
      .select('-password +aadhaarNumber +panNumber')
      .sort({ createdAt: -1 });
    const customersWithStats = await buildCustomersWithStats(customers);

    const columns = [
      'S.No.',
      'Customer ID',
      'Customer Name',
      'Email',
      'Phone',
      'Status',
      'KYC Status',
      'Registration Date',
      'Primary Account',
      'Account Numbers',
      'Total Balance',
      'OD Used',
      'Classification',
    ];

    const rows = customersWithStats.map((customer, index) => ({
      'S.No.': index + 1,
      'Customer ID': customer.customerId || '',
      'Customer Name': customer.name || '',
      'Email': customer.email || '',
      'Phone': customer.phone || '',
      'Status': customer.isActive ? 'Active' : 'Inactive',
      'KYC Status': customer.isKycComplete ? 'Complete' : 'Incomplete',
      'Registration Date': formatReportDate(customer.createdAt),
      'Primary Account': customer.primaryAccountType || '',
      'Account Numbers': (customer.accounts || []).map((account) => account.accountNumber).filter(Boolean).join(', '),
      'Total Balance': customer.totalBalance || 0,
      'OD Used': customer.totalODUsed || 0,
      'Classification': customer.classification || 'PENDING',
    }));

    const sheetRows = [
      ['Adnate PayNest'],
      ['Adnate PayNest – Monthly Customer Registration Report'],
      [`Report Month: ${range.label}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['Summary'],
      ['Total Registered Customers', customersWithStats.length],
      ['Active Customers', customersWithStats.filter((customer) => customer.isActive).length],
      ['Inactive Customers', customersWithStats.filter((customer) => !customer.isActive).length],
      ['KYC Complete', customersWithStats.filter((customer) => customer.isKycComplete).length],
      [],
      columns,
      ...(rows.length
        ? rows.map((row) => columns.map((column) => row[column] ?? ''))
        : [['No customer registrations found for this filter.']]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
    ];
    worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(14, String(column).length + 4) }));
    worksheet['!autofilter'] = { ref: `A12:M${Math.max(12, sheetRows.length)}` };
    worksheet['!freeze'] = { xSplit: 0, ySplit: 12 };

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Customers');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Adnate_PayNest_Monthly_Customer_Registration_Report_${range.year}-${String(range.month).padStart(2, '0')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getAllTransactions,
  sendSystemNotification,
  getSystemAnalytics,
  getAllAccounts,
  getAllCustomers,
  getCustomerRegistrationYears,
  downloadCustomerMonthlyReport,
  createUserValidation,
};

