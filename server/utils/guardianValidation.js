const calculateAge = (dateValue, today = new Date()) => {
  if (!dateValue) return null;
  const birthDate = new Date(dateValue);
  if (Number.isNaN(birthDate.getTime())) return null;
  if (birthDate > today) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
};

const normalizeGuardianDetails = (details = {}) => ({
  name: typeof details.name === 'string' ? details.name.trim() : '',
  relationship: typeof details.relationship === 'string' ? details.relationship.trim() : '',
  phone: typeof details.phone === 'string' ? details.phone.trim() : '',
  dateOfBirth: details.dateOfBirth || null,
});

const hasGuardianDetails = (details = {}) => {
  const guardian = normalizeGuardianDetails(details);
  return !!(guardian.name && guardian.relationship && guardian.phone && guardian.dateOfBirth);
};

const validateGuardianForCustomer = ({ role, dateOfBirth, guardianDetails }) => {
  if (role !== 'customer' || !dateOfBirth) {
    return { valid: true };
  }

  const customerAge = calculateAge(dateOfBirth);
  if (customerAge === null) {
    return { valid: false, message: 'Date of birth must be a valid date.' };
  }

  if (customerAge >= 18) {
    return { valid: true, customerAge, guardianDetails: normalizeGuardianDetails(guardianDetails) };
  }

  const guardian = normalizeGuardianDetails(guardianDetails);
  if (!hasGuardianDetails(guardian)) {
    return {
      valid: false,
      customerAge,
      message: 'Guardian details are required for customers below 18 years old.',
    };
  }

  const guardianAge = calculateAge(guardian.dateOfBirth);
  if (guardianAge === null) {
    return { valid: false, customerAge, message: 'Guardian date of birth must be a valid date.' };
  }

  if (guardianAge < 18) {
    return {
      valid: false,
      customerAge,
      guardianAge,
      message: 'Guardian must be 18 years or older.',
    };
  }

  return { valid: true, customerAge, guardianAge, guardianDetails: guardian };
};

module.exports = {
  calculateAge,
  normalizeGuardianDetails,
  validateGuardianForCustomer,
};
