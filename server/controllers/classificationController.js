const ClassificationRequest = require('../models/ClassificationRequest');
const Classification = require('../models/Classification');
const User = require('../models/User');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { sendClassificationLimitsUpdatedEmail } = require('../utils/emailService');
const { body, param, query } = require('express-validator');
const {
  normalizeClassificationName,
  ensureDefaultClassifications,
  getClassificationByName,
  syncAccountsForClassification,
} = require('../utils/classificationPolicy');

const buildLimitSnapshot = (classification) => ({
  dailyTransferLimit: classification.dailyTransferLimit,
  monthlyTransferLimit: classification.monthlyTransferLimit,
  overdraftLimit: classification.overdraftLimit,
  overdraftPenaltyPerDay: classification.overdraftPenaltyPerDay || 0,
});

const writeClassificationAudit = async (req, action, classificationName, previousValues, updatedValues) => {
  try {
    await AuditLog.create({
      userId: req.user?._id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      action,
      details: `Admin ${action === 'classification_created' ? 'created' : action === 'classification_deleted' ? 'deleted' : 'updated'} classification ${classificationName}.`,
      metadata: {
        adminId: req.user?._id,
        classificationName,
        previousValues,
        updatedValues,
        changedAt: new Date().toISOString(),
      },
      severity: 'info',
    });
  } catch (auditErr) {
    console.warn('Classification audit log failed:', auditErr.message);
  }
};

const formatLimit = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

const notifyCustomersOfTransferLimitChange = async (req, classificationName, previousValues, updatedValues) => {
  const changes = [];
  const updatedFields = [];
  if (Number(previousValues?.dailyTransferLimit) !== Number(updatedValues?.dailyTransferLimit)) {
    changes.push(`daily transfer limit changed from ${formatLimit(previousValues.dailyTransferLimit)} to ${formatLimit(updatedValues.dailyTransferLimit)}`);
    updatedFields.push('dailyTransferLimit');
  }
  if (Number(previousValues?.monthlyTransferLimit) !== Number(updatedValues?.monthlyTransferLimit)) {
    changes.push(`monthly transfer limit changed from ${formatLimit(previousValues.monthlyTransferLimit)} to ${formatLimit(updatedValues.monthlyTransferLimit)}`);
    updatedFields.push('monthlyTransferLimit');
  }

  if (Number(previousValues?.overdraftLimit) !== Number(updatedValues?.overdraftLimit)) {
    changes.push(`overdraft limit changed from ${formatLimit(previousValues.overdraftLimit)} to ${formatLimit(updatedValues.overdraftLimit)}`);
    updatedFields.push('overdraftLimit');
  }

  if (changes.length === 0) return { notifiedCustomers: 0, failedEmails: 0 };

  const customers = await User.find({
    role: 'customer',
    classification: classificationName,
  }).select('_id email').lean();

  if (customers.length === 0) return { notifiedCustomers: 0, failedEmails: 0 };

  try {
    await Notification.insertMany(
      customers.map((customer) => ({
        userId: customer._id,
        title: 'Transfer Limits Updated',
        message: `Your ${classificationName} classification ${changes.join(' and ')}. These limits are now active on your customer accounts.`,
        type: 'info',
        priority: 'high',
        senderId: req.user?._id,
        senderName: req.user?.name || 'Admin',
        senderRole: 'admin',
        link: '/customer-dashboard/accounts',
      })),
      { ordered: false }
    );
  } catch (notificationError) {
    console.warn(`Classification in-app notifications failed for ${classificationName}:`, notificationError.message);
  }

  const effectiveDate = new Date();
  const emailResults = await Promise.allSettled(customers.map((customer) =>
    sendClassificationLimitsUpdatedEmail(customer.email, {
      classification: classificationName,
      ...updatedValues,
      updatedFields,
      effectiveDate,
    })
  ));
  const failedEmails = emailResults.filter((result) => result.status === 'rejected');
  failedEmails.forEach((result) => {
    console.error(`Classification limit update email failed for ${classificationName}:`, result.reason?.message || result.reason);
  });

  return { notifiedCustomers: customers.length, failedEmails: failedEmails.length };
};

