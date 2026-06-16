const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const overdraftController = require('../controllers/overdraftController');
const approvalController = require('../controllers/approvalController');
const adminController = require('../controllers/adminController');
const notificationController = require('../controllers/notificationController');
const managerDashboardController = require('../controllers/managerDashboardController');

// All manager routes require auth + manager role
router.use(protect);
router.use(authorize('manager'));

router.get('/dashboard', managerDashboardController.getManagerDashboard);

// ─── Overdraft limit increase requests ────────────────────────────────────────

// ─── Overdraft accounts monitoring ────────────────────────────────────────────
router.get('/overdrafts/accounts', adminController.getAllAccounts);

// ─── Transfer approvals (reuse existing approval controller) ──────────────────
router.get('/approvals', approvalController.getPendingApprovals);
router.get('/approvals/history', approvalController.getApprovalHistory);
router.get('/approvals/stats', approvalController.getApprovalStats);
router.put('/approvals/:id/approve', approvalController.approveRequest);
router.put('/approvals/:id/reject', approvalController.rejectRequest);

// ─── Customer monitoring ──────────────────────────────────────────────────────
router.get('/customers', adminController.getAllCustomers);
router.get('/message-customers', notificationController.getManagerMessageCustomers);
router.post('/notifications/send-message', notificationController.sendManagerCustomerMessage);

module.exports = router;
