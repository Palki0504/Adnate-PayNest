const mongoose = require('mongoose');

const pendingAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingUser',
      required: true,
    },
    customerId: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
      required: [true, 'Account type is required'],
    },
    accountNumber: {
      type: String,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    classification: {
      type: String,
      default: 'PENDING',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Generate account number before saving
pendingAccountSchema.pre('save', async function (next) {
  if (!this.accountNumber) {
    const prefix = this.accountType === 'savings' ? 'SAV' : this.accountType === 'current' ? 'CUR' : 'SAL';
    this.accountNumber = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

module.exports = mongoose.model('PendingAccount', pendingAccountSchema);
