const EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const isValidEmail = (email = '') => EMAIL_REGEX.test(normalizeEmail(email));

module.exports = {
  EMAIL_VALIDATION_MESSAGE,
  EMAIL_REGEX,
  normalizeEmail,
  isValidEmail,
};
