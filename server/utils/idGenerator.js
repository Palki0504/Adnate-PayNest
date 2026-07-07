const Counter = require('../models/Counter');

const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.seq;
};

const formatId = (prefix, seq, minDigits = 3) => `${prefix}${String(seq).padStart(minDigits, '0')}`;

const getNextCustomerSequence = async () => {
  const User = require('../models/User');
  const PendingUser = require('../models/PendingUser');
  
  const [users, pendingUsers] = await Promise.all([
    User.find({
      role: 'customer',
      customerId: /^CUSTID\d+$/,
    })
      .select('customerId')
      .lean(),
    PendingUser.find({
      role: 'customer',
      customerId: /^CUSTID\d+$/,
    })
      .select('customerId')
      .lean(),
  ]);

  const usedSequences = new Set([...users, ...pendingUsers].map((customer) => {
    const match = customer.customerId?.match(/^CUSTID(\d+)$/);
    const sequence = match ? parseInt(match[1], 10) : 0;
    return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
  }).filter(Boolean));

  let nextSequence = 1;
  while (usedSequences.has(nextSequence)) {
    nextSequence += 1;
  }

  return nextSequence;
};

const getNextManagerSequence = async () => {
  const User = require('../models/User');

  const managers = await User.find({
    role: 'manager',
    adminId: /^MANAGER\d+$/,
  })
    .select('adminId')
    .lean();

  const highestSequence = managers.reduce((max, manager) => {
    const match = manager.adminId?.match(/^MANAGER(\d+)$/);
    const sequence = match ? parseInt(match[1], 10) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);

  await Counter.findOneAndUpdate(
    { name: 'manager' },
    { $max: { seq: highestSequence } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return getNextSequence('manager');
};

const createUniqueUserId = async (role) => {
  if (role === 'customer') {
    const seq = await getNextCustomerSequence();
    return formatId('CUSTID', seq, 2);
  }
  if (role === 'manager') {
    const seq = await getNextManagerSequence();
    return formatId('MANAGER', seq);
  }
  if (role === 'admin') {
    const seq = await getNextSequence('admin');
    return formatId('ADM', seq);
  }
  return null;
};

module.exports = { createUniqueUserId };
