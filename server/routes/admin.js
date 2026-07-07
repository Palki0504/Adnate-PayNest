const express = require('express');
const router = express.Router();
const {
  getSystemStats,
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getAllTransactions,
  sendSystemNotification,
  getSystemAnalytics,
  getAllAccounts,
  getAllCustomers,
  getCustomerRegistrationYears,
  downloadCustomerMonthlyReport,
  createUserValidation,
} = require('../controllers/adminController');
const { getBusinessRules, createBusinessRule, updateBusinessRule, deleteBusinessRule, createRuleValidation, updateRuleValidation } = require('../controllers/businessRulesController');
const { getAuditLogs } = require('../controllers/auditLogController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const {
  getAdminCustomerLoans,
  getAdminEMIRecords,
  downloadAdminCustomerLoansReport,
  downloadAdminCustomerLoansMonthlyReport,
  downloadAdminEMIMonthlyReport,
} = require('../controllers/loanController');
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// ─── Admin-only routes ─────────────────────────────────────────────────────────
router.get('/stats', protect, authorize('admin'), getSystemStats);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.post('/users', protect, authorize('admin'), createUserValidation, validateRequest, createUser);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.put('/users/:id/toggle-status', protect, authorize('admin'), toggleUserStatus);
router.get('/transactions', protect, authorize('admin'), getAllTransactions);
router.post('/notifications/send', protect, authorize('admin'), sendSystemNotification);
router.get('/analytics', protect, authorize('admin'), getSystemAnalytics);
router.get('/loans/customer-loans', protect, authorize('admin'), getAdminCustomerLoans);
router.get('/loans/customer-loans/report', protect, authorize('admin'), downloadAdminCustomerLoansReport);
router.get('/loans/customer-loans/monthly-report', protect, authorize('admin'), downloadAdminCustomerLoansMonthlyReport);
router.get('/loans/emis', protect, authorize('admin'), getAdminEMIRecords);
router.get('/loans/emis/monthly-report', protect, authorize('admin'), downloadAdminEMIMonthlyReport);

// ─── Business Rules ────────────────────────────────────────────────────────────
router.get('/business-rules', protect, authorize('admin'), getBusinessRules);
router.post('/business-rules', protect, authorize('admin'), createRuleValidation, validateRequest, createBusinessRule);
router.put('/business-rules/:id', protect, authorize('admin'), updateRuleValidation, validateRequest, updateBusinessRule);
router.delete('/business-rules/:id', protect, authorize('admin'), deleteBusinessRule);

// ─── Audit Logs ────────────────────────────────────────────────────────────────
router.get('/audit-logs', protect, authorize('admin'), getAuditLogs);

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', protect, authorize('admin'), getSettings);
router.put('/settings', protect, authorize('admin'), updateSettings);

// ─── Admin + Manager routes ────────────────────────────────────────────────────
router.get('/accounts', protect, authorize('admin', 'manager'), getAllAccounts);
router.get('/customers/years', protect, authorize('admin', 'manager'), getCustomerRegistrationYears);
router.get('/customers/monthly-report', protect, authorize('admin', 'manager'), downloadCustomerMonthlyReport);
router.get('/customers', protect, authorize('admin', 'manager'), getAllCustomers);

module.exports = router;
