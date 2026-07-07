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
const { protect, authorize, requireKycApproved } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/transactions/admin
router.get('/admin', protect, authorize('admin'), getAdminTransactions);

// GET /api/transactions/manager
router.get('/manager', protect, authorize('manager'), getAdminTransactions);

// GET /api/transactions
router.get('/export', protect, authorize('customer'), requireKycApproved, exportMyTransactions);

// GET /api/transactions
router.get('/', protect, authorize('customer'), requireKycApproved, getMyTransactions);

// GET /api/transactions/analytics
router.get('/analytics', protect, authorize('customer'), requireKycApproved, getAnalytics);

// POST /api/transactions/transfer (direct account-to-account, own accounts)
router.post('/transfer', protect, authorize('customer'), requireKycApproved, transferValidation, validateRequest, transferMoney);

// POST /api/transactions/transfer-to-beneficiary (uses a saved beneficiary record)
router.post('/transfer-to-beneficiary', protect, authorize('customer'), requireKycApproved, beneficiaryTransferValidation, validateRequest, transferToBeneficiary);

// POST /api/transactions/transfer-by-customerid (Transfer Funds page — direct by Customer ID, no saved beneficiary)
router.post('/transfer-by-customerid', protect, authorize('customer'), requireKycApproved, transferByCustomerIdValidation, validateRequest, transferByCustomerId);

// POST /api/transactions/self-transfer (Self transfer between customer's own accounts)
router.post('/self-transfer', protect, authorize('customer'), requireKycApproved, selfTransferValidation, validateRequest, selfTransfer);

module.exports = router;
