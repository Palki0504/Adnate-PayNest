const User = require('../models/User');
const ClassificationRequest = require('../models/ClassificationRequest');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');
const { body } = require('express-validator');
const { sendTokenResponse } = require('../utils/jwtHelper');
const { createUniqueUserId } = require('../utils/idGenerator');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { normalizeEmail } = require('../utils/emailValidation');
const { normalizeGuardianDetails, validateGuardianForCustomer } = require('../utils/guardianValidation');

// ─── Validation Rules ─────────────────────────────────────────────────────────
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .customSanitizer(normalizeEmail),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Please enter a valid phone number'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  body('role')
    .optional()
    .isIn(['customer', 'manager', 'admin']).withMessage('Invalid role selected'),
  body('accountType')
    .notEmpty().withMessage('Account type is required')
    .isIn(['savings', 'current', 'salary']).withMessage('Invalid account type'),
  body('dateOfBirth')
    .custom((value, { req }) => {
      if ((req.body.role || 'customer') === 'customer' && !value) {
        throw new Error('Date of birth is required');
      }
      if (value && Number.isNaN(new Date(value).getTime())) {
        throw new Error('Date of birth must be a valid date');
      }
      return true;
    }),
  body('guardianDetails.name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Guardian name must be 2-100 characters'),
  body('guardianDetails.relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Guardian relationship is required'),
  body('guardianDetails.phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid guardian phone number'),
  body('guardianDetails.dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Guardian date of birth must be a valid date'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .customSanitizer(normalizeEmail),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .customSanitizer(normalizeEmail),
];

const resetPasswordValidation = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];


