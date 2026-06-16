const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const {
  getClassificationRequests,
  approveClassificationRequest,
  rejectClassificationRequest,
  getClassificationRequestsValidation,
  approveRequestValidation,
  rejectRequestValidation,
  getCustomersClassificationValidation,
  updateCustomerClassificationValidation,
  getAllCustomersClassification,
  adminUpdateCustomerClassification,
} = require('../controllers/classificationController');

router.use(protect, authorize('admin'));

router.get('/', getClassificationRequestsValidation, validateRequest, getClassificationRequests);
router.patch('/:id/approve', approveRequestValidation, validateRequest, approveClassificationRequest);
router.patch('/:id/reject', rejectRequestValidation, validateRequest, rejectClassificationRequest);

router.get('/customers', getCustomersClassificationValidation, validateRequest, getAllCustomersClassification);
router.put('/customers/:id/classification', updateCustomerClassificationValidation, validateRequest, adminUpdateCustomerClassification);

module.exports = router;
