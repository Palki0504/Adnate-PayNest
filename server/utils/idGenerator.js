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

  const allCustomers = [...users, ...pendingUsers];

  const highestSequence = allCustomers.reduce((max, customer) => {
    const match = customer.customerId?.match(/^CUSTID(\d+)$/);
    const sequence = match ? parseInt(match[1], 10) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);

  return highestSequence + 1;
};

const createUniqueUserId = async (role) => {
  if (role === 'customer') {
    const seq = await getNextCustomerSequence();
    return formatId('CUSTID', seq, 2);
  }
  if (role === 'manager') {
    const seq = await getNextSequence('manager');
    return formatId('MANAGER', seq);
  }
  if (role === 'admin') {
    const seq = await getNextSequence('admin');
    return formatId('ADM', seq);
  }
  return null;
};

module.exports = { createUniqueUserId };
