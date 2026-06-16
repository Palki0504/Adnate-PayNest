const mongoose = require('mongoose');

const businessRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      unique: true,
    },
    key: {
      type: String,
      required: [true, 'Rule key is required'],
      trim: true,
      unique: true,
      lowercase: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Rule value is required'],
    },
    valueType: {
      type: String,
      enum: ['number', 'boolean', 'string'],
      default: 'number',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['transfer', 'overdraft', 'kyc', 'security', 'general'],
      default: 'general',
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessRule', businessRuleSchema);
