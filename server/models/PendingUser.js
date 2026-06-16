const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { EMAIL_VALIDATION_MESSAGE, isValidEmail, normalizeEmail } = require('../utils/emailValidation');

const pendingUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeEmail,
      validate: {
        validator: isValidEmail,
        message: EMAIL_VALIDATION_MESSAGE,
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+?[\d\s\-()]{7,15}$/, 'Please enter a valid phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      default: 'customer',
    },
    primaryAccountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isTempPassword: {
      type: Boolean,
      default: true,
    },
    customerId: {
      type: String,
      unique: true,
      required: true,
    },
    // KYC / Custom fields
    aadhaarNumber: {
      type: String,
      trim: true,
      match: [/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    guardianDetails: {
      name: {
        type: String,
        trim: true,
        default: '',
      },
      relationship: {
        type: String,
        trim: true,
        default: '',
      },
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      dateOfBirth: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
pendingUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
pendingUserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('PendingUser', pendingUserSchema);
