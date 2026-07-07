const mongoose = require('mongoose');

const monthlyStatementDeliverySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    status: {
      type: String,
      enum: ['sending', 'sent', 'failed'],
      default: 'sending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

monthlyStatementDeliverySchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyStatementDelivery', monthlyStatementDeliverySchema);
