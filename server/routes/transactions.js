const express = require('express');
const router = express.Router();
const {
  getMyTransactions,
  exportMyTransactions,
  getAnalytics,
  getAdminTransactions,
  transferMoney,
  transferToBeneficiary,
  transferByCustomerId,
  selfTransfer,
  transferValidation,
  beneficiaryTransferValidation,
  transferByCustomerIdValidation,
  selfTransferValidation,
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/transactions/admin
router.get('/admin', protect, authorize('admin'), getAdminTransactions);

// GET /api/transactions/manager
router.get('/manager', protect, authorize('manager'), getAdminTransactions);

// GET /api/transactions
router.get('/export', protect, authorize('customer'), exportMyTransactions);

// GET /api/transactions
router.get('/', protect, authorize('customer'), getMyTransactions);

// GET /api/transactions/analytics
router.get('/analytics', protect, authorize('customer'), getAnalytics);

// POST /api/transactions/transfer (direct account-to-account, own accounts)
router.post('/transfer', protect, authorize('customer'), transferValidation, validateRequest, transferMoney);

// POST /api/transactions/transfer-to-beneficiary (uses a saved beneficiary record)
router.post('/transfer-to-beneficiary', protect, authorize('customer'), beneficiaryTransferValidation, validateRequest, transferToBeneficiary);

// POST /api/transactions/transfer-by-customerid (Transfer Funds page — direct by Customer ID, no saved beneficiary)
router.post('/transfer-by-customerid', protect, authorize('customer'), transferByCustomerIdValidation, validateRequest, transferByCustomerId);

// POST /api/transactions/self-transfer (Self transfer between customer's own accounts)
router.post('/self-transfer', protect, authorize('customer'), selfTransferValidation, validateRequest, selfTransfer);

module.exports = router;

