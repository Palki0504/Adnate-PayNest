const User = require('../models/User');
const ClassificationRequest = require('../models/ClassificationRequest');
const { FIXED_ACCOUNT_BALANCES } = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { body, param, query, validationResult } = require('express-validator');
const { sendNewUserWelcomeEmail, generateTempPassword } = require('../utils/emailService');
const { createUniqueUserId } = require('../utils/idGenerator');
const { normalizeEmail } = require('../utils/emailValidation');
const { normalizeGuardianDetails, validateGuardianForCustomer } = require('../utils/guardianValidation');

const maskAadhaar = (aadhaar) => {
  if (!aadhaar) return null;
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
};

const calculateAge = (dateValue) => {
  const birthDate = new Date(dateValue);
  if (!dateValue || Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

const getUsers = async (req, res, next) => {
  try {
    const { search, role, status, page = 1, limit = 25 } = req.query;
    const filter = { role: { $in: ['customer', 'manager'] } };

    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { adminId: { $regex: q, $options: 'i' } },
        { customerId: { $regex: q, $options: 'i' } },
      ];
    }

    if (role && ['customer', 'manager'].includes(role)) {
      filter.role = role;
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));

    const [customersCount, managersCount, totalUsers, users] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true, approvalStatus: 'approved' }),
      User.countDocuments({ role: 'manager', isActive: true }),
      User.countDocuments(filter),
      User.find(filter)
        .select('-password -profileImage -panNumber -aadhaarNumber')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
    ]);

    res.status(200).json({
      success: true,
      customersCount,
      managersCount,
      totalUsers,
      users,
      page: pageNumber,
      limit: pageSize,
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('+aadhaarNumber +panNumber');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let accountNumber = null;
    let accountType = user.primaryAccountType || null;
    if (user.role === 'customer') {
      const Account = require('../models/Account');
      const account = await Account.findOne({ userId: user._id });
      if (account) {
        accountNumber = account.accountNumber;
        accountType = account.accountType;
      }
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        id: user._id,
        adminId: user.adminId || user.customerId || user._id,
        customerId: user.customerId || null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        isTempPassword: user.isTempPassword || false,
        isKycComplete: user.isKycComplete || false,
        designation: user.designation || null,
        gender: user.gender || null,
        dateOfBirth: user.dateOfBirth || null,
        guardianDetails: user.guardianDetails || null,
        aadhaarNumber: user.aadhaarNumber || null,
        panNumber: user.panNumber || null,
        hasAadhaar: !!user.aadhaarNumber,
        hasPan: !!user.panNumber,
        hasDateOfBirth: !!user.dateOfBirth,
        classification: user.role === 'customer' ? user.classification || 'PENDING' : null,
        accountNumber,
        accountType,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, designation, gender, dateOfBirth, aadhaarNumber, isActive, accountType, guardianDetails, replaceActiveManager = false } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const PendingUser = require('../models/PendingUser');
    const [existingUser, existingPendingUser] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      PendingUser.findOne({ email: normalizedEmail }),
    ]);

    if (existingUser || existingPendingUser) {
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    }

    if (role === 'manager' && calculateAge(dateOfBirth) < 18) {
      return res.status(400).json({ success: false, message: 'Manager must be at least 18 years old' });
    }
    if (role === 'manager' && !/^\d{12}$/.test(String(aadhaarNumber || '').trim())) {
      return res.status(400).json({ success: false, message: 'Aadhaar Card number must be exactly 12 digits' });
    }

    let activeManagers = [];
    if (role === 'manager') {
      activeManagers = await User.find({ role: 'manager', isActive: true }).select('_id name email');
      if (activeManagers.length > 0 && replaceActiveManager !== true) {
        return res.status(409).json({
          success: false,
          requiresManagerReplacement: true,
          message: 'One active manager already exists. Creating a new manager will deactivate the previous manager. Are you sure you want to continue?',
          activeManager: activeManagers[0],
        });
      }
    }

    const guardianCheck = validateGuardianForCustomer({ role, dateOfBirth, guardianDetails });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    // Auto-generate temporary password from email prefix (e.g. palki@example.com → Palki@123)
    const tempPassword = generateTempPassword(normalizedEmail);

    let user;
    let userId;

    if (role === 'customer') {
      const mongoose = require('mongoose');
      const PendingAccount = require('../models/PendingAccount');
      const newUserId = new mongoose.Types.ObjectId();
      const customerId = await createUniqueUserId('customer');
      userId = customerId;

      user = await PendingUser.create({
        _id: newUserId,
        name,
        email: normalizedEmail,
        phone,
        password: tempPassword,
        role: 'customer',
        primaryAccountType: accountType,
        dateOfBirth: dateOfBirth || null,
        guardianDetails: normalizeGuardianDetails(guardianDetails),
        isActive: typeof isActive === 'boolean' ? isActive : true,
        aadhaarNumber: aadhaarNumber || undefined,
        customerId,
      });

      await PendingAccount.create({
        userId: user._id,
        customerId: user.customerId,
        accountType,
        balance: FIXED_ACCOUNT_BALANCES[accountType],
        classification: 'PENDING',
      });
    } else {
      const previousManagerIds = activeManagers.map((manager) => manager._id);
      if (previousManagerIds.length > 0) {
        await User.updateMany({ _id: { $in: previousManagerIds } }, { $set: { isActive: false } });
      }
      try {
        user = await User.create({
          name,
          email: normalizedEmail,
          phone,
          password: tempPassword,
          role,
          isTempPassword: true,
          customerId: undefined,
          primaryAccountType: undefined,
          designation: designation || '',
          gender: gender || '',
          dateOfBirth: dateOfBirth || null,
          guardianDetails: undefined,
          isActive: true,
          aadhaarNumber: aadhaarNumber || undefined,
        });
      } catch (createError) {
        if (previousManagerIds.length > 0) {
          await User.updateMany({ _id: { $in: previousManagerIds } }, { $set: { isActive: true } }).catch(() => {});
        }
        throw createError;
      }
      userId = user.adminId || user.customerId || user._id;
    }

    let emailStatus = { sent: true, warning: null };

    try {
      await sendNewUserWelcomeEmail(user.email, tempPassword, user.name, user.role, userId);
    } catch (sendError) {
      emailStatus = { sent: false, warning: sendError.message };
      console.warn('New user created but failed to send email:', sendError.message);
    }

    res.status(201).json({
      success: true,
      message: role === 'customer'
        ? (emailStatus.sent
            ? 'User invitation sent successfully. Customer account will be activated after first login.'
            : 'User invitation created, but the welcome email could not be sent.')
        : (emailStatus.sent
            ? 'User created successfully and login credentials sent to customer email.'
            : 'User created successfully, but the welcome email could not be sent.'),
      emailSent: emailStatus.sent,
      emailWarning: emailStatus.warning,
      user: {
        id: user._id,
        adminId: role === 'customer' ? undefined : (user.adminId || user._id),
        customerId: role === 'customer' ? user.customerId : undefined,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, aadhaarNumber, panNumber, dateOfBirth, role, designation, gender, guardianDetails } = req.body;
    
    const user = await User.findById(id).select('+password +aadhaarNumber +panNumber');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    
    if (email !== undefined && email.toLowerCase() !== user.email) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email already exists.' });
      }
      updateFields.email = normalizedEmail;
    }
    
    if (designation !== undefined) updateFields.designation = designation;
    if (gender !== undefined) updateFields.gender = gender;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth || null;
    if (guardianDetails !== undefined) updateFields.guardianDetails = normalizeGuardianDetails(guardianDetails);
    if (aadhaarNumber !== undefined) updateFields.aadhaarNumber = aadhaarNumber || null;
    if (panNumber !== undefined) updateFields.panNumber = panNumber ? panNumber.toUpperCase() : null;

    if (role && ['customer', 'manager'].includes(role) && role !== user.role) {
      if (role === 'manager' && user.isActive) {
        const activeManager = await User.findOne({ role: 'manager', isActive: true, _id: { $ne: user._id } });
        if (activeManager) {
          return res.status(409).json({ success: false, message: 'One active manager already exists. Create a replacement manager through Add User to deactivate the previous manager safely.' });
        }
      }
      updateFields.role = role;
      if (role === 'manager' && !user.adminId) {
        updateFields.adminId = await createUniqueUserId('manager');
      }
      if (role === 'customer' && !user.customerId) {
        updateFields.customerId = await createUniqueUserId('customer');
      }
    }

    const guardianCheck = validateGuardianForCustomer({
      role: updateFields.role || user.role,
      dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : user.dateOfBirth,
      guardianDetails: guardianDetails !== undefined ? guardianDetails : user.guardianDetails,
    });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    const finalRole = updateFields.role || user.role;
    const finalDateOfBirth = dateOfBirth !== undefined ? dateOfBirth : user.dateOfBirth;
    const finalManagerAadhaar = aadhaarNumber !== undefined ? aadhaarNumber : user.aadhaarNumber;
    if (finalRole === 'manager' && calculateAge(finalDateOfBirth) < 18) {
      return res.status(400).json({ success: false, message: 'Manager must be at least 18 years old' });
    }
    if (finalRole === 'manager' && !/^\d{12}$/.test(String(finalManagerAadhaar || '').trim())) {
      return res.status(400).json({ success: false, message: 'Aadhaar Card number must be exactly 12 digits' });
    }

    // Set KYC complete if required customer fields are filled
    const finalAadhaar = aadhaarNumber !== undefined ? aadhaarNumber : user.aadhaarNumber;
    const finalDob = dateOfBirth !== undefined ? dateOfBirth : user.dateOfBirth;
    const finalPan = panNumber !== undefined ? panNumber : user.panNumber;
    const finalName = name !== undefined ? name : user.name;
    if (finalAadhaar && finalDob && finalPan && finalName) {
      updateFields.isKycComplete = true;
    }

    const updatedUser = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true }).select('-password +aadhaarNumber +panNumber');
    const modifiedFields = Object.keys(updateFields);

    if (user.role === 'customer' && modifiedFields.length > 0) {
      const fieldLabels = modifiedFields
        .filter((field) => field !== 'password')
        .map((field) => ({
          aadhaarNumber: 'Aadhaar number',
          panNumber: 'PAN number',
          dateOfBirth: 'date of birth',
          isKycComplete: 'KYC status',
        }[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase()))
        .join(', ');

      await Notification.create({
        userId: user._id,
        title: 'Profile Updated',
        message: `An admin updated your profile${fieldLabels ? ` (${fieldLabels})` : ''}. Please review your profile details.`,
        type: 'info',
        priority: 'medium',
        senderId: req.user._id,
        senderName: req.user.name || 'Admin',
        senderRole: 'admin',
        link: '/customer-dashboard/profile',
      }).catch((notifErr) => {
        console.warn('Customer profile update notification failed:', notifErr.message);
      });
    }

    // ── Audit Logging ────────────────────────────────────────────────────
    try {
      const oldValues = {};
      const newValues = {};
      modifiedFields.forEach((field) => {
        if (['name', 'email', 'phone'].includes(field)) {
          oldValues[field] = user[field];
          newValues[field] = updateFields[field];
        }
      });

      const targetUserId = user.customerId || user.adminId || user._id.toString();
      await AuditLog.create({
        userId: req.user._id,
        userName: req.user.name || 'Admin',
        userRole: 'admin',
        action: 'user_updated',
        details: `Admin updated user ${user.name} (${targetUserId}). Modified fields: ${modifiedFields.join(', ')}.`,
        metadata: {
          targetUserId: user._id,
          targetUserDisplayId: targetUserId,
          modifiedFields,
          oldValues,
          newValues,
          updatedAt: new Date().toISOString(),
        },
        severity: 'info',
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: {
        _id: updatedUser._id,
        id: updatedUser._id,
        adminId: updatedUser.adminId || updatedUser.customerId || updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
        designation: updatedUser.designation || null,
        gender: updatedUser.gender || null,
        dateOfBirth: updatedUser.dateOfBirth || null,
        guardianDetails: updatedUser.guardianDetails || null,
        aadhaarNumber: updatedUser.aadhaarNumber || null,
        panNumber: updatedUser.panNumber || null,
        hasAadhaar: !!updatedUser.aadhaarNumber,
        hasPan: !!updatedUser.panNumber,
        hasDateOfBirth: !!updatedUser.dateOfBirth,
        classification: updatedUser.role === 'customer' ? updatedUser.classification || 'PENDING' : null,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'manager' && isActive) {
      const activeManager = await User.findOne({ role: 'manager', isActive: true, _id: { $ne: user._id } });
      if (activeManager) {
        return res.status(409).json({ success: false, message: 'Another manager is already active. Deactivate the current manager before activating this manager.' });
      }
    }

    user.isActive = !!isActive;
    await user.save({ validateBeforeSave: false });

    // ── Audit Logging ────────────────────────────────────────────────────
    try {
      const targetUserId = user.customerId || user.adminId || user._id.toString();
      await AuditLog.create({
        userId: req.user._id,
        userName: req.user.name || 'Admin',
        userRole: 'admin',
        action: user.isActive ? 'user_activated' : 'user_deactivated',
        details: `Admin ${user.isActive ? 'activated' : 'deactivated'} user ${user.name} (${targetUserId}).`,
        metadata: {
          targetUserId: user._id,
          targetUserDisplayId: targetUserId,
          isActive: user.isActive,
          updatedAt: new Date().toISOString(),
        },
        severity: 'info',
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed:', auditErr.message);
    }

    res.status(200).json({
      success: true,
      message: `User has been ${user.isActive ? 'activated' : 'deactivated'}.`,
      user: {
        id: user._id,
        adminId: user.adminId || user.customerId || user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};


const createUserValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please enter a valid email address').customSanitizer(normalizeEmail),
  body('phone').trim().notEmpty().withMessage('Phone number is required').matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid phone number'),
  body('role').trim().notEmpty().withMessage('Role is required').isIn(['customer', 'manager']).withMessage('Role must be customer or manager'),
  body('accountType').if(body('role').equals('customer')).trim().notEmpty().withMessage('Account type is required').isIn(['savings', 'current', 'salary']).withMessage('Invalid account type'),
  body('aadhaarNumber').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{12}$/).withMessage('Aadhaar number must be exactly 12 digits'),
  body('dateOfBirth').trim().notEmpty().withMessage('Date of birth is required').isISO8601().withMessage('Date of birth must be a valid date'),
  body('dateOfBirth').custom((value, { req }) => {
    if (req.body.role === 'manager' && calculateAge(value) < 18) throw new Error('Manager must be at least 18 years old');
    return true;
  }),
  body('guardianDetails.name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Guardian name must be 2-100 characters'),
  body('guardianDetails.relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Guardian relationship is required'),
  body('guardianDetails.phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid guardian phone number'),
  body('guardianDetails.dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Guardian date of birth must be a valid date'),
  body('replaceActiveManager').optional().isBoolean().withMessage('replaceActiveManager must be true or false'),
];

const updateUserValidation = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').optional().trim().isEmail().withMessage('Please enter a valid email address').customSanitizer(normalizeEmail),
  body('phone').optional().trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid phone number'),
  body('role').optional().trim().isIn(['customer', 'manager']).withMessage('Role must be customer or manager'),
  body('designation').optional().trim().isLength({ max: 100 }).withMessage('Designation must be 100 characters or less'),
  body('gender').optional().trim().isIn(['Male', 'Female', 'Other', 'Prefer not to say', '']).withMessage('Invalid gender'),
  body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).trim().isISO8601().withMessage('Date of birth must be a valid date'),
  body('guardianDetails.name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Guardian name must be 2-100 characters'),
  body('guardianDetails.relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Guardian relationship is required'),
  body('guardianDetails.phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid guardian phone number'),
  body('guardianDetails.dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Guardian date of birth must be a valid date'),
  body('aadhaarNumber').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{12}$/).withMessage('Aadhaar number must be exactly 12 digits'),
  body('panNumber').optional({ nullable: true, checkFalsy: true }).trim().matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/).withMessage('PAN format must be ABCDE1234F'),
];

const updateUserStatusValidation = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

// ─── Admin: get pending registrations ─────────────────────────────────────────
const getPendingRegistrations = async (req, res, next) => {
  try {
    const users = await User.find({
      approvalStatus: 'pending',
      role: { $in: ['customer', 'manager'] },
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, users, count: users.length });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: approve registration ──────────────────────────────────────────────
const approveRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'User is not in pending state' });
    }
    if (user.role === 'customer' && !user.dateOfBirth) {
      return res.status(400).json({ success: false, message: 'Date of birth is required before approving a customer account.' });
    }

    const guardianCheck = validateGuardianForCustomer({
      role: user.role,
      dateOfBirth: user.dateOfBirth,
      guardianDetails: user.guardianDetails,
    });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    user.approvalStatus = 'approved';
    user.isActive = true;
    await user.save({ validateBeforeSave: false });

    // If customer, ensure classification request exists
    if (user.role === 'customer') {
      const existing = await ClassificationRequest.findOne({ userId: user._id });
      if (!existing) {
        await ClassificationRequest.create({ userId: user._id, requestedClassification: 'PENDING', status: 'Pending' });
      }
    }

    // Notify user
    const Notification = require('../models/Notification');
    await Notification.create({
      userId: user._id,
      title: '✅ Account Approved!',
      message: `Congratulations ${user.name}! Your ${user.role} account has been approved by the admin. You can now log in to Adnate PayNest.`,
      type: 'approval',
      priority: 'high',
    }).catch(() => {});

    // Send email
    try {
      const { sendRegistrationApprovedEmail } = require('../utils/emailService');
      await sendRegistrationApprovedEmail(user.email, user.name, user.role);
    } catch (emailErr) {
      console.warn('Failed to send approval email:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: `${user.role === 'manager' ? 'Manager' : 'Customer'} account approved successfully.`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: reject registration ───────────────────────────────────────────────
const rejectRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'User is not in pending state' });
    }

    user.approvalStatus = 'rejected';
    user.isActive = false;
    user.approvalComment = reason;
    await user.save({ validateBeforeSave: false });

    // Notify user
    const Notification = require('../models/Notification');
    await Notification.create({
      userId: user._id,
      title: '❌ Account Registration Rejected',
      message: `Your ${user.role} account registration has been rejected.${reason ? ` Reason: ${reason}` : ''} Please contact support for more information.`,
      type: 'rejection',
      priority: 'high',
    }).catch(() => {});

    // Send email
    try {
      const { sendRegistrationRejectedEmail } = require('../utils/emailService');
      await sendRegistrationRejectedEmail(user.email, user.name, user.role, reason);
    } catch (emailErr) {
      console.warn('Failed to send rejection email:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: `${user.role === 'manager' ? 'Manager' : 'Customer'} account rejected.`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  createUserValidation,
  updateUserValidation,
  updateUserStatusValidation,
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
};

