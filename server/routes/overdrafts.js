const express = require('express');
const router = express.Router();
const { protect, requireKycApproved } = require('../middleware/auth');
const controller = require('../controllers/overdraftController');
const { transferOverdraft } = require('../controllers/overdraftTransferController');

// All customer routes require authentication
router.use(protect);
router.use(requireKycApproved);

// Customer: get their own overdraft details (summary)
router.get('/my-details', controller.getCustomerOverdraftDetails);

// Customer: get their own overdraft history (paginated logs)
router.get('/my-history', controller.getCustomerOverdraftHistory);

// Customer: get their own 12-month OD usage chart data
router.get('/my-chart', controller.getCustomerOverdraftChart);

// Customer: verify a receiver by customer ID or account number
router.get('/receiver', controller.resolveReceiver);

// Customer: repay outstanding overdraft
router.post('/repay', controller.repayOverdraft);

// Customer: transfer directly from overdraft to another customer
router.post('/use', transferOverdraft);


// Customer: submit an overdraft limit increase request

// Customer: get their own limit increase requests

module.exports = router;

