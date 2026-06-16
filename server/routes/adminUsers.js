const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  createUserValidation,
  updateUserValidation,
  updateUserStatusValidation,
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
} = require('../controllers/adminUserController');

router.use(protect, authorize('admin'));

router.get('/', getUsers);
router.get('/pending-registrations', getPendingRegistrations);
router.get('/:id', getUserById);
router.post('/', createUserValidation, validateRequest, createUser);
router.put('/:id', updateUserValidation, validateRequest, updateUser);
router.patch('/:id/status', updateUserStatusValidation, validateRequest, updateUserStatus);
router.post('/:id/approve-registration', approveRegistration);
router.post('/:id/reject-registration', rejectRegistration);

module.exports = router;
