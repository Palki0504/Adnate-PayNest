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

const kycDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    trim: true,
  },
  label: {
    type: String,
    trim: true,
  },
  originalName: {
    type: String,
    trim: true,
  },
  storedName: {
    type: String,
    trim: true,
  },
  path: {
    type: String,
    trim: true,
    select: false,
  },
  mimeType: {
    type: String,
    trim: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Uploaded', 'Pending Review', 'Approved', 'Rejected'],
    default: 'Uploaded',
  },
}, { _id: true });

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
    maritalStatus: {
      type: String,
      trim: true,
      default: '',
    },
    occupation: {
      type: String,
      trim: true,
      default: '',
    },
    employmentType: {
      type: String,
      trim: true,
      default: '',
    },
    annualIncome: {
      type: Number,
      min: 0,
      default: 0,
    },
    nationality: {
      type: String,
      trim: true,
      default: 'Indian',
    },
    address: {
      houseFlatNumber: { type: String, trim: true, default: '' },
      street: { type: String, trim: true, default: '' },
      area: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pinCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'India' },
    },
    nomineeDetails: {
      name: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' },
      dateOfBirth: { type: Date },
      contactNumber: { type: String, trim: true, default: '' },
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
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: ['Not Started', 'Pending', 'Approved', 'Rejected'],
      default: 'Not Started',
    },
    kycSubmittedAt: {
      type: Date,
    },
    kycApprovedAt: {
      type: Date,
    },
    kycApprovedBy: {
      type: String,
      trim: true,
      default: '',
    },
    kycRejectedAt: {
      type: Date,
    },
    kycRejectedBy: {
      type: String,
      trim: true,
      default: '',
    },
    kycRejectedReason: {
      type: String,
      trim: true,
      default: '',
    },
    kycChangeSummary: {
      type: [{
        field: { type: String, trim: true },
        label: { type: String, trim: true },
        oldValue: { type: String, trim: true, default: '' },
        newValue: { type: String, trim: true, default: '' },
      }],
      default: [],
    },
    kycChangeRequiresVerification: {
      type: Boolean,
      default: false,
    },
    kycChangeSubmittedAt: {
      type: Date,
    },
    profileChangeRequest: {
      status: {
        type: String,
        enum: ['None', 'Pending', 'Approved', 'Rejected'],
        default: 'None',
      },
      changes: {
        type: [{
          field: { type: String, trim: true },
          label: { type: String, trim: true },
          oldValue: { type: String, trim: true, default: '' },
          newValue: { type: String, trim: true, default: '' },
          newRawValue: mongoose.Schema.Types.Mixed,
        }],
        default: [],
      },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: String, trim: true, default: '' },
      remarks: { type: String, trim: true, default: '' },
    },
    documents: {
      type: [kycDocumentSchema],
      default: [],
      select: false,
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

userSchema.index({ role: 1, approvalStatus: 1, createdAt: -1 });

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

