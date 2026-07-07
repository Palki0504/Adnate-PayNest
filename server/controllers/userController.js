const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const User = require('../models/User');
const ClassificationRequest = require('../models/ClassificationRequest');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { normalizeGuardianDetails, validateGuardianForCustomer } = require('../utils/guardianValidation');
const { sendInvestmentEmail } = require('../utils/emailService');

const UPLOAD_ROOT = path.join(__dirname, '..', 'private_uploads', 'kyc-documents');
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxFileSize = Number(process.env.KYC_MAX_FILE_SIZE_BYTES || 5 * 1024 * 1024);

const runAfterResponse = (task, label) => {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`${label} failed:`, error.message || error);
      });
  });
};

const requiredDocumentLabels = {
  aadhaarFront: 'Aadhaar Card (Front)',
  aadhaarBack: 'Aadhaar Card (Back)',
  panCard: 'PAN Card',
  photograph: 'Passport Size Photograph',
  signature: 'Signature Image',
};

const conditionalDocumentLabels = {
  salarySlip: 'Salary Proof',
  studentId: 'Student ID Card / College ID',
  guardianIncomeProof: 'Guardian Income Proof',
  businessProof: 'Business Proof',
};

const sanitizeFileName = (name) => path.basename(name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');

const getRequiredDocumentTypes = (employmentType = '') => {
  const normalized = String(employmentType || '').toLowerCase();
  const types = Object.keys(requiredDocumentLabels);
  if (normalized.includes('salaried')) types.push('salarySlip');
  if (normalized.includes('student')) types.push('studentId', 'guardianIncomeProof');
  if (normalized.includes('self') || normalized.includes('business')) types.push('businessProof');
  return types;
};

const needsAnnualIncome = (employmentType = '') => {
  const normalized = String(employmentType || '').toLowerCase();
  return normalized.includes('salaried') || normalized.includes('self') || normalized.includes('business');
};

const documentTypeSet = (employmentType = '') => new Set(getRequiredDocumentTypes(employmentType));

const hasDocumentRequirementChange = (oldEmploymentType = '', newEmploymentType = '') => {
  const oldTypes = documentTypeSet(oldEmploymentType);
  const newTypes = documentTypeSet(newEmploymentType);
  if (oldTypes.size !== newTypes.size) return true;
  return [...newTypes].some((type) => !oldTypes.has(type));
};

const formatChangeValue = (value) => {
  if (value === undefined || value === null || value === '') return 'Not provided';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildKycChangeSummary = (currentUser, payload) => {
  const fields = [
    ['phone', 'Phone Number', currentUser.phone, payload.phone],
    ['occupation', 'Occupation', currentUser.occupation, payload.occupation],
    ['employmentType', 'Employment Type', currentUser.employmentType, payload.employmentType],
    ['annualIncome', 'Annual Income', currentUser.annualIncome, payload.annualIncome],
  ];

  return fields
    .map(([field, label, oldValue, newValue]) => ({
      field,
      label,
      oldValue: formatChangeValue(oldValue),
      newValue: formatChangeValue(newValue),
    }))
    .filter((item) => item.oldValue !== item.newValue);
};

const pendingProfileChangeFields = {
  phone: 'Phone Number',
  occupation: 'Occupation',
  employmentType: 'Employment Type',
  annualIncome: 'Annual Income',
};

const buildPendingProfileChanges = (changeSummary, payload) => changeSummary
  .filter((change) => Object.prototype.hasOwnProperty.call(pendingProfileChangeFields, change.field))
  .map((change) => ({
    ...change,
    newRawValue: change.field === 'annualIncome' ? Number(payload[change.field] || 0) : payload[change.field],
  }));

const applyProfileChangeValue = (customer, change) => {
  if (!change?.field) return;
  if (change.field === 'annualIncome') {
    customer.annualIncome = Number(change.newRawValue ?? change.newValue ?? 0);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(pendingProfileChangeFields, change.field)) {
    customer[change.field] = change.newRawValue ?? change.newValue ?? '';
  }
};

const resolveKycDocumentPath = async (customer, document) => {
  if (document.path && fsSync.existsSync(document.path)) return document.path;
  if (!document.storedName) return '';

  const fallbackPath = path.join(UPLOAD_ROOT, String(customer._id), document.storedName);
  if (!fsSync.existsSync(fallbackPath)) return '';

  document.path = fallbackPath;
  await customer.save();
  return fallbackPath;
};

const saveKycDocuments = async (documents, userId) => {
  const folder = path.join(UPLOAD_ROOT, String(userId));
  await fs.mkdir(folder, { recursive: true });
  const saved = [];

  for (const doc of documents || []) {
    if (!doc?.data || !doc?.name || !doc?.type) continue;
    const match = String(doc.data).match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !allowedMimeTypes.has(match[1])) {
      throw new Error(`${doc.name || 'Document'} must be JPG, JPEG, PNG, or PDF.`);
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > maxFileSize) {
      throw new Error(`${doc.name} exceeds the ${Math.round(maxFileSize / 1024 / 1024)} MB file limit.`);
    }
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileName(doc.name)}`;
    const fullPath = path.join(folder, storedName);
    await fs.writeFile(fullPath, buffer, { flag: 'wx' });
    saved.push({
      type: doc.type,
      label: requiredDocumentLabels[doc.type] || conditionalDocumentLabels[doc.type] || doc.type,
      originalName: doc.name,
      storedName,
      path: fullPath,
      mimeType: match[1],
      size: buffer.length,
      status: 'Pending Review',
    });
  }
  return saved;
};

const isKycApproved = (user) => user?.profileCompleted && user?.kycStatus === 'Approved';

// ─── Helper: Mask sensitive data ─────────────────────────────────────────────
const maskAadhaar = (aadhaar) => {
  if (!aadhaar) return null;
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
};

const maskPan = (pan) => {
  if (!pan) return null;
  return `XXXXXX${pan.slice(-4)}`;
};

const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    : '';

// ─── @desc    Get user profile
// ─── @route   GET /api/users/profile
// ─── @access  Protected
const getProfile = async (req, res, next) => {
  try {
    // Include sensitive fields for masking
    const user = await User.findById(req.user._id).select('+aadhaarNumber +panNumber +documents');

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
        profileCompleted: user.profileCompleted || false,
        kycStatus: user.kycStatus || 'Not Started',
        kycSubmittedAt: user.kycSubmittedAt || null,
        kycApprovedAt: user.kycApprovedAt || null,
        kycRejectedReason: user.kycRejectedReason || '',
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
        maritalStatus: user.maritalStatus || '',
        occupation: user.occupation || '',
        employmentType: user.employmentType || '',
        annualIncome: user.annualIncome || 0,
        nationality: user.nationality || 'Indian',
        address: user.address || {},
        nomineeDetails: user.nomineeDetails || {},
        documents: (user.documents || []).map((doc) => {
          const item = doc.toObject ? doc.toObject() : { ...doc };
          delete item.path;
          return item;
        }),
        bankingAccess: isKycApproved(user),
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
  body('maritalStatus').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
  body('occupation').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('employmentType').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
  body('annualIncome').optional({ nullable: true, checkFalsy: true }).isNumeric().withMessage('Annual income must be numeric'),
  body('nationality').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
  body('address.pinCode').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{6}$/).withMessage('PIN Code must be 6 digits'),
  body('nomineeDetails.contactNumber').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Enter a valid nominee contact number'),
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
    const {
      name, phone, designation, gender, aadhaarNumber, panNumber, dateOfBirth, guardianDetails,
      maritalStatus, occupation, employmentType, annualIncome, nationality, address, nomineeDetails,
    } = req.body;

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

    if (maritalStatus !== undefined) currentUser.maritalStatus = maritalStatus || '';
    if (occupation !== undefined) currentUser.occupation = occupation || '';
    if (employmentType !== undefined) currentUser.employmentType = employmentType || '';
    if (annualIncome !== undefined) currentUser.annualIncome = Number(annualIncome || 0);
    if (nationality !== undefined) currentUser.nationality = nationality || 'Indian';
    if (address) currentUser.address = { ...(currentUser.address?.toObject?.() || currentUser.address || {}), ...address };
    if (nomineeDetails) currentUser.nomineeDetails = { ...(currentUser.nomineeDetails?.toObject?.() || currentUser.nomineeDetails || {}), ...nomineeDetails };

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
        profileCompleted: user.profileCompleted || false,
        kycStatus: user.kycStatus || 'Not Started',
        dateOfBirth: user.dateOfBirth || null,
        guardianDetails: user.guardianDetails || null,
        maritalStatus: user.maritalStatus || '',
        occupation: user.occupation || '',
        employmentType: user.employmentType || '',
        annualIncome: user.annualIncome || 0,
        nationality: user.nationality || 'Indian',
        address: user.address || {},
        nomineeDetails: user.nomineeDetails || {},
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

const validateKycPayload = (payload, documentsByType) => {
  const requiredFields = [
    ['name', 'Full name'],
    ['phone', 'Mobile number'],
    ['dateOfBirth', 'Date of birth'],
    ['gender', 'Gender'],
    ['maritalStatus', 'Marital status'],
    ['aadhaarNumber', 'Aadhaar number'],
    ['panNumber', 'PAN number'],
    ['occupation', 'Occupation'],
    ['employmentType', 'Employment type'],
    ['nationality', 'Nationality'],
    ['address.houseFlatNumber', 'House/Flat number'],
    ['address.street', 'Street'],
    ['address.city', 'City'],
    ['address.state', 'State'],
    ['address.pinCode', 'PIN code'],
    ['address.country', 'Country'],
    ['nomineeDetails.name', 'Nominee name'],
    ['nomineeDetails.relationship', 'Nominee relationship'],
    ['nomineeDetails.dateOfBirth', 'Nominee date of birth'],
    ['nomineeDetails.contactNumber', 'Nominee contact number'],
  ];

  const getValue = (pathName) => pathName.split('.').reduce((acc, key) => acc?.[key], payload);
  const missingField = requiredFields.find(([pathName]) => {
    const value = getValue(pathName);
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missingField) return `${missingField[1]} is required.`;

  if (!/^\d{12}$/.test(String(payload.aadhaarNumber || '').trim())) return 'Aadhaar number must be exactly 12 digits.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(payload.panNumber || '').trim().toUpperCase())) return 'PAN must be in format ABCDE1234F.';
  if (needsAnnualIncome(payload.employmentType) && !String(payload.annualIncome ?? '').trim()) return 'Annual income is required for this employment type.';
  if (!/^\d{6}$/.test(String(payload.address?.pinCode || '').trim())) return 'PIN Code must be 6 digits.';
  if (!/^\+?[\d\s\-()]{7,15}$/.test(String(payload.nomineeDetails?.contactNumber || '').trim())) return 'Enter a valid nominee contact number.';

  const missingDoc = getRequiredDocumentTypes(payload.employmentType).find((type) => !documentsByType.has(type));
  if (missingDoc) {
    return `${requiredDocumentLabels[missingDoc] || conditionalDocumentLabels[missingDoc] || missingDoc} document is required.`;
  }

  return '';
};

const submitKyc = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const currentUser = await User.findById(req.user._id).select('+aadhaarNumber +panNumber +documents +documents.path');
    if (!currentUser || currentUser.role !== 'customer') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (currentUser.kycStatus === 'Pending') {
      return res.status(400).json({ success: false, message: 'Your KYC is already pending manager verification.' });
    }

    const savedDocuments = await saveKycDocuments(payload.documents || [], currentUser._id);
    const documentsByType = new Map((currentUser.documents || []).map((doc) => [doc.type, doc]));
    savedDocuments.forEach((doc) => documentsByType.set(doc.type, doc));
    const effectivePayload = {
      ...payload,
      aadhaarNumber: payload.aadhaarNumber || currentUser.aadhaarNumber,
      panNumber: payload.panNumber || currentUser.panNumber,
      dateOfBirth: payload.dateOfBirth || currentUser.dateOfBirth,
    };
    const validationError = validateKycPayload(effectivePayload, documentsByType);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const wasApproved = currentUser.kycStatus === 'Approved';
    const previousEmploymentType = currentUser.employmentType || '';
    const nextEmploymentType = effectivePayload.employmentType || '';
    const employmentTypeChanged = String(previousEmploymentType).trim().toLowerCase() !== String(nextEmploymentType).trim().toLowerCase();
    const requiresFreshKycReview = !wasApproved || (employmentTypeChanged && hasDocumentRequirementChange(previousEmploymentType, nextEmploymentType));
    const changeSummary = buildKycChangeSummary(currentUser, effectivePayload);
    const pendingProfileChanges = wasApproved ? buildPendingProfileChanges(changeSummary, effectivePayload) : [];

    if (wasApproved && pendingProfileChanges.length > 0) {
      currentUser.profileChangeRequest = {
        status: 'Pending',
        changes: pendingProfileChanges,
        submittedAt: new Date(),
        reviewedAt: undefined,
        reviewedBy: '',
        remarks: '',
      };
      currentUser.kycChangeSummary = [];
      currentUser.kycChangeRequiresVerification = false;
      currentUser.kycChangeSubmittedAt = undefined;
      currentUser.kycStatus = 'Approved';
      currentUser.isKycComplete = true;

      const user = await currentUser.save();
      const managers = await User.find({ role: 'manager', isActive: true }).select('_id name');
      const changeCount = pendingProfileChanges.length;
      const managerMessage = `Customer ${user.name} (${user.customerId || user._id}) has submitted ${changeCount} profile ${changeCount === 1 ? 'change' : 'changes'} for approval.`;

      await Notification.create({
        userId: user._id,
        title: 'Profile Changes Submitted',
        message: 'Your profile changes have been submitted for manager approval.',
        type: 'info',
        priority: 'medium',
        link: '/customer-dashboard/profile',
      }).catch(() => {});

      if (managers.length) {
        await Notification.insertMany(managers.map((manager) => ({
          userId: manager._id,
          title: 'Profile Change Request',
          message: managerMessage,
          type: 'approval',
          priority: 'high',
          senderId: user._id,
          senderName: user.name,
          senderRole: 'system',
          link: `/manager-dashboard/kyc-verification?profileRequest=${user._id}`,
        }))).catch(() => {});
      }

      res.status(200).json({
        success: true,
        message: 'Your profile changes have been submitted for manager approval.',
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          profileCompleted: user.profileCompleted,
          kycStatus: user.kycStatus,
          isKycComplete: user.isKycComplete,
          bankingAccess: user.profileCompleted && user.kycStatus === 'Approved',
        },
      });
      return;
    }

    currentUser.name = effectivePayload.name;
    currentUser.phone = effectivePayload.phone;
    currentUser.gender = effectivePayload.gender;
    currentUser.maritalStatus = effectivePayload.maritalStatus;
    currentUser.occupation = effectivePayload.occupation;
    currentUser.employmentType = effectivePayload.employmentType;
    currentUser.annualIncome = Number(effectivePayload.annualIncome || 0);
    currentUser.nationality = effectivePayload.nationality || 'Indian';
    currentUser.aadhaarNumber = String(effectivePayload.aadhaarNumber).trim();
    currentUser.panNumber = String(effectivePayload.panNumber).trim().toUpperCase();
    currentUser.dateOfBirth = effectivePayload.dateOfBirth ? new Date(effectivePayload.dateOfBirth) : undefined;
    currentUser.address = effectivePayload.address || {};
    currentUser.nomineeDetails = {
      ...(effectivePayload.nomineeDetails || {}),
      dateOfBirth: effectivePayload.nomineeDetails?.dateOfBirth ? new Date(effectivePayload.nomineeDetails.dateOfBirth) : undefined,
    };
    currentUser.documents = Array.from(documentsByType.values());
    currentUser.profileCompleted = true;
    currentUser.kycChangeSummary = changeSummary;
    currentUser.kycChangeRequiresVerification = requiresFreshKycReview;
    currentUser.kycChangeSubmittedAt = changeSummary.length ? new Date() : undefined;
    if (requiresFreshKycReview) {
      currentUser.kycStatus = 'Pending';
      currentUser.kycSubmittedAt = new Date();
      currentUser.kycApprovedAt = undefined;
      currentUser.kycRejectedReason = '';
      currentUser.isKycComplete = false;
    } else {
      currentUser.kycStatus = 'Approved';
      currentUser.kycRejectedReason = '';
      currentUser.isKycComplete = true;
    }

    const user = await currentUser.save();

    const managers = await User.find({ role: 'manager', isActive: true }).select('_id name');
    const customerMessage = requiresFreshKycReview
      ? 'Your KYC has been submitted successfully and is awaiting Manager approval.'
      : 'Your profile changes have been saved successfully.';
    await Notification.create({
      userId: user._id,
      title: requiresFreshKycReview ? 'KYC Submitted' : 'Profile Updated',
      message: customerMessage,
      type: 'info',
      priority: 'medium',
      link: '/customer-dashboard/profile',
    }).catch(() => {});

    if (managers.length) {
      const managerTitle = requiresFreshKycReview ? 'New KYC Request' : 'Customer Profile Updated';
      const changeText = changeSummary.length
        ? ` Changes: ${changeSummary.map((item) => `${item.label}: ${item.oldValue} -> ${item.newValue}`).join('; ')}`
        : '';
      const managerMessage = requiresFreshKycReview
        ? `${user.name} (${user.customerId || user._id}) submitted KYC for verification.${changeText}`
        : `${user.name} (${user.customerId || user._id}) updated profile details. KYC remains approved.${changeText}`;
      await Notification.insertMany(managers.map((manager) => ({
        userId: manager._id,
        title: managerTitle,
        message: managerMessage,
        type: requiresFreshKycReview ? 'approval' : 'info',
        priority: requiresFreshKycReview ? 'high' : 'medium',
        senderId: user._id,
        senderName: user.name,
        senderRole: 'system',
        link: requiresFreshKycReview ? '/manager-dashboard/kyc-verification' : '/manager-dashboard/customers',
      }))).catch(() => {});
    }

    if (user.email && requiresFreshKycReview) {
      await sendInvestmentEmail(user.email, {
        subject: 'KYC Submitted - Adnate PayNest',
        heading: 'KYC Submitted Successfully',
        details: [['Customer Name', user.name], ['KYC Status', 'Pending Verification']],
        message: 'Your KYC has been submitted successfully and is awaiting Manager approval.',
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: customerMessage,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        profileCompleted: user.profileCompleted,
        kycStatus: user.kycStatus,
        isKycComplete: user.isKycComplete,
        bankingAccess: user.profileCompleted && user.kycStatus === 'Approved',
      },
    });
  } catch (error) {
    next(error);
  }
};

const getKycRequests = async (req, res, next) => {
  try {
    const { status = 'Pending' } = req.query;
    const query = { role: 'customer' };
    if (status && status !== 'All') query.kycStatus = status;
    const [customers, statusCounts, totalCustomers] = await Promise.all([
      User.find(query)
        .select('-password +documents +aadhaarNumber +panNumber')
        .sort({ kycSubmittedAt: -1, updatedAt: -1 })
        .lean(),
      User.aggregate([
        { $match: { role: 'customer' } },
        { $group: { _id: '$kycStatus', count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: 'customer' }),
    ]);

    const countsByStatus = statusCounts.reduce((acc, item) => {
      acc[item._id || 'Not Started'] = item.count;
      return acc;
    }, {});
    const stats = {
      pending: countsByStatus.Pending || 0,
      approved: countsByStatus.Approved || 0,
      rejected: countsByStatus.Rejected || 0,
      notStarted: countsByStatus['Not Started'] || 0,
      total: totalCustomers,
    };

    res.status(200).json({
      success: true,
      stats,
      customers: customers.map(({ documents = [], aadhaarNumber, panNumber, ...customer }) => ({
        ...customer,
        aadhaarNumber: maskAadhaar(aadhaarNumber),
        panNumber: maskPan(panNumber),
        kycChangeSummary: customer.kycChangeSummary || [],
        kycChangeRequiresVerification: !!customer.kycChangeRequiresVerification,
        kycChangeSubmittedAt: customer.kycChangeSubmittedAt || null,
        documents: documents.map(({ path: ignored, ...doc }) => doc),
      })),
    });
  } catch (error) {
    next(error);
  }
};

const getProfileChangeRequests = async (req, res, next) => {
  try {
    const { status = 'Pending' } = req.query;
    const query = {
      role: 'customer',
      'profileChangeRequest.status': status,
      'profileChangeRequest.changes.0': { $exists: true },
    };
    if (status === 'All') delete query['profileChangeRequest.status'];

    const [customers, statusCounts] = await Promise.all([
      User.find(query)
        .select('name email phone customerId classification profileChangeRequest')
        .sort({ 'profileChangeRequest.submittedAt': -1, updatedAt: -1 })
        .lean(),
      User.aggregate([
        { $match: { role: 'customer', 'profileChangeRequest.changes.0': { $exists: true } } },
        { $group: { _id: '$profileChangeRequest.status', count: { $sum: 1 } } },
      ]),
    ]);

    const countsByStatus = statusCounts.reduce((acc, item) => {
      acc[item._id || 'None'] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      stats: {
        pending: countsByStatus.Pending || 0,
        approved: countsByStatus.Approved || 0,
        rejected: countsByStatus.Rejected || 0,
        total: customers.length,
      },
      requests: customers.map((customer) => ({
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        customerId: customer.customerId,
        classification: customer.classification || 'PENDING',
        request: customer.profileChangeRequest,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const reviewProfileChangeRequest = async (req, res, next) => {
  try {
    const { status, remarks = '' } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
    }
    if (status === 'Rejected' && !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection remarks are required.' });
    }

    const customer = await User.findById(req.params.id);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const request = customer.profileChangeRequest;
    if (!request || request.status !== 'Pending' || !request.changes?.length) {
      return res.status(400).json({ success: false, message: 'No pending profile change request found.' });
    }

    if (status === 'Approved') {
      request.changes.forEach((change) => applyProfileChangeValue(customer, change));
    }
    customer.profileChangeRequest.status = status;
    customer.profileChangeRequest.reviewedAt = new Date();
    customer.profileChangeRequest.reviewedBy = req.user.name || req.user.adminId || 'Manager';
    customer.profileChangeRequest.remarks = status === 'Rejected' ? remarks.trim() : '';
    customer.kycChangeSummary = [];
    customer.kycChangeRequiresVerification = false;
    customer.kycChangeSubmittedAt = undefined;

    await customer.save();

    const approvedMessage = 'Your submitted profile changes have been approved and updated in your profile.';
    const rejectedMessage = `Your submitted profile changes were rejected. Manager remarks: ${remarks.trim()}`;
    await Notification.create({
      userId: customer._id,
      title: status === 'Approved' ? 'Profile Changes Approved' : 'Profile Changes Rejected',
      message: status === 'Approved' ? approvedMessage : rejectedMessage,
      type: status === 'Approved' ? 'approval' : 'rejection',
      priority: 'high',
      senderId: req.user._id,
      senderName: req.user.name || 'Manager',
      senderRole: 'manager',
      link: '/customer-dashboard/profile',
    }).catch(() => {});

    if (customer.email) {
      runAfterResponse(() => sendInvestmentEmail(customer.email, {
        subject: status === 'Approved' ? 'Profile Changes Approved' : 'Profile Changes Rejected',
        heading: status === 'Approved' ? 'Profile Changes Approved' : 'Profile Changes Rejected',
        details: [
          ['Customer Name', customer.name],
          ['Status', status],
          ...(status === 'Rejected' ? [['Manager Remarks', remarks.trim()]] : []),
        ],
        message: status === 'Approved' ? approvedMessage : rejectedMessage,
      }), 'Profile change review email');
    }

    res.status(200).json({ success: true, message: `Profile changes ${status.toLowerCase()} successfully.` });
  } catch (error) {
    next(error);
  }
};

const reviewKyc = async (req, res, next) => {
  try {
    const { status, remarks = '' } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
    }
    if (status === 'Rejected' && !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection remarks are required.' });
    }

    const customer = await User.findById(req.params.id).select('+documents +documents.path +aadhaarNumber +panNumber');
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const reviewedAt = new Date();
    const reviewerName = req.user.name || req.user.adminId || 'Manager';
    customer.kycStatus = status;
    customer.isKycComplete = status === 'Approved';
    customer.kycApprovedAt = status === 'Approved' ? reviewedAt : undefined;
    customer.kycApprovedBy = status === 'Approved' ? reviewerName : '';
    customer.kycRejectedAt = status === 'Rejected' ? reviewedAt : undefined;
    customer.kycRejectedBy = status === 'Rejected' ? reviewerName : '';
    customer.kycRejectedReason = status === 'Rejected' ? remarks.trim() : '';
    customer.documents = (customer.documents || []).map((doc) => {
      doc.status = status === 'Approved' ? 'Approved' : 'Rejected';
      return doc;
    });
    await customer.save();

    const approvedMessage = 'Your KYC has been approved successfully. All banking services are now unlocked, including Fund Transfer, Loans, Overdraft, Fixed Deposits, Recurring Deposits, and Investments.';
    const rejectedMessage = `Your KYC verification was rejected. Reason: ${remarks.trim()}. Please update your profile/documents and resubmit KYC.`;
    await Notification.create({
      userId: customer._id,
      title: status === 'Approved' ? 'KYC Verified' : 'KYC Rejected',
      message: status === 'Approved' ? approvedMessage : rejectedMessage,
      type: status === 'Approved' ? 'approval' : 'rejection',
      priority: 'high',
      senderId: req.user._id,
      senderName: req.user.name || 'Manager',
      senderRole: 'manager',
      link: '/customer-dashboard/profile',
    }).catch(() => {});

    if (customer.email) {
      runAfterResponse(() => sendInvestmentEmail(customer.email, {
        subject: status === 'Approved' ? 'KYC Verification Approved' : 'KYC Verification Rejected',
        heading: status === 'Approved' ? 'KYC Verification Approved' : 'KYC Verification Rejected',
        details: [
          ['Customer Name', customer.name],
          ['KYC Status', status],
          ['Date & Time', formatDateTime(reviewedAt)],
          ...(status === 'Approved' ? [['Approved By', reviewerName]] : [['Rejected By', reviewerName], ['Manager Remarks', remarks.trim()]]),
        ],
        message: status === 'Approved' ? approvedMessage : rejectedMessage,
      }), 'KYC review email');
    }

    res.status(200).json({ success: true, message: `KYC ${status.toLowerCase()} successfully.` });
  } catch (error) {
    next(error);
  }
};

const getKycDocument = async (req, res, next) => {
  try {
    const customer = await User.findById(req.params.id).select('+documents +documents.path');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const document = customer.documents.id(req.params.documentId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    const documentPath = await resolveKycDocumentPath(customer, document);
    if (!documentPath) return res.status(404).json({ success: false, message: 'Document file not found on server.' });

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${document.originalName || document.storedName}"`);
    fsSync.createReadStream(documentPath).pipe(res);
  } catch (error) {
    next(error);
  }
};

const getMyKycDocument = async (req, res, next) => {
  try {
    const customer = await User.findById(req.user._id).select('+documents +documents.path');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const document = customer.documents.id(req.params.documentId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    const documentPath = await resolveKycDocumentPath(customer, document);
    if (!documentPath) return res.status(404).json({ success: false, message: 'Document file not found on server.' });

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${document.originalName || document.storedName}"`);
    fsSync.createReadStream(documentPath).pipe(res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateProfileValidation,
  submitKyc,
  getKycRequests,
  getProfileChangeRequests,
  reviewProfileChangeRequest,
  reviewKyc,
  getKycDocument,
  getMyKycDocument,
  changePassword,
  changePasswordValidation,
};
