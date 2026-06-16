const mongoose = require('mongoose');

const classificationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Classification name is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    dailyTransferLimit: {
      type: Number,
      required: [true, 'Daily transfer limit is required'],
      min: 0,
    },
    monthlyTransferLimit: {
      type: Number,
      required: [true, 'Monthly transfer limit is required'],
      min: 0,
    },
    overdraftLimit: {
      type: Number,
      required: [true, 'Overdraft limit is required'],
      min: 0,
    },
    overdraftPenaltyPerDay: {
      type: Number,
      required: [true, 'Overdraft penalty per day is required'],
      min: 0,
      default: 0,
    },
    transferPrivileges: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Classification', classificationSchema);
