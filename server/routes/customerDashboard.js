const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getCustomerDashboard } = require('../controllers/customerDashboardController');

const router = express.Router();

router.get('/dashboard', protect, authorize('customer'), getCustomerDashboard);

module.exports = router;
