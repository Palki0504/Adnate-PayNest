const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  submitLimitRequest,
  getMyLimitRequests,
  getPendingLimitRequests,
  approveLimitRequest,
  rejectLimitRequest,
} = require('../controllers/transferLimitController');

// All routes are protected
router.use(protect);

// Customer endpoints
router.post('/request', submitLimitRequest);
router.get('/my-requests', getMyLimitRequests);

// Manager endpoints
router.get('/pending', authorize('manager'), getPendingLimitRequests);
router.put('/:requestId/approve', authorize('manager'), approveLimitRequest);
router.put('/:requestId/reject', authorize('manager'), rejectLimitRequest);

module.exports = router;
