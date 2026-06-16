export const calculateAge = (dateValue, today = new Date()) => {
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

export const isUnder18 = (dateValue) => {
  const age = calculateAge(dateValue);
  return age !== null && age < 18;
};

export const guardianRelationshipOptions = ['Father', 'Mother', 'Legal Guardian', 'Other'];
