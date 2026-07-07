const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for a user
 * @param {string} userId - MongoDB user _id
 * @returns {string} signed JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};
 

const sendTokenResponse = (res, user, statusCode, message) => {
  const token = generateToken(user._id);

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      customerId: user.customerId,
      adminId: user.adminId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      classification: user.role === 'customer' ? user.classification : undefined,
      profileCompleted: user.role === 'customer' ? !!user.profileCompleted : undefined,
      kycStatus: user.role === 'customer' ? (user.kycStatus || 'Not Started') : undefined,
      isKycComplete: user.role === 'customer' ? !!user.isKycComplete : undefined,
      bankingAccess: user.role === 'customer' ? !!(user.profileCompleted && user.kycStatus === 'Approved') : undefined,
      isActive: user.isActive,
      isTempPassword: !!user.isTempPassword,
      createdAt: user.createdAt,
    },
  });
};

module.exports = { generateToken, sendTokenResponse };
