const express = require('express');
const router = express.Router();
const {
  getMyBeneficiaries,
  lookupAccountNumber,
  lookupBeneficiaryNickname,
  getBeneficiaryById,
  addBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  addBeneficiaryValidation,
  updateBeneficiaryValidation,
} = require('../controllers/beneficiaryController');
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/beneficiaries - Get all beneficiaries
router.get('/', protect, authorize('customer'), getMyBeneficiaries);
router.get('/lookup/:accountNumber', protect, authorize('customer'), lookupAccountNumber);
router.get('/lookup-nickname/:nickname', protect, authorize('customer'), lookupBeneficiaryNickname);

// GET /api/beneficiaries/:id - Get single beneficiary
router.get('/:id', protect, authorize('customer'), getBeneficiaryById);

// POST /api/beneficiaries - Add new beneficiary
router.post('/', protect, authorize('customer'), addBeneficiaryValidation, validateRequest, addBeneficiary);

// PUT /api/beneficiaries/:id - Update beneficiary
router.put('/:id', protect, authorize('customer'), updateBeneficiaryValidation, validateRequest, updateBeneficiary);

// DELETE /api/beneficiaries/:id - Delete beneficiary
router.delete('/:id', protect, authorize('customer'), deleteBeneficiary);

module.exports = router;
