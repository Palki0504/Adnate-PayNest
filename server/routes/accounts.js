const express = require('express');
const router = express.Router();
const {
  getMyAccounts,
  getAccountById,
  createAccount,
  createAccountValidation,
} = require('../controllers/accountController');
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/accounts
router.get('/', protect, authorize('customer'), getMyAccounts);

// POST /api/accounts
router.post('/', protect, authorize('customer'), createAccountValidation, validateRequest, createAccount);

// GET /api/accounts/:id
router.get('/:id', protect, authorize('customer'), getAccountById);

module.exports = router;
