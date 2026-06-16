const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const {
  accountTypeRequestValidation,
  managerCommentValidation,
  submitAccountTypeRequest,
  getMyAccountTypeRequests,
  getAccountTypeRequests,
  approveAccountTypeRequest,
  rejectAccountTypeRequest,
} = require('../controllers/accountTypeRequestController');

router.use(protect);

router.post('/request', authorize('customer'), accountTypeRequestValidation, validateRequest, submitAccountTypeRequest);
router.get('/my-requests', authorize('customer'), getMyAccountTypeRequests);

router.get('/pending', authorize('manager'), getAccountTypeRequests);
router.put('/:requestId/approve', authorize('manager'), managerCommentValidation, validateRequest, approveAccountTypeRequest);
router.put('/:requestId/reject', authorize('manager'), managerCommentValidation, validateRequest, rejectAccountTypeRequest);

module.exports = router;
