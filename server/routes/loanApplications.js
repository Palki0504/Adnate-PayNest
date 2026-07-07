const express = require('express');
const { protect, authorize, requireKycApproved } = require('../middleware/auth');
const controller = require('../controllers/loanApplicationController');

const router = express.Router();
router.get('/bootstrap', protect, authorize('customer'), requireKycApproved, controller.getBootstrap);
router.put('/draft', protect, authorize('customer'), requireKycApproved, controller.saveDraft);
router.post('/', protect, authorize('customer'), requireKycApproved, controller.submitApplication);
router.get('/mine', protect, authorize('customer'), requireKycApproved, controller.getMyApplications);
router.get('/manager', protect, authorize('manager'), controller.getManagerApplications);
router.get('/:id/documents/:documentId', protect, controller.getApplicationDocument);
router.get('/:id', protect, controller.getApplicationDetails);
router.put('/:id', protect, authorize('customer'), requireKycApproved, controller.updateCustomerApplication);
router.patch('/:id', protect, authorize('customer'), requireKycApproved, controller.updateCustomerApplication);
router.put('/:id/status', protect, authorize('manager'), controller.updateStatus);

module.exports = router;
