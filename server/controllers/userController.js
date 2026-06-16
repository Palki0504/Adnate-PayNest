const User = require('../models/User');
const ClassificationRequest = require('../models/ClassificationRequest');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { normalizeGuardianDetails, validateGuardianForCustomer } = require('../utils/guardianValidation');

// ─── Helper: Mask sensitive data ─────────────────────────────────────────────
const maskAadhaar = (aadhaar) => {
  if (!aadhaar) return null;
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
};

const maskPan = (pan) => {
  if (!pan) return null;
  return `XXXXXX${pan.slice(-4)}`;
};

// ─── @desc    Get user profile
// ─── @route   GET /api/users/profile
// ─── @access  Protected
const getProfile = async (req, res, next) => {
  try {
    // Include sensitive fields for masking
    const user = await User.findById(req.user._id).select('+aadhaarNumber +panNumber');

    const classificationRequest = await ClassificationRequest.findOne({ userId: user._id, status: 'Pending' }).sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        isTempPassword: user.isTempPassword || false,
        isKycComplete: user.isKycComplete || false,
        classification: user.classification || 'PENDING',
        classificationRequestStatus: classificationRequest?.status || null,
        classificationRequestId: classificationRequest?._id || null,
        dateOfBirth: user.dateOfBirth || null,
        guardianDetails: user.guardianDetails || null,
        aadhaarNumber: maskAadhaar(user.aadhaarNumber),
        panNumber: maskPan(user.panNumber),
        adminId: user.adminId || user.customerId || user._id,
        designation: user.designation || null,
        gender: user.gender || null,
        hasAadhaar: !!user.aadhaarNumber,
        hasPan: !!user.panNumber,
        hasDateOfBirth: !!user.dateOfBirth,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Update user profile
// ─── @route   PUT /api/users/profile
// ─── @access  Protected
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Please enter a valid phone number'),
  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Designation must be 2–100 characters'),
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say']).withMessage('Invalid gender'),
  body('aadhaarNumber')
    .optional()
    .trim()
    .matches(/^\d{12}$/).withMessage('Aadhaar number must be exactly 12 digits'),
  body('panNumber')
    .optional()
    .trim()
    .customSanitizer((value) => (typeof value === 'string' ? value.toUpperCase() : value))
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/).withMessage('PAN must be in format ABCDE1234F'),
  body('dateOfBirth')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('guardianDetails.name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Guardian name must be 2-100 characters'),
  body('guardianDetails.relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Guardian relationship is required'),
  body('guardianDetails.phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid guardian phone number'),
  body('guardianDetails.dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Guardian date of birth must be a valid date'),
];

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, designation, gender, aadhaarNumber, panNumber, dateOfBirth, guardianDetails } = req.body;

    // Get current user with sensitive fields
    const currentUser = await User.findById(req.user._id).select('+aadhaarNumber +panNumber');

    const kycLocked = !!(currentUser.aadhaarNumber && currentUser.panNumber && currentUser.dateOfBirth);

    if (name && name !== currentUser.name) {
      if (kycLocked) {
        return res.status(400).json({
          success: false,
          message: 'Full name cannot be changed after KYC details are saved.',
        });
      }
      currentUser.name = name;
    }

    if (phone) currentUser.phone = phone;

    if (designation) {
      if (currentUser.designation) {
        return res.status(400).json({
          success: false,
          message: 'Designation cannot be changed after it has been set.',
        });
      }
      currentUser.designation = designation;
    }

    if (gender) {
      if (currentUser.gender) {
        return res.status(400).json({
          success: false,
          message: 'Gender cannot be changed after it has been set.',
        });
      }
      currentUser.gender = gender;
    }

    if (aadhaarNumber) {
      if (currentUser.aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number has already been saved and cannot be changed.',
        });
      }
      currentUser.aadhaarNumber = aadhaarNumber;
    }

    if (panNumber) {
      if (currentUser.panNumber) {
        return res.status(400).json({
          success: false,
          message: 'PAN number has already been saved and cannot be changed.',
        });
      }
      currentUser.panNumber = panNumber;
    }

    if (dateOfBirth) {
      if (currentUser.dateOfBirth) {
        return res.status(400).json({
          success: false,
          message: 'Date of Birth has already been saved and cannot be changed.',
        });
      }
      currentUser.dateOfBirth = new Date(dateOfBirth);
    }

    if (guardianDetails) {
      currentUser.guardianDetails = normalizeGuardianDetails(guardianDetails);
    }

    const guardianCheck = validateGuardianForCustomer({
      role: currentUser.role,
      dateOfBirth: currentUser.dateOfBirth,
      guardianDetails: currentUser.guardianDetails,
    });
    if (!guardianCheck.valid) {
      return res.status(400).json({ success: false, message: guardianCheck.message });
    }

    if (currentUser.aadhaarNumber && currentUser.panNumber && currentUser.dateOfBirth) {
      currentUser.isKycComplete = true;
    }

    const user = await currentUser.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        adminId: user.adminId || user.customerId || user._id,
        designation: user.designation || null,
        gender: user.gender || null,
        classification: user.classification || 'PENDING',
        isKycComplete: user.isKycComplete || false,
        dateOfBirth: user.dateOfBirth || null,
        guardianDetails: user.guardianDetails || null,
        aadhaarNumber: maskAadhaar(user.aadhaarNumber),
        panNumber: maskPan(user.panNumber),
        hasAadhaar: !!user.aadhaarNumber,
        hasPan: !!user.panNumber,
        hasDateOfBirth: !!user.dateOfBirth,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Change password
// ─── @route   PUT /api/users/change-password
// ─── @access  Protected
const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error('Passwords do not match');
      return true;
    }),
];

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect Current Password',
      });
    }

    user.password = newPassword;
    user.isTempPassword = false; // Clear temp password flag
    await user.save();

    // ─── Audit Log & Admin Notification (for managers) ─────────────────────
    const managerId = user.adminId || user.customerId || user._id;
    const timestamp = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    // Create audit log entry for all roles
    try {
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        action: 'password_reset',
        details: `${user.role === 'manager' ? 'Manager' : user.role.charAt(0).toUpperCase() + user.role.slice(1)} ${user.name} (${managerId}) changed their password`,
        severity: 'warning',
        ipAddress: req.ip || req.connection?.remoteAddress || '',
      });
    } catch (auditErr) {
      console.error('Audit log creation failed:', auditErr.message);
    }

    // Notify all admins when a manager changes their password
    if (user.role === 'manager') {
      try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        if (admins.length > 0) {
          const notifications = admins.map((admin) => ({
            userId: admin._id,
            title: 'Manager Password Changed',
            message: `Manager ${user.name} (ID: ${managerId}) has updated their login password on ${timestamp}.`,
            type: 'alert',
            priority: 'medium',
          }));
          await Notification.insertMany(notifications);
        }
      } catch (notifErr) {
        console.error('Admin notification creation failed:', notifErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateProfileValidation,
  changePassword,
  changePasswordValidation,
};
