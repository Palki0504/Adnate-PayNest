const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/overdraftController');

// Admin only routes
router.use(protect);
router.use(authorize('admin'));

router.get('/summary', controller.getSummary);
router.get('/monthly-usage', controller.getMonthlyUsageTrend);
router.get('/accounts', controller.getAccounts);

module.exports = router;
