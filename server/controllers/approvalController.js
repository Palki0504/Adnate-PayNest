const ApprovalRequest = require('../models/ApprovalRequest');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Notification = require('../models/Notification');

// ─── Helper: Create notification ─────────────────────────────────────────────
const createNotification = async (userId, title, message, type = 'approval', priority = 'high') => {
  try {
    await Notification.create({ userId, title, message, type, priority });
  } catch (e) {
    console.error('Notification creation failed:', e.message);
  }
};

// ─── @desc    Get pending approval queue (manager)
// ─── @route   GET /api/approvals
// ─── @access  Protected (manager)
const getPendingApprovals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [approvals, total] = await Promise.all([
      ApprovalRequest.find({ status: 'pending' })
        .populate('customerId', 'name email phone')
        .populate('fromAccountId', 'accountType accountNumber balance')
        .populate('toAccountId', 'accountType accountNumber balance')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      ApprovalRequest.countDocuments({ status: 'pending' }),
    ]);

    res.status(200).json({
      success: true,
      approvals,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get approval history (all reviewed)
// ─── @route   GET /api/approvals/history
// ─── @access  Protected (manager)
const getApprovalHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = { status: { $in: ['approved', 'rejected'] } };
    if (status && ['approved', 'rejected'].includes(status)) query.status = status;

    const [approvals, total] = await Promise.all([
      ApprovalRequest.find(query)
        .populate('customerId', 'name email')
        .populate('managerId', 'name email')
        .sort({ reviewedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      ApprovalRequest.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      approvals,
      pagination: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), total },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Approve a transfer request
// ─── @route   PUT /api/approvals/:id/approve
// ─── @access  Protected (manager)
const approveRequest = async (req, res, next) => {
  try {
    const { remark = '' } = req.body;
    const approval = await ApprovalRequest.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has already been reviewed.' });
    }

    const amount = approval.amount;

    // Execute the actual transfer
    if (approval.transferType === 'own_account') {
      const [fromAccount, toAccount] = await Promise.all([
        Account.findById(approval.fromAccountId),
        Account.findById(approval.toAccountId),
      ]);

      if (!fromAccount || !toAccount) {
        return res.status(400).json({ success: false, message: 'Account(s) no longer exist.' });
      }

      const availableBalance = fromAccount.balance + (fromAccount.overdraftLimit - fromAccount.overdraftUsed);
      if (amount > availableBalance) {
        // Reject due to insufficient funds now
        approval.status = 'rejected';
        approval.managerId = req.user._id;
        approval.remark = 'Insufficient balance at time of approval.';
        approval.reviewedAt = new Date();
        await approval.save();

        await createNotification(
          approval.customerId,
          'Transfer Rejected ❌',
          `Your transfer of ₹${amount.toLocaleString('en-IN')} was rejected due to insufficient balance.`,
          'rejection',
          'high'
        );
        return res.status(200).json({ success: false, message: 'Rejected: Insufficient balance.' });
      }

      if (amount > fromAccount.balance) {
        const odAmount = amount - fromAccount.balance;
        fromAccount.overdraftUsed += odAmount;
        fromAccount.balance = 0;
      } else {
        fromAccount.balance -= amount;
      }
      toAccount.balance += amount;
      await Promise.all([fromAccount.save(), toAccount.save()]);

      await Transaction.create({
        userId: approval.customerId,
        fromAccount: fromAccount._id,
        toAccount: toAccount._id,
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount,
        type: 'transfer',
        category: 'transfer',
        status: 'completed',
        description: approval.description || 'Own account transfer (approved)',
        reference: `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`,
        balance_after: fromAccount.balance,
      });
    } else {
      // Beneficiary transfer
      const fromAccount = await Account.findById(approval.fromAccountId);
      if (!fromAccount) {
        return res.status(400).json({ success: false, message: 'Source account no longer exists.' });
      }

      const availableBalance = fromAccount.balance + (fromAccount.overdraftLimit - fromAccount.overdraftUsed);
      if (amount > availableBalance) {
        approval.status = 'rejected';
        approval.managerId = req.user._id;
        approval.remark = 'Insufficient balance at time of approval.';
        approval.reviewedAt = new Date();
        await approval.save();

        await createNotification(
          approval.customerId,
          'Transfer Rejected ❌',
          `Your transfer of ₹${amount.toLocaleString('en-IN')} to ${approval.beneficiaryName} was rejected due to insufficient balance.`,
          'rejection',
          'high'
        );
        return res.status(200).json({ success: false, message: 'Rejected: Insufficient balance.' });
      }

      if (amount > fromAccount.balance) {
        const odAmount = amount - fromAccount.balance;
        fromAccount.overdraftUsed += odAmount;
        fromAccount.balance = 0;
      } else {
        fromAccount.balance -= amount;
      }
      await fromAccount.save();

      await Transaction.create({
        userId: approval.customerId,
        fromAccount: fromAccount._id,
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: approval.toAccountNumber,
        amount,
        type: 'debit',
        category: 'transfer',
        status: 'completed',
        description: approval.description || `Transfer to ${approval.beneficiaryName} (approved)`,
        reference: `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`,
        balance_after: fromAccount.balance,
      });
    }

    // Mark as approved
    approval.status = 'approved';
    approval.managerId = req.user._id;
    approval.remark = remark;
    approval.reviewedAt = new Date();
    await approval.save();

    await createNotification(
      approval.customerId,
      'Transfer Approved ✅',
      `Your transfer of ₹${amount.toLocaleString('en-IN')} has been approved by the manager. ${remark ? `Remark: ${remark}` : ''}`,
      'approval',
      'high'
    );

    res.status(200).json({ success: true, message: 'Transfer approved and executed successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Reject a transfer request
// ─── @route   PUT /api/approvals/:id/reject
// ─── @access  Protected (manager)
const rejectRequest = async (req, res, next) => {
  try {
    const { remark } = req.body;

    if (!remark || remark.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection remark is required.' });
    }

    const approval = await ApprovalRequest.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has already been reviewed.' });
    }

    approval.status = 'rejected';
    approval.managerId = req.user._id;
    approval.remark = remark;
    approval.reviewedAt = new Date();
    await approval.save();

    await createNotification(
      approval.customerId,
      'Transfer Rejected ❌',
      `Your transfer of ₹${approval.amount.toLocaleString('en-IN')} has been rejected. Reason: ${remark}`,
      'rejection',
      'high'
    );

    res.status(200).json({ success: true, message: 'Transfer request rejected.' });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get customer's own approval requests
// ─── @route   GET /api/approvals/my
// ─── @access  Protected (customer)
const getMyApprovals = async (req, res, next) => {
  try {
    const approvals = await ApprovalRequest.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ success: true, approvals });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Get approval stats (manager overview)
// ─── @route   GET /api/approvals/stats
// ─── @access  Protected (manager)
const getApprovalStats = async (req, res, next) => {
  try {
    const [pending, approved, rejected, totalAmount] = await Promise.all([
      ApprovalRequest.countDocuments({ status: 'pending' }),
      ApprovalRequest.countDocuments({ status: 'approved' }),
      ApprovalRequest.countDocuments({ status: 'rejected' }),
      ApprovalRequest.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        pending,
        approved,
        rejected,
        totalApprovedAmount: totalAmount[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingApprovals,
  getApprovalHistory,
  approveRequest,
  rejectRequest,
  getMyApprovals,
  getApprovalStats,
};
