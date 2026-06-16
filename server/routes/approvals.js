const express = require('express');
const router = express.Router();
const {
  getPendingApprovals,
  getApprovalHistory,
  approveRequest,
  rejectRequest,
  getMyApprovals,
  getApprovalStats,
} = require('../controllers/approvalController');
const { protect, authorize } = require('../middleware/auth');

// Customer: get my approval requests
router.get('/my', protect, authorize('customer'), getMyApprovals);

// Manager: get approval stats
router.get('/stats', protect, authorize('manager'), getApprovalStats);

// Manager: get pending approval queue
router.get('/', protect, authorize('manager'), getPendingApprovals);

// Manager: get approval history
router.get('/history', protect, authorize('manager'), getApprovalHistory);

// Manager: approve a request
router.put('/:id/approve', protect, authorize('manager'), approveRequest);

// Manager: reject a request
router.put('/:id/reject', protect, authorize('manager'), rejectRequest);

module.exports = router;
