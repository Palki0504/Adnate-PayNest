const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('❌ MONGO_URI is not defined in the environment. Set it in server/.env.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const ensureBeneficiaryIndexes = async () => {
      const Beneficiary = require('../models/Beneficiary');
      const collection = Beneficiary.collection;

      try {
        const indexes = await collection.indexes();
        const staleIndexes = [
          'userId_1_beneficiaryAccountNumber_1',
          'userId_1_accountNumber_1',
          'userId_1_nickname_1',
          'userId_1_customerId_1',
          'beneficiary_active_user_customer_unique',
          'beneficiary_active_account_unique',
        ];

        for (const indexName of staleIndexes) {
          if (indexes.some((index) => index.name === indexName)) {
            await collection.dropIndex(indexName);
          }
        }

        await collection.createIndex(
          { userId: 1, nickname: 1 },
          {
            name: 'beneficiary_active_user_nickname_unique',
            unique: true,
            partialFilterExpression: { isActive: true },
            collation: { locale: 'en', strength: 2 },
          }
        );

        await collection.createIndex(
          { userId: 1, accountNumber: 1 },
          {
            name: 'beneficiary_active_account_unique',
            unique: true,
            partialFilterExpression: { isActive: true, accountNumber: { $type: 'string' } },
          }
        );

        const latestIndexes = await collection.indexes();
        const hasUserLookup = latestIndexes.some((index) => JSON.stringify(index.key) === JSON.stringify({ userId: 1 }));
        if (!hasUserLookup) {
          await collection.createIndex({ userId: 1 }, { name: 'userId_1' });
        }
      } catch (error) {
        console.warn(`Beneficiary index maintenance skipped: ${error.message}`);
      }
    };

    const ensureDefaultClassifications = async () => {
      const Classification = require('../models/Classification');
      const defaults = [
        {
          name: 'SILVER',
          title: 'Silver',
          description: 'Standard customer with conservative daily and monthly transfer capabilities.',
          dailyTransferLimit: 15000,
          monthlyTransferLimit: 100000,
          overdraftLimit: 10000,
          overdraftPenaltyPerDay: 100,
          transferPrivileges: ['standard-transfers'],
        },
        {
          name: 'GOLD',
          title: 'Gold',
          description: 'Premium customer status with increased transfer and overdraft limits.',
          dailyTransferLimit: 50000,
          monthlyTransferLimit: 250000,
          overdraftLimit: 50000,
          overdraftPenaltyPerDay: 200,
          transferPrivileges: ['standard-transfers', 'priority-support'],
        },
        {
          name: 'PLATINUM',
          title: 'Platinum',
          description: 'Top tier classification with the highest limits and expanded privileges.',
          dailyTransferLimit: 100000,
          monthlyTransferLimit: 500000,
          overdraftLimit: 100000,
          overdraftPenaltyPerDay: 500,
          transferPrivileges: ['standard-transfers', 'priority-support', 'instant-settlements'],
        },
      ];

      for (const item of defaults) {
        await Classification.findOneAndUpdate(
          { name: item.name },
          { $setOnInsert: item },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await Classification.updateOne(
          { name: item.name, overdraftPenaltyPerDay: { $exists: false } },
          { $set: { overdraftPenaltyPerDay: item.overdraftPenaltyPerDay } }
        );
      }

      const Account = require('../models/Account');
      const classifications = await Classification.find({});
      for (const classification of classifications) {
        await Account.updateMany(
          { classification: classification.name },
          { $set: { overdraftPenaltyPerDay: classification.overdraftPenaltyPerDay || 0 } }
        );
      }
    };

    const syncExistingAccountsToUsers = async () => {
      const Account = require('../models/Account');
      const accounts = await Account.find({});
      for (const account of accounts) {
        await Account.syncToUser(account);
      }
    };

    await ensureBeneficiaryIndexes();
    await ensureDefaultClassifications();
    await syncExistingAccountsToUsers();

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
