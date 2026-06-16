/**
 * Adnate PayNest - Fix Script
 * Syncs the customerId field from User to Account records
 * for any accounts that are missing the customerId.
 * 
 * Run: node server/utils/fixAccountCustomerIds.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Account = require('../models/Account');

const fixAccountCustomerIds = async () => {
  try {
    await connectDB();
    console.log('🔧 Starting account customerId sync...');

    // Find all customer users that have a customerId
    const customers = await User.find({ role: 'customer', customerId: { $exists: true, $ne: null } });
    console.log(`📊 Found ${customers.length} customers to process`);

    let fixed = 0;
    let alreadyOk = 0;

    for (const customer of customers) {
      // Find accounts for this user that are missing customerId
      const result = await Account.updateMany(
        { userId: customer._id, $or: [{ customerId: null }, { customerId: { $exists: false } }, { customerId: '' }] },
        { $set: { customerId: customer.customerId } }
      );

      if (result.modifiedCount > 0) {
        console.log(`  ✅ Fixed ${result.modifiedCount} account(s) for ${customer.name} (${customer.customerId})`);
        fixed += result.modifiedCount;
      } else {
        alreadyOk++;
      }
    }

    console.log(`\n🎉 Done! Fixed ${fixed} accounts, ${alreadyOk} customers already had correct data.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  }
};

fixAccountCustomerIds();
