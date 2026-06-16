const BusinessRule = require('../models/BusinessRule');
const AuditLog = require('../models/AuditLog');
const { body, param } = require('express-validator');

// ─── Default rules to seed on first access ────────────────────────────────────
const DEFAULT_RULES = [
  { name: 'Max Transfer Amount Per Transaction', key: 'max_per_transaction_transfer', value: 100000, valueType: 'number', description: 'Maximum amount allowed per single transaction', category: 'transfer', isEditable: true },
  { name: 'Max Overdraft Uses Per Month', key: 'max_overdraft_per_month', value: 3, valueType: 'number', description: 'Maximum overdraft uses allowed per month per account', category: 'overdraft', isEditable: true },
  { name: 'Manager Approval Threshold', key: 'approval_threshold', value: 50000, valueType: 'number', description: 'Transfers above this amount require manager approval', category: 'transfer', isEditable: true },
  { name: 'KYC Required for Transfer', key: 'kyc_required_transfer', value: false, valueType: 'boolean', description: 'Require KYC completion before allowing fund transfers', category: 'kyc', isEditable: true },
  { name: 'Allow Self Registration', key: 'allow_self_registration', value: true, valueType: 'boolean', description: 'Allow new customers to register themselves', category: 'security', isEditable: true },
  { name: 'Session Timeout (Minutes)', key: 'session_timeout_minutes', value: 60, valueType: 'number', description: 'Auto logout after inactivity (in minutes)', category: 'security', isEditable: true },
];

// ─── @desc    Get all business rules (seed defaults if empty)
// ─── @route   GET /api/admin/business-rules
// ─── @access  Protected (admin)
const getBusinessRules = async (req, res, next) => {
  try {
    let rules = await BusinessRule.find().sort({ category: 1, name: 1 });

    if (rules.length === 0) {
      // Seed defaults
      rules = await BusinessRule.insertMany(DEFAULT_RULES);
    }

    res.status(200).json({ success: true, rules });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Create a new business rule
// ─── @route   POST /api/admin/business-rules
// ─── @access  Protected (admin)
const createBusinessRule = async (req, res, next) => {
  try {
    const { name, key, value, valueType, description, category } = req.body;

    const existing = await BusinessRule.findOne({ key: key.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A rule with this key already exists.' });
    }

    const rule = await BusinessRule.create({
      name,
      key: key.toLowerCase(),
      value,
      valueType: valueType || 'number',
      description: description || '',
      category: category || 'general',
      createdBy: req.user._id,
    });

    await AuditLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'business_rule_created',
      details: `Business rule "${name}" created`,
      metadata: { ruleId: rule._id, key, value },
    });

    res.status(201).json({ success: true, message: 'Business rule created successfully.', rule });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Update a business rule
// ─── @route   PUT /api/admin/business-rules/:id
// ─── @access  Protected (admin)
const updateBusinessRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { value, description, isEnabled, name } = req.body;

    const rule = await BusinessRule.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }
    if (!rule.isEditable) {
      return res.status(403).json({ success: false, message: 'This rule cannot be modified.' });
    }

    if (value !== undefined) rule.value = value;
    if (description !== undefined) rule.description = description;
    if (isEnabled !== undefined) rule.isEnabled = isEnabled;
    if (name !== undefined) rule.name = name;
    rule.updatedBy = req.user._id;

    await rule.save();

    await AuditLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'business_rule_updated',
      details: `Business rule "${rule.name}" updated`,
      metadata: { ruleId: rule._id, newValue: value },
    });

    res.status(200).json({ success: true, message: 'Business rule updated successfully.', rule });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Delete a business rule
// ─── @route   DELETE /api/admin/business-rules/:id
// ─── @access  Protected (admin)
const deleteBusinessRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rule = await BusinessRule.findById(id);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }
    if (!rule.isEditable) {
      return res.status(403).json({ success: false, message: 'This rule cannot be deleted.' });
    }

    await BusinessRule.findByIdAndDelete(id);

    await AuditLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'business_rule_deleted',
      details: `Business rule "${rule.name}" deleted`,
      metadata: { ruleId: id },
    });

    res.status(200).json({ success: true, message: 'Business rule deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const createRuleValidation = [
  body('name').trim().notEmpty().withMessage('Rule name is required'),
  body('key').trim().notEmpty().withMessage('Rule key is required'),
  body('value').notEmpty().withMessage('Rule value is required'),
  body('category').optional().isIn(['transfer', 'overdraft', 'kyc', 'security', 'general']),
];

const updateRuleValidation = [
  param('id').isMongoId().withMessage('Invalid rule ID'),
];

module.exports = { getBusinessRules, createBusinessRule, updateBusinessRule, deleteBusinessRule, createRuleValidation, updateRuleValidation };
