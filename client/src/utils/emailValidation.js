export const EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

export const isValidEmail = (email = '') => EMAIL_REGEX.test(normalizeEmail(email));
