import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Button, TextField,
  MenuItem, Tabs, Tab, CircularProgress, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Slider, Dialog, DialogTitle,
  DialogContent, DialogActions, Paper, Snackbar
} from '@mui/material';
import {
  AccountBalanceWallet, Calculate, ListAlt, Info,
  GetApp, Payment, Close, Star, ReceiptLong, Visibility,
  Home, DirectionsCar, School, Person, VerifiedUser,
  AccountBalance, Badge, Percent, CalendarMonth, Description,
  Savings, TrendingDown, Timelapse, Payments, ArrowBack
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { loanAPI, accountAPI } from '../../services/api';
import EMICalculator from './EMICalculator';
import ApplyLoanWizard from './ApplyLoanWizard';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const formatPdfCurrency = (value) => {
  const amount = Number(value) || 0;
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;
};

const toPlainPdfText = (value) => String(value ?? '')
  .replace(/[\u20B9]/g, 'Rs. ')
  .replace(/[^\x20-\x7E]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toLoanTypeLabel = (value) => String(value || '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const canUseLoanPaymentActions = (loan) => ['Approved', 'Disbursed'].includes(loan?.status) && Number(loan?.outstandingBalance || 0) > 0;

const whiteFieldSx = {
  bgcolor: '#fff',
  borderRadius: '14px',
  '& .MuiOutlinedInput-root': {
    color: '#0f172a',
    bgcolor: '#fff',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
    '& fieldset': { borderColor: '#D1D9E6', borderWidth: '2px' },
    '&:hover fieldset': { borderColor: '#3B82F6' },
    '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(59,130,246,0.15)' },
    '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: '2px' },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    color: '#0f172a',
    WebkitTextFillColor: '#0f172a',
    padding: '15px 16px',
    fontWeight: 600,
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#64748b',
    opacity: 1,
  },
  '& .MuiInputLabel-root': {
    color: '#0F172A',
    bgcolor: '#fff',
    px: 0.6,
    fontWeight: 600,
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#0F172A' },
  '& .MuiSelect-icon': {
    color: '#0B1F4D',
    right: 12,
    transition: 'transform .2s ease, color .2s ease',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiSelect-icon': {
    color: '#3B82F6',
    transform: 'rotate(180deg)',
  },
};

const selectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#fff',
        color: '#0f172a',
        '& .MuiMenuItem-root': { color: '#0f172a' },
        '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#fef3c7' },
      },
    },
  },
};

