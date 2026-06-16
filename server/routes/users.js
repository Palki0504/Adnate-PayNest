const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  updateProfileValidation,
  changePassword,
  changePasswordValidation,
} = require('../controllers/userController');

const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// GET /api/users/profile
router.get('/profile', protect, getProfile);

// PUT /api/users/profile
router.put('/profile', protect, updateProfileValidation, validateRequest, updateProfile);

// PUT /api/users/change-password
router.put('/change-password', protect, changePasswordValidation, validateRequest, changePassword);

module.exports = router;
