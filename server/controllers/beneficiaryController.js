const Beneficiary = require('../models/Beneficiary');
const Account = require('../models/Account');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

const MAX_BENEFICIARIES = 10;

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveAccountNumber = async (accountNumber) => {
  const normalizedAccountNumber = String(accountNumber || '').trim().toUpperCase();
  const account = await Account.findOne({ accountNumber: normalizedAccountNumber, status: 'active' });
  if (!account) return null;
  const customer = await User.findOne({ _id: account.userId, role: 'customer', isActive: true })
    .select('name customerId');
  return customer ? { account, customer } : null;
};

const lookupAccountNumber = async (req, res, next) => {
  try {
    const resolved = await resolveAccountNumber(req.params.accountNumber);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Invalid account number. No customer found.' });
    }
    if (String(resolved.customer._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot use your own account as a beneficiary.' });
    }
    const savedBeneficiary = await Beneficiary.findOne({
      userId: req.user._id,
      accountNumber: resolved.account.accountNumber,
      isActive: true,
    }).select('nickname');
    res.status(200).json({
      success: true,
      account: {
        accountNumber: resolved.account.accountNumber,
        accountType: resolved.account.accountType,
        customerName: resolved.customer.name,
        customerId: resolved.customer.customerId,
        beneficiaryNickname: savedBeneficiary?.nickname || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

const lookupBeneficiaryNickname = async (req, res, next) => {
  try {
    const nickname = String(req.params.nickname || '').trim();
    const beneficiary = await Beneficiary.findOne({
      userId: req.user._id,
      nickname: { $regex: new RegExp(`^${escapeRegex(nickname)}$`, 'i') },
      isActive: true,
    });

    if (!beneficiary?.accountNumber) {
      return res.status(404).json({ success: false, message: 'No saved beneficiary found with this nickname.' });
    }

    const resolved = await resolveAccountNumber(beneficiary.accountNumber);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'The saved beneficiary account is no longer valid.' });
    }

    res.status(200).json({
      success: true,
      account: {
        accountNumber: resolved.account.accountNumber,
        accountType: resolved.account.accountType,
        customerName: resolved.customer.name,
        customerId: resolved.customer.customerId,
        beneficiaryNickname: beneficiary.nickname,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get all beneficiaries for logged-in user
const getMyBeneficiaries = async (req, res, next) => {
  try {
    const beneficiaries = await Beneficiary.find({
      userId: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: beneficiaries.length,
      beneficiaries,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get single beneficiary
const getBeneficiaryById = async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found.',
      });
    }

    res.status(200).json({
      success: true,
      beneficiary,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Add new beneficiary
const addBeneficiary = async (req, res, next) => {
  try {
    const {
      nickname,
      accountNumber,
      beneficiaryPhone,
      relationship = 'other',
      notes = '',
    } = req.body;

    // Check if user has reached max beneficiaries
    const beneficiaryCount = await Beneficiary.countDocuments({
      userId: req.user._id,
      isActive: true,
    });

    if (beneficiaryCount >= MAX_BENEFICIARIES) {
      return res.status(400).json({
        success: false,
        message: `You can only add up to ${MAX_BENEFICIARIES} beneficiaries.`,
      });
    }

    // Check if nickname already exists for this user
    const existingNickname = await Beneficiary.findOne({
      userId: req.user._id,
      nickname: { $regex: new RegExp(`^${nickname}$`, 'i') },
      isActive: true,
    });

    if (existingNickname) {
      return res.status(409).json({
        success: false,
        message: 'A beneficiary with this nickname already exists.',
      });
    }

    // Check if account number already added
    const existingCustomer = await Beneficiary.findOne({
      userId: req.user._id,
      accountNumber: String(accountNumber).trim().toUpperCase(),
      isActive: true,
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: 'This customer is already added as a beneficiary.',
      });
    }

    // Verify recipient exists — look up via User model first (customerId is on User)
    // then find their Account by userId
    const resolved = await resolveAccountNumber(accountNumber);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number. No customer found.',
      });
    }
    const { account: recipientAccount, customer: recipientUser } = resolved;

    // Prevent adding yourself as a beneficiary
    if (recipientUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a beneficiary.',
      });
    }

    // Create beneficiary
    const beneficiary = await Beneficiary.create({
      userId: req.user._id,
      nickname,
      customerId: recipientUser.customerId,
      accountNumber: recipientAccount.accountNumber,
      accountType: recipientAccount.accountType,
      beneficiaryName: recipientUser.name,
      beneficiaryPhone: beneficiaryPhone || '',
      relationship,
      notes,
      isVerified: true, // Auto-verify for internal transfers
    });

    res.status(201).json({
      success: true,
      message: 'Beneficiary added successfully.',
      beneficiary,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        success: false,
        message: 'A beneficiary with this nickname or account already exists.',
      });
    }
    next(error);
  }
};

// ─── Update beneficiary details
const updateBeneficiary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname, beneficiaryEmail, beneficiaryPhone, relationship, notes, maxTransferLimit } = req.body;

    const beneficiary = await Beneficiary.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found.',
      });
    }

    // Check if new nickname conflicts with another beneficiary
    if (nickname && nickname !== beneficiary.nickname) {
      const existingNickname = await Beneficiary.findOne({
        userId: req.user._id,
        nickname: { $regex: new RegExp(`^${nickname}$`, 'i') },
        _id: { $ne: id },
        isActive: true,
      });

      if (existingNickname) {
        return res.status(409).json({
          success: false,
          message: 'A beneficiary with this nickname already exists.',
        });
      }

      beneficiary.nickname = nickname;
    }

    if (beneficiaryEmail) beneficiary.beneficiaryEmail = beneficiaryEmail;
    if (beneficiaryPhone) beneficiary.beneficiaryPhone = beneficiaryPhone;
    if (relationship) beneficiary.relationship = relationship;
    if (notes !== undefined) beneficiary.notes = notes;
    if (maxTransferLimit !== undefined) beneficiary.maxTransferLimit = maxTransferLimit;

    await beneficiary.save();

    res.status(200).json({
      success: true,
      message: 'Beneficiary updated successfully.',
      beneficiary,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delete/deactivate beneficiary
const deleteBeneficiary = async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found.',
      });
    }

    // Soft delete - mark as inactive
    beneficiary.isActive = false;
    beneficiary.status = 'inactive';
    await beneficiary.save();

    res.status(200).json({
      success: true,
      message: 'Beneficiary deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── Validation middleware for adding beneficiary
const addBeneficiaryValidation = [
  body('nickname')
    .trim()
    .notEmpty().withMessage('Nickname is required')
    .isLength({ min: 2, max: 50 }).withMessage('Nickname must be 2-50 characters'),
  body('accountNumber')
    .trim()
    .notEmpty().withMessage('Account number is required'),
  body('beneficiaryEmail')
    .optional()
    .isEmail().withMessage('Please enter a valid email address'),
  body('beneficiaryPhone')
    .optional()
    .matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Invalid phone number'),
  body('relationship')
    .optional()
    .isIn(['self', 'family', 'friend', 'business', 'other']).withMessage('Invalid relationship'),
  body('notes')
    .optional()
    .isLength({ max: 200 }).withMessage('Notes cannot exceed 200 characters'),
];

// ─── Validation middleware for updating beneficiary
const updateBeneficiaryValidation = [
  body('nickname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Nickname must be 2-50 characters'),
  body('beneficiaryEmail')
    .optional()
    .isEmail().withMessage('Please enter a valid email address'),
  body('beneficiaryPhone')
    .optional()
    .matches(/^\+?[\d\s\-()]{7,15}$/).withMessage('Invalid phone number'),
  body('relationship')
    .optional()
    .isIn(['self', 'family', 'friend', 'business', 'other']).withMessage('Invalid relationship'),
  body('notes')
    .optional()
    .isLength({ max: 200 }).withMessage('Notes cannot exceed 200 characters'),
  body('maxTransferLimit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Max transfer limit must be a valid number'),
];

module.exports = {
  getMyBeneficiaries,
  lookupAccountNumber,
  lookupBeneficiaryNickname,
  getBeneficiaryById,
  addBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  addBeneficiaryValidation,
  updateBeneficiaryValidation,
};
