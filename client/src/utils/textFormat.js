export const toTitleCase = (value = '') => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .replace(/\b[\p{L}\p{N}]/gu, (letter) => letter.toUpperCase());

export const getDisplayName = (value, fallback = 'Customer') => {
  const formatted = toTitleCase(value);
  return formatted || fallback;
};
