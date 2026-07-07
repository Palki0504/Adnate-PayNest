const express = require('express');
const router = express.Router();
const { protect, authorize, requireKycApproved } = require('../middleware/auth');
const {
  applyForLoan,
  getMyLoans,
  getLoanDetails,
  getEMIHistory,
  payEMI,
  makePartPayment,
  getFullRepaymentQuote,
  closeFullLoan,
  respondToInfoRequest,
  calculateEMI,
  getAllLoanRequests,
  reviewLoan,
  approveLoan,
  rejectLoan,
  requestAdditionalInfo,
  getLoanMonitoring,
  getLoanAnalytics,
  getLoanChartData,
  getAdminLoanOverview,
  getLoanConfigs,
  upsertLoanConfig,
  deleteLoanConfig,
  getAdminCustomerLoans,
  getAdminEMIRecords,
  downloadAdminCustomerLoansReport,
  downloadAdminEMIReport,
  getDelinquentReport
} = require('../controllers/loanController');

// --- Customer ---
router.post('/apply', protect, authorize('customer'), requireKycApproved, applyForLoan);
router.get('/my-loans', protect, authorize('customer'), requireKycApproved, getMyLoans);
router.get('/:id', protect, getLoanDetails);
router.get('/:id/emi-history', protect, requireKycApproved, getEMIHistory);
router.get('/:id/full-repayment-quote', protect, authorize('customer'), requireKycApproved, getFullRepaymentQuote);
router.post('/:id/emis/:emiId/pay', protect, authorize('customer'), requireKycApproved, payEMI);
router.post('/:id/part-payment', protect, authorize('customer'), requireKycApproved, makePartPayment);
router.post('/:id/foreclose', protect, authorize('customer'), requireKycApproved, closeFullLoan);
router.post('/:id/full-repayment', protect, authorize('customer'), requireKycApproved, closeFullLoan);
router.post('/:id/respond-info', protect, authorize('customer'), requireKycApproved, respondToInfoRequest);
router.post('/calculate-emi', protect, requireKycApproved, calculateEMI);

// --- Manager ---
router.get('/manager/requests', protect, authorize('manager'), getAllLoanRequests);
router.put('/manager/:id/review', protect, authorize('manager'), reviewLoan);
router.put('/manager/:id/approve', protect, authorize('manager'), approveLoan);
router.put('/manager/:id/reject', protect, authorize('manager'), rejectLoan);
router.put('/manager/:id/request-info', protect, authorize('manager'), requestAdditionalInfo);
router.get('/manager/monitoring', protect, authorize('manager'), getLoanMonitoring);

// --- Admin ---
router.get('/admin/analytics', protect, authorize('admin'), getLoanAnalytics);
router.get('/admin/charts', protect, authorize('admin'), getLoanChartData);
router.get('/admin/overview', protect, authorize('admin'), getAdminLoanOverview);
router.get('/admin/configs', protect, authorize('admin'), getLoanConfigs);
router.post('/admin/configs', protect, authorize('admin'), upsertLoanConfig);
router.put('/admin/configs', protect, authorize('admin'), upsertLoanConfig);
router.put('/admin/configs/:id', protect, authorize('admin'), upsertLoanConfig);
router.delete('/admin/configs/:id', protect, authorize('admin'), deleteLoanConfig);
router.get('/admin/customer-loans', protect, authorize('admin'), getAdminCustomerLoans);
router.get('/admin/customer-loans/report', protect, authorize('admin'), downloadAdminCustomerLoansReport);
router.get('/admin/emis', protect, authorize('admin'), getAdminEMIRecords);
router.get('/admin/emis/report', protect, authorize('admin'), downloadAdminEMIReport);
router.get('/admin/delinquent', protect, authorize('admin'), getDelinquentReport);

module.exports = router;
