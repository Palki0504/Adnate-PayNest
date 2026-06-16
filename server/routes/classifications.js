const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const {
  getClassifications,
  createClassification,
  updateClassification,
  deleteClassification,
  updateCustomerClassificationValidation,
  adminUpdateCustomerClassification,
  createClassificationValidation,
  updateClassificationValidation,
  deleteClassificationValidation,
} = require('../controllers/classificationController');

router.get('/', protect, getClassifications);
router.post('/', protect, authorize('admin'), createClassificationValidation, validateRequest, createClassification);
router.put('/customers/:id/classification', protect, authorize('admin'), updateCustomerClassificationValidation, validateRequest, adminUpdateCustomerClassification);
router.put('/:id', protect, authorize('admin'), updateClassificationValidation, validateRequest, updateClassification);
router.delete('/:id', protect, authorize('admin'), deleteClassificationValidation, validateRequest, deleteClassification);

module.exports = router;
