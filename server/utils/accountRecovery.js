const mongoose = require('mongoose');
const Account = require('../models/Account');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');

const MAX_RECOVERED_ACCOUNTS = 3;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const toAccountObject = (account) =>
  typeof account?.toObject === 'function' ? account.toObject() : account;

const snapshotKey = (snapshot) =>
  String(snapshot?.accountId || snapshot?.accountNumber || snapshot?.accountType || '').trim();

const getAccountSnapshots = (user) => {
  const snapshots = [];
  const pushSnapshot = (snapshot) => {
    if (!snapshot || !snapshot.accountType) return;
    snapshots.push(toAccountObject(snapshot));
  };

  (Array.isArray(user?.accounts) ? user.accounts : []).forEach(pushSnapshot);
  ['account1', 'account2', 'account3'].forEach((slot) => pushSnapshot(user?.[slot]));

  const seen = new Set();
  return snapshots.filter((snapshot) => {
    const key = snapshotKey(snapshot);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_RECOVERED_ACCOUNTS);
};

const recoverAccountsFromUserSnapshot = async (user) => {
  const snapshots = getAccountSnapshots(user);
  const recovered = [];

  for (const snapshot of snapshots) {
    const accountType = String(snapshot.accountType || '').toLowerCase();
    if (!['savings', 'salary', 'current'].includes(accountType)) continue;

    const lookup = [];
    if (isObjectId(snapshot.accountId)) lookup.push({ _id: snapshot.accountId });
    if (snapshot.accountNumber) lookup.push({ accountNumber: snapshot.accountNumber });
    lookup.push({ userId: user._id, accountType });

    const existing = await Account.findOne({ $or: lookup });
    if (existing) {
      existing.userId = user._id;
      existing.customerId = user.customerId || existing.customerId;
      existing.accountType = accountType;
      existing.status = snapshot.status || snapshot.accountStatus || existing.status || 'active';
      existing.classification = user.classification || existing.classification;
      if (snapshot.accountNumber && !existing.accountNumber) existing.accountNumber = snapshot.accountNumber;
      if (snapshot.balance !== undefined && snapshot.balance !== null) existing.balance = Number(snapshot.balance) || 0;
      await existing.save();
      if (existing.status === 'active') recovered.push(existing);
      continue;
    }

    recovered.push(await Account.create({
      ...(isObjectId(snapshot.accountId) ? { _id: snapshot.accountId } : {}),
      userId: user._id,
      customerId: user.customerId,
      accountType,
      accountNumber: snapshot.accountNumber,
      balance: Number(snapshot.balance ?? FIXED_ACCOUNT_BALANCES[accountType] ?? 0) || 0,
      status: snapshot.status || snapshot.accountStatus || 'active',
      classification: user.classification || 'PENDING',
    }));
  }

  return recovered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const getActiveAccountsForUser = async (user) => {
  const userId = user?._id;
  if (!userId) return [];

  let accounts = await Account.find({ userId, status: 'active' }).sort({ createdAt: 1 });
  if (accounts.length) return accounts;

  if (user.customerId) {
    accounts = await Account.find({ customerId: user.customerId, status: 'active' }).sort({ createdAt: 1 });
    if (accounts.length) {
      try {
        await Account.updateMany(
          { _id: { $in: accounts.map((account) => account._id) } },
          { $set: { userId, customerId: user.customerId } }
        );
      } catch (error) {
        console.warn(`Account relink skipped for ${user.customerId}: ${error.message}`);
      }
      return Account.find({ userId, status: 'active' }).sort({ createdAt: 1 });
    }
  }

  return recoverAccountsFromUserSnapshot(user);
};

module.exports = {
  getActiveAccountsForUser,
};
