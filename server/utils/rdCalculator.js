const DAY_MS = 24 * 60 * 60 * 1000;

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const startOfDay = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addMonths = (value, months) => {
  const date = startOfDay(value);
  return new Date(date.getFullYear(), date.getMonth() + Number(months || 0), date.getDate());
};

const diffDays = (from, to) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  return Math.max(0, Math.floor((end - start) / DAY_MS));
};

const interestForDays = (amount, annualRate, days) => (
  roundMoney((Number(amount || 0) * Number(annualRate || 0) * Number(days || 0)) / 36500)
);

const clampInterest = (interest, depositedAmount, annualRate, maxDays) => {
  const safeInterest = Math.max(0, roundMoney(interest));
  const conservativeCap = roundMoney((Number(depositedAmount || 0) * Math.max(0, Number(annualRate || 0)) * Math.max(0, Number(maxDays || 0))) / 36500);
  return Math.min(safeInterest, Math.max(0, conservativeCap));
};

const buildScheduledInstallments = ({ monthlyContribution, tenure, startDate }) => {
  const amount = roundMoney(monthlyContribution);
  const count = Math.max(0, Number(tenure || 0));
  return Array.from({ length: count }, (_, index) => ({
    installmentNo: index + 1,
    amount,
    depositDate: addMonths(startDate, index),
  }));
};

const calculateRDMaturity = ({ monthlyContribution, tenure, annualRate, startDate = new Date(), maturityDate }) => {
  const effectiveStartDate = startOfDay(startDate);
  const effectiveMaturityDate = maturityDate ? startOfDay(maturityDate) : addMonths(effectiveStartDate, tenure);
  const installments = buildScheduledInstallments({ monthlyContribution, tenure, startDate: effectiveStartDate })
    .map((installment) => {
      const days = diffDays(installment.depositDate, effectiveMaturityDate);
      const interest = interestForDays(installment.amount, annualRate, days);
      return { ...installment, days, interest };
    });

  const totalDepositedAmount = roundMoney(installments.reduce((sum, item) => sum + item.amount, 0));
  const rawInterest = roundMoney(installments.reduce((sum, item) => sum + item.interest, 0));
  const maxDays = diffDays(effectiveStartDate, effectiveMaturityDate);
  const interestEarned = clampInterest(rawInterest, totalDepositedAmount, annualRate, maxDays);
  const expectedMaturityAmount = roundMoney(Math.max(totalDepositedAmount, totalDepositedAmount + interestEarned));

  return {
    startDate: effectiveStartDate,
    maturityDate: effectiveMaturityDate,
    monthlyContribution: roundMoney(monthlyContribution),
    tenure: Number(tenure || 0),
    interestRate: Number(annualRate || 0),
    totalDepositedAmount,
    interestEarned,
    accruedInterest: interestEarned,
    expectedMaturityAmount,
    maturityAmount: expectedMaturityAmount,
    installmentBreakdown: installments,
  };
};

const calculateRDPrematureClosure = ({ rd, withdrawalDate = new Date() }) => {
  const requestDate = startOfDay(withdrawalDate);
  const paidInstallments = (rd.installmentHistory || [])
    .filter((item) => item.status === 'Paid' && item.paidDate && startOfDay(item.paidDate) <= requestDate)
    .map((item) => {
      const depositDate = startOfDay(item.paidDate);
      const days = diffDays(depositDate, requestDate);
      return {
        installmentNo: item.installmentNo,
        amount: roundMoney(item.amount),
        depositDate,
        paidDate: depositDate,
        days,
        daysAccrued: days,
        interest: interestForDays(item.amount, rd.interestRate, days),
      };
    });

  const totalDepositedAmount = roundMoney(paidInstallments.reduce((sum, item) => sum + item.amount, 0));
  const rawInterest = roundMoney(paidInstallments.reduce((sum, item) => sum + item.interest, 0));
  const startDate = rd.startDate || rd.approvedAt || rd.createdAt || requestDate;
  const maxDays = diffDays(startDate, requestDate);
  const interestEarned = clampInterest(rawInterest, totalDepositedAmount, rd.interestRate, maxDays);

  return {
    totalDepositedAmount,
    interestEarned,
    accruedInterest: interestEarned,
    paidInstallmentsCount: paidInstallments.length,
    installmentBreakdown: paidInstallments,
  };
};

module.exports = {
  addMonths,
  calculateRDMaturity,
  calculateRDPrematureClosure,
  diffDays,
  interestForDays,
  roundMoney,
  startOfDay,
};