const loanDetailAccent = {
  blue: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  purple: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  green: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  red: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  orange: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  indigo: { bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE' },
  cyan: { bg: '#ECFEFF', color: '#0891B2', border: '#A5F3FC' },
  yellow: { bg: '#FEFCE8', color: '#CA8A04', border: '#FEF08A' },
  teal: { bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' },
};

const loanSummaryCardSx = (accent) => ({
  height: '100%',
  minHeight: 154,
  p: 2.25,
  bgcolor: '#fff',
  border: `1px solid ${accent.border}`,
  borderRadius: '16px',
  boxShadow: '0 10px 26px rgba(15,23,42,0.08)',
  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 1.25,
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 16px 34px rgba(15,23,42,0.14)',
    borderColor: accent.color,
  },
});

const bankingActionButtonSx = (color) => ({
  bgcolor: '#fff',
  color,
  border: `1.5px solid ${color}`,
  borderRadius: '12px',
  minHeight: 48,
  px: 2,
  fontWeight: 900,
  textTransform: 'none',
  boxShadow: '0 8px 18px rgba(15,23,42,.08)',
  transition: 'all .2s ease',
  '& .MuiButton-startIcon': { color: 'inherit' },
  '&:hover': {
    bgcolor: color,
    color: '#fff',
    borderColor: color,
    boxShadow: `0 12px 24px ${color}33`,
    transform: 'translateY(-2px)',
  },
});

const loanStatusSx = (status) => {
  const palette = {
    Disbursed: { bgcolor: '#dcfce7', color: '#15803d', border: '#86efac' },
    Approved: { bgcolor: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
    'Under Review': { bgcolor: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    Submitted: { bgcolor: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    Rejected: { bgcolor: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    Closed: { bgcolor: '#e2e8f0', color: '#475569', border: '#cbd5e1' },
    Settled: { bgcolor: '#e2e8f0', color: '#475569', border: '#cbd5e1' },
    'Fully Paid': { bgcolor: '#dcfce7', color: '#15803d', border: '#86efac' },
    'More Info Required': { bgcolor: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  };
  const value = palette[status] || palette.Submitted;
  return { bgcolor: value.bgcolor, color: value.color, border: `1px solid ${value.border}`, fontWeight: 800, borderRadius: '8px' };
};

const loanTypeVisual = (type) => {
  const visuals = {
    home: { icon: <Home fontSize="small" />, color: '#2563eb', bg: '#eff6ff', label: 'Home Loan' },
    personal: { icon: <Person fontSize="small" />, color: '#7c3aed', bg: '#f5f3ff', label: 'Personal Loan' },
    vehicle: { icon: <DirectionsCar fontSize="small" />, color: '#ea580c', bg: '#fff7ed', label: 'Vehicle Loan' },
    education: { icon: <School fontSize="small" />, color: '#059669', bg: '#ecfdf5', label: 'Education Loan' },
  };
  return visuals[type] || { icon: <AccountBalanceWallet fontSize="small" />, color: '#2563eb', bg: '#eff6ff', label: `${type || 'Loan'} Loan` };
};

const CustomerLoans = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [loanDetails, setLoanDetails] = useState(null);
  const [emiHistory, setEmiHistory] = useState([]);
  const [payingEMIId, setPayingEMIId] = useState('');
  const [paymentEMI, setPaymentEMI] = useState(null);
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Apply Form State
  const [loanType, setLoanType] = useState('personal');
  const [amount, setAmount] = useState(100000);
  const [tenure, setTenure] = useState(12);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [existingLiabilities, setExistingLiabilities] = useState('0');
  const [purpose, setPurpose] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');

  // Eligibility Preview
  const [eligibilityDetails, setEligibilityDetails] = useState(null);

  // Part Payment & Foreclosure state
  const [partPayAmount, setPartPayAmount] = useState('');
  const [partPayNote, setPartPayNote] = useState('');
  const [partPayOpen, setPartPayOpen] = useState(false);
  const [partPayLoan, setPartPayLoan] = useState(null);
  const [partPayAccountId, setPartPayAccountId] = useState('');
  const [partPayLoading, setPartPayLoading] = useState(false);
  const [partPayError, setPartPayError] = useState('');
  const [forecloseOpen, setForecloseOpen] = useState(false);
  const [fullRepaymentQuote, setFullRepaymentQuote] = useState(null);
  const [fullRepaymentLoan, setFullRepaymentLoan] = useState(null);
  const [fullRepaymentAccountId, setFullRepaymentAccountId] = useState('');
  const [fullRepaymentError, setFullRepaymentError] = useState('');
  const [fullRepaymentLoading, setFullRepaymentLoading] = useState(false);

  const fetchAccountsAndLoans = async () => {
    setLoading(true);
    try {
      const accRes = await accountAPI.getAll();
      setAccounts(accRes.data.accounts || []);
      if (accRes.data.accounts?.length > 0) {
        setLinkedAccountId(accRes.data.accounts[0]._id);
      }

      const loanRes = await loanAPI.getMyLoans();
      setLoans(loanRes.data.loans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load banking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsAndLoans();
  }, []);

  const handleTabChange = async (event, newValue) => {
    setError('');
    setSuccess('');

    const needsAutomaticSelection = newValue === 3 && (
      !selectedLoanId
      || !loanDetails
    );

    if (needsAutomaticSelection) {
      const preferredLoan = loans[0];

      if (!preferredLoan) {
        setError('No loan is available to display.');
        setActiveTab(2);
        return;
      }

      await loadLoanDetails(preferredLoan._id, newValue);
      return;
    }

    setActiveTab(newValue);
  };

  // Run Eligibility Preview Simulator when apply inputs change
  useEffect(() => {
    if (!monthlyIncome || isNaN(monthlyIncome)) {
      setEligibilityDetails(null);
      return;
    }
    const income = Number(monthlyIncome);
    const liabilities = Number(existingLiabilities) || 0;
    const loanAmt = Number(amount);

    // Rough client simulator based on standard criteria
    const classification = 'SILVER'; // Default fallback, normally would get from logged-in user context
    let classificationScore = 15;
    let incomeScore = 15;
    let liabilitiesScore = 10;

    const monthlyInterestRate = 8.5 / 12 / 100;
    const emi = (loanAmt * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, 12)) /
      (Math.pow(1 + monthlyInterestRate, 12) - 1);
    
    const incomeRatio = income / emi;
    if (incomeRatio >= 3) incomeScore = 25;
    else if (incomeRatio >= 2) incomeScore = 15;
    else incomeScore = 5;

    const liabilitiesRatio = income > 0 ? (liabilities / income) * 100 : 100;
    if (liabilitiesRatio < 30) liabilitiesScore = 10;
    else if (liabilitiesRatio < 50) liabilitiesScore = 5;
    else liabilitiesScore = 0;

    const totalScore = classificationScore + incomeScore + liabilitiesScore + 25; // 25 default for account history/overdraft
    const isEligible = totalScore >= 50 && income >= 15000;

    setEligibilityDetails({
      score: totalScore,
      isEligible,
      monthlyEMI: Math.round(emi),
      remarks: isEligible ? 'High probability of approval based on your profile' : 'Low probability of approval. Check income/amount ratio.'
    });
  }, [amount, monthlyIncome, existingLiabilities]);

  // Handle Apply Submission
  const handleApply = async (e) => {
    e.preventDefault();
    if (!monthlyIncome || !purpose || !linkedAccountId) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await loanAPI.apply({
        loanType,
        amount: Number(amount),
        tenure: Number(tenure),
        monthlyIncome: Number(monthlyIncome),
        existingLiabilities: Number(existingLiabilities) || 0,
        purpose,
        linkedAccountId
      });
      setSuccess(res.data.message || 'Loan application submitted successfully!');
      // Reset form
      setPurpose('');
      setMonthlyIncome('');
      setExistingLiabilities('0');
      // Reload loans
      const loanRes = await loanAPI.getMyLoans();
      setLoans(loanRes.data.loans || []);
      // Switch tab to My Loans
      setTimeout(() => setActiveTab(2), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Loan application failed.');
    } finally {
      setLoading(false);
    }
  };

  // Load Detailed Loan Info
  const loadLoanDetails = async (id, targetTab = 3) => {
    setSelectedLoanId(id);
    setLoading(true);
    setError('');
    try {
      const res = await loanAPI.getDetails(id);
      setLoanDetails(res.data.loan);
      setEmiHistory(res.data.amortizationSchedule || []);
      setActiveTab(targetTab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch loan details.');
    } finally {
      setLoading(false);
    }
  };

  const viewLoanDetails = (id) => loadLoanDetails(id, 3);

  const openEMIPayment = async (emi) => {
    setPaymentEMI(emi);
    setPaymentError('');
    try {
      const accountResponse = await accountAPI.getAll();
      const customerAccounts = (accountResponse.data.accounts || []).filter((account) => !account.status || account.status === 'active');
      setAccounts(customerAccounts);
      const preferredAccount = customerAccounts.find((account) => account._id === loanDetails?.linkedAccountId?._id)
        || customerAccounts.find((account) => account._id === loanDetails?.linkedAccountId)
        || customerAccounts[0];
      setPayFromAccountId(preferredAccount?._id || '');
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Unable to load your bank accounts.');
    }
  };

  const closeEMIPayment = () => {
    if (payingEMIId) return;
    setPaymentEMI(null);
    setPayFromAccountId('');
    setPaymentError('');
  };

  const handlePayEMI = async () => {
    if (!selectedLoanId || !paymentEMI || !payFromAccountId || payingEMIId) {
      if (!payFromAccountId) setPaymentError('Please select an account to pay EMI.');
      return;
    }
    setPayingEMIId(paymentEMI._id);
    setError('');
    setSuccess('');
    setPaymentError('');
    try {
      const response = await loanAPI.payEMI(selectedLoanId, paymentEMI._id, payFromAccountId);
      setSuccess(response.data.message || 'EMI payment processed successfully.');

      const [detailsResponse, loanResponse, accountResponse] = await Promise.all([
        loanAPI.getDetails(selectedLoanId),
        loanAPI.getMyLoans(),
        accountAPI.getAll(),
      ]);
      setLoanDetails(detailsResponse.data.loan);
      setEmiHistory(detailsResponse.data.amortizationSchedule || []);
      setLoans(loanResponse.data.loans || []);
      setAccounts(accountResponse.data.accounts || []);
      setPaymentEMI(null);
      setPayFromAccountId('');
      setPaymentError('');
    } catch (err) {
      const message = err.response?.data?.message || 'EMI payment failed.';
      setPaymentError(message);
      if (err.response?.data?.payment) {
        setEmiHistory((current) => current.map((item) => (
          item._id === err.response.data.payment._id ? err.response.data.payment : item
        )));
      }
    } finally {
      setPayingEMIId('');
    }
  };

  const openPartPayment = async (loan) => {
    if (partPayLoading) return;
    const targetLoan = loan || loanDetails;
    if (!targetLoan?._id) return;
    setPartPayLoan(targetLoan);
    setPartPayAmount('');
    setPartPayNote('');
    setPartPayError('');
    setPartPayOpen(true);
    setPartPayLoading(true);
    try {
      const accountRes = await accountAPI.getAll();
      const customerAccounts = (accountRes.data.accounts || []).filter((account) => !account.status || account.status === 'active');
      setAccounts(customerAccounts);
      const preferred = customerAccounts.find((account) => account._id === (targetLoan.linkedAccountId?._id || targetLoan.linkedAccountId))
        || customerAccounts.find((account) => account.accountNumber === targetLoan.linkedAccountNumber)
        || customerAccounts[0];
      setPartPayAccountId(preferred?._id || '');
    } catch (err) {
      setPartPayError(err.response?.data?.message || 'Unable to load accounts for part payment.');
      setError(err.response?.data?.message || 'Unable to load accounts for part payment.');
    } finally {
      setPartPayLoading(false);
    }
  };

  const closePartPayment = (force = false) => {
    if (partPayLoading && !force) return;
    setPartPayOpen(false);
    setPartPayLoan(null);
    setPartPayAccountId('');
    setPartPayAmount('');
    setPartPayNote('');
    setPartPayError('');
  };

  // Handle Part Payment
  const handlePartPayment = async () => {
    if (partPayLoading) return;
    const targetLoanId = partPayLoan?._id || selectedLoanId;
    const amount = Number(partPayAmount || 0);
    if (!partPayAmount || isNaN(partPayAmount) || Number(partPayAmount) <= 0) {
      setPartPayError('Please enter a valid part payment amount.');
      setError('Please enter a valid part payment amount.');
      return;
    }
    if (!partPayAccountId) {
      setPartPayError('Please select an account for part payment.');
      setError('Please select an account for part payment.');
      return;
    }
    if (amount > Number(partPayLoan?.outstandingBalance || loanDetails?.outstandingBalance || 0)) {
      setPartPayError('Part payment amount cannot be greater than outstanding balance.');
      setError('Part payment amount cannot be greater than outstanding balance.');
      return;
    }
    setPartPayLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await loanAPI.makePartPayment(targetLoanId, {
        amount,
        accountId: partPayAccountId,
        note: partPayNote || 'Customer Part Payment',
      });
      setSuccess(res.data.message || 'Part payment processed successfully!');
      closePartPayment(true);
      const loanRes = await loanAPI.getMyLoans();
      setLoans(loanRes.data.loans || []);
      if (selectedLoanId === targetLoanId) {
        await loadLoanDetails(targetLoanId, activeTab);
        const emiRes = await loanAPI.getEMIHistory(targetLoanId);
        setEmiHistory(emiRes.data.payments || emiRes.data.emiHistory || []);
      }
      window.dispatchEvent(new CustomEvent('paynest:data-changed', { detail: { source: 'loan-part-payment', loanId: targetLoanId } }));
    } catch (err) {
      const message = err.response?.data?.message || 'Part payment deduction failed.';
      setPartPayError(message);
      setError(message);
    } finally {
      setPartPayLoading(false);
    }
  };

  const openFullRepayment = async (loan) => {
    if (fullRepaymentLoading) return;
    const targetLoan = loan || loanDetails;
    if (!targetLoan?._id) return;
    setFullRepaymentLoading(true);
    setFullRepaymentError('');
    setFullRepaymentQuote(null);
    setFullRepaymentLoan(targetLoan);
    setForecloseOpen(true);
    try {
      const [quoteRes, accountRes] = await Promise.all([
        loanAPI.getFullRepaymentQuote(targetLoan._id),
        accountAPI.getAll(),
      ]);
      const customerAccounts = (accountRes.data.accounts || []).filter((account) => !account.status || account.status === 'active');
      setAccounts(customerAccounts);
      setFullRepaymentQuote(quoteRes.data.quote);
      const preferred = customerAccounts.find((account) => account._id === (targetLoan.linkedAccountId?._id || targetLoan.linkedAccountId))
        || customerAccounts.find((account) => account.accountNumber === targetLoan.linkedAccountNumber)
        || customerAccounts[0];
      setFullRepaymentAccountId(preferred?._id || '');
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to calculate full loan repayment amount.';
      setFullRepaymentError(message);
      setError(message);
    } finally {
      setFullRepaymentLoading(false);
    }
  };

  const closeFullRepayment = (force = false) => {
    if (fullRepaymentLoading && !force) return;
    setForecloseOpen(false);
    setFullRepaymentQuote(null);
    setFullRepaymentLoan(null);
    setFullRepaymentAccountId('');
    setFullRepaymentError('');
  };

  const handleForeclose = async () => {
    if (fullRepaymentLoading) return;
    if (!fullRepaymentLoan?._id || !fullRepaymentAccountId) {
      setFullRepaymentError('Please select an account to close this loan.');
      return;
    }
    const targetLoanId = fullRepaymentLoan._id;
    setFullRepaymentLoading(true);
    setFullRepaymentError('');
    setError('');
    setSuccess('');
    try {
      const res = await loanAPI.closeFullLoan(targetLoanId, { accountId: fullRepaymentAccountId });
      setSuccess(res.data.message || 'Loan fully paid and closed successfully!');
      closeFullRepayment(true);
      window.dispatchEvent(new CustomEvent('paynest:data-changed', { detail: { source: 'loan-full-repayment', loanId: targetLoanId } }));

      try {
        const loanRes = await loanAPI.getMyLoans();
        const refreshedLoans = loanRes.data.loans || [];
        setLoans(refreshedLoans);

        const closedLoan = refreshedLoans.find((loan) => loan._id === targetLoanId) || res.data.loan;
        if (selectedLoanId === targetLoanId && closedLoan) {
          setLoanDetails((previous) => ({ ...(previous || {}), ...closedLoan, status: 'Closed', outstandingBalance: 0 }));
        }

        if (selectedLoanId === targetLoanId) {
          const emiRes = await loanAPI.getEMIHistory(targetLoanId);
          setEmiHistory(emiRes.data.payments || emiRes.data.emiHistory || []);
        }
      } catch (refreshError) {
        console.warn('Loan full repayment completed, but dashboard refresh failed:', refreshError.response?.data?.message || refreshError.message);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Full loan repayment failed.';
      setFullRepaymentError(message);
      setError(message);
      if (err.response?.data?.quote) setFullRepaymentQuote(err.response.data.quote);
    } finally {
      setFullRepaymentLoading(false);
    }
  };

  // PDF Generators using jsPDF
  const downloadSanctionLetter = () => {
    if (!loanDetails) return;
    const doc = new jsPDF();
    
    // Theme Primary Color
    doc.setFillColor(15, 45, 94);
    doc.rect(0, 0, 210, 42, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('ADNATE PAYNEST BANK', 15, 24);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text('Premium Banking & Personal Finance Services', 15, 32);

    // Document Title
    doc.setTextColor(15, 45, 94);
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('LOAN SANCTION LETTER', 15, 58);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Sanction Ref: LN-SNC-${loanDetails.loanNumber}`, 15, 66);
    doc.text(`Date of Sanction: ${formatDate(loanDetails.approvedAt || new Date())}`, 15, 72);

    doc.setDrawColor(220, 220, 220);
    doc.line(15, 78, 195, 78);

    // Customer / Loan details
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text(`Dear ${getDisplayName(loanDetails.userId?.name)},`, 15, 88);
    doc.text('We are pleased to inform you that the bank has sanctioned your loan application with the following key terms:', 15, 96);

    const dataRows = [
      ['Loan Account Number', loanDetails.loanNumber],
      ['Customer ID', loanDetails.customerId || '-'],
      ['Loan Type', loanDetails.loanType.toUpperCase()],
      ['Approved Loan Amount', formatPdfCurrency(loanDetails.approvedAmount || loanDetails.amount)],
      ['Interest Rate (Fixed)', `${loanDetails.interestRate}% p.a.`],
      ['Tenure (Months)', `${loanDetails.tenure} Months`],
      ['Monthly EMI Amount', formatPdfCurrency(loanDetails.monthlyEMI)],
      ['First EMI Start Date', formatDate(loanDetails.emiStartDate)],
      ['Linked Settlement Account', loanDetails.linkedAccountNumber],
    ];

    doc.autoTable({
      startY: 104,
      head: [['Loan Parameter', 'Sanctioned Terms']],
      body: dataRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 45, 94] },
      margin: { left: 15, right: 15 },
    });

    const finalY = doc.lastAutoTable.finalY + 16;
    doc.text('Please sign the corresponding Loan Agreement to initiate disbursement of funds.', 15, finalY);
    doc.text('This sanction is valid for 30 days from the date of issue.', 15, finalY + 8);
    
    doc.setFont('Helvetica', 'bold');
    doc.text('For Adnate PayNest Bank,', 15, finalY + 28);
    doc.setFont('Helvetica', 'normal');
    doc.text('Authorized Finance Manager', 15, finalY + 46);

    doc.save(`Sanction_Letter_${loanDetails.loanNumber}.pdf`);
  };

  const downloadLoanAgreement = () => {
    if (!loanDetails) return;
    const doc = new jsPDF();
    
    // Theme Header
    doc.setFillColor(15, 45, 94);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('ADNATE PAYNEST BANK', 15, 24);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text('Premium Corporate & Retail Banking Services', 15, 32);

    doc.setTextColor(15, 45, 94);
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('SECURED LOAN AGREEMENT', 15, 58);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Agreement Reference: LN-AGR-${loanDetails.loanNumber}`, 15, 66);
    doc.text(`Effective Date: ${formatDate(loanDetails.disbursedAt || new Date())}`, 15, 72);

    doc.setDrawColor(220, 220, 220);
    doc.line(15, 78, 195, 78);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text('This Loan Agreement ("Agreement") is executed between:', 15, 88);
    
    doc.setFont('Helvetica', 'bold');
    doc.text('LENDER: Adnate PayNest Bank Limited', 15, 96);
    doc.text(`BORROWER: ${getDisplayName(loanDetails.userId?.name)} (ID: ${loanDetails.customerId})`, 15, 102);
    doc.setFont('Helvetica', 'normal');

    doc.text('1. COVENANT TO PAY: The Borrower covenants to repay the Lender the Principal Amount along with interest at the agreed interest rate in regular monthly installments (EMIs) on or before the due date.', 15, 114, { maxWidth: 180 });
    doc.text('2. AUTO-DEDUCTION: The Borrower authorizes Adnate PayNest to automatically deduct the monthly EMI amounts from the linked account specified below.', 15, 130, { maxWidth: 180 });
    doc.text('3. PENALTIES: In the event of default or insufficient balance on the scheduled due date, a penalty charge is applicable on the outstanding EMI.', 15, 146, { maxWidth: 180 });

    const keyTerms = [
      ['Loan Reference', loanDetails.loanNumber],
      ['Disbursed Principal', formatPdfCurrency(loanDetails.approvedAmount || loanDetails.amount)],
      ['Interest Rate', `${loanDetails.interestRate}% Fixed`],
      ['Total Interest Payable', formatPdfCurrency(loanDetails.totalInterest)],
      ['Total Repayment Amount', formatPdfCurrency(loanDetails.totalRepayment)],
      ['Linked Account Number', loanDetails.linkedAccountNumber],
    ];

    doc.autoTable({
      startY: 160,
      head: [['Loan Clause', 'Details & Reference']],
      body: keyTerms,
      theme: 'grid',
      headStyles: { fillColor: [15, 45, 94] },
      margin: { left: 15, right: 15 },
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    
    // Signatures
    doc.setFont('Helvetica', 'bold');
    doc.text('For Adnate PayNest Bank:', 15, finalY);
    doc.text('Borrower Signature:', 120, finalY);
    
    doc.setFont('Helvetica', 'normal');
    doc.text('_________________________', 15, finalY + 15);
    doc.text('_________________________', 120, finalY + 15);
    doc.text('Authorized Representative', 15, finalY + 20);
    doc.text(`${getDisplayName(loanDetails.userId?.name, 'Borrower')}`, 120, finalY + 20);

    doc.save(`Loan_Agreement_${loanDetails.loanNumber}.pdf`);
  };

  const downloadRepaymentSchedule = async () => {
    if (!loanDetails || emiHistory.length === 0) return;
    setError('');
    let schedule = emiHistory;
    try {
      const response = await loanAPI.getEMIHistory(loanDetails._id);
      schedule = response.data.payments || [];
      setEmiHistory(schedule);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to fetch the latest EMI schedule.');
      return;
    }
    if (schedule.length === 0) {
      setError('No EMI schedule is available for this loan.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 45, 94);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ADNATE PAYNEST BANK', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Repayment & Amortization Statement', 14, 24);

    doc.setTextColor(15, 45, 94);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN AMORTIZATION SCHEDULE', 14, 46);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const loanReferenceLine = toPlainPdfText(
      `Loan Reference: ${loanDetails.loanNumber} | Type: ${toLoanTypeLabel(loanDetails.loanType)}`
    );
    const amountLine = toPlainPdfText(
      `Approved Amount: ${formatPdfCurrency(loanDetails.approvedAmount || loanDetails.amount)} | Current Outstanding Balance: ${formatPdfCurrency(loanDetails.outstandingBalance)}`
    );
    doc.text(loanReferenceLine, 14, 54);
    doc.text(amountLine, 14, 60);

    const columns = ['EMI No', 'Due Date', 'Principal Paid', 'Interest Paid', 'EMI Amount', 'Outstanding Balance', 'Status'];
    const rows = schedule.map((item) => [
      toPlainPdfText(item.emiNumber),
      toPlainPdfText(formatDate(item.dueDate)),
      formatPdfCurrency(item.status === 'Paid' ? (item.principalPaid ?? item.principalAmount) : 0),
      formatPdfCurrency(item.status === 'Paid' ? (item.interestPaid ?? item.interestAmount) : 0),
      formatPdfCurrency(item.emiAmount),
      formatPdfCurrency(item.outstandingAfter),
      toPlainPdfText(item.status || 'Pending'),
    ]);

    doc.autoTable({
      startY: 67,
      head: [columns],
      body: rows,
      theme: 'grid',
      margin: { left: 14, right: 14, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.4,
        overflow: 'linebreak',
        lineColor: [205, 213, 224],
        lineWidth: 0.2,
        textColor: [43, 52, 68],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 45, 94],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 31, halign: 'center' },
        2: { cellWidth: 42, halign: 'right' },
        3: { cellWidth: 39, halign: 'right' },
        4: { cellWidth: 39, halign: 'right' },
        5: { cellWidth: 49, halign: 'right' },
        6: { cellWidth: 26, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pageNumber = doc.internal.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(105, 115, 130);
        doc.text(
          `Generated by Adnate PayNest | Page ${pageNumber}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 7,
          { align: 'right' }
        );
        if (data.pageNumber > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 45, 94);
          doc.text(`Loan Reference: ${toPlainPdfText(loanDetails.loanNumber)}`, 14, 10);
        }
      },
    });

    doc.save(`Repayment_Amortization_${toPlainPdfText(loanDetails.loanNumber)}.pdf`);
  };

  const activeLoanCards = loans.filter((loan) => ['Approved', 'Disbursed'].includes(loan.status));
  const selectedPaymentLoan = loanDetails && selectedLoanId === loanDetails._id ? loanDetails : null;

  return (
    <Box sx={{ color: '#fff', width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 800 }}>Loan & EMI Management</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
          Apply for new credit lines, calculate plans, manage payments, and download sanction/agreement documents.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}
      <Snackbar open={Boolean(success)} autoHideDuration={4500} onClose={() => setSuccess('')} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(error)} autoHideDuration={4500} onClose={() => setError('')} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity="error" variant="filled" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>

      <Paper sx={{
        bgcolor: '#fff',
        color: '#0f172a',
        border: '1px solid #dbe3ef',
        borderRadius: '20px',
        boxShadow: '0 18px 46px rgba(15,23,42,0.12)',
        overflow: 'hidden',
        mb: 3,
        p: { xs: 1.25, md: 2 },
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="amber"
          textColor="inherit"
          variant="scrollable"
          sx={{
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#fff',
            borderRadius: '14px 14px 0 0',
            '& .MuiTabs-indicator': { bgcolor: '#0B1F4D', height: 3 },
            '& .MuiTab-root': { color: '#475569', py: 2, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.2px' },
            '& .MuiTab-root.Mui-selected': { color: '#0b1f4d' },
          }}
        >
          <Tab icon={<AccountBalanceWallet sx={{ mr: 1 }} />} iconPosition="start" label="Apply for Loan" />
          <Tab icon={<Calculate sx={{ mr: 1 }} />} iconPosition="start" label="EMI Calculator" />
          <Tab icon={<ListAlt sx={{ mr: 1 }} />} iconPosition="start" label="My Loans" />
          <Tab icon={<Info sx={{ mr: 1 }} />} iconPosition="start" label="Loan Details" />
          <Tab icon={<ReceiptLong sx={{ mr: 1 }} />} iconPosition="start" label="EMI Payments" />
        </Tabs>

        {/* Tab 0: Apply for Loan */}
        {activeTab === 0 && <ApplyLoanWizard onSubmitted={fetchAccountsAndLoans} />}
        {false && (
          <Box sx={{ p: 3 }}>
            <form onSubmit={handleApply}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, mb: 1.5 }}>Select Loan Product</Typography>
                  <Grid container spacing={2}>
                    {[
                      { type: 'personal', title: 'Personal Loan', rate: '10.5%', desc: 'Unsecured loan for weddings, travels, medical needs or expenses.' },
                      { type: 'home', title: 'Home Loan', rate: '8.2%', desc: 'Secured long-term financing for buying or constructing homes.' },
                      { type: 'vehicle', title: 'Vehicle Loan', rate: '8.9%', desc: 'Buy new/used cars or two-wheelers with flexible tenure options.' },
                      { type: 'education', title: 'Education Loan', rate: '7.8%', desc: 'Finance university tuition and living costs for higher education.' }
                    ].map((item) => (
                      <Grid item xs={12} sm={6} md={3} key={item.type}>
                        <Card
                          onClick={() => setLoanType(item.type)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: loanType === item.type ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                            border: `2px solid ${loanType === item.type ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '12px',
                            '&:hover': { border: '2px solid #f59e0b', transform: 'translateY(-2px)' },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography sx={{ fontWeight: 700, color: loanType === item.type ? '#f59e0b' : '#fff' }}>{item.title}</Typography>
                              <Chip size="small" label={`${item.rate} APR`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.7rem' }} />
                            </Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>{item.desc}</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 3 }}>
                    <Typography id="amount-slider" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>Loan Amount</span>
                      <strong style={{ color: '#f59e0b' }}>{formatCurrency(amount)}</strong>
                    </Typography>
                    <Slider
                      value={amount}
                      onChange={(e, val) => setAmount(val)}
                      min={50000}
                      max={2000000}
                      step={50000}
                      sx={{ color: '#f59e0b' }}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography id="tenure-slider" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>Tenure (Months)</span>
                      <strong style={{ color: '#f59e0b' }}>{tenure} Months</strong>
                    </Typography>
                    <Slider
                      value={tenure}
                      onChange={(e, val) => setTenure(val)}
                      min={6}
                      max={60}
                      step={6}
                      sx={{ color: '#f59e0b' }}
                    />
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Monthly Net Income (₹)"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        placeholder="e.g. 50000"
                        sx={whiteFieldSx}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Existing Monthly Liabilities (₹)"
                        value={existingLiabilities}
                        onChange={(e) => setExistingLiabilities(e.target.value)}
                        placeholder="e.g. 10000"
                        sx={whiteFieldSx}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Linked Disbursement/Repayment Account"
                    value={linkedAccountId}
                    onChange={(e) => setLinkedAccountId(e.target.value)}
                    SelectProps={selectProps}
                    sx={{ ...whiteFieldSx, mb: 3 }}
                    required
                  >
                    {accounts.map((a) => (
                      <MenuItem key={a._id} value={a._id}>
                        {a.accountType.toUpperCase()} - {a.accountNumber} ({formatCurrency(a.balance)})
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Purpose of Loan"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Provide specific details about why you need this loan..."
                    sx={whiteFieldSx}
                    required
                  />
                </Grid>

                {eligibilityDetails && (
                  <Grid item xs={12}>
                    <Card sx={{ bgcolor: eligibilityDetails.isEligible ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${eligibilityDetails.isEligible ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: '12px' }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, color: eligibilityDetails.isEligible ? '#4ade80' : '#f87171' }}>
                            <Star />
                            Estimated Eligibility Score: {eligibilityDetails.score} / 100
                          </Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                            {eligibilityDetails.remarks}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>Estimated EMI</Typography>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
                            {formatCurrency(eligibilityDetails.monthlyEMI)} / mo
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || (eligibilityDetails && !eligibilityDetails.isEligible)}
                    sx={{
                      bgcolor: '#f59e0b',
                      color: '#000',
                      fontWeight: 700,
                      px: 5,
                      py: 1.5,
                      borderRadius: '10px',
                      '&:hover': { bgcolor: '#d97706' },
                      '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    {loading ? 'Submitting...' : 'Submit Loan Application'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Box>
        )}

        {/* Tab 1: EMI Calculator */}
        {activeTab === 1 && <EMICalculator />}

        {/* Tab 2: My Loans */}
        {activeTab === 2 && (
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <Paper sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)', overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: '13px', bgcolor: '#eff6ff', color: '#0B1F4D' }}><ListAlt /></Box>
                <Box>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.15rem' }}>My Loans</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '.84rem', mt: .3 }}>Review submitted, approved, and active loans.</Typography>
                </Box>
              </Box>
            <TableContainer sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1050 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#0B1F4D' }}>
                    {['Loan Number', 'Type', 'Requested Amount', 'Approved Amount', 'Outstanding Balance', 'Status', 'Applied Date', 'Action'].map((h) => (
                      <TableCell key={h} sx={{ color: '#fff', borderColor: '#163873', fontWeight: 800, py: 1.55, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loans.map((l, index) => {
                    const typeVisual = loanTypeVisual(l.loanType);
                    return (
                      <TableRow key={l._id} sx={{ bgcolor: index % 2 ? '#f8fafc' : '#fff', '& td': { color: '#334155', borderBottom: '1px solid #e2e8f0', py: 1.55 }, '&:hover': { bgcolor: '#eff6ff' } }}>
                        <TableCell><Button onClick={() => viewLoanDetails(l._id)} sx={{ p: 0, minWidth: 0, color: '#2563eb', fontWeight: 900, fontFamily: 'monospace', textTransform: 'none' }}>{l.loanNumber}</Button></TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '9px', bgcolor: typeVisual.bg, color: typeVisual.color, border: `1px solid ${typeVisual.color}33` }}>{typeVisual.icon}</Box>
                            <Typography sx={{ color: '#0f172a', fontWeight: 700 }}>{typeVisual.label}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(l.amount)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{l.approvedAmount ? formatCurrency(l.approvedAmount) : '-'}</TableCell>
                        <TableCell sx={{ color: `${Number(l.outstandingBalance) === 0 ? '#16a34a' : '#ef4444'} !important`, fontWeight: 900 }}>{l.approvedAmount || l.status === 'Closed' ? formatCurrency(l.outstandingBalance) : '-'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={l.status} sx={loanStatusSx(l.status)} />
                        </TableCell>
                        <TableCell>{formatDate(l.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="outlined" size="small" startIcon={<Visibility />} onClick={() => viewLoanDetails(l._id)} sx={{ color: '#0B1F4D', borderColor: '#0B1F4D', borderRadius: '9px', fontWeight: 800, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#0B1F4D', color: '#fff', borderColor: '#0B1F4D' } }}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                        No loans submitted or active.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
              <Box sx={{ py: 1.8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .8, color: '#64748b' }}>
                <VerifiedUser sx={{ fontSize: 18, color: '#0B1F4D' }} />
                <Typography sx={{ fontSize: '.8rem' }}>All loan data is updated in real time.</Typography>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Tab 3: Detailed Loan Info */}
        {activeTab === 3 && loanDetails && (
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)', mb: 3 }}>
                  <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 2.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <Box>
                        <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.18rem' }}>Loan Details</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '.84rem', mt: .4 }}>Account-level summary, repayment values, and settlement information.</Typography>
                      </Box>
                      <Chip label={loanDetails.status} color={loanDetails.status === 'Rejected' ? 'error' : 'success'} size="small" sx={{ fontWeight: 700 }} />
                    </Box>
                    <Grid container spacing={2.25}>
                      {[
                        { label: 'Loan Number', val: loanDetails.loanNumber, mono: true, icon: <Badge />, accent: loanDetailAccent.blue },
                        { label: 'Loan Type', val: toLoanTypeLabel(loanDetails.loanType), icon: <AccountBalance />, accent: loanDetailAccent.purple },
                        { label: 'Approved Amount', val: formatCurrency(loanDetails.approvedAmount || loanDetails.amount), icon: <Savings />, accent: loanDetailAccent.green },
                        {
                          label: 'Outstanding Balance',
                          val: formatCurrency(loanDetails.outstandingBalance),
                          icon: <TrendingDown />,
                          accent: loanDetailAccent.red,
                          valueColor: Number(loanDetails.outstandingBalance) === 0 ? '#059669' : '#DC2626',
                        },
                        { label: 'Interest Rate', val: `${loanDetails.interestRate}% p.a.`, icon: <Percent />, accent: loanDetailAccent.orange },
                        { label: 'Tenure', val: `${loanDetails.tenure} Months`, icon: <Timelapse />, accent: loanDetailAccent.indigo },
                        { label: 'Monthly EMI', val: formatCurrency(loanDetails.monthlyEMI), icon: <Payments />, accent: loanDetailAccent.cyan, valueColor: '#0B1F4D' },
                        { label: 'Next Due Date', val: formatDate(loanDetails.nextEMIDueDate), icon: <CalendarMonth />, accent: loanDetailAccent.yellow },
                        { label: 'Settlement Account', val: loanDetails.linkedAccountNumber, mono: true, icon: <AccountBalanceWallet />, accent: loanDetailAccent.teal },
                      ].map((item) => (
                        <Grid item xs={12} sm={6} lg={3} key={item.label}>
                          <Paper sx={loanSummaryCardSx(item.accent)}>
                            <Box sx={{ width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: item.accent.bg, color: item.accent.color, border: `1px solid ${item.accent.border}` }}>
                              {React.cloneElement(item.icon, { sx: { fontSize: 23 } })}
                            </Box>
                            <Box sx={{ minWidth: 0, width: '100%' }}>
                              <Typography sx={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', mb: 0.65 }}>{item.label}</Typography>
                              <Typography sx={{ color: item.valueColor || '#0f172a', fontWeight: 900, fontSize: { xs: '1.08rem', md: '1.2rem' }, lineHeight: 1.2, overflowWrap: 'anywhere', fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.val || '-'}</Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    {canUseLoanPaymentActions(loanDetails) && (
                      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Button variant="outlined" startIcon={partPayLoading ? <CircularProgress size={16} /> : <Payment />} onClick={() => openPartPayment(loanDetails)} disabled={partPayLoading} sx={bankingActionButtonSx('#0B1F4D')}>
                          Part Payment
                        </Button>
                        <Button variant="outlined" startIcon={fullRepaymentLoading ? <CircularProgress size={16} /> : <Close />} onClick={() => openFullRepayment(loanDetails)} disabled={fullRepaymentLoading} sx={bankingActionButtonSx('#0B1F4D')}>
                          Close Loan Now
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)', mb: 3 }}>
                  <CardContent sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.12rem' }}>Agreement & Documents</Typography>
                      <Typography sx={{ color: '#64748b', fontSize: '0.84rem', mt: .45 }}>
                        Download secure bank generated certificates for taxation or reference.
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                      {[
                        { title: 'Sanction Letter', onClick: downloadSanctionLetter, disabled: false },
                        { title: 'Loan Agreement', onClick: downloadLoanAgreement, disabled: false },
                        { title: 'Repayment Schedule', onClick: downloadRepaymentSchedule, disabled: emiHistory.length === 0 },
                      ].map((doc) => (
                        <Paper
                          key={doc.title}
                          sx={{
                            p: 2.25,
                            minHeight: 128,
                            borderRadius: '14px',
                            border: '1px solid #D1D9E6',
                            bgcolor: '#fff',
                            boxShadow: '0 8px 22px rgba(15,23,42,.08)',
                            display: 'flex',
                            alignItems: 'stretch',
                            flexDirection: 'column',
                            gap: 1.6,
                            opacity: doc.disabled ? 0.58 : 1,
                            transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                            '&:hover': !doc.disabled && {
                              borderColor: '#0B1F4D',
                              transform: 'translateY(-3px)',
                              boxShadow: '0 14px 30px rgba(15,23,42,.14)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                            <Box sx={{ width: 44, height: 44, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '12px', bgcolor: '#eff6ff', color: '#0B1F4D' }}>
                              <Description />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: '1rem', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{doc.title}</Typography>
                              <Chip size="small" label="PDF" sx={{ mt: .8, height: 22, bgcolor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 800, borderRadius: '7px' }} />
                            </Box>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<GetApp />}
                            onClick={doc.onClick}
                            disabled={doc.disabled}
                            sx={{
                              alignSelf: 'flex-end',
                              color: '#0B1F4D',
                              borderColor: '#0B1F4D',
                              borderRadius: '10px',
                              fontWeight: 900,
                              minWidth: { xs: 42, sm: 'auto' },
                              px: { xs: 1, sm: 1.5 },
                              '& .MuiButton-startIcon': { mr: { xs: 0, sm: .75 } },
                              '& .MuiButton-startIcon svg': { fontSize: 18 },
                              '&:hover': { bgcolor: '#0B1F4D', color: '#fff', borderColor: '#0B1F4D' },
                            }}
                          >
                            Download
                          </Button>
                        </Paper>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

            </Grid>
          </Box>
        )}

        {/* Tab 4: EMI Payment */}
        {activeTab === 4 && (
          <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Paper sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)', p: { xs: 2.5, md: 3 } }}>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.15rem' }}>EMI Payments</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.88rem', mt: 0.5 }}>
                Select an active loan to view its EMI schedule, pay pending EMIs, and track auto-debit updates.
              </Typography>
              <Grid container spacing={2.2} sx={{ mt: 0.5 }}>
                {activeLoanCards.map((loan) => {
                  const visual = loanTypeVisual(loan.loanType);
                  const isSelected = selectedLoanId === loan._id && selectedPaymentLoan;
                  return (
                    <Grid item xs={12} md={6} xl={4} key={loan._id}>
                      <Paper
                        sx={{
                          height: '100%',
                          p: 2.25,
                          borderRadius: '16px',
                          border: `1.5px solid ${isSelected ? '#3B82F6' : '#D1D9E6'}`,
                          bgcolor: isSelected ? '#EFF6FF' : '#fff',
                          boxShadow: isSelected ? '0 14px 32px rgba(59,130,246,.18)' : '0 8px 22px rgba(15,23,42,.08)',
                          transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                          '&:hover': { transform: 'translateY(-3px)', borderColor: '#3B82F6', boxShadow: '0 16px 34px rgba(15,23,42,.14)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
                          <Box sx={{ display: 'flex', gap: 1.3, minWidth: 0 }}>
                            <Box sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: '14px', bgcolor: visual.bg, color: visual.color, flex: '0 0 auto' }}>
                              {visual.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1rem', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{loan.loanNumber}</Typography>
                              <Typography sx={{ color: '#64748b', fontWeight: 700, fontSize: '.84rem', mt: .35 }}>{visual.label || toLoanTypeLabel(loan.loanType)}</Typography>
                            </Box>
                          </Box>
                          <Chip size="small" label={loan.status} sx={loanStatusSx(loan.status)} />
                        </Box>
                        <Grid container spacing={1.4}>
                          {[
                            ['Approved Amount', formatCurrency(loan.approvedAmount || loan.amount)],
                            ['Outstanding Balance', formatCurrency(loan.outstandingBalance)],
                            ['Monthly EMI', formatCurrency(loan.monthlyEMI)],
                            ['Next EMI Date', formatDate(loan.nextEMIDueDate)],
                          ].map(([label, value]) => (
                            <Grid item xs={6} key={label}>
                              <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', p: 1.25, minHeight: 70 }}>
                                <Typography sx={{ color: '#64748b', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</Typography>
                                <Typography sx={{ color: label === 'Outstanding Balance' ? '#dc2626' : '#0f172a', fontSize: '.92rem', fontWeight: 900, mt: .5, overflowWrap: 'anywhere' }}>{value}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<ReceiptLong />}
                          onClick={() => loadLoanDetails(loan._id, 4)}
                          sx={{ mt: 2, bgcolor: '#0B1F4D', color: '#fff', borderRadius: '12px', py: 1.1, fontWeight: 900, textTransform: 'none', boxShadow: '0 10px 20px rgba(11,31,77,.18)', '&:hover': { bgcolor: '#132d63', transform: 'translateY(-1px)' } }}
                        >
                          View EMI Schedule / Pay EMI
                        </Button>
                        {canUseLoanPaymentActions(loan) && (
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1.2 }}>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={partPayLoading ? <CircularProgress size={16} /> : <Payment />}
                              onClick={() => openPartPayment(loan)}
                              disabled={partPayLoading || fullRepaymentLoading}
                              sx={{ color: '#0B1F4D', borderColor: '#0B1F4D', borderRadius: '12px', py: 1.05, fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: '#EFF6FF', borderColor: '#132d63' } }}
                            >
                              Part Payment
                            </Button>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={fullRepaymentLoading ? <CircularProgress size={16} /> : <Close />}
                              onClick={() => openFullRepayment(loan)}
                              disabled={fullRepaymentLoading || partPayLoading}
                              sx={{ color: '#0B1F4D', borderColor: '#0B1F4D', borderRadius: '12px', py: 1.05, fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: '#EFF6FF', borderColor: '#132d63' } }}
                            >
                              Full Payment / Close Loan Now
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
                {activeLoanCards.length === 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ py: 5, textAlign: 'center', color: '#64748b', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '14px' }}>
                      No active loans are available for EMI payments.
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {selectedPaymentLoan && (
            <Paper sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)', overflow: 'hidden' }}>
              <Box sx={{ p: { xs: 2.5, md: 3 }, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.15rem' }}>EMI Schedule - {selectedPaymentLoan.loanNumber}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.85rem', mt: 0.5 }}>
                    Payments are deducted from account {selectedPaymentLoan.linkedAccountNumber || 'your selected repayment account'}.
                  </Typography>
                </Box>
                <Button startIcon={<ArrowBack />} onClick={() => { setLoanDetails(null); setSelectedLoanId(''); setEmiHistory([]); }} sx={{ color: '#0B1F4D', fontWeight: 900, textTransform: 'none' }}>
                  Back to Loan Cards
                </Button>
              </Box>
              <TableContainer sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 1120 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#132d63' }}>
                      {['EMI No.', 'Due Date', 'Principal Paid', 'Interest Paid', 'EMI Amount', 'Outstanding Balance', 'Status', 'Paid Date', 'Payment Mode', 'Action'].map((heading) => (
                        <TableCell key={heading} sx={{ color: '#fff', fontWeight: 800, borderColor: 'rgba(255,255,255,.1)', whiteSpace: 'nowrap' }}>{heading}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {emiHistory.map((emi) => {
                      const isPaid = ['Paid', 'Settled', 'Closed'].includes(emi.status);
                      const canPay = ['Pending', 'Failed'].includes(emi.status);
                      const displayStatus = emi.status === 'Processing' ? 'Pending' : emi.status;
                      const statusSx = isPaid
                        ? {
                            bgcolor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }
                        : {
                            bgcolor: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5',
                          };
                      return (
                        <TableRow key={emi._id || emi.emiNumber} sx={{ bgcolor: emi.emiNumber % 2 === 0 ? '#f8fafc' : '#fff', '& td': { color: '#334155', borderColor: '#e2e8f0', py: 1.5 }, '&:hover': { bgcolor: '#eff6ff' } }}>
                          <TableCell sx={{ fontWeight: 800 }}>{emi.emiNumber}</TableCell>
                          <TableCell>{formatDate(emi.dueDate)}</TableCell>
                          <TableCell>{formatCurrency(isPaid ? (emi.principalPaid ?? emi.principalAmount) : 0)}</TableCell>
                          <TableCell>{formatCurrency(isPaid ? (emi.interestPaid ?? emi.interestAmount) : 0)}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(emi.emiAmount)}</TableCell>
                          <TableCell>{formatCurrency(emi.outstandingAfter)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={displayStatus}
                              sx={{
                                ...statusSx,
                                fontWeight: 800,
                                borderRadius: '8px',
                                '& .MuiChip-label': { px: 1.2 },
                              }}
                            />
                          </TableCell>
                          <TableCell>{formatDate(emi.paidAt)}</TableCell>
                          <TableCell>{emi.paymentMode || (emi.transactionRef ? 'Online Debit' : '-')}</TableCell>
                          <TableCell>
                            {canPay ? (
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={payingEMIId === emi._id ? <CircularProgress size={16} color="inherit" /> : <Payment />}
                                disabled={Boolean(payingEMIId)}
                                onClick={() => openEMIPayment(emi)}
                                sx={{
                                  bgcolor: '#FEE2E2',
                                  color: '#DC2626',
                                  border: '1px solid #FCA5A5',
                                  borderRadius: '10px',
                                  px: 2,
                                  fontWeight: 800,
                                  boxShadow: '0 5px 14px rgba(220,38,38,.14)',
                                  transition: 'all .2s ease',
                                  '& .MuiButton-startIcon': { color: 'inherit' },
                                  '&:hover': {
                                    bgcolor: '#DC2626',
                                    color: '#fff',
                                    borderColor: '#DC2626',
                                    boxShadow: '0 8px 18px rgba(220,38,38,.24)',
                                    transform: 'translateY(-1px)',
                                  },
                                  '&:focus-visible': {
                                    outline: '3px solid rgba(252,165,165,.55)',
                                    outlineOffset: 2,
                                  },
                                  '&.Mui-disabled': {
                                    bgcolor: '#fef2f2',
                                    color: '#fca5a5',
                                    borderColor: '#fecaca',
                                    boxShadow: 'none',
                                  },
                                }}
                              >
                                {payingEMIId === emi._id ? 'Paying...' : emi.status === 'Failed' ? 'Retry EMI' : 'Pay EMI'}
                              </Button>
                            ) : (
                              <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {emiHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#64748b' }}>
                          EMI schedule is available after the loan is approved.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            )}
          </Box>
        )}

      </Paper>

      <Dialog
        open={Boolean(paymentEMI)}
        onClose={closeEMIPayment}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #dbe3ef', boxShadow: '0 24px 60px rgba(15,23,42,.24)' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: '#0b1f4d', pb: 1 }}>Pay EMI</DialogTitle>
        <DialogContent>
          {paymentError && <Alert severity="error" sx={{ mb: 2 }}>{paymentError}</Alert>}
          {paymentEMI && (
            <Paper sx={{ p: 2.25, mb: 2.5, bgcolor: '#0b1f4d', color: '#fff', borderRadius: '14px', border: '1px solid rgba(147,197,253,.24)' }}>
              <Grid container spacing={2}>
                {[
                  ['EMI No.', paymentEMI.emiNumber],
                  ['Due Date', formatDate(paymentEMI.dueDate)],
                  ['EMI Amount', formatCurrency(paymentEMI.emiAmount)],
                  ['Principal', formatCurrency(paymentEMI.principalAmount)],
                  ['Interest', formatCurrency(paymentEMI.interestAmount)],
                  ['Outstanding Balance', formatCurrency(paymentEMI.outstandingAfter)],
                ].map(([label, value]) => (
                  <Grid item xs={6} key={label}>
                    <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '.72rem' }}>{label}</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, mt: .35 }}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
          <TextField
            select
            fullWidth
            label="Pay From Account"
            value={payFromAccountId}
            onChange={(event) => {
              setPayFromAccountId(event.target.value);
              setPaymentError('');
            }}
            SelectProps={selectProps}
            sx={whiteFieldSx}
          >
            {accounts.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {`${account.accountType.charAt(0).toUpperCase()}${account.accountType.slice(1)} - ${account.accountNumber} - ${formatCurrency(account.balance)}`}
              </MenuItem>
            ))}
          </TextField>
          {accounts.length === 0 && (
            <Typography sx={{ color: '#dc2626', fontSize: '.82rem', mt: 1 }}>No active bank accounts are available.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={closeEMIPayment} disabled={Boolean(payingEMIId)} sx={{ color: '#475569', fontWeight: 700 }}>Cancel</Button>
          <Button
            onClick={handlePayEMI}
            variant="contained"
            disabled={Boolean(payingEMIId) || !payFromAccountId}
            startIcon={payingEMIId ? <CircularProgress size={17} color="inherit" /> : <Payment />}
            sx={{
              bgcolor: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              fontWeight: 900,
              px: 3,
              boxShadow: '0 6px 16px rgba(220,38,38,.16)',
              '& .MuiButton-startIcon': { color: 'inherit' },
              '&:hover': {
                bgcolor: '#DC2626',
                color: '#fff',
                borderColor: '#DC2626',
                boxShadow: '0 9px 20px rgba(220,38,38,.26)',
              },
              '&:focus-visible': {
                outline: '3px solid rgba(252,165,165,.55)',
                outlineOffset: 2,
              },
              '&.Mui-disabled': {
                bgcolor: '#fef2f2',
                color: '#fca5a5',
                borderColor: '#fecaca',
                boxShadow: 'none',
              },
            }}
          >
            {payingEMIId ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Part Payment Dialog */}
      <Dialog open={partPayOpen} onClose={() => closePartPayment()} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', border: '1px solid #D1D9E6', borderRadius: '18px', boxShadow: '0 24px 60px rgba(15,23,42,.22)' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#0B1F4D' }}>Loan Part Payment</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#64748b', fontSize: '0.85rem', mb: 2.5 }}>
            Part payment reduces the outstanding principal for {partPayLoan?.loanNumber || 'this loan'} and updates the remaining EMI schedule.
          </Typography>
          {partPayError && <Alert severity="error" sx={{ mb: 2 }}>{partPayError}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
            <Paper sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.75rem' }}>Outstanding Balance</Typography>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mt: .4 }}>{formatCurrency(partPayLoan?.outstandingBalance)}</Typography>
            </Paper>
            <Paper sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.75rem' }}>Monthly EMI</Typography>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mt: .4 }}>{formatCurrency(partPayLoan?.monthlyEMI)}</Typography>
            </Paper>
          </Box>
          <TextField
            fullWidth
            type="number"
            label="Prepayment Amount (₹)"
            value={partPayAmount}
            onChange={(e) => setPartPayAmount(e.target.value)}
            placeholder="Enter payment amount"
            sx={{ ...whiteFieldSx, mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Note (Optional)"
            value={partPayNote}
            onChange={(e) => setPartPayNote(e.target.value)}
            placeholder="e.g. Early payment bonus"
            sx={whiteFieldSx}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            fullWidth
            label="Pay From Account"
            value={partPayAccountId}
            onChange={(e) => setPartPayAccountId(e.target.value)}
            sx={{ ...whiteFieldSx, mt: 2 }}
            InputLabelProps={{ shrink: true }}
          >
            {accounts.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {account.accountNumber} - {account.accountType} - Balance {formatCurrency(account.balance)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => closePartPayment()} disabled={partPayLoading} sx={{ color: '#475569', fontWeight: 800 }}>Cancel</Button>
          <Button onClick={handlePartPayment} disabled={partPayLoading || !partPayAmount || !partPayAccountId} variant="outlined" startIcon={partPayLoading ? <CircularProgress size={16} /> : <Payment />} sx={bankingActionButtonSx('#0B1F4D')}>
            {partPayLoading ? 'Processing...' : 'Pay Amount'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Foreclosure Dialog */}
      <Dialog open={forecloseOpen} onClose={() => closeFullRepayment()} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', border: '1px solid #D1D9E6', borderRadius: '18px', boxShadow: '0 24px 60px rgba(15,23,42,.22)' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#0B1F4D' }}>Pay Full Loan Amount</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#64748b', fontSize: '0.85rem', mb: 2 }}>
            Confirm full repayment for {fullRepaymentLoan?.loanNumber || 'this loan'}. The closure amount below is calculated by the bank system from loan and EMI records.
          </Typography>
          {fullRepaymentError && <Alert severity="error" sx={{ mb: 2 }}>{fullRepaymentError}</Alert>}
          {fullRepaymentLoading && !fullRepaymentQuote ? (
            <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
          ) : fullRepaymentQuote && (
            <Box sx={{ p: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', mb: 2 }}>
              {[
                ['Remaining Principal', fullRepaymentQuote.remainingPrincipal],
                ['Pending Interest', fullRepaymentQuote.pendingInterest],
                ['Unpaid EMI Amount', fullRepaymentQuote.unpaidEmiAmount],
                ['Late Fees / Penalties', fullRepaymentQuote.lateFees],
                [`Closure Charges (${fullRepaymentQuote.prepaymentChargePercent || 0}%)`, fullRepaymentQuote.closureCharge],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: .75, borderBottom: '1px solid #FECACA' }}>
                  <Typography sx={{ color: '#991B1B', fontWeight: 800, fontSize: '.84rem' }}>{label}</Typography>
                  <Typography sx={{ color: '#7F1D1D', fontWeight: 900 }}>{formatCurrency(value)}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, pt: 1.2 }}>
                <Typography sx={{ color: '#DC2626', fontWeight: 900 }}>Total Closure Amount</Typography>
                <Typography sx={{ color: '#DC2626', fontWeight: 900, fontSize: '1.08rem' }}>{formatCurrency(fullRepaymentQuote.totalClosureAmount)}</Typography>
              </Box>
            </Box>
          )}
          <TextField
            select
            fullWidth
            label="Pay From Account"
            value={fullRepaymentAccountId}
            onChange={(event) => {
              setFullRepaymentAccountId(event.target.value);
              setFullRepaymentError('');
            }}
            SelectProps={selectProps}
            sx={whiteFieldSx}
          >
            {accounts.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {`${account.accountType.charAt(0).toUpperCase()}${account.accountType.slice(1)} - ${account.accountNumber} - ${formatCurrency(account.balance)}`}
              </MenuItem>
            ))}
          </TextField>
          <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 1.5 }}>
            On confirmation, the total closure amount will be deducted and all remaining EMI records will be settled. This process is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => closeFullRepayment()} disabled={fullRepaymentLoading} sx={{ color: '#475569', fontWeight: 800 }}>Cancel</Button>
          <Button onClick={handleForeclose} disabled={fullRepaymentLoading || !fullRepaymentQuote || !fullRepaymentAccountId} variant="outlined" startIcon={fullRepaymentLoading ? <CircularProgress size={16} /> : <Close />} sx={bankingActionButtonSx('#0B1F4D')}>
            {fullRepaymentLoading ? 'Processing...' : 'Close Loan Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerLoans;
