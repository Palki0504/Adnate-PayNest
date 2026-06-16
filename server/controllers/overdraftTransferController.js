const Account = require('../models/Account');
const Notification = require('../models/Notification');
const OverdraftLog = require('../models/OverdraftLog');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { generateTransactionId } = require('../utils/transferHelper');

const MAX_MONTHLY_OD_USES = 3;
const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const monthEnd = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
};

const rollbackTransfer = async ({ sender, receiver, amount, previous, usageAfter, transactionId, receiverCredited }) => {
  if (transactionId) await Transaction.deleteOne({ _id: transactionId }).catch(() => {});
  if (receiverCredited) {
    await Account.updateOne({ _id: receiver._id }, { $inc: { balance: -amount } }).catch(() => {});
  }
  await Account.updateOne(
    { _id: sender._id, overdraftUsed: previous.overdraftUsed + amount, monthlyOverdraftCount: usageAfter },
    {
      $set: {
        overdraftUsed: previous.overdraftUsed,
        availableOverdraft: previous.availableOverdraft,
        monthlyOverdraftCount: previous.monthlyOverdraftCount,
        monthlyTransferTotal: previous.monthlyTransferTotal,
        overdraftStatus: previous.overdraftStatus,
        lastOverdraftDeactivatedAt: previous.lastOverdraftDeactivatedAt || null,
        overdraftDueDate: previous.overdraftDueDate || null,
        lastPenaltyCalculatedAt: previous.lastPenaltyCalculatedAt || null,
      },
    }
  ).catch(() => {});
};