const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, accountType, dateOfBirth, guardianDetails } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userRole = role || 'customer';

    const guardianCheck = validateGuardianForCustomer({ role: userRole, dateOfBirth, guardianDetails });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Customers and Managers require admin approval before login
    const requiresApproval = ['customer', 'manager'].includes(userRole);

    const newUser = new User({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: userRole,
      customerId: userRole === 'customer' ? await createUniqueUserId('customer') : undefined,
      primaryAccountType: userRole === 'customer' ? accountType : undefined,
      dateOfBirth: dateOfBirth || null,
      guardianDetails: userRole === 'customer' ? normalizeGuardianDetails(guardianDetails) : undefined,
      approvalStatus: requiresApproval ? 'pending' : 'approved',
    });

    await newUser.save();

    // Fetch saved user with generated IDs
    const user = await User.findById(newUser._id);

    if (user.role === 'customer') {
      const Account = require('../models/Account');

      await ClassificationRequest.create({
        userId: user._id,
        requestedClassification: 'PENDING',
        status: 'Pending',
      });

      await Account.create({
        userId: user._id,
        customerId: user.customerId,
        accountType,
        balance: FIXED_ACCOUNT_BALANCES[accountType],
        classification: 'PENDING',
      });
    }

    // Notify all admin users about the new signup
    if (requiresApproval) {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      const adminNotifications = admins.map((admin) => ({
        userId: admin._id,
        title: `🆕 New ${user.role === 'manager' ? 'Manager' : 'Customer'} Registration`,
        message: `${name} (${email}) has registered as a ${user.role} and is awaiting your approval.`,
        type: 'info',
        priority: 'high',
      }));
      if (adminNotifications.length > 0) {
        await Notification.insertMany(adminNotifications).catch(() => {});
      }
    }

    // Log registration
    await AuditLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'register',
      details: `New ${user.role} registered: ${name} (${email}) — status: ${user.approvalStatus}`,
      ipAddress,
      severity: 'info',
    }).catch(() => {});

    // If approval required, do NOT issue token — return 202
    if (requiresApproval) {
      return res.status(202).json({
        success: true,
        requiresApproval: true,
        message: 'Registration submitted successfully! Your account is pending admin approval. You will be notified via email once approved.',
      });
    }

    sendTokenResponse(res, user, 201, 'Account created successfully. Welcome to Adnate PayNest!');
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Login user
// ─── @route   POST /api/auth/login
// ─── @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // Find user with password included
    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    let isPending = false;

    if (!user) {
      const PendingUser = require('../models/PendingUser');
      user = await PendingUser.findOne({ email: email.toLowerCase() }).select('+password');
      if (user) {
        isPending = true;
      }
    }

    if (!user) {
      // Log failed login attempt
      await AuditLog.create({
        action: 'login_failed',
        details: `Failed login attempt for email: ${email}`,
        ipAddress,
        severity: 'warning',
      }).catch(() => {});
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        details: `Login blocked — account deactivated: ${email}`,
        ipAddress,
        severity: 'warning',
      }).catch(() => {});
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support at support@adnatefinance.com.',
      });
    }

    // Check admin approval status (for customers and managers in User model only)
    if (!isPending && user.approvalStatus === 'pending') {
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        details: `Login blocked — account pending admin approval: ${email}`,
        ipAddress,
        severity: 'warning',
      }).catch(() => {});
      return res.status(403).json({
        success: false,
        requiresApproval: true,
        message: 'Your account is pending admin approval. You will receive an email once your account is approved.',
      });
    }

    if (!isPending && user.approvalStatus === 'rejected') {
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        details: `Login blocked — account registration rejected: ${email}`,
        ipAddress,
        severity: 'warning',
      }).catch(() => {});
      return res.status(403).json({
        success: false,
        message: `Your account registration was rejected. ${user.approvalComment ? `Reason: ${user.approvalComment}` : 'Please contact support for more information.'}`,
      });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        details: `Incorrect password for: ${email}`,
        ipAddress,
        severity: 'warning',
      }).catch(() => {});
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Ensure legacy users have an ID for their role
    if (user.role === 'customer' && !user.customerId) {
      user.customerId = await createUniqueUserId('customer');
    }
    if (user.role === 'manager' && !user.adminId) {
      user.adminId = await createUniqueUserId('manager');
    }
    if (user.role === 'admin' && !user.adminId) {
      user.adminId = await createUniqueUserId('admin');
    }

    if (!isPending) {
      // Update last login
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    }

    // Log successful login
    await AuditLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'login',
      details: `${user.name} logged in successfully`,
      ipAddress,
      severity: 'info',
    }).catch(() => {});

    // Create login notification for customer/manager (non-pending only)
    if (!isPending && (user.role === 'customer' || user.role === 'manager')) {
      const now = new Date();
      const timeStr = now.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
      await Notification.create({
        userId: user._id,
        title: '✅ Login Successful',
        message: `Hello ${user.name}, you logged in to Adnate PayNest on ${timeStr}. If this wasn't you, please contact support immediately.`,
        type: 'alert',
        priority: 'medium',
      }).catch(() => {});

      if (user.role === 'manager') {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        if (admins.length > 0) {
          const managerId = user.adminId || user._id.toString();
          await Notification.insertMany(
            admins.map((admin) => ({
              userId: admin._id,
              title: 'Manager Login',
              message: `Manager ${user.name} (${managerId}) logged in successfully on ${timeStr}.`,
              type: 'alert',
              priority: 'medium',
              senderId: user._id,
              senderName: user.name,
              senderRole: 'manager',
              link: '/admin-dashboard/user-management',
            }))
          ).catch(() => {});
        }
      }
    }

    sendTokenResponse(res, user, 200, 'Login successful. Welcome back!');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    let user = await User.findById(req.user._id);
    if (!user) {
      const PendingUser = require('../models/PendingUser');
      user = await PendingUser.findById(req.user._id);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        customerId: user.customerId,
        adminId: user.adminId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        classification: user.role === 'customer' ? user.classification : undefined,
        profileCompleted: user.role === 'customer' ? !!user.profileCompleted : undefined,
        kycStatus: user.role === 'customer' ? (user.kycStatus || 'Not Started') : undefined,
        isKycComplete: user.role === 'customer' ? !!user.isKycComplete : undefined,
        bankingAccess: user.role === 'customer' ? !!(user.profileCompleted && user.kycStatus === 'Approved') : undefined,
        isActive: user.isActive,
        isTempPassword: !!user.isTempPassword,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Forgot Password - Send password reset link
// ─── @route   POST /api/auth/forgot-password
// ─── @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Save token on the user record (no expiry)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = undefined;

    await user.save({ validateBeforeSave: false });

    // Send email
    const { sendPasswordResetEmail } = require('../utils/emailService');
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    
    try {
      await sendPasswordResetEmail(user.email, token, user.name);

      // Audit Log success
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'forgot_password_request',
        details: `Password reset link sent to email: ${user.email}`,
        ipAddress,
        severity: 'info',
      }).catch(() => {});

    } catch (emailError) {
      // Revert token and expiry on failure
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Failed to send reset email:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email: ' + emailError.message,
      });
    }

    res.status(200).json({
      success: true,
      message: 'A secure password reset link has been sent to your email.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Validate Reset Token
// ─── @route   GET /api/auth/validate-token/:token
// ─── @access  Public
const validateToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Reset Password
// ─── @route   POST /api/auth/reset-password/:token
// ─── @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid.',
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isTempPassword = false; // Clear temporary password status

    await user.save({ validateBeforeSave: false });

    // Log success
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await AuditLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'password_reset_success',
      details: `Password reset successfully via token for user: ${user.name} (${user.email})`,
      ipAddress,
      severity: 'info',
    }).catch(() => {});

    // Create Notification
    await Notification.create({
      userId: user._id,
      title: '🔐 Password Reset Success',
      message: `Hello ${user.name}, your account password has been successfully reset. If this was not you, please contact support immediately.`,
      type: 'alert',
      priority: 'high',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully.',
    });
  } catch (error) {
    next(error);
  }
};

const activateAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    const PendingUser = require('../models/PendingUser');
    const PendingAccount = require('../models/PendingAccount');

    const pendingUser = await PendingUser.findById(req.user._id);
    if (!pendingUser) {
      const activatedUser = await User.findById(req.user._id);
      if (activatedUser && !activatedUser.isTempPassword) {
        return res.status(200).json({
          success: true,
          message: `Customer ${activatedUser.name} account is already activated. Please sign in with the new password.`,
        });
      }
      return res.status(404).json({ success: false, message: 'Pending activation user not found.' });
    }

    const pendingAccount = await PendingAccount.findOne({ userId: pendingUser._id });
    if (!pendingAccount) {
      return res.status(400).json({ success: false, message: 'Pending account details not found.' });
    }

    // Activation is intentionally retry-safe in case a previous request stopped midway.
    let user = await User.findOne({
      $or: [{ _id: pendingUser._id }, { email: pendingUser.email }],
    }).select('+password');

    if (!user) {
      user = await User.create({
        _id: pendingUser._id,
        name: pendingUser.name,
        email: pendingUser.email,
        phone: pendingUser.phone,
        password,
        role: 'customer',
        customerId: pendingUser.customerId,
        primaryAccountType: pendingUser.primaryAccountType,
        dateOfBirth: pendingUser.dateOfBirth,
        guardianDetails: pendingUser.guardianDetails,
        isActive: true,
        isTempPassword: false,
        approvalStatus: 'approved',
        isKycComplete: !!(pendingUser.aadhaarNumber && pendingUser.dateOfBirth && pendingUser.name),
        aadhaarNumber: pendingUser.aadhaarNumber,
      });
    } else {
      user.password = password;
      user.isActive = true;
      user.isTempPassword = false;
      user.approvalStatus = 'approved';
      await user.save({ validateBeforeSave: false });
    }

    // Create the main account only if a prior activation attempt did not create it.
    const Account = require('../models/Account');
    let account = await Account.findOne({ userId: user._id, accountType: pendingAccount.accountType });
    if (!account) {
      account = await Account.create({
        userId: user._id,
        customerId: user.customerId,
        accountType: pendingAccount.accountType,
        accountNumber: pendingAccount.accountNumber,
        balance: pendingAccount.balance,
        classification: 'PENDING',
      });
    }

    await ClassificationRequest.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { requestedClassification: 'PENDING', status: 'Pending' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Notify admins
    const admins = await User.find({ role: 'admin', isActive: true });
    const now = new Date();
    const timestamp = now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const adminNotifications = admins.map((admin) => ({
      userId: admin._id,
      title: 'Customer Account Activated Successfully',
      message: `Customer Name: ${user.name}\nCustomer ID: ${user.customerId}\nEmail: ${user.email}\nActivation Time: ${timestamp}`,
      type: 'system',
      priority: 'high',
    }));

    if (adminNotifications.length > 0) {
      await Notification.insertMany(adminNotifications).catch(() => {});
    }

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'account_activated',
      details: `Customer ${user.name} (${user.customerId}) completed first-time login and activated account.`,
      ipAddress,
      severity: 'info',
    }).catch(() => {});

    // Clean up
    await PendingUser.findByIdAndDelete(pendingUser._id);
    await PendingAccount.findOneAndDelete({ userId: pendingUser._id });

    res.status(200).json({
      success: true,
      message: `Customer ${user.name} has completed first-time login and account activation. Please sign in with the new password.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  validateToken,
  resetPassword,
  activateAccount,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
};