const getClassificationRequests = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const customerIds = await User.find({ role: 'customer' }).distinct('_id');

    const filter = { userId: { $in: customerIds } };
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      filter.status = status;
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { requestedClassification: { $regex: q, $options: 'i' } },
      ];
    }

    const totalRequests = await ClassificationRequest.countDocuments(filter);
    const requests = await ClassificationRequest.find(filter)
      .sort({ requestedAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'userId', select: 'name email phone customerId role classification' })
      .populate({ path: 'reviewedBy', select: 'name email' });

    const totalCustomers = await User.countDocuments({ role: 'customer', isActive: true, approvalStatus: 'approved' });
    const pendingCount = await ClassificationRequest.countDocuments({ userId: { $in: customerIds }, status: 'Pending' });
    const approvedCount = await ClassificationRequest.countDocuments({ userId: { $in: customerIds }, status: 'Approved' });
    const rejectedCount = await ClassificationRequest.countDocuments({ userId: { $in: customerIds }, status: 'Rejected' });

    res.status(200).json({
      success: true,
      totalCustomers,
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      page: pageNumber,
      limit: pageSize,
      requests,
    });
  } catch (error) {
    next(error);
  }
};

const approveClassificationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { classification, comments } = req.body;

    const request = await ClassificationRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Classification request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be approved.' });
    }

    const targetUser = await User.findById(request.userId);
    if (!targetUser || targetUser.role !== 'customer') {
      return res.status(400).json({ success: false, message: 'Classification can only be approved for customers.' });
    }

    await ensureDefaultClassifications();
    const approvedType = normalizeClassificationName(classification || (request.requestedClassification === 'PENDING' ? 'SILVER' : request.requestedClassification) || 'SILVER');
    const classificationConfig = await getClassificationByName(approvedType);
    if (!classificationConfig) {
      return res.status(400).json({ success: false, message: 'Invalid classification value.' });
    }

    const limits = buildLimitSnapshot(classificationConfig);

    request.status = 'Approved';
    request.approvedClassification = approvedType;
    request.reviewedBy = req.user._id;
    request.comments = comments || request.comments;
    request.reviewedAt = new Date();
    await request.save();

    await Account.updateMany(
      { userId: request.userId },
      {
        classification: approvedType,
        dailyTransferLimit: limits.dailyTransferLimit,
        monthlyTransferLimit: limits.monthlyTransferLimit,
        overdraftLimit: limits.overdraftLimit,
        overdraftPenaltyPerDay: limits.overdraftPenaltyPerDay,
      }
    );

    const updatedUser = await User.findByIdAndUpdate(
      request.userId,
      { classification: approvedType, classificationRequestId: request._id },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Classification request for ${updatedUser.name} has been approved as ${approvedType}.`,
      request,
    });
  } catch (error) {
    next(error);
  }
};

const rejectClassificationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const request = await ClassificationRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Classification request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be rejected.' });
    }

    request.status = 'Rejected';
    request.comments = comments || request.comments;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    res.status(200).json({
      success: true,
      message: `Classification request was rejected.`,
      request,
    });
  } catch (error) {
    next(error);
  }
};

const getClassifications = async (req, res, next) => {
  try {
    await ensureDefaultClassifications();
    const classifications = await Classification.find({}).sort({ name: 1 });
    res.status(200).json({ success: true, classifications });
  } catch (error) {
    next(error);
  }
};

const createClassification = async (req, res, next) => {
  try {
    const { name, dailyTransferLimit, monthlyTransferLimit, overdraftLimit, overdraftPenaltyPerDay, title, description, transferPrivileges, isActive } = req.body;
    const normalizedName = normalizeClassificationName(name);
    const existing = await Classification.findOne({ name: normalizedName });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Classification name already exists.' });
    }

    const classification = await Classification.create({
      name: normalizedName,
      title: title || normalizedName,
      description: description || '',
      dailyTransferLimit,
      monthlyTransferLimit,
      overdraftLimit,
      overdraftPenaltyPerDay,
      transferPrivileges: transferPrivileges || [],
      isActive: isActive !== undefined ? isActive : true,
    });

    await writeClassificationAudit(req, 'classification_created', classification.name, null, classification.toObject());

    res.status(201).json({
      success: true,
      message: `${classification.name} classification created successfully.`,
      classification,
    });
  } catch (error) {
    next(error);
  }
};

const updateClassification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, title, description, dailyTransferLimit, monthlyTransferLimit, overdraftLimit, overdraftPenaltyPerDay, transferPrivileges, isActive } = req.body;

    const classification = await Classification.findById(id);
    if (!classification) {
      return res.status(404).json({ success: false, message: 'Classification not found.' });
    }

    const previousValues = classification.toObject();
    const oldName = classification.name;

    if (name !== undefined) {
      const normalizedName = normalizeClassificationName(name);
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: 'Classification name is required.' });
      }
      const existing = await Classification.findOne({ name: normalizedName, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Classification name already exists.' });
      }
      classification.name = normalizedName;
      classification.title = title !== undefined ? title : normalizedName;
    }

    classification.title = title !== undefined ? title : classification.title;
    classification.description = description !== undefined ? description : classification.description;
    classification.dailyTransferLimit = dailyTransferLimit !== undefined ? dailyTransferLimit : classification.dailyTransferLimit;
    classification.monthlyTransferLimit = monthlyTransferLimit !== undefined ? monthlyTransferLimit : classification.monthlyTransferLimit;
    classification.overdraftLimit = overdraftLimit !== undefined ? overdraftLimit : classification.overdraftLimit;
    classification.overdraftPenaltyPerDay = overdraftPenaltyPerDay !== undefined ? overdraftPenaltyPerDay : classification.overdraftPenaltyPerDay;
    classification.transferPrivileges = transferPrivileges !== undefined ? transferPrivileges : classification.transferPrivileges;
    classification.isActive = isActive !== undefined ? isActive : classification.isActive;

    await classification.save();

    if (oldName !== classification.name) {
      await User.updateMany({ classification: oldName }, { $set: { classification: classification.name } });
      await Account.updateMany({ classification: oldName }, { $set: { classification: classification.name } });
      await ClassificationRequest.updateMany({ requestedClassification: oldName }, { $set: { requestedClassification: classification.name } });
      await ClassificationRequest.updateMany({ approvedClassification: oldName }, { $set: { approvedClassification: classification.name } });
    }

    const updatedLimitSnapshot = buildLimitSnapshot(classification);
    await syncAccountsForClassification(classification.name, updatedLimitSnapshot);
    await writeClassificationAudit(req, 'classification_updated', classification.name, previousValues, classification.toObject());

    let notifiedCustomers = 0;
    let failedEmails = 0;
    try {
      const notificationResult = await notifyCustomersOfTransferLimitChange(req, classification.name, previousValues, updatedLimitSnapshot);
      notifiedCustomers = notificationResult.notifiedCustomers;
      failedEmails = notificationResult.failedEmails;
    } catch (notifErr) {
      console.warn('Transfer limit change notifications failed:', notifErr.message);
      failedEmails = 1;
    }

    res.status(200).json({
      success: true,
      message: `${classification.name} classification updated successfully.${notifiedCustomers ? ` ${notifiedCustomers} customer notification(s) sent.` : ''}`,
      classification,
      notifiedCustomers,
      emailError: failedEmails ? `${failedEmails} customer email(s) could not be sent. The classification limits were still updated successfully.` : null,
    });
  } catch (error) {
    next(error);
  }
};

const deleteClassification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const classification = await Classification.findById(id);
    if (!classification) {
      return res.status(404).json({ success: false, message: 'Classification not found.' });
    }

    const [assignedUsers, assignedAccounts] = await Promise.all([
      User.countDocuments({ classification: classification.name }),
      Account.countDocuments({ classification: classification.name }),
    ]);

    if (assignedUsers > 0 || assignedAccounts > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete ${classification.name}. It is assigned to ${assignedUsers} customer(s) and ${assignedAccounts} account(s). Reassign them first.`,
      });
    }

    const previousValues = classification.toObject();
    await Classification.findByIdAndDelete(id);
    await writeClassificationAudit(req, 'classification_deleted', previousValues.name, previousValues, null);

    res.status(200).json({
      success: true,
      message: `${previousValues.name} classification deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

const approveRequestValidation = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('classification')
    .optional()
    .trim()
    .customSanitizer(normalizeClassificationName)
    .custom(async (value) => {
      if (!value) return true;
      const classification = await getClassificationByName(value);
      if (!classification) throw new Error('Invalid classification');
      return true;
    }),
  body('comments').optional().trim().isString(),
];

const rejectRequestValidation = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('comments').optional().trim().isString(),
];

const getClassificationRequestsValidation = [
  query('status').optional().isIn(['Pending', 'Approved', 'Rejected']).withMessage('Invalid status filter'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

const updateClassificationValidation = [
  param('id').isMongoId().withMessage('Invalid classification ID'),
  body('name').optional().trim().notEmpty().withMessage('Classification name is required'),
  body('dailyTransferLimit').optional().isFloat({ min: 0 }).withMessage('Daily transfer limit must be zero or greater').toFloat(),
  body('monthlyTransferLimit').optional().isFloat({ min: 0 }).withMessage('Monthly transfer limit must be zero or greater').toFloat(),
  body('overdraftLimit').optional().isFloat({ min: 0 }).withMessage('Overdraft limit must be zero or greater').toFloat(),
  body('overdraftPenaltyPerDay').optional().isFloat({ min: 0 }).withMessage('Overdraft penalty per day must be zero or greater').toFloat(),
  body('transferPrivileges').optional().isArray().withMessage('Transfer privileges must be an array'),
];

const deleteClassificationValidation = [
  param('id').isMongoId().withMessage('Invalid classification ID'),
];

const createClassificationValidation = [
  body('name').trim().notEmpty().withMessage('Classification name is required').customSanitizer(normalizeClassificationName),
  body('dailyTransferLimit').isFloat({ min: 0 }).withMessage('Daily transfer limit must be zero or greater').toFloat(),
  body('monthlyTransferLimit').isFloat({ min: 0 }).withMessage('Monthly transfer limit must be zero or greater').toFloat(),
  body('overdraftLimit').isFloat({ min: 0 }).withMessage('Overdraft limit must be zero or greater').toFloat(),
  body('overdraftPenaltyPerDay').isFloat({ min: 0 }).withMessage('Overdraft penalty per day must be zero or greater').toFloat(),
  body('transferPrivileges').optional().isArray().withMessage('Transfer privileges must be an array'),
];

const getCustomersClassificationValidation = [
  query('search').optional().trim().isString(),
  query('classification').optional().trim().isString(),
  query('sortBy').optional().isIn(['customerId', 'name', 'classification']).withMessage('Invalid sort parameter'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
];

const updateCustomerClassificationValidation = [
  param('id').isMongoId().withMessage('Invalid customer ID'),
  body('classification').trim().customSanitizer(normalizeClassificationName).custom(async (value) => {
    const classification = await getClassificationByName(value);
    if (!classification) throw new Error('Invalid classification value');
    return true;
  }),
];

const getAllCustomersClassification = async (req, res, next) => {
  try {
    const { search, classification, sortBy, sortOrder } = req.query;

    const filter = { role: 'customer' };

    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { customerId: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (classification) {
      filter.classification = normalizeClassificationName(classification);
    }

    const sort = {};
    if (sortBy === 'customerId') {
      sort.customerId = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'classification') {
      sort.classification = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const customers = await User.find(filter).sort(sort);

    // Fetch accounts to identify Account Type(s) for each customer
    const accounts = await Account.find({ userId: { $in: customers.map((c) => c._id) } });

    const customerList = customers.map((user) => {
      const userAccounts = accounts.filter((acc) => acc.userId.toString() === user._id.toString());
      const accountTypes = userAccounts.map((acc) => acc.accountType);
      return {
        id: user._id,
        customerId: user.customerId || user._id,
        name: user.name,
        email: user.email,
        classification: user.classification || 'PENDING',
        isActive: user.isActive,
        accountTypes: accountTypes,
        status: user.isActive ? 'Active' : 'Inactive',
      };
    });

    res.status(200).json({
      success: true,
      customers: customerList,
    });
  } catch (error) {
    next(error);
  }
};

const adminUpdateCustomerClassification = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { classification } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    if (user.role !== 'customer') {
      return res.status(400).json({ success: false, message: 'Classification can only be set for customers.' });
    }

    if (!classification) {
      return res.status(400).json({ success: false, message: 'Invalid classification value.' });
    }

    const targetType = normalizeClassificationName(classification);

    const classificationConfig = await getClassificationByName(targetType);
    if (!classificationConfig) {
      return res.status(400).json({ success: false, message: 'Invalid classification value.' });
    }
    const limits = buildLimitSnapshot(classificationConfig);
    const previousClassification = user.classification || 'PENDING';

    user.classification = targetType;
    await user.save({ validateBeforeSave: false });

    await Account.updateMany(
      { userId: user._id },
      {
        $set: {
        classification: targetType,
        dailyTransferLimit: limits.dailyTransferLimit,
        monthlyTransferLimit: limits.monthlyTransferLimit,
        overdraftLimit: limits.overdraftLimit,
        overdraftPenaltyPerDay: limits.overdraftPenaltyPerDay,
        },
      }
    );

    await ClassificationRequest.findOneAndUpdate(
      { userId: user._id, status: 'Pending' },
      {
        status: 'Approved',
        requestedClassification: targetType,
        approvedClassification: targetType,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      { sort: { requestedAt: -1 } }
    );

    try {
      await AuditLog.create({
        userId: req.user._id,
        userName: req.user.name || 'Admin',
        userRole: req.user.role || 'admin',
        action: 'classification_changed',
        details: `Admin changed ${user.name}'s classification to ${targetType}.`,
        metadata: {
          targetUserId: user._id,
          targetCustomerId: user.customerId,
          classification: targetType,
          limits,
          changedAt: new Date().toISOString(),
        },
        severity: 'info',
      });
    } catch (auditErr) {
      console.warn('Customer classification audit log failed:', auditErr.message);
    }

    if (previousClassification !== targetType) {
      await Notification.create({
        userId: user._id,
        title: 'Classification Updated',
        message: `Your customer classification was changed from ${previousClassification} to ${targetType}. Your transfer and overdraft limits have been updated accordingly.`,
        type: 'info',
        priority: 'high',
        senderId: req.user._id,
        senderName: req.user.name || 'Admin',
        senderRole: 'admin',
        link: '/customer-dashboard/accounts',
      }).catch((notifErr) => {
        console.warn('Customer classification notification failed:', notifErr.message);
      });
    }

    res.status(200).json({
      success: true,
      message: `Customer classification updated to ${targetType} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        classification: user.classification,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClassificationRequests,
  approveClassificationRequest,
  rejectClassificationRequest,
  getClassifications,
  createClassification,
  updateClassification,
  deleteClassification,
  getClassificationRequestsValidation,
  approveRequestValidation,
  rejectRequestValidation,
  createClassificationValidation,
  updateClassificationValidation,
  deleteClassificationValidation,
  getCustomersClassificationValidation,
  updateCustomerClassificationValidation,
  getAllCustomersClassification,
  adminUpdateCustomerClassification,
};
