export const ACCOUNT_TYPES = [
  {
    value: 'savings',
    label: 'Savings Account',
    fixedBalance: 40000,
    fixedBalanceLabel: '\u20b940,000',
    description: 'Ideal for daily savings and deposits',
  },
  {
    value: 'salary',
    label: 'Salary Account',
    fixedBalance: 10000,
    fixedBalanceLabel: '\u20b910,000',
    description: 'Designed for salary credits and payroll',
  },
  {
    value: 'current',
    label: 'Current Account',
    fixedBalance: 80000,
    fixedBalanceLabel: '\u20b980,000',
    description: 'For business and high-volume transactions',
  },
];

export const getAccountTypeLabel = (value) =>
  ACCOUNT_TYPES.find((t) => t.value === value)?.label || value;


