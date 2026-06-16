const AuditLog = require('../models/AuditLog');
const { query, param } = require('express-validator');

// ─── @desc    Get audit logs with filters and pagination
// ─── @route   GET /api/admin/audit-logs
// ─── @access  Protected (admin)
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      action,
      severity,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = {};

    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    if (userId) filter.userId = userId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AuditLog.countDocuments(filter),
    ]);

    // Summary stats
    const [loginCount, failedLoginCount, adminActions] = await Promise.all([
      AuditLog.countDocuments({ action: 'login' }),
      AuditLog.countDocuments({ action: 'login_failed' }),
      AuditLog.countDocuments({ action: { $in: ['user_created', 'user_updated', 'user_activated', 'user_deactivated', 'notification_sent', 'business_rule_created', 'business_rule_updated', 'settings_updated'] } }),
    ]);

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        total,
      },
      stats: { loginCount, failedLoginCount, adminActions },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Helper to create audit log entries from other controllers
const createLog = async ({ userId, userName, userRole, action, details, metadata, ipAddress, severity }) => {
  try {
    await AuditLog.create({ userId, userName, userRole, action, details: details || '', metadata: metadata || {}, ipAddress: ipAddress || '', severity: severity || 'info' });
  } catch (err) {
    console.error('Failed to create audit log:', err.message);
  }
};

module.exports = { getAuditLogs, createLog };
