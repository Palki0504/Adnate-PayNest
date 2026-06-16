const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Beneficiary = require('../models/Beneficiary');
const OverdraftLog = require('../models/OverdraftLog');
const User = require('../models/User');
const XLSX = require('xlsx');
const {
  checkDailyTransferLimit,
  checkMonthlyTransferLimit,
  checkOverdraftAllowed,
  updateAccountAfterTransfer,
  generateTransactionId,
  validateBeneficiary,
} = require('../utils/transferHelper');
const { sendTransferSuccessEmail, sendTransferFailureEmail, sendTransferNotificationEmail } = require('../utils/emailService');
const { body, validationResult } = require('express-validator');

const consolidatedTransactionQuery = {
  reference: { $not: /-CR$/ },
};

// ─── @desc    Get transactions with search, filter, sort, pagination
// ─── @route   GET /api/transactions
// ─── @access  Protected (customer)
const getMyTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      type,
      status,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate,
    } = req.query;

    const accountIds = await Account.find({ userId: req.user._id }).distinct('_id');
    const visibilityQuery = {
      $or: [
        { userId: req.user._id },
        { toAccount: { $in: accountIds } },
      ],
    };

    const query = {
      ...consolidatedTransactionQuery,
      $and: [visibilityQuery],
    };

    if (type) query.type = type;
    if (status) query.status = status;
    if (category) query.category = category;

    if (search) {
      query.$and.push({
        $or: [
          { description: { $regex: search, $options: 'i' } },
          { reference: { $regex: search, $options: 'i' } },
          { fromAccountNumber: { $regex: search, $options: 'i' } },
          { toAccountNumber: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalTransactions: total,
        limit: limitNum,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportMyTransactions = async (req, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid month in YYYY-MM format.',
      });
    }

    const [year, monthNumber] = month.split('-').map(Number);
    const startDate = new Date(year, monthNumber - 1, 1);
    const endDate = new Date(year, monthNumber, 1);

    const accountIds = await Account.find({ userId: req.user._id }).distinct('_id');
    const transactions = await Transaction.find({
      ...consolidatedTransactionQuery,
      $or: [
        { userId: req.user._id },
        { toAccount: { $in: accountIds } },
      ],
      createdAt: { $gte: startDate, $lt: endDate },
    }).sort({ createdAt: -1 });

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
    const rows = transactions.map((tx) => ({
      'Date': new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Time': new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      'Description': tx.description || '',
      'From Account': tx.fromAccountNumber || '',
      'To Account': tx.toAccountNumber || '',
      'Category': tx.category || '',
      'Type': tx.type || '',
      'Status': tx.status || '',
      'Amount': tx.amount || 0,
      'Reference': tx.reference || '',
      'Receiver Name': tx.metadata?.receiverName || tx.metadata?.beneficiaryName || '',
      'Receiver Customer ID': tx.metadata?.receiverCustomerId || '',
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
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `transactions-${req.user.customerId || req.user._id}-${month}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get analytics data (spending by category, monthly trend)
// ─── @route   GET /api/transactions/analytics
// ─── @access  Protected (customer)
const getAnalytics = async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Spending by category (debits only)
    const categoryData = await Transaction.aggregate([
      {
        $match: {
          ...consolidatedTransactionQuery,
          userId: req.user._id,
          type: 'debit',
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Monthly trend (last 6 months)
    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          ...consolidatedTransactionQuery,
          userId: req.user._id,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.status(200).json({
      success: true,
      categoryBreakdown: categoryData,
      monthlyTrend: monthlyData,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get all transactions for admin with filters/search
// ─── @route   GET /api/transactions/admin
// ─── @access  Protected (admin)
const getAdminTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      period = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
    } = req.query;

    const match = { ...consolidatedTransactionQuery };

    if (status && status !== 'all') {
      match.status = status;
    }
    if (type && type !== 'all') {
      match.type = type;
    }

    if (period && period !== 'all') {
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = null;
      }
      if (startDate) {
        match.createdAt = { $gte: startDate };
      }
    }

    const searchRegex = search ? new RegExp(search, 'i') : null;

    const lookupPipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'user.role': 'customer',
        },
      },
      {
        $lookup: {
          from: 'accounts',
          localField: 'toAccount',
          foreignField: '_id',
          as: 'toAccountDoc',
        },
      },
      {
        $unwind: {
          path: '$toAccountDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'toAccountDoc.userId',
          foreignField: '_id',
          as: 'receiverUser',
        },
      },
      {
        $unwind: {
          path: '$receiverUser',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (searchRegex) {
      match.$or = [
        { reference: searchRegex },
        { fromAccountNumber: searchRegex },
        { toAccountNumber: searchRegex },
        { 'user.customerId': searchRegex },
        { 'user.name': searchRegex },
        { 'receiverUser.customerId': searchRegex },
        { 'receiverUser.name': searchRegex },
        { 'metadata.receiverName': searchRegex },
        { 'metadata.receiverCustomerId': searchRegex },
      ];
    }

    const sortOptions = {};
    if (sortBy === 'customerName') {
      sortOptions['user.name'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'customerId') {
      sortOptions['user.customerId'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const aggregationPipeline = [
      ...lookupPipeline,
      { $match: match },
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          user: {
            _id: 1,
            name: 1,
            customerId: 1,
            email: 1,
          },
          reference: 1,
          senderName: '$user.name',
          senderCustomerId: '$user.customerId',
          receiverName: {
            $ifNull: [
              '$metadata.receiverName',
              { $ifNull: ['$receiverUser.name', { $ifNull: ['$metadata.receiverNickname', '$toAccountNumber'] }] },
            ],
          },
          receiverCustomerId: {
            $ifNull: ['$metadata.receiverCustomerId', '$receiverUser.customerId'],
          },
          fromAccountNumber: 1,
          toAccountNumber: 1,
          amount: 1,
          status: 1,
          type: 1,
          category: 1,
          description: 1,
          createdAt: 1,
        },
      },
    ];

    const countPipeline = [
      ...lookupPipeline,
      { $match: match },
      { $count: 'total' },
    ];

    const summaryPipeline = [
      ...lookupPipeline,
      { $match: match },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ];

    const [transactions, countResult, summaryResult] = await Promise.all([
      Transaction.aggregate(aggregationPipeline),
      Transaction.aggregate(countPipeline),
      Transaction.aggregate(summaryPipeline),
    ]);

    const totalTransactions = countResult[0]?.total || 0;
    const totalAmount = summaryResult[0]?.totalAmount || 0;

    res.status(200).json({
      success: true,
      transactions,
      totalTransactions,
      totalAmount,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalTransactions / limitNum),
        totalTransactions,
        limit: limitNum,
        hasNext: pageNum * limitNum < totalTransactions,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Transfer money to a beneficiary
// ─── @route   POST /api/transactions/transfer-to-beneficiary
// ─── @access  Protected (customer)
const transferToBeneficiary = async (req, res, next) => {
  try {
    const { fromAccountId, beneficiaryId, amount, description = '', category = 'transfer' } = req.body;

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer amount must be greater than 0',
      });
    }

    // Get sender account
    const fromAccount = await Account.findOne({ _id: fromAccountId, userId: req.user._id });
    if (!fromAccount) {
      return res.status(404).json({
        success: false,
        message: 'Source account not found',
      });
    }

    if (fromAccount.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Source account is not active',
      });
    }

    // Look up beneficiary and validate ownership
    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      userId: req.user._id,
      isActive: true,
    });
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found or inactive.',
      });
    }

    const receiverName = beneficiary.beneficiaryName;
    const receiverNickname = beneficiary.nickname;
    const receiverCustomerId = beneficiary.customerId;

    // Look up recipient user by customerId
    const receiverUser = await User.findOne({ customerId: receiverCustomerId, isActive: true });
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found in our system.',
      });
    }

    // Resolve the exact account saved on the beneficiary.
    const toAccount = beneficiary.accountNumber
      ? await Account.findOne({
        userId: receiverUser._id,
        accountNumber: beneficiary.accountNumber,
        status: 'active',
      })
      : await Account.findOne({ userId: receiverUser._id, status: 'active' });
    if (!toAccount) {
      return res.status(404).json({
        success: false,
        message: 'Recipient does not have an active account.',
      });
    }

    // Check daily transfer limit
    const dailyCheck = await checkDailyTransferLimit(fromAccountId, amount);
    if (!dailyCheck.allowed) {
      const user = await User.findById(req.user._id);
      await sendTransferNotificationEmail(
        user.email,
        user.name,
        receiverName,
        amount,
        dailyCheck.reason,
        category,
        'failed'
      );
      return res.status(400).json({
        success: false,
        message: dailyCheck.reason,
        limit: dailyCheck.limit,
        used: dailyCheck.used,
        remaining: dailyCheck.remaining,
      });
    }

    // Check monthly transfer limit
    const monthlyCheck = await checkMonthlyTransferLimit(fromAccountId, amount);
    if (!monthlyCheck.allowed) {
      const user = await User.findById(req.user._id);
      await sendTransferNotificationEmail(
        user.email,
        user.name,
        receiverName,
        amount,
        monthlyCheck.reason,
        category,
        'failed'
      );
      return res.status(400).json({
        success: false,
        message: monthlyCheck.reason,
        limit: monthlyCheck.limit,
        used: monthlyCheck.used,
        remaining: monthlyCheck.remaining,
      });
    }

    // Check sufficient balance or overdraft
    let usesOverdraft = false;
    if (amount > fromAccount.balance) {
      const odCheck = await checkOverdraftAllowed(fromAccountId, amount);
      if (!odCheck.allowed) {
        const user = await User.findById(req.user._id);
        await sendTransferNotificationEmail(
          user.email,
          user.name,
          receiverName,
          amount,
          odCheck.reason,
          category,
          'failed'
        );
        return res.status(400).json({
          success: false,
          message: odCheck.reason,
          monthlyOverdraftCount: odCheck.monthlyOverdraftCount,
        });
      }
      usesOverdraft = odCheck.usesOverdraft;
    }

    const balanceAmountUsed = Math.min(amount, fromAccount.balance);
    const overdraftAmountUsed = Math.max(0, amount - balanceAmountUsed);
    const finalAccountBalance = Math.max(0, fromAccount.balance - balanceAmountUsed);

    // Generate unique transaction ID
    const transactionId = generateTransactionId();

    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: fromAccountId,
      toAccount: toAccount._id,
      fromAccountNumber: fromAccount.accountNumber,
      toAccountNumber: toAccount.accountNumber,
      amount,
      type: 'transfer',
      category,
      description: `Transfer to ${receiverNickname} (${receiverName})`,
      reference: transactionId,
      status: 'completed',
      balance_after: finalAccountBalance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
      finalAccountBalance,
      metadata: {
        usedOverdraft: usesOverdraft,
        overdraftAmountUsed,
        balanceAmountUsed,
        finalAccountBalance,
        senderName: req.user.name,
        senderCustomerId: req.user.customerId,
        receiverName,
        receiverNickname,
        receiverCustomerId,
      },
    });

    // Update account balances
    fromAccount.balance = finalAccountBalance;
    toAccount.balance += amount;

    // If overdraft was used, update overdraft tracking
    if (usesOverdraft) {
      fromAccount.overdraftUsed += overdraftAmountUsed;

      // Log overdraft usage
      await OverdraftLog.create({
        userId: req.user._id,
        accountId: fromAccountId,
        transactionId: transaction._id,
        amount: overdraftAmountUsed,
        odLimitAtTime: fromAccount.overdraftLimit,
        penaltyPerDayAtTime: fromAccount.getOverdraftDailyPenalty(),
        odUsedAfter: fromAccount.overdraftUsed,
        monthlyUsageAfter: (fromAccount.monthlyOverdraftCount || 0) + 1,
        penaltyAmountAfter: fromAccount.overdraftPenalty || 0,
        totalDueAfter: (fromAccount.overdraftUsed || 0) + (fromAccount.overdraftPenalty || 0),
        overdraftStatusAfter: (fromAccount.monthlyOverdraftCount || 0) + 1 >= 3 ? 'DEACTIVATED' : 'ACTIVE',
        description: `Overdraft used for transfer to ${receiverName}`,
      });
    }

    // Update transfer and overdraft counters
    // Save all changes
    await Promise.all([
      fromAccount.save(),
      toAccount.save(),
    ]);
    await updateAccountAfterTransfer(fromAccountId, amount, usesOverdraft);

    // Get updated user info for email
    const senderUser = await User.findById(req.user._id);

    // Format date and time
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

    setImmediate(async () => {
      const emailResults = await Promise.allSettled([
        sendTransferNotificationEmail(
          senderUser.email, senderUser.name, receiverName, amount, null, category,
          'success', transactionId, fromAccount.balance, formattedDate, formattedTime
        ),
        receiverUser?.email
          ? sendTransferNotificationEmail(
            receiverUser.email, receiverUser.name, senderUser.name, amount, null, category,
            'received', transactionId, toAccount.balance, formattedDate, formattedTime, true
          )
          : Promise.resolve(),
      ]);
      emailResults.forEach((result) => {
        if (result.status === 'rejected') console.error('Transfer success email failed:', result.reason?.message || result.reason);
      });
    });

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      transaction,
      debitTransaction: transaction,
      transactionId,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Transfer validation for beneficiary transfers
const beneficiaryTransferValidation = [
  body('fromAccountId')
    .notEmpty().withMessage('Source account ID is required')
    .isMongoId().withMessage('Invalid account ID format'),
  body('beneficiaryId')
    .notEmpty().withMessage('Beneficiary ID is required')
    .isMongoId().withMessage('Invalid beneficiary ID format'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a valid number greater than 0'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  body('category')
    .optional()
    .isIn(['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'investment', 'transfer', 'other'])
    .withMessage('Invalid category'),
];

// ─── @desc    Transfer money between accounts with limit validation (direct)
// ─── @route   POST /api/transactions/transfer
// ─── @access  Protected (customer)
const transferMoney = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, description = '', category = 'transfer' } = req.body;

    // Validate input
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'fromAccountId, toAccountId, and amount are required',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer amount must be greater than 0',
      });
    }

    // Fetch both accounts
    const [fromAccount, toAccount] = await Promise.all([
      Account.findOne({ _id: fromAccountId, userId: req.user._id }),
      Account.findById(toAccountId),
    ]);

    if (!fromAccount) {
      return res.status(404).json({
        success: false,
        message: 'Source account not found',
      });
    }

    if (!toAccount) {
      return res.status(404).json({
        success: false,
        message: 'Destination account not found',
      });
    }

    if (fromAccount.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Source account is not active',
      });
    }

    if (toAccount.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Destination account is not active',
      });
    }

    // Check daily transfer limit
    const dailyCheck = await checkDailyTransferLimit(fromAccountId, amount);
    if (!dailyCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: dailyCheck.reason,
        limit: dailyCheck.limit,
        used: dailyCheck.used,
        remaining: dailyCheck.remaining,
      });
    }

    // Check monthly transfer limit
    const monthlyCheck = await checkMonthlyTransferLimit(fromAccountId, amount);
    if (!monthlyCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: monthlyCheck.reason,
        limit: monthlyCheck.limit,
        used: monthlyCheck.used,
        remaining: monthlyCheck.remaining,
      });
    }

    // Check overdraft allowance
    let usesOverdraft = false;
    if (amount > fromAccount.balance) {
      const odCheck = await checkOverdraftAllowed(fromAccountId, amount);
      if (!odCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: odCheck.reason,
          monthlyOverdraftCount: odCheck.monthlyOverdraftCount,
        });
      }
      usesOverdraft = odCheck.usesOverdraft;
    }

    const balanceAmountUsed = Math.min(amount, fromAccount.balance);
    const overdraftAmountUsed = Math.max(0, amount - balanceAmountUsed);
    const finalAccountBalance = Math.max(0, fromAccount.balance - balanceAmountUsed);

    // Generate transaction ID
    const transactionId = generateTransactionId();
    const receiverUser = await User.findById(toAccount.userId).select('name customerId').lean();

    // Create transaction record
    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
      fromAccountNumber: fromAccount.accountNumber,
      toAccountNumber: toAccount.accountNumber,
      amount,
      type: 'transfer',
      category,
      description: description || `Transfer to ${toAccount.accountNumber}`,
      reference: transactionId,
      status: 'completed',
      balance_after: finalAccountBalance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
      finalAccountBalance,
      metadata: {
        usedOverdraft: usesOverdraft,
        overdraftAmountUsed,
        balanceAmountUsed,
        finalAccountBalance,
        senderName: req.user.name,
        senderCustomerId: req.user.customerId,
        receiverName: receiverUser?.name,
        receiverCustomerId: receiverUser?.customerId,
      },
    });

    // Update account balances
    fromAccount.balance = finalAccountBalance;
    toAccount.balance += amount;

    // If overdraft was used, update overdraft tracking
    if (usesOverdraft) {
      fromAccount.overdraftUsed += overdraftAmountUsed;

      // Log overdraft usage
      await OverdraftLog.create({
        userId: req.user._id,
        accountId: fromAccountId,
        transactionId: transaction._id,
        amount: overdraftAmountUsed,
        odLimitAtTime: fromAccount.overdraftLimit,
        penaltyPerDayAtTime: fromAccount.getOverdraftDailyPenalty(),
        odUsedAfter: fromAccount.overdraftUsed,
        monthlyUsageAfter: (fromAccount.monthlyOverdraftCount || 0) + 1,
        penaltyAmountAfter: fromAccount.overdraftPenalty || 0,
        totalDueAfter: (fromAccount.overdraftUsed || 0) + (fromAccount.overdraftPenalty || 0),
        overdraftStatusAfter: (fromAccount.monthlyOverdraftCount || 0) + 1 >= 3 ? 'DEACTIVATED' : 'ACTIVE',
        description: `Overdraft used for transfer to ${toAccount.accountNumber}`,
      });
    }

    // Update transfer and overdraft counters
    // Save both accounts
    await Promise.all([fromAccount.save(), toAccount.save()]);
    await updateAccountAfterTransfer(fromAccountId, amount, usesOverdraft);

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      transaction,
      transactionId,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Transfer validation middleware
const transferValidation = [
  body('fromAccountId')
    .notEmpty().withMessage('Source account ID is required')
    .isMongoId().withMessage('Invalid account ID format'),
  body('toAccountId')
    .notEmpty().withMessage('Destination account ID is required')
    .isMongoId().withMessage('Invalid account ID format'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a valid number greater than 0'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  body('category')
    .optional()
    .isIn(['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'transfer', 'other'])
    .withMessage('Invalid category'),
];

// ─── @desc    Direct transfer by Customer ID (Transfer Funds page — no saved beneficiary needed)
// ─── @route   POST /api/transactions/transfer-by-customerid
// ─── @access  Protected (customer)
const transferByCustomerId = async (req, res, next) => {
  try {
    const { fromAccountId, receiverAccountNumber, receiverNickname, amount, category = 'transfer', confirmOverdraft = false } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer amount must be greater than 0' });
    }

    // Get sender account
    const fromAccount = await Account.findOne({ _id: fromAccountId, userId: req.user._id });
    if (!fromAccount) {
      return res.status(404).json({ success: false, message: 'Source account not found' });
    }
    if (fromAccount.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Source account is not active' });
    }

    const toAccount = await Account.findOne({
      accountNumber: String(receiverAccountNumber).trim().toUpperCase(),
      status: 'active',
    });
    if (!toAccount) {
      return res.status(404).json({ success: false, message: 'Invalid account number. No customer found.' });
    }
    const receiverUser = await User.findOne({ _id: toAccount.userId, role: 'customer', isActive: true });
    if (!receiverUser) return res.status(404).json({ success: false, message: 'Invalid account number. No customer found.' });
    if (String(receiverUser._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot transfer funds to yourself.' });
    }
    const receiverName = receiverUser.name;
    const receiverCustomerId = receiverUser.customerId;

    // Check daily limit
    const dailyCheck = await checkDailyTransferLimit(fromAccountId, amount);
    if (!dailyCheck.allowed) {
      await sendTransferNotificationEmail(req.user.email, req.user.name, receiverName, amount, dailyCheck.reason, category, 'failed').catch(() => {});
      return res.status(400).json({ success: false, message: dailyCheck.reason, limit: dailyCheck.limit, used: dailyCheck.used, remaining: dailyCheck.remaining });
    }

    // Check monthly limit
    const monthlyCheck = await checkMonthlyTransferLimit(fromAccountId, amount);
    if (!monthlyCheck.allowed) {
      await sendTransferNotificationEmail(req.user.email, req.user.name, receiverName, amount, monthlyCheck.reason, category, 'failed').catch(() => {});
      return res.status(400).json({ success: false, message: monthlyCheck.reason, limit: monthlyCheck.limit, used: monthlyCheck.used, remaining: monthlyCheck.remaining });
    }

    // Check balance / overdraft
    let usesOverdraft = false;
    let overdraftCheck = null;
    if (amount > fromAccount.balance) {
      overdraftCheck = await checkOverdraftAllowed(fromAccountId, amount);
      if (!overdraftCheck.allowed) {
        await sendTransferNotificationEmail(req.user.email, req.user.name, receiverName, amount, overdraftCheck.reason, category, 'failed').catch(() => {});
        return res.status(400).json({ success: false, message: overdraftCheck.reason, monthlyOverdraftCount: overdraftCheck.monthlyOverdraftCount });
      }
      usesOverdraft = overdraftCheck.usesOverdraft;
      if (usesOverdraft && confirmOverdraft !== true) {
        return res.status(409).json({
          success: false,
          requiresOverdraftConfirmation: true,
          message: `Your account has insufficient cash balance. ₹${overdraftCheck.overdraftAmountUsed.toLocaleString('en-IN')} will be deducted from your overdraft. Are you sure you want to use overdraft?`,
          balanceAmountUsed: overdraftCheck.balanceAmountUsed,
          overdraftAmountUsed: overdraftCheck.overdraftAmountUsed,
          availableOverdraft: Math.max(0, (fromAccount.overdraftLimit || 0) - (fromAccount.overdraftUsed || 0)),
        });
      }
    }

    const balanceAmountUsed = Math.min(amount, fromAccount.balance);
    const overdraftAmountUsed = Math.max(0, amount - balanceAmountUsed);
    const finalAccountBalance = Math.max(0, fromAccount.balance - balanceAmountUsed);

    const transactionId = generateTransactionId();
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: fromAccountId,
      toAccount: toAccount._id,
      fromAccountNumber: fromAccount.accountNumber,
      toAccountNumber: toAccount.accountNumber,
      amount,
      type: 'transfer',
      category,
      description: `Transfer to ${receiverNickname || receiverName} (${receiverCustomerId})`,
      reference: transactionId,
      status: 'completed',
      balance_after: finalAccountBalance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
      finalAccountBalance,
      metadata: {
        usedOverdraft: usesOverdraft,
        overdraftAmountUsed,
        balanceAmountUsed,
        finalAccountBalance,
        senderName: req.user.name,
        senderCustomerId: req.user.customerId,
        receiverName,
        receiverNickname,
        receiverCustomerId,
      },
    });

    // Update balances
    fromAccount.balance = finalAccountBalance;
    toAccount.balance += amount;

    if (usesOverdraft) {
      const hadNoOutstandingOverdraft = (fromAccount.overdraftUsed || 0) <= 0;
      fromAccount.overdraftUsed += overdraftAmountUsed;
      if (hadNoOutstandingOverdraft || !fromAccount.overdraftDueDate) {
        const dueDate = new Date();
        fromAccount.overdraftDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59, 999);
        fromAccount.lastPenaltyCalculatedAt = undefined;
      }
      await OverdraftLog.create({
        userId: req.user._id,
        accountId: fromAccountId,
        transactionId: transaction._id,
        amount: overdraftAmountUsed,
        odLimitAtTime: fromAccount.overdraftLimit,
        penaltyPerDayAtTime: fromAccount.getOverdraftDailyPenalty(),
        odUsedAfter: fromAccount.overdraftUsed,
        monthlyUsageAfter: (fromAccount.monthlyOverdraftCount || 0) + 1,
        penaltyAmountAfter: fromAccount.overdraftPenalty || 0,
        totalDueAfter: (fromAccount.overdraftUsed || 0) + (fromAccount.overdraftPenalty || 0),
        overdraftStatusAfter: (fromAccount.monthlyOverdraftCount || 0) + 1 >= 3 ? 'DEACTIVATED' : 'ACTIVE',
        description: `Overdraft used for transfer to ${receiverName}`,
      });
    }

    await Promise.all([fromAccount.save(), toAccount.save()]);
    await updateAccountAfterTransfer(fromAccountId, amount, usesOverdraft);

    setImmediate(async () => {
      const emailResults = await Promise.allSettled([
        sendTransferNotificationEmail(req.user.email, req.user.name, receiverName, amount, null, category, 'success', transactionId, fromAccount.balance, formattedDate, formattedTime),
        receiverUser.email
          ? sendTransferNotificationEmail(receiverUser.email, receiverUser.name, req.user.name, amount, null, category, 'received', transactionId, toAccount.balance, formattedDate, formattedTime, true)
          : Promise.resolve(),
      ]);
      emailResults.forEach((result) => {
        if (result.status === 'rejected') console.error('Transfer success email failed:', result.reason?.message || result.reason);
      });
    });

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      transaction,
      transactionId,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance,
      usedOverdraft: usesOverdraft,
      overdraftAmountUsed,
      balanceAmountUsed,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Validation for direct Customer ID transfer (Transfer Funds page)
const transferByCustomerIdValidation = [
  body('fromAccountId')
    .notEmpty().withMessage('Source account ID is required')
    .isMongoId().withMessage('Invalid account ID format'),
  body('receiverAccountNumber')
    .trim()
    .notEmpty().withMessage('Receiver account number is required'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category')
    .optional()
    .isIn(['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'investment', 'transfer', 'other'])
    .withMessage('Invalid category'),
  body('confirmOverdraft')
    .optional()
    .isBoolean().withMessage('Overdraft confirmation must be true or false'),
];

// ─── @desc    Self-transfer between customer's own accounts
// ─── @route   POST /api/transactions/self-transfer
// ─── @access  Protected (customer)
const selfTransfer = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, remarks = '' } = req.body;

    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ success: false, message: 'fromAccountId, toAccountId, and amount are required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer amount must be greater than 0.' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ success: false, message: 'Source and destination accounts must be different.' });
    }

    // Fetch both accounts and verify both belong to the same customer
    const [fromAccount, toAccount] = await Promise.all([
      Account.findOne({ _id: fromAccountId, userId: req.user._id }),
      Account.findOne({ _id: toAccountId, userId: req.user._id }),
    ]);

    if (!fromAccount) {
      return res.status(404).json({ success: false, message: 'Source account not found or does not belong to you.' });
    }
    if (!toAccount) {
      return res.status(404).json({ success: false, message: 'Destination account not found or does not belong to you.' });
    }
    if (fromAccount.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Source account is not active.' });
    }
    if (toAccount.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Destination account is not active.' });
    }

    // Check sufficient balance (no overdraft for self-transfer)
    if (parsedAmount > fromAccount.balance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${fromAccount.balance.toLocaleString('en-IN')}`,
      });
    }

    const transactionId = generateTransactionId();
    const desc = remarks.trim() || `Self transfer to ${toAccount.accountType} account (${toAccount.accountNumber})`;

    const transaction = await Transaction.create({
      userId: req.user._id,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
      fromAccountNumber: fromAccount.accountNumber,
      toAccountNumber: toAccount.accountNumber,
      amount: parsedAmount,
      type: 'transfer',
      category: 'transfer',
      description: desc,
      reference: transactionId,
      status: 'completed',
      balance_after: fromAccount.balance - parsedAmount,
      metadata: {
        selfTransfer: true,
        transferType: 'self_transfer',
        senderName: req.user.name,
        senderCustomerId: req.user.customerId,
        receiverName: req.user.name,
        receiverCustomerId: req.user.customerId,
      },
    });

    // Update balances
    fromAccount.balance -= parsedAmount;
    toAccount.balance += parsedAmount;
    await Promise.all([fromAccount.save(), toAccount.save()]);

    res.status(200).json({
      success: true,
      message: 'Self transfer completed successfully.',
      transaction,
      transactionId,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance,
      fromAccountType: fromAccount.accountType,
      toAccountType: toAccount.accountType,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Validation for self-transfer
const selfTransferValidation = [
  body('fromAccountId').notEmpty().withMessage('Source account ID is required').isMongoId().withMessage('Invalid account ID'),
  body('toAccountId').notEmpty().withMessage('Destination account ID is required').isMongoId().withMessage('Invalid account ID'),
  body('amount').notEmpty().withMessage('Amount is required').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('remarks').optional().isString(),
];

module.exports = {
  getMyTransactions,
  exportMyTransactions,
  getAnalytics,
  getAdminTransactions,
  transferMoney,
  transferToBeneficiary,
  transferByCustomerId,
  selfTransfer,
  transferValidation,
  beneficiaryTransferValidation,
  transferByCustomerIdValidation,
  selfTransferValidation,
};
