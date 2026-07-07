const toTitleCase = (value = '') => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .replace(/\b[\p{L}\p{N}]/gu, (letter) => letter.toUpperCase());

const getDisplayName = (value, fallback = 'Customer') => toTitleCase(value) || fallback;

module.exports = {
  toTitleCase,
  getDisplayName,
};
