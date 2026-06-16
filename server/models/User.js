const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createUniqueUserId } = require('../utils/idGenerator');
const { EMAIL_VALIDATION_MESSAGE, isValidEmail, normalizeEmail } = require('../utils/emailValidation');

const userAccountSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
  },
  accountType: {
    type: String,
    enum: ['savings', 'current', 'salary'],
  },
  accountNumber: {
    type: String,
    trim: true,
  },
  customerName: {
    type: String,
    trim: true,
  },
  customerId: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  dailyTransferLimit: {
    type: Number,
    min: 0,
  },
  monthlyTransferLimit: {
    type: Number,
    min: 0,
  },
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'frozen', 'closed'],
    default: 'active',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'frozen', 'closed'],
    default: 'active',
  },
  balance: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
  },
  approvedAt: {
    type: Date,
  },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
      sparse: true,
    },
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
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ['customer', 'manager', 'admin'],
      default: 'customer',
    },
    classification: {
      type: String,
      default: 'PENDING',
      uppercase: true,
      trim: true,
    },
    classificationRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassificationRequest',
    },
    primaryAccountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
      required: function () {
        return this.role === 'customer';
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    adminId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters'],
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', ''],
      default: '',
    },
    lastLogin: {
      type: Date,
    },
    // ─── Forgot Password ────────────────────────────────────────────────
    isTempPassword: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    // ─── KYC Fields ─────────────────────────────────────────────────────
    aadhaarNumber: {
      type: String,
      trim: true,
      match: [/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'],
      select: false, // sensitive - never returned by default
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}\d{4}[A-Z]$/, 'PAN must be in format ABCDE1234F'],
      select: false, // sensitive - never returned by default
    },
    dateOfBirth: {
      type: Date,
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
        validate: {
          validator: (value) => !value || /^\+?[\d\s\-()]{7,15}$/.test(value),
          message: 'Please enter a valid guardian phone number',
        },
      },
      dateOfBirth: {
        type: Date,
      },
    },
    account1: userAccountSchema,
    account2: userAccountSchema,
    account3: userAccountSchema,
    accounts: {
      type: [userAccountSchema],
      default: [],
    },
    isKycComplete: {
      type: Boolean,
      default: false,
    },
    // ─── Signup Approval Workflow ────────────────────────────────────────────
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved', // Existing users are unaffected
    },
    approvalComment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('email')) {
    this.email = normalizeEmail(this.email);
  }

  if (this.isNew) {
    if (this.role === 'admin' && !this.adminId) {
      this.adminId = await createUniqueUserId('admin');
    }

    if (this.role === 'manager' && !this.adminId) {
      this.adminId = await createUniqueUserId('manager');
    }

    if (this.role === 'customer' && !this.customerId) {
      this.customerId = await createUniqueUserId('customer');
    }
  }

  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const syncUserProfileToAccounts = async (user) => {
  if (!user || user.role !== 'customer') return;
  const User = mongoose.model('User');
  await User.updateOne(
    { _id: user._id, 'accounts.0': { $exists: true } },
    {
      $set: {
        'accounts.$[].customerName': user.name,
        'accounts.$[].customerId': user.customerId,
        'accounts.$[].email': user.email,
        'accounts.$[].phone': user.phone,
      },
    }
  );
};

userSchema.post('save', async function (user) {
  await syncUserProfileToAccounts(user);
});

userSchema.post('findOneAndUpdate', async function (user) {
  await syncUserProfileToAccounts(user);
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: return public profile (no password)
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

