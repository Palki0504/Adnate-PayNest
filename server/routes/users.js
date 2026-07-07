const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/users/profile
router.get('/profile', protect, getProfile);

// PUT /api/users/profile
router.put('/profile', protect, updateProfileValidation, validateRequest, updateProfile);

// POST /api/users/kyc/submit
router.post('/kyc/submit', protect, authorize('customer'), submitKyc);
router.get('/kyc/documents/:documentId', protect, authorize('customer'), getMyKycDocument);

// Manager KYC verification routes
router.get('/kyc/requests', protect, authorize('manager'), getKycRequests);
router.get('/profile-change-requests', protect, authorize('manager'), getProfileChangeRequests);
router.put('/profile-change-requests/:id/review', protect, authorize('manager'), reviewProfileChangeRequest);
router.put('/kyc/:id/review', protect, authorize('manager'), reviewKyc);
router.get('/kyc/:id/documents/:documentId', protect, authorize('manager'), getKycDocument);

// PUT /api/users/change-password
router.put('/change-password', protect, changePasswordValidation, validateRequest, changePassword);

module.exports = router;
