const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  forgotPassword,
  validateToken,
  resetPassword,
  activateAccount,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');

// POST /api/auth/register
router.post('/register', registerValidation, validateRequest, register);

// POST /api/auth/login
router.post('/login', loginValidation, validateRequest, login);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);

// GET /api/auth/validate-token/:token
router.get('/validate-token/:token', validateToken);

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', resetPasswordValidation, validateRequest, resetPassword);

// POST /api/auth/activate-account
router.post('/activate-account', protect, resetPasswordValidation, validateRequest, activateAccount);

// GET /api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
