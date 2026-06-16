const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    fromAccountNumber: {
      type: String,
    },
    toAccountNumber: {
      type: String,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'transfer', 'overdraft', 'overdraft_transfer'],
      required: [true, 'Transaction type is required'],
    },
    category: {
      type: String,
      enum: ['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'transfer', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'rejected'],
      default: 'completed',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    reference: {
      type: String,
      unique: true,
    },
    balance_after: {
      type: Number,
    },
    usedOverdraft: {
      type: Boolean,
      default: false,
    },
    overdraftAmountUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmountUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAccountBalance: {
      type: Number,
      min: 0,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate reference number
transactionSchema.pre('save', async function (next) {
  if (!this.reference) {
    this.reference = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }
  next();
});

// Index for faster querying
transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
