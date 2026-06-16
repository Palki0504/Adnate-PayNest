const { validationResult } = require('express-validator');

// Middleware to check express-validator results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    const firstMessage = formatted[0]?.message || 'Validation failed';

    return res.status(400).json({
      success: false,
      message: formatted.length === 1 ? firstMessage : `Validation failed: ${firstMessage}`,
      errors: formatted,
    });
  }
  next();
};

module.exports = validateRequest;
