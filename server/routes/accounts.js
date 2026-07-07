const express = require('express');
const router = express.Router();
const {
  getMyAccounts,
  getAccountById,
  createAccount,
  createAccountValidation,
} = require('../controllers/accountController');
const { protect, authorize, requireKycApproved } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/accounts
router.get('/', protect, authorize('customer'), requireKycApproved, getMyAccounts);

// POST /api/accounts
router.post('/', protect, authorize('customer'), requireKycApproved, createAccountValidation, validateRequest, createAccount);

// GET /api/accounts/:id
router.get('/:id', protect, authorize('customer'), requireKycApproved, getAccountById);

module.exports = router;
