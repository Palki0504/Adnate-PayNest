/**
 * Adnate PayNest - Seed Script
 * Creates test customers with accounts, transactions, and notifications
 * Run: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const OverdraftLog = require('../models/OverdraftLog');

const getRequiredSeedValue = (key) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}. Add it to server/.env before running the seed script.`);
  }
  return value;
};

// â”€â”€ Primary test customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SEED_EMAIL = process.env.SEED_CUSTOMER_EMAIL || 'customer@paynest.test';
const SEED_PASSWORD = getRequiredSeedValue('SEED_CUSTOMER_PASSWORD');

// â”€â”€ Secondary test customer (for beneficiary testing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SEED_EMAIL2 = process.env.SEED_CUSTOMER_2_EMAIL || 'beneficiary@paynest.test';
const SEED_PASSWORD2 = getRequiredSeedValue('SEED_CUSTOMER_2_PASSWORD');

// â”€â”€ Staff accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || 'manager@paynest.test';
const MANAGER_PASSWORD = getRequiredSeedValue('SEED_MANAGER_PASSWORD');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@paynest.test';
const ADMIN_PASSWORD = getRequiredSeedValue('SEED_ADMIN_PASSWORD');

const categories = ['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'transfer', 'other'];
const descriptions = [
  'Grocery Store Purchase',
  'Online Shopping - Amazon',
  'Electricity Bill Payment',
  'Flight Booking - SpiceJet',
  'Netflix Subscription',
  'Monthly Salary Credit',
  'Fund Transfer to Savings',
  'Restaurant - Dinner',
  'Fuel - Petrol Station',
  'Medical Expenses',
  'Insurance Premium',
  'ATM Withdrawal',
  'UPI Transfer',
  'Hotel Booking',
  'Mobile Recharge',
];

const getRandomDate = (daysBack) => {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d;
};

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('ðŸŒ± Starting seed process...');

    // Drop deprecated unique index if exists
    try {
      await mongoose.connection.db.collection('transactions').dropIndex('transactionId_1');
      console.log('ðŸ§¹ Dropped deprecated unique index transactionId_1');
    } catch (err) {
      // Ignore if index doesn't exist
    }

    // â”€â”€ Primary seed customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existingUser = await User.findOne({ email: SEED_EMAIL });
    if (existingUser) {
      await User.deleteOne({ _id: existingUser._id });
      await Account.deleteMany({ userId: existingUser._id });
      await Transaction.deleteMany({ userId: existingUser._id });
      await Notification.deleteMany({ userId: existingUser._id });
      await OverdraftLog.deleteMany({ userId: existingUser._id });
      console.log('ðŸ§¹ Cleared existing primary seed data');
    }

    // Create primary test customer
    const user = await User.create({
      name: 'Arjun Sharma',
      email: SEED_EMAIL,
      phone: '+91 98765 43210',
      password: SEED_PASSWORD,
      role: 'customer',
      primaryAccountType: 'savings',
    });

    // Fetch again to get generated customerId
    const savedUser = await User.findById(user._id);
    console.log(`âœ… Created customer: ${savedUser.email} | Customer ID: ${savedUser.customerId}`);

    // Create accounts for primary customer â€” always include customerId
    const savingsAccount = await Account.create({
      userId: savedUser._id,
      customerId: savedUser.customerId,
      accountType: 'savings',
      accountNumber: `SAV${Date.now()}${Math.floor(Math.random() * 10000)}`,
      balance: 40000,
      overdraftLimit: 500,
      overdraftUsed: 0,
      classification: 'GOLD',
      interestRate: 3.5,
    });

    console.log('Created 1 account for primary customer (savings)');

    // Create 40 transactions over last 6 months
    const transactionData = [];
    let runningBalance = savingsAccount.balance;

    for (let i = 0; i < 40; i++) {
      const isCredit = Math.random() > 0.55;
      const amount = Math.floor(Math.random() * 15000) + 500;
      const category = categories[Math.floor(Math.random() * categories.length)];
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];

      if (isCredit) runningBalance += amount;
      else runningBalance -= amount;

      transactionData.push({
        userId: savedUser._id,
        fromAccount: isCredit ? null : savingsAccount._id,
        toAccount: isCredit ? savingsAccount._id : null,
        fromAccountNumber: isCredit ? 'EXT-BANK-NEFT' : savingsAccount.accountNumber,
        toAccountNumber: isCredit ? savingsAccount.accountNumber : 'EXT-BENEFICIARY',
        amount,
        type: isCredit ? 'credit' : 'debit',
        category,
        status: 'completed',
        description,
        reference: `TXN${Date.now()}${i}${Math.floor(Math.random() * 10000)}`,
        balance_after: Math.max(0, runningBalance),
        createdAt: getRandomDate(180),
      });
    }

    // Add salary credit for current month
    transactionData.push({
      userId: savedUser._id,
      fromAccountNumber: 'EMPLOYER-PAYROLL',
      toAccount: savingsAccount._id,
      toAccountNumber: savingsAccount.accountNumber,
      amount: 85000,
      type: 'credit',
      category: 'salary',
      status: 'completed',
      description: 'Monthly Salary - May 2025',
      reference: `TXN${Date.now()}SALARY${Math.floor(Math.random() * 10000)}`,
      balance_after: 215000,
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    });

    await Transaction.insertMany(transactionData);
    console.log(`âœ… Created ${transactionData.length} transactions`);

    // Create overdraft log
    await OverdraftLog.create({
      userId: savedUser._id,
      accountId: savingsAccount._id,
      amount: 3200,
      odLimitAtTime: 15000,
      odUsedAfter: 3200,
      description: 'Emergency medical withdrawal',
      status: 'active',
    });

    // Create notifications
    const notifications = [
      {
        userId: savedUser._id,
        title: 'Welcome to Adnate PayNest! ðŸŽ‰',
        message: 'Your account is fully set up. Explore your dashboard to manage finances.',
        type: 'info',
        priority: 'high',
        isRead: false,
        createdAt: getRandomDate(30),
      },
      {
        userId: savedUser._id,
        title: 'Salary Credited âœ…',
        message: 'â‚¹85,000 has been credited to your Salary Account ending 4521.',
        type: 'transaction',
        priority: 'high',
        isRead: false,
        createdAt: new Date(),
      },
      {
        userId: savedUser._id,
        title: 'Overdraft Alert âš ï¸',
        message: 'Your salary account has used â‚¹3,200 of overdraft limit. Available OD: â‚¹11,800.',
        type: 'alert',
        priority: 'high',
        isRead: false,
        createdAt: getRandomDate(5),
      },
      {
        userId: savedUser._id,
        title: 'Account Upgraded to GOLD ðŸ†',
        message: 'Congratulations! Your savings account has been upgraded to GOLD classification.',
        type: 'info',
        priority: 'medium',
        isRead: true,
        createdAt: getRandomDate(15),
      },
      {
        userId: savedUser._id,
        title: 'Transaction Completed',
        message: 'â‚¹12,500 debited from your account for Amazon Online Shopping.',
        type: 'transaction',
        priority: 'low',
        isRead: true,
        createdAt: getRandomDate(10),
      },
      {
        userId: savedUser._id,
        title: 'Security Alert ðŸ”’',
        message: 'New login detected from Windows device. If this was not you, change your password immediately.',
        type: 'alert',
        priority: 'high',
        isRead: false,
        createdAt: getRandomDate(2),
      },
    ];

    await Notification.insertMany(notifications);
    console.log(`âœ… Created ${notifications.length} notifications`);

    // â”€â”€ Secondary seed customer (for beneficiary testing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existingUser2 = await User.findOne({ email: SEED_EMAIL2 });
    if (existingUser2) {
      await User.deleteOne({ _id: existingUser2._id });
      await Account.deleteMany({ userId: existingUser2._id });
      await Transaction.deleteMany({ userId: existingUser2._id });
      await Notification.deleteMany({ userId: existingUser2._id });
      console.log('ðŸ§¹ Cleared existing secondary seed data');
    }

    const user2 = await User.create({
      name: 'Priya Singh',
      email: SEED_EMAIL2,
      phone: '+91 98765 11111',
      password: SEED_PASSWORD2,
      role: 'customer',
      primaryAccountType: 'savings',
    });

    const savedUser2 = await User.findById(user2._id);
    console.log(`âœ… Created secondary customer: ${savedUser2.email} | Customer ID: ${savedUser2.customerId}`);

    // Create accounts for secondary customer
    await Account.create({
      userId: savedUser2._id,
      customerId: savedUser2.customerId,
      accountType: 'savings',
      accountNumber: `SAV${Date.now() + 10}${Math.floor(Math.random() * 10000)}`, 
      balance: 40000,
      overdraftLimit: 25000,
      overdraftUsed: 0,
      classification: 'SILVER',
      interestRate: 3.5,
    });

    await Notification.create({
      userId: savedUser2._id,
      title: 'Welcome to Adnate PayNest! ðŸŽ‰',
      message: `Hello Priya, your account has been set up. Your Customer ID is ${savedUser2.customerId}.`,
      type: 'info',
      priority: 'high',
    });

    console.log(`âœ… Created account for secondary customer (savings)`);

    // â”€â”€ Seed Manager Account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existingManager = await User.findOne({ email: MANAGER_EMAIL });
    if (existingManager) await User.deleteOne({ _id: existingManager._id });

    await User.create({
      name: 'Priya Kapoor',
      email: MANAGER_EMAIL,
      phone: '+91 91234 56789',
      password: MANAGER_PASSWORD,
      role: 'manager',
    });
    console.log(`âœ… Created manager: ${MANAGER_EMAIL}`);

    // â”€â”€ Seed Admin Account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) await User.deleteOne({ _id: existingAdmin._id });

    await User.create({
      name: 'Rohan Mehta',
      email: ADMIN_EMAIL,
      phone: '+91 99887 76655',
      password: ADMIN_PASSWORD,
      role: 'admin',
      adminId: 'ADM1001',
    });
    console.log(`âœ… Created admin: ${ADMIN_EMAIL}`);

    console.log('\nðŸŽ‰ Seed completed successfully!');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('  ROLE           EMAIL                    PASSWORD        ');
    console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    console.log(`  Customer 1     ${SEED_EMAIL.padEnd(24)} [from env]      `);
    console.log(`  Customer 2     ${SEED_EMAIL2.padEnd(24)} [from env]      `);
    console.log(`  Manager        ${MANAGER_EMAIL.padEnd(24)} [from env]      `);
    console.log(`  Admin          ${ADMIN_EMAIL.padEnd(24)} [from env]      `);
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('\nðŸ’¡ TIP: Log in as Customer 1 and use Customer 2\'s Customer ID');
    console.log('   as a beneficiary (find the ID from the DB or after seeding).\n');

    process.exit(0);
  } catch (error) {
    console.error('âŒ Seed failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