const transferOverdraft = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const customerId = String(req.body.receiverCustomerId || '').trim().toUpperCase();
    const accountNumber = String(req.body.receiverAccountNumber || '').trim().toUpperCase();
    const accountType = String(req.body.receiverAccountType || '').trim().toLowerCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Requested amount must be greater than 0.' });
    }
    if (!customerId || !accountNumber || !['savings', 'current', 'salary'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'Complete and verify all receiver details before using overdraft.' });
    }

    const sender = await Account.findOne({ _id: req.body.accountId, userId: req.user._id });
    if (!sender) return res.status(404).json({ success: false, message: 'Sender account not found.' });
    await sender.resetMonthlyCounters();
    if (sender.status !== 'active') return res.status(400).json({ success: false, message: 'The selected sender account is not active.' });
    if ((sender.monthlyOverdraftCount || 0) >= MAX_MONTHLY_OD_USES) {
      return res.status(400).json({ success: false, message: 'Monthly overdraft usage limit reached. Overdraft is deactivated for this month.' });
    }
    if (sender.overdraftStatus !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Overdraft facility is not active for this account.' });
    }

    const availableOD = Math.max(0, (sender.overdraftLimit || 0) - (sender.overdraftUsed || 0));
    if (amount > availableOD) {
      return res.status(400).json({ success: false, message: `Requested amount exceeds available limit. Available: ${formatINR(availableOD)}` });
    }

    const receiver = await Account.findOne({ accountNumber, accountType, status: 'active' });
    if (!receiver) return res.status(404).json({ success: false, message: 'Receiver account details are invalid or inactive.' });
    const receiverUser = await User.findOne({ _id: receiver.userId, customerId, role: 'customer', isActive: true });
    if (!receiverUser) return res.status(400).json({ success: false, message: 'Receiver details do not match an active customer account.' });
    if (String(receiverUser._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot transfer overdraft funds to your own account.' });
    }
    if (req.body.receiverName && receiverUser.name.trim().toLowerCase() !== String(req.body.receiverName).trim().toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Receiver name does not match the verified customer.' });
    }

    const previous = {
      overdraftUsed: sender.overdraftUsed || 0,
      availableOverdraft: availableOD,
      monthlyOverdraftCount: sender.monthlyOverdraftCount || 0,
      monthlyTransferTotal: sender.monthlyTransferTotal || 0,
      overdraftStatus: sender.overdraftStatus,
      lastOverdraftDeactivatedAt: sender.lastOverdraftDeactivatedAt,
      overdraftDueDate: sender.overdraftDueDate,
      lastPenaltyCalculatedAt: sender.lastPenaltyCalculatedAt,
    };
    const usageAfter = previous.monthlyOverdraftCount + 1;
    const statusAfter = usageAfter >= MAX_MONTHLY_OD_USES ? 'DEACTIVATED' : 'ACTIVE';
    const now = new Date();
    const updatedSender = await Account.findOneAndUpdate(
      {
        _id: sender._id,
        userId: req.user._id,
        status: 'active',
        overdraftStatus: 'ACTIVE',
        overdraftUsed: previous.overdraftUsed,
        monthlyOverdraftCount: previous.monthlyOverdraftCount,
      },
      {
        $inc: { overdraftUsed: amount, availableOverdraft: -amount, monthlyOverdraftCount: 1, monthlyTransferTotal: amount },
        $set: {
          overdraftDueDate: previous.overdraftDueDate || monthEnd(),
          lastPenaltyCalculatedAt: previous.overdraftUsed <= 0 ? null : previous.lastPenaltyCalculatedAt,
          overdraftStatus: statusAfter,
          lastOverdraftDeactivatedAt: statusAfter === 'DEACTIVATED' ? now : null,
        },
      },
      { new: true, runValidators: true }
    );
    if (!updatedSender) {
      return res.status(409).json({ success: false, message: 'Overdraft details changed while processing. Please refresh and try again.' });
    }

    let receiverCredited = false;
    let transaction;
    try {
      const updatedReceiver = await Account.findOneAndUpdate(
        { _id: receiver._id, userId: receiverUser._id, status: 'active' },
        { $inc: { balance: amount } },
        { new: true, runValidators: true }
      );
      if (!updatedReceiver) throw new Error('Receiver account became unavailable while processing.');
      receiverCredited = true;

      transaction = await Transaction.create({
        userId: req.user._id,
        fromAccount: sender._id,
        toAccount: receiver._id,
        fromAccountNumber: sender.accountNumber,
        toAccountNumber: receiver.accountNumber,
        amount,
        type: 'overdraft_transfer',
        category: 'transfer',
        status: 'completed',
        description: `Overdraft Transfer to ${receiverUser.name} (${receiverUser.customerId})`,
        reference: generateTransactionId(),
        balance_after: sender.balance,
        usedOverdraft: true,
        overdraftAmountUsed: amount,
        balanceAmountUsed: 0,
        finalAccountBalance: sender.balance,
        metadata: {
          transactionType: 'Overdraft Transfer',
          usedOverdraft: true,
          senderName: req.user.name,
          senderCustomerId: req.user.customerId,
          receiverName: receiverUser.name,
          receiverCustomerId: receiverUser.customerId,
          receiverAccountType: receiver.accountType,
        },
      });

      await OverdraftLog.create({
        userId: req.user._id,
        accountId: sender._id,
        transactionId: transaction._id,
        senderAccountNumber: sender.accountNumber,
        receiverAccountId: receiver._id,
        receiverAccountNumber: receiver.accountNumber,
        receiverAccountType: receiver.accountType,
        receiverCustomerId: receiverUser.customerId,
        receiverName: receiverUser.name,
        transactionType: 'Overdraft Transfer',
        amount,
        odLimitAtTime: sender.overdraftLimit,
        penaltyPerDayAtTime: sender.getOverdraftDailyPenalty(),
        odUsedAfter: updatedSender.overdraftUsed,
        monthlyUsageAfter: usageAfter,
        penaltyAmountAfter: updatedSender.overdraftPenalty || 0,
        totalDueAfter: (updatedSender.overdraftUsed || 0) + (updatedSender.overdraftPenalty || 0),
        overdraftStatusAfter: statusAfter,
        description: `Overdraft Transfer to ${receiverUser.name} (${receiver.accountNumber})`,
        status: 'active',
      });

      Promise.allSettled([
        Notification.create({ userId: req.user._id, title: 'Overdraft Transfer Successful', message: `${formatINR(amount)} was transferred to ${receiverUser.name}.`, type: 'transaction' }),
        Notification.create({ userId: receiverUser._id, title: 'Overdraft Transfer Received', message: `You received ${formatINR(amount)} from ${req.user.name}.`, type: 'transaction' }),
      ]).catch(() => {});

      return res.status(200).json({
        success: true,
        message: `${formatINR(amount)} transferred successfully using overdraft.`,
        transaction,
        account: updatedSender,
        receiver: { name: receiverUser.name, customerId, accountType, accountNumber, balance: updatedReceiver.balance },
      });
    } catch (error) {
      await rollbackTransfer({ sender, receiver, amount, previous, usageAfter, transactionId: transaction?._id, receiverCredited });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { transferOverdraft };
