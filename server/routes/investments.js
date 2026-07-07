const express = require('express');
const { protect, authorize, requireKycApproved } = require('../middleware/auth');
const controller = require('../controllers/investmentController');

const router = express.Router();

router.get('/bootstrap', protect, requireKycApproved, controller.getBootstrap);
router.post('/fd/calculate', protect, requireKycApproved, controller.calculateFD);
router.post('/rd/calculate', protect, requireKycApproved, controller.calculateRD);

router.post('/customer/fds', protect, authorize('customer'), requireKycApproved, controller.createFD);
router.get('/customer/fds', protect, authorize('customer'), requireKycApproved, controller.getMyFDs);
router.get('/customer/fds/:id/withdrawal-preview', protect, authorize('customer'), requireKycApproved, controller.getFDWithdrawalPreview);
router.post('/customer/fds/:id/withdrawal', protect, authorize('customer'), requireKycApproved, controller.requestFDWithdrawal);
router.put('/customer/fds/:id/renewal', protect, authorize('customer'), requireKycApproved, controller.updateFDRenewal);
router.post('/customer/fds/:id/renewal-request', protect, authorize('customer'), requireKycApproved, controller.requestFDRenewal);

router.post('/customer/rds', protect, authorize('customer'), requireKycApproved, controller.createRD);
router.get('/customer/rds', protect, authorize('customer'), requireKycApproved, controller.getMyRDs);
router.get('/customer/rds/:id/closure-preview', protect, authorize('customer'), requireKycApproved, controller.getRDClosurePreview);
router.post('/customer/rds/:id/closure', protect, authorize('customer'), requireKycApproved, controller.requestRDClosure);
router.post('/customer/rds/:id/renewal-request', protect, authorize('customer'), requireKycApproved, controller.requestRDRenewal);
router.get('/customer/rds/:id/installments', protect, authorize('customer'), requireKycApproved, controller.getRDInstallments);

router.get('/manager/queue', protect, authorize('manager'), controller.getManagerQueue);
router.get('/manager/monitoring', protect, authorize('manager'), controller.getManagerMonitoring);
router.put('/manager/fds/:id/decision', protect, authorize('manager'), controller.approveFD);
router.patch('/manager/fds/:id/decision', protect, authorize('manager'), controller.approveFD);
router.put('/manager/fds/:id/withdrawal-decision', protect, authorize('manager'), controller.approveFDWithdrawal);
router.patch('/manager/fds/:id/withdrawal-decision', protect, authorize('manager'), controller.approveFDWithdrawal);
router.put('/manager/fds/:id/renewal-decision', protect, authorize('manager'), controller.approveFDRenewal);
router.patch('/manager/fds/:id/renewal-decision', protect, authorize('manager'), controller.approveFDRenewal);
router.put('/manager/rds/:id/decision', protect, authorize('manager'), controller.approveRD);
router.patch('/manager/rds/:id/decision', protect, authorize('manager'), controller.approveRD);
router.put('/manager/rds/:id/closure-decision', protect, authorize('manager'), controller.approveRDClosure);
router.patch('/manager/rds/:id/closure-decision', protect, authorize('manager'), controller.approveRDClosure);
router.put('/manager/rds/:id/renewal-decision', protect, authorize('manager'), controller.approveRDRenewal);
router.patch('/manager/rds/:id/renewal-decision', protect, authorize('manager'), controller.approveRDRenewal);

router.get('/admin/overview', protect, authorize('admin'), controller.getAdminOverview);
router.get('/admin/classifications', protect, authorize('admin'), controller.getAdminClassifications);
router.get('/admin/rules/:type', protect, authorize('admin'), controller.getAdminRule);
router.put('/admin/rules', protect, authorize('admin'), controller.upsertRule);
router.get('/admin/fd/accounts', protect, authorize('admin'), controller.getAdminFDAccounts);
router.get('/admin/rd/accounts', protect, authorize('admin'), controller.getAdminRDAccounts);
router.get('/admin/:product/reports/:reportType', protect, authorize('admin'), controller.downloadMonthlyReport);
router.get('/admin/reports/:type', protect, authorize('admin'), controller.downloadReport);

module.exports = router;
