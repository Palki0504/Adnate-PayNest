const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    bankName: {
      type: String,
      default: 'Adnate PayNest',
    },
    supportEmail: {
      type: String,
      default: 'support@adnatefinance.com',
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    overdraftEnabled: {
      type: Boolean,
      default: true,
    },
    maxODPerMonth: {
      type: Number,
      default: 3,
    },
    requireKycForTransfer: {
      type: Boolean,
      default: false,
    },
    maxTransferApprovalThreshold: {
      type: Number,
      default: 50000,
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 60,
    },
    allowSelfRegistration: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
