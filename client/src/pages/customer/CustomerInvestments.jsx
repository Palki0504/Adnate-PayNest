import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, Paper, Snackbar, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Calculate, Download, History, MonetizationOn, PendingActions,
  Refresh, Savings, Send, Settings, TrackChanges,
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import { accountAPI, investmentAPI } from '../../services/api';
import { getDisplayName } from '../../utils/textFormat';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const certificateMoney = (value) => `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
const deductionMoney = (value) => (Number(value || 0) > 0 ? `- ${money(value)}` : money(0));
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const PREMATURE_PENALTY_MULTIPLIER = 2;
const isoDate = (value = new Date()) => {
  const parsed = new Date(value);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};
const addMonths = (value, months) => {
  const next = new Date(value || new Date());
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
};
const calculateFDMaturity = (amount, tenure, rate) => {
  const principal = Number(amount || 0);
  const years = Number(tenure || 0) / 12;
  const maturityAmount = Math.round(principal * Math.pow(1 + (Number(rate || 0) / 100) / 4, 4 * years));
  return { maturityAmount, interestEarned: Math.max(0, maturityAmount - principal) };
};
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    '& fieldset': { borderColor: '#D1D9E6', borderWidth: 2 },
    '&:hover fieldset': { borderColor: '#3B82F6' },
    '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': { color: '#0f172a', fontWeight: 700, p: '15px 16px' },
  '& .MuiInputLabel-root': { color: '#0F172A', fontWeight: 700, bgcolor: '#fff', px: 0.5 },
};

const formLabelSx = {
  color: '#0F172A',
  fontWeight: 900,
  fontSize: '.88rem',
  mb: 0.8,
  lineHeight: 1.2,
};

const FDField = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={formLabelSx}>{label}</Typography>
    {children}
  </Box>
);

const createFdFieldSx = {
  ...fieldSx,
  '& .MuiOutlinedInput-root': {
    ...fieldSx['& .MuiOutlinedInput-root'],
    minHeight: 58,
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    color: '#0f172a',
    fontWeight: 800,
    p: '16px 18px',
    minHeight: '26px',
    boxSizing: 'border-box',
  },
  '& .MuiFormHelperText-root': {
    ml: 0.2,
    mt: 0.8,
    color: '#64748b',
    fontWeight: 600,
  },
};

const statusSx = (status) => {
  const map = {
    Active: ['#dcfce7', '#15803d', '#86efac'],
    Pending: ['#ffedd5', '#c2410c', '#fdba74'],
    Rejected: ['#fee2e2', '#dc2626', '#fca5a5'],
    Matured: ['#dbeafe', '#1d4ed8', '#93c5fd'],
    Closed: ['#e2e8f0', '#475569', '#cbd5e1'],
    'Premature Closed': ['#f3e8ff', '#7e22ce', '#d8b4fe'],
  };
  const [bg, color, border] = map[status] || map.Pending;
  return { bgcolor: bg, color, border: `1px solid ${border}`, fontWeight: 900, borderRadius: '9px' };
};

const actionButtonSx = {
  bgcolor: '#fff',
  color: '#0B1F4D',
  border: '1px solid #D1D9E6',
  borderRadius: '14px',
  p: 2,
  justifyContent: 'flex-start',
  fontWeight: 900,
  textTransform: 'none',
  boxShadow: '0 8px 22px rgba(15,23,42,.08)',
  '&:hover': { bgcolor: '#EFF6FF', borderColor: '#3B82F6', transform: 'translateY(-2px)' },
};

const primaryFdButtonSx = {
  bgcolor: '#1D4ED8',
  color: '#fff',
  borderRadius: '12px',
  minHeight: 52,
  px: 2.6,
  fontWeight: 900,
  textTransform: 'none',
  boxShadow: '0 10px 22px rgba(29,78,216,.22)',
  '& .MuiButton-startIcon': { color: 'inherit' },
  '&:hover': {
    bgcolor: '#0B1F4D',
    boxShadow: '0 14px 28px rgba(11,31,77,.28)',
    transform: 'translateY(-1px)',
  },
};

const outlineFdButtonSx = {
  color: '#0B1F4D',
  bgcolor: '#fff',
  borderColor: '#1D4ED8',
  borderRadius: '12px',
  minHeight: 52,
  px: 2.6,
  fontWeight: 900,
  textTransform: 'none',
  boxShadow: '0 8px 18px rgba(15,23,42,.08)',
  '&:hover': {
    bgcolor: '#EFF6FF',
    borderColor: '#0B1F4D',
    boxShadow: '0 12px 24px rgba(11,31,77,.14)',
    transform: 'translateY(-1px)',
  },
};

const SectionCard = ({ title: sectionTitle, subtitle, children }) => (
  <Card sx={{ bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 12px 34px rgba(15,23,42,.14)' }}>
    <CardContent sx={{ p: { xs: 2.3, md: 3 } }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.18rem' }}>{sectionTitle}</Typography>
        {subtitle && <Typography sx={{ color: '#64748b', mt: 0.5, fontSize: '.9rem' }}>{subtitle}</Typography>}
      </Box>
      {children}
    </CardContent>
  </Card>
);

const CustomerInvestments = ({ type = 'FD' }) => {
  const isFD = type === 'FD';
  const [records, setRecords] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState('');
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ linkedAccountId: '', amount: '', tenure: '', startDate: '', reason: '', autoRenewal: false, maturityInstruction: 'Credit to linked account' });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [installments, setInstallments] = useState([]);
  const [activeSection, setActiveSection] = useState('create');
  const [fdSubmitDialog, setFdSubmitDialog] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const todayDate = isoDate();

  const rule = useMemo(() => rules.find((item) => item.type === type), [rules, type]);
  const ruleTenures = useMemo(() => rule?.allowedTenures || rule?.tenureOptions || [], [rule]);
  const selectedRecord = useMemo(() => records.find((item) => item._id === selected), [records, selected]);
  const selectedAccount = useMemo(() => accounts.find((account) => account._id === form.linkedAccountId), [accounts, form.linkedAccountId]);
  const selectedClassification = String(selectedAccount?.classification || 'SILVER').toUpperCase();
  const fdRate = useMemo(() => {
    const rates = rule?.classificationInterestRates || [];
    const match = rates.find((item) => String(item.classificationName || item.classification || '').toUpperCase() === selectedClassification);
    return Number(match?.interestRate ?? rates[0]?.interestRate ?? 0);
  }, [rule, selectedClassification]);
  const liveFDPreview = useMemo(() => {
    const amount = Number(form.amount || 0);
    const hasSchedule = Boolean(form.tenure && form.startDate);
    const { maturityAmount, interestEarned } = calculateFDMaturity(amount, form.tenure, fdRate);
    return {
      interestRate: fdRate,
      startDate: form.startDate,
      maturityDate: hasSchedule ? addMonths(form.startDate, form.tenure) : null,
      accruedInterest: interestEarned,
      interestEarned,
      maturityAmount: amount && form.tenure ? maturityAmount : 0,
    };
  }, [form.amount, form.tenure, form.startDate, fdRate]);
  const liveRDPreview = useMemo(() => {
    const amount = Number(form.amount || 0);
    if (preview && !preview.withdrawal && !isFD) {
      return {
        interestRate: preview.interestRate,
        startDate: preview.startDate,
        monthlyDebitDate: preview.monthlyDebitDate || preview.startDate,
        maturityDate: preview.maturityDate,
        totalDepositedAmount: preview.totalDepositedAmount || 0,
        interestEarned: preview.interestEarned || preview.accruedInterest || 0,
        maturityAmount: preview.maturityAmount || preview.expectedMaturityAmount || 0,
        expectedMaturityAmount: preview.expectedMaturityAmount || preview.maturityAmount || 0,
      };
    }
    return {
      interestRate: fdRate,
      startDate: form.startDate,
      monthlyDebitDate: form.startDate,
      maturityDate: null,
      totalDepositedAmount: amount && form.tenure ? amount * Number(form.tenure || 0) : 0,
      interestEarned: 0,
      maturityAmount: 0,
      expectedMaturityAmount: 0,
    };
  }, [form.amount, form.tenure, form.startDate, fdRate, preview, isFD]);

  const load = async () => {
    try {
      const [bootstrap, accountRes, recordRes] = await Promise.all([
        investmentAPI.getBootstrap(),
        accountAPI.getAll(),
        isFD ? investmentAPI.getMyFDs() : investmentAPI.getMyRDs(),
      ]);
      setRules(bootstrap.data.rules || []);
      setAccounts(accountRes.data.accounts || []);
      setRecords(isFD ? (recordRes.data.fds || []) : (recordRes.data.rds || []));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load investment data.');
    }
  };

  useEffect(() => { load(); }, [type]);

  const calculate = async (source = form) => {
    try {
      const payload = isFD
        ? { amount: Number(source.amount), tenure: Number(source.tenure), startDate: source.startDate }
        : { monthlyContribution: Number(source.amount), tenure: Number(source.tenure), startDate: source.startDate, classification: selectedClassification };
      const res = isFD ? await investmentAPI.calculateFD(payload) : await investmentAPI.calculateRD(payload);
      setPreview(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Calculation failed.');
      return null;
    }
  };

  const submitCreate = async () => {
    if (submitLoading) {
      setError('Request already sent and pending for approval.');
      return;
    }
    setSubmitLoading(true);
    try {
      if (!form.startDate) throw new Error('Please select a start date.');
      if (form.startDate < todayDate) throw new Error('Start date cannot be in the past.');
      if (isFD) {
        const amount = Number(form.amount || 0);
        if (!form.linkedAccountId) throw new Error('Please select a linked account.');
        if (!amount) throw new Error('Please enter a valid FD amount.');
        if (rule && (amount < Number(rule.minAmount || 0) || amount > Number(rule.maxAmount || Infinity))) {
          throw new Error(`FD amount must be between ${money(rule.minAmount)} and ${money(rule.maxAmount)}.`);
        }
        if (selectedAccount && amount > Number(selectedAccount.balance || 0)) {
          throw new Error('Selected account does not have sufficient balance for this FD request.');
        }
      } else {
        const amount = Number(form.amount || 0);
        const minMonthlyAmount = Number(rule?.minMonthlyAmount ?? rule?.minAmount ?? 0);
        const maxMonthlyAmount = Number(rule?.maxMonthlyAmount ?? rule?.maxAmount ?? Infinity);
        if (!form.linkedAccountId) throw new Error('Please select a linked account.');
        if (!amount) throw new Error('Please enter a valid RD monthly contribution.');
        if (rule && (amount < minMonthlyAmount || amount > maxMonthlyAmount)) {
          throw new Error(`RD monthly contribution must be between ${money(minMonthlyAmount)} and ${money(maxMonthlyAmount)}.`);
        }
      }
      const payload = isFD
        ? { linkedAccountId: form.linkedAccountId, depositAmount: Number(form.amount), tenure: Number(form.tenure), startDate: form.startDate, autoRenewal: form.autoRenewal, maturityInstruction: form.maturityInstruction }
        : { linkedAccountId: form.linkedAccountId, monthlyContribution: Number(form.amount), tenure: Number(form.tenure), startDate: form.startDate };
      const res = isFD ? await investmentAPI.createFD(payload) : await investmentAPI.createRD(payload);
      setMessage(res.data.message);
      if (isFD) {
        setFdSubmitDialog(res.data.fd || { fdId: 'FD Request' });
      } else {
        setFdSubmitDialog(res.data.rd || { rdId: 'RD Request' });
      }
      setOpen('');
      setPreview(null);
      setForm((current) => ({ ...current, amount: '', reason: '' }));
      load();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage === 'This request is already pending for manager approval.'
        ? 'Request already sent and pending for approval.'
        : apiMessage || err.message || `Failed to create ${type}.`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetFDForm = () => {
    setForm((current) => ({
      ...current,
      amount: '',
      tenure: ruleTenures[0] || '',
      startDate: isoDate(),
      reason: '',
      autoRenewal: false,
      maturityInstruction: 'Credit to linked account',
    }));
    setPreview(null);
  };

  const submitRequest = async () => {
    if (requestLoading) return;
    const reason = form.reason.trim();
    const pendingRequest = isFD
      ? selectedRecord?.prematureWithdrawalRequest?.status === 'Pending'
      : selectedRecord?.prematureClosureRequest?.status === 'Pending';
    const maturityDate = selectedRecord?.maturityDate ? new Date(selectedRecord.maturityDate) : null;

    if (!selected || !selectedRecord) {
      setError(`Please select an ${isFD ? 'FD' : 'RD'} account.`);
      return;
    }
    if (selectedRecord.status !== 'Active') {
      setError(`Only active ${isFD ? 'FD' : 'RD'} accounts can be submitted for premature withdrawal.`);
      return;
    }
    if (maturityDate && maturityDate <= new Date()) {
      setError(`This ${isFD ? 'FD' : 'RD'} has already matured and cannot be submitted for premature withdrawal.`);
      return;
    }
    if (pendingRequest) {
      setError(`A premature withdrawal request for this ${isFD ? 'FD' : 'RD'} is already pending for manager approval.`);
      return;
    }
    if (!reason) {
      setError('Please enter a reason for premature withdrawal.');
      return;
    }
    if (!prematureCalculation) {
      setError('Please view the backend calculation preview before submitting this request.');
      return;
    }

    setRequestLoading(true);
    try {
      await (isFD
        ? investmentAPI.requestFDWithdrawal(selected, { reason })
        : investmentAPI.requestRDClosure(selected, { reason }));
      setMessage('Premature withdrawal request has been sent to the Manager for approval.');
      setForm((current) => ({ ...current, reason: '' }));
      setPreview(null);
      await load();
    } catch (err) {
      const apiMessage = err.response?.data?.message || '';
      const duplicateMessage = apiMessage.toLowerCase().includes('pending') || apiMessage.toLowerCase().includes('already');
      setError(duplicateMessage
        ? `A premature withdrawal request for this ${isFD ? 'FD' : 'RD'} is already pending for manager approval.`
        : apiMessage || 'Request failed.');
    } finally {
      setRequestLoading(false);
    }
  };

  const loadPrematurePreview = async () => {
    if (!selected || !selectedRecord || previewLoading) return;
    setPreviewLoading(true);
    setError('');
    try {
      const res = await (isFD
        ? investmentAPI.getFDWithdrawalPreview(selected)
        : investmentAPI.getRDClosurePreview(selected));
      setPreview({ withdrawal: true, calculation: res.data.calculation });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to calculate premature withdrawal preview.');
    } finally {
      setPreviewLoading(false);
    }
  };
  const updateRenewal = async () => {
    if (renewalLoading) return;
    if (!selected || !selectedRecord) {
      setError(`Please select an ${isFD ? 'FD' : 'RD'} account to renew.`);
      return;
    }
    if (selectedRecord.renewalRequest?.status === 'Pending') {
      setError('Renewal request already sent and pending for approval.');
      return;
    }
    setRenewalLoading(true);
    try {
      await (isFD ? investmentAPI.requestFDRenewal(selected) : investmentAPI.requestRDRenewal(selected));
      setMessage('Renewal request sent to Manager for approval.');
      setOpen('');
      setSelected('');
      await load();
    } catch (err) {
      const apiMessage = err.response?.data?.message || '';
      setError(apiMessage.toLowerCase().includes('pending') || apiMessage.toLowerCase().includes('already')
        ? 'Renewal request already sent and pending for approval.'
        : apiMessage || 'Renewal request failed.');
    } finally {
      setRenewalLoading(false);
    }
  };

  const openInstallments = async (record) => {
    setSelected(record._id);
    const res = await investmentAPI.getRDInstallments(record._id);
    setInstallments(res.data.installments || []);
    setOpen('installments');
  };

  const certificate = (record) => {
    const isRDRecord = Boolean(record.rdId);
    const amountRows = isRDRecord
      ? [
        ['Monthly Contribution', certificateMoney(record.monthlyContribution)],
        ['Total Deposited', certificateMoney(record.totalDepositedAmount || Number(record.monthlyContribution || 0) * Number(record.installmentsPaid || 0))],
        ['Installments Paid', record.installmentsPaid],
        ['Missed Installments', record.missedInstallments],
        ['Expected Maturity Amount', certificateMoney(record.expectedMaturityAmount || record.maturityAmount)],
      ]
      : [
        ['Deposit Amount', certificateMoney(record.depositAmount)],
        ['Interest Earned', certificateMoney(record.interestEarned || record.accruedInterest)],
        ['Maturity Amount', certificateMoney(record.maturityAmount)],
      ];
    const certificateRows = [
      [isRDRecord ? 'RD ID' : 'FD ID', isRDRecord ? record.rdId : record.fdId],
      ['Customer', getDisplayName(record.customerName)],
      ['Linked Account', record.linkedAccountNumber],
      ['Interest Rate', `${record.interestRate || 0}% p.a.`],
      ['Tenure', `${record.tenure || 0} months`],
      ['Start Date', date(record.startDate)],
      ['Maturity Date', date(record.maturityDate)],
      ...amountRows,
      ['Status', record.status],
      ['Issued On', date(new Date())],
    ];
    const doc = new jsPDF();
    doc.setFillColor(11, 31, 77);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('ADNATE PAYNEST BANK', 15, 22);
    doc.setTextColor(11, 31, 77);
    doc.setFontSize(16);
    doc.text(isRDRecord ? 'RECURRING DEPOSIT CERTIFICATE' : 'FIXED DEPOSIT CERTIFICATE', 15, 55);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    [
      [isRDRecord ? 'RD ID' : 'FD ID', record.fdId || record.rdId],
      ['Customer', getDisplayName(record.customerName)],
      ['Linked Account', record.linkedAccountNumber],
      [isRDRecord ? 'Monthly Contribution' : 'Deposit Amount', money(record.depositAmount || record.monthlyContribution).replace('₹', 'Rs. ')],
      ['Interest Rate', `${record.interestRate}% p.a.`],
      ['Tenure', `${record.tenure} months`],
      ['Start Date', date(record.startDate)],
      ['Maturity Date', date(record.maturityDate)],
      [isRDRecord ? 'Expected Maturity Amount' : 'Maturity Amount', money(record.maturityAmount || record.expectedMaturityAmount).replace('₹', 'Rs. ')],
      ['Status', record.status],
    ];
    certificateRows.forEach(([label, value], index) => doc.text(`${label}: ${value ?? '-'}`, 18, 72 + index * 8));
    doc.save(`${isRDRecord ? 'RD' : 'FD'}_Certificate_${isRDRecord ? record.rdId : record.fdId}.pdf`);
  };

  const rows = records;
  const title = isFD ? 'Fixed Deposits' : 'Recurring Deposits';
  const activeFDs = records.filter((record) => record.status === 'Active');
  const certificateFDs = records.filter((record) => ['Active', 'Matured', 'Closed'].includes(record.status));
  const renewalEligibleFDs = records.filter((record) => (
    ['Active', 'Matured'].includes(record.status) && record.renewalRequest?.status !== 'Pending'
  ));
  const fdSummary = records.reduce((summary, record) => ({
    investment: summary.investment + Number(record.depositAmount || 0),
    interest: summary.interest + Number(record.interestEarned || record.accruedInterest || 0),
    maturity: summary.maturity + Number(record.maturityAmount || 0),
  }), { investment: 0, interest: 0, maturity: 0 });
  const rdSummary = records.reduce((summary, record) => ({
    investment: summary.investment + Number(record.totalDepositedAmount || (record.monthlyContribution || 0) * (record.installmentsPaid || 0)),
    interest: summary.interest + Number(record.interestEarned || Math.max(0, (record.maturityAmount || record.expectedMaturityAmount || 0) - ((record.monthlyContribution || 0) * (record.tenure || 0)))),
    maturity: summary.maturity + Number(record.maturityAmount || record.expectedMaturityAmount || 0),
    upcoming: summary.upcoming + (record.status === 'Active' && record.maturityDate ? 1 : 0),
  }), { investment: 0, interest: 0, maturity: 0, upcoming: 0 });
  const fdBasePenaltyRate = Number(rule?.prematureWithdrawalPenalty ?? rule?.prematurePenalty ?? 0);
  const fdAppliedPenaltyRate = fdBasePenaltyRate * PREMATURE_PENALTY_MULTIPLIER;
  const rdBasePenaltyRate = Number(rule?.prematureClosurePenalty ?? rule?.prematurePenalty ?? 0);
  const rdAppliedPenaltyRate = rdBasePenaltyRate * PREMATURE_PENALTY_MULTIPLIER;
  const savedPrematureCalculation = isFD
    ? selectedRecord?.prematureWithdrawalRequest?.calculationBreakdown
    : selectedRecord?.prematureClosureRequest?.calculationBreakdown;
  const prematureCalculation = preview?.calculation || savedPrematureCalculation || null;
  const prematurePrincipal = Number(prematureCalculation?.principalAmount ?? prematureCalculation?.totalDepositedAmount ?? prematureCalculation?.depositAmount ?? 0);
  const prematureInterest = Number(prematureCalculation?.actualAccruedInterest ?? prematureCalculation?.accruedInterest ?? 0);
  const prematureAdminPenaltyRate = Number(prematureCalculation?.adminPenaltyRate ?? (isFD ? fdBasePenaltyRate : rdBasePenaltyRate));
  const prematureAppliedPenaltyRate = Number(prematureCalculation?.appliedPenaltyRate ?? (isFD ? fdAppliedPenaltyRate : rdAppliedPenaltyRate));
  const prematurePenalty = Number(prematureCalculation?.penaltyAmount || 0);
  const revisedPayout = Number(prematureCalculation?.revisedPayoutAmount || 0);
  const pendingWithdrawalRequest = isFD
    ? selectedRecord?.prematureWithdrawalRequest?.status === 'Pending'
    : selectedRecord?.prematureClosureRequest?.status === 'Pending';
  const canSubmitWithdrawal = Boolean(selectedRecord && selectedRecord.status === 'Active' && form.reason.trim() && prematureCalculation && !pendingWithdrawalRequest);
  const fdActionSx = (active) => ({
    ...actionButtonSx,
    minHeight: 74,
    bgcolor: active ? '#0B1F4D' : '#fff',
    color: active ? '#fff' : '#0B1F4D',
    borderColor: active ? '#0B1F4D' : '#D1D9E6',
    boxShadow: active ? '0 14px 30px rgba(11,31,77,.24)' : '0 8px 22px rgba(15,23,42,.08)',
    '& .MuiButton-startIcon': { color: 'inherit' },
    '&:hover': {
      bgcolor: active ? '#132d63' : '#EFF6FF',
      borderColor: active ? '#132d63' : '#3B82F6',
      transform: 'translateY(-2px)',
      boxShadow: active ? '0 16px 34px rgba(11,31,77,.28)' : '0 12px 28px rgba(59,130,246,.12)',
    },
  });

  const fdTable = (tableRows = records) => (
    <TableContainer sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
      <Table sx={{ minWidth: 980 }} size="small">
        <TableHead><TableRow sx={{ bgcolor: '#0B1F4D' }}>
          {['FD ID', 'Linked Account', 'Deposit Amount', 'Interest Rate', 'Tenure', 'Start Date', 'Maturity Date', 'Maturity Amount', 'Status', 'Actions'].map((head) => (
            <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>{head}</TableCell>
          ))}
        </TableRow></TableHead>
        <TableBody>
          {tableRows.map((row) => (
            <TableRow key={row._id} sx={{ '& td': { color: '#334155', borderColor: '#e2e8f0', py: 1.45 }, '&:hover': { bgcolor: '#eff6ff' } }}>
              <TableCell sx={{ fontWeight: 900 }}>{row.fdId}</TableCell>
              <TableCell>{row.linkedAccountNumber}</TableCell>
              <TableCell>{money(row.depositAmount)}</TableCell>
              <TableCell>{row.interestRate}%</TableCell>
              <TableCell>{row.tenure} mo</TableCell>
              <TableCell>{date(row.startDate)}</TableCell>
              <TableCell>{date(row.maturityDate)}</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>{money(row.maturityAmount)}</TableCell>
              <TableCell><Chip size="small" label={row.status} sx={statusSx(row.status)} /></TableCell>
              <TableCell>
                <Button size="small" disabled={!certificateFDs.some((item) => item._id === row._id)} onClick={() => certificate(row)} startIcon={<Download />} sx={{ color: '#0B1F4D', fontWeight: 900 }}>
                  Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tableRows.length === 0 && <TableRow><TableCell colSpan={10} align="center" sx={{ color: '#64748b', py: 6 }}>No FD records found.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderFDSection = () => {
    if (activeSection === 'accounts') {
      return (
        <SectionCard title="My FD Accounts" subtitle="Track live FD requests, active deposits, maturity values, and certificates.">
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              ['Total FD Investment', fdSummary.investment, '#2563eb', <Savings />],
              ['Total Interest Earned', fdSummary.interest, '#059669', <MonetizationOn />],
              ['Total Maturity Amount', fdSummary.maturity, '#7c3aed', <AccountBalance />],
            ].map(([label, value, color, icon]) => (
              <Grid item xs={12} md={4} key={label}>
                <Paper sx={{ p: 2.2, borderRadius: '16px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 9px 24px rgba(15,23,42,.09)' }}>
                  <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '13px', bgcolor: `${color}14`, color, mb: 1.2 }}>{icon}</Box>
                  <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.82rem' }}>{label}</Typography>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.35rem', mt: .45 }}>{money(value)}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          {fdTable(records)}
        </SectionCard>
      );
    }

    if (activeSection === 'withdrawal') {
      return (
        <SectionCard title="Premature Withdrawal Request" subtitle="Request early closure of your Fixed Deposit before maturity. Applicable penalty will be deducted.">
          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={8}>
              <Grid container spacing={2.2}>
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Select FD Account"
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setPreview(null);
                    }}
                    SelectProps={{ displayEmpty: true }}
                    helperText="Only active FDs are eligible for premature withdrawal."
                    sx={fieldSx}
                  >
                    <MenuItem value="" disabled>Select FD Account</MenuItem>
                    {activeFDs.map((record) => (
                      <MenuItem key={record._id} value={record._id}>
                        {record.fdId} - {money(record.depositAmount)} - Maturity {date(record.maturityDate)} - {record.status}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="FD Amount" value={selectedRecord ? money(selectedRecord.depositAmount) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="FD Start Date" value={selectedRecord ? date(selectedRecord.startDate) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Maturity Date" value={selectedRecord ? date(selectedRecord.maturityDate) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Tenure" value={selectedRecord ? `${selectedRecord.tenure} months` : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Withdrawal Request Date" value={prematureCalculation ? date(prematureCalculation.withdrawalRequestDate) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Completed Period" value={prematureCalculation?.completedPeriod || ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Actual Accrued Interest Till Date" value={prematureCalculation ? money(prematureInterest) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Admin Penalty Rate" value={prematureCalculation ? `${prematureAdminPenaltyRate}%` : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Penalty Applied" value={prematureCalculation ? `${prematureAppliedPenaltyRate}% (2x as per premature withdrawal rule)` : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Penalty Amount" value={prematureCalculation ? money(prematurePenalty) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Revised Payout Amount" value={prematureCalculation ? money(revisedPayout) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Reason for Premature Withdrawal"
                    placeholder="Enter reason for premature withdrawal..."
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    helperText="Minimum 10 characters required."
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 1.6, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                    <Typography sx={{ color: '#92400e', fontWeight: 700, fontSize: '.86rem' }}>Your request will be reviewed by the bank manager. You will receive a notification once approved.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 1.5, alignItems: 'stretch' }}>
                  <Button fullWidth variant="outlined" onClick={() => { setSelected(''); setPreview(null); setForm((current) => ({ ...current, reason: '' })); }} sx={outlineFdButtonSx}>Reset</Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={requestLoading ? <CircularProgress size={18} color="inherit" /> : <Send />}
                    onClick={submitRequest}
                    disabled={requestLoading || !canSubmitWithdrawal}
                    sx={primaryFdButtonSx}
                  >
                    {requestLoading ? 'Submitting...' : 'Submit Withdrawal Request'}
                  </Button>
                  <Button fullWidth variant="contained" startIcon={previewLoading ? <CircularProgress size={18} color="inherit" /> : <Calculate />} disabled={!selectedRecord || previewLoading} onClick={loadPrematurePreview} sx={primaryFdButtonSx}>
                    {previewLoading ? 'Calculating...' : 'View Calculation'}
                  </Button>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 2.5, borderRadius: '18px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)' }}>
                <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.05rem', mb: 2 }}>Penalty & Payout Summary</Typography>
                <Box sx={{ p: 2, mb: 2, borderRadius: '14px', bgcolor: '#ecfdf5', border: '1px solid #bbf7d0' }}>
                  <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '.86rem' }}>Estimated Payout After Penalty</Typography>
                  <Typography sx={{ color: '#16a34a', fontWeight: 900, fontSize: '1.45rem', mt: .8 }}>{prematureCalculation ? money(revisedPayout) : money(0)}</Typography>
                </Box>
                {[
                  ['FD ID', selectedRecord?.fdId || '-', '#0f172a'],
                  ['Principal Amount', prematureCalculation ? money(prematurePrincipal) : money(0), '#0f172a'],
                  ['Start Date', prematureCalculation ? date(prematureCalculation.startDate) : '-', '#0f172a'],
                  ['Withdrawal Request Date', prematureCalculation ? date(prematureCalculation.withdrawalRequestDate) : '-', '#0f172a'],
                  ['Completed Period', prematureCalculation?.completedPeriod || '-', '#0f172a'],
                  ['Interest Rate', prematureCalculation ? `${prematureCalculation.interestRate}%` : '0%', '#0f172a'],
                  ['Actual Accrued Interest Till Date', prematureCalculation ? money(prematureInterest) : money(0), '#0f172a'],
                  ['Admin Penalty Rate', prematureCalculation ? `${prematureAdminPenaltyRate}%` : '0%', '#0f172a'],
                  ['Penalty Applied', prematureCalculation ? `${prematureAppliedPenaltyRate}% (2x as per premature withdrawal rule)` : '0%', '#dc2626'],
                  ['Penalty Amount', prematureCalculation ? deductionMoney(prematurePenalty) : money(0), '#dc2626'],
                  ['Revised Payout Amount', prematureCalculation ? money(revisedPayout) : money(0), '#2563eb'],
                  ['Reason', form.reason || prematureCalculation?.reason || '-', '#0f172a'],
                ].map(([label, value, color], index) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.2, borderTop: index === 0 ? 'none' : '1px solid #e2e8f0' }}>
                    <Typography sx={{ color, fontWeight: 800, fontSize: '.86rem' }}>{label}</Typography>
                    <Typography sx={{ color, fontWeight: 900, fontSize: '.9rem', textAlign: 'right' }}>{value}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </SectionCard>
      );
    }

    if (activeSection === 'renewal') {
      return (
        <SectionCard title="Select FD for Renewal" subtitle="Choose an FD account to renew your fixed deposit.">
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <FDField label="Select FD Account">
                <TextField
                  select
                  fullWidth
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  SelectProps={{ displayEmpty: true }}
                  sx={createFdFieldSx}
                >
                  <MenuItem value="" disabled>Select FD Account</MenuItem>
                  {renewalEligibleFDs.map((record) => (
                    <MenuItem key={record._id} value={record._id}>
                      {record.fdId} &bull; {money(record.depositAmount)} &bull; {date(record.maturityDate)}
                    </MenuItem>
                  ))}
                </TextField>
              </FDField>
            </Grid>
            <Grid item xs={12}>
              {selectedRecord ? (
                <Paper sx={{ p: { xs: 2, md: 2.6 }, borderRadius: '18px', bgcolor: '#f8fafc', border: '1px solid #dbe4f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)' }}>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mb: 2, fontSize: '1.05rem' }}>FD Details</Typography>
                  <Grid container spacing={2}>
                    {[
                      ['FD Amount', money(selectedRecord.depositAmount)],
                      ['Interest Rate', `${selectedRecord.interestRate}% p.a.`],
                      ['Start Date', date(selectedRecord.startDate)],
                      ['Maturity Date', date(selectedRecord.maturityDate)],
                      ['Tenure', `${selectedRecord.tenure} months`],
                      ['Maturity Amount', money(selectedRecord.maturityAmount)],
                    ].map(([label, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={label}>
                        <Paper sx={{ p: 1.8, borderRadius: '14px', bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                          <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.78rem' }}>{label}</Typography>
                          <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mt: .6 }}>{value || '-'}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              ) : (
                <Paper sx={{ p: 3.5, textAlign: 'center', borderRadius: '16px', bgcolor: '#fff', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: 800 }}>
                  Select an eligible FD account to view renewal details.
                </Paper>
              )}
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={renewalLoading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
                onClick={updateRenewal}
                disabled={renewalLoading || !selected || selectedRecord?.renewalRequest?.status === 'Pending'}
                sx={{ ...primaryFdButtonSx, px: 4, minWidth: { xs: '100%', sm: 180 } }}
              >
                {renewalLoading ? 'Sending Request...' : 'Renew FD'}
              </Button>
            </Grid>
          </Grid>
        </SectionCard>
      );
    }

    if (activeSection === 'certificates') {
      return (
        <SectionCard title="FD Certificates" subtitle="Download certificates for active, matured, or closed fixed deposits.">
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <FDField label="Select FD Account">
                <TextField
                  select
                  fullWidth
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  SelectProps={{ displayEmpty: true }}
                  sx={createFdFieldSx}
                >
                  <MenuItem value="" disabled>Select FD Account</MenuItem>
                  {certificateFDs.map((record) => (
                    <MenuItem key={record._id} value={record._id}>
                      {record.fdId} &bull; {money(record.depositAmount)} &bull; {record.status}
                    </MenuItem>
                  ))}
                </TextField>
              </FDField>
            </Grid>
            <Grid item xs={12}>
              {selectedRecord ? (
                <Paper sx={{ p: { xs: 2, md: 2.6 }, borderRadius: '18px', bgcolor: '#f8fafc', border: '1px solid #dbe4f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)' }}>
                  <Grid container spacing={2}>
                    {[
                      ['FD ID', selectedRecord.fdId],
                      ['Deposit Amount', money(selectedRecord.depositAmount)],
                      ['Interest Rate', `${selectedRecord.interestRate}% p.a.`],
                      ['Start Date', date(selectedRecord.startDate)],
                      ['Maturity Date', date(selectedRecord.maturityDate)],
                      ['Maturity Amount', money(selectedRecord.maturityAmount)],
                    ].map(([label, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={label}>
                        <Paper sx={{ p: 1.8, borderRadius: '14px', bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                          <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.78rem' }}>{label}</Typography>
                          <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mt: .6 }}>{value || '-'}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <Button variant="contained" startIcon={<Download />} onClick={() => certificate(selectedRecord)} sx={{ ...primaryFdButtonSx, mt: 2.5 }}>
                    Download FD Certificate
                  </Button>
                </Paper>
              ) : (
                <Paper sx={{ p: 3.5, textAlign: 'center', borderRadius: '16px', bgcolor: '#fff', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: 800 }}>
                  Select an eligible FD account to download its certificate.
                </Paper>
              )}
            </Grid>
          </Grid>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Create Fixed Deposit" subtitle="Create an FD request using your linked account. The FD becomes active only after manager approval.">
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <Grid container spacing={2.8} alignItems="flex-start">
              <Grid item xs={12} md={6}>
                <FDField label="Linked Account">
                <TextField
                  select
                  fullWidth
                  value={form.linkedAccountId}
                  onChange={(e) => setForm({ ...form, linkedAccountId: e.target.value })}
                  SelectProps={{ displayEmpty: true }}
                  sx={createFdFieldSx}
                >
                  <MenuItem value="" disabled>Select linked account</MenuItem>
                  {accounts.map((account) => (
                    <MenuItem key={account._id} value={account._id}>
                      {account.accountNumber} - {account.accountType} - Balance {money(account.balance)}
                    </MenuItem>
                  ))}
                </TextField>
                </FDField>
              </Grid>
              <Grid item xs={12} md={6}>
                <FDField label="Deposit Amount">
                <TextField
                  fullWidth
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Enter deposit amount"
                  helperText={`Minimum: ${money(rule?.minAmount || 0)} | Maximum: ${money(rule?.maxAmount || 0)}`}
                  sx={createFdFieldSx}
                />
                </FDField>
              </Grid>
              <Grid item xs={12} md={6}>
                <FDField label="Interest Rate">
                  <TextField fullWidth value={form.linkedAccountId ? `${fdRate || 0}% p.a.` : ''} placeholder="Auto-filled from FD rules" InputProps={{ readOnly: true }} helperText={form.linkedAccountId ? `${selectedClassification} classification rate` : 'Select linked account to view rate'} sx={createFdFieldSx} />
                </FDField>
              </Grid>
              <Grid item xs={12} md={6}>
                <FDField label="Tenure">
                <TextField select fullWidth value={form.tenure} onChange={(e) => setForm({ ...form, tenure: e.target.value })} SelectProps={{ displayEmpty: true }} sx={createFdFieldSx}>
                  <MenuItem value="" disabled>Select tenure</MenuItem>
                  {ruleTenures.map((tenure) => <MenuItem key={tenure} value={tenure}>{tenure} months</MenuItem>)}
                </TextField>
                </FDField>
              </Grid>
              <Grid item xs={12} md={6}>
                <FDField label="Start Date">
                  <TextField fullWidth type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} inputProps={{ min: todayDate }} helperText="Select start date" sx={createFdFieldSx} />
                </FDField>
              </Grid>
              <Grid item xs={12} md={6}>
                <FDField label="Maturity Date">
                  <TextField fullWidth value={liveFDPreview.maturityDate ? date(liveFDPreview.maturityDate) : ''} placeholder="Auto-calculated" InputProps={{ readOnly: true }} sx={createFdFieldSx} />
                </FDField>
              </Grid>

              {preview && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2.2, borderRadius: '16px', border: '1px solid #cbd5e1', bgcolor: '#f8fbff', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)' }}>
                  {[
                    ['Interest Earned', money(preview.interestEarned || preview.accruedInterest), '#16a34a'],
                    ['Maturity Amount', money(preview.maturityAmount), '#2563eb'],
                    ['Deposit Frequency', 'One-time', '#0B1F4D'],
                  ].map(([label, value, color], index) => (
                    <Box key={label} sx={{ px: { md: 2 }, borderLeft: index === 0 ? 'none' : { md: '1px solid #cbd5e1' } }}>
                      <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.82rem' }}>{label}</Typography>
                      <Typography sx={{ color, fontWeight: 900, fontSize: '1.3rem', mt: .5 }}>{value}</Typography>
                    </Box>
                  ))}
                </Paper>
              </Grid>
              )}

              <Grid item xs={12} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '160px minmax(190px, 1fr) minmax(230px, 1.25fr)' }, gap: 1.8, alignItems: 'stretch', mt: 0.5 }}>
                <Button variant="outlined" onClick={resetFDForm} sx={{ color: '#0B1F4D', borderColor: '#cbd5e1', borderRadius: '12px', py: 1.2, fontWeight: 900 }}>Reset</Button>
                <Button variant="contained" startIcon={<Calculate />} onClick={() => calculate(form)} sx={primaryFdButtonSx}>Calculate</Button>
                <Button variant="contained" startIcon={submitLoading ? <CircularProgress size={18} color="inherit" /> : <Send />} onClick={submitCreate} disabled={submitLoading} sx={primaryFdButtonSx}>{submitLoading ? 'Submitting...' : 'Submit FD Request'}</Button>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 1.6, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                  <Typography sx={{ color: '#92400e', fontWeight: 700, fontSize: '.86rem' }}>Your FD request will be reviewed by the bank manager. You will receive an email and dashboard notification once approved.</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>

          {false && (
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2.5, borderRadius: '18px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)', mb: 2.5 }}>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.05rem', mb: 2 }}>FD Preview</Typography>
              {[
                ['Deposit Amount', money(form.amount)],
                ['Interest Rate (p.a.)', `${fdRate || 0}%`],
                ['Tenure', `${form.tenure} Months`],
                ['Start Date', date(form.startDate)],
                ['Maturity Date', date(liveFDPreview.maturityDate)],
                ['Interest Earned', money(liveFDPreview.interestEarned)],
                ['Maturity Amount', money(liveFDPreview.maturityAmount)],
              ].map(([label, value], index) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.25, borderBottom: index === 6 ? 'none' : '1px solid #e2e8f0' }}>
                  <Typography sx={{ color: label === 'Interest Earned' ? '#16a34a' : '#334155', fontWeight: 700, fontSize: '.86rem' }}>{label}</Typography>
                  <Typography sx={{ color: label === 'Maturity Amount' ? '#2563eb' : '#0f172a', fontWeight: 900, fontSize: '.9rem', textAlign: 'right' }}>{value}</Typography>
                </Box>
              ))}
            </Paper>
            <Paper sx={{ p: 2.5, borderRadius: '18px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)' }}>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.05rem', mb: 1.6 }}>Why Choose FD?</Typography>
              {['Guaranteed returns with fixed interest rates', 'Safe and secure investment', 'Flexible tenure options', 'Premature withdrawal with applicable penalty'].map((benefit) => (
                <Box key={benefit} sx={{ display: 'flex', gap: 1.2, alignItems: 'center', py: .9 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#dbeafe', color: '#2563eb', display: 'grid', placeItems: 'center', fontWeight: 900 }}>✓</Box>
                  <Typography sx={{ color: '#334155', fontWeight: 700, fontSize: '.86rem' }}>{benefit}</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
          )}
        </Grid>
      </SectionCard>
    );
  };

  if (isFD) {
    const fdActions = [
      { key: 'create', label: 'Create FD', icon: <Savings /> },
      { key: 'accounts', label: 'My FD Accounts', icon: <AccountBalance /> },
      { key: 'withdrawal', label: 'Premature Withdrawal', icon: <PendingActions /> },
      { key: 'certificates', label: 'FD Certificates', icon: <Download /> },
      { key: 'renewal', label: 'FD Renewal', icon: <Settings /> },
    ];

    return (
      <Box sx={{ color: '#fff', width: '100%', overflowX: 'hidden' }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 900 }}>Fixed Deposits</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.55)' }}>Create, track, withdraw, renew, and download FD certificates.</Typography>
        </Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {fdActions.map((item) => (
            <Grid item xs={12} sm={6} md={4} xl={2} key={item.key}>
              <Button fullWidth startIcon={item.icon} onClick={() => { setActiveSection(item.key); setPreview(null); }} sx={fdActionSx(activeSection === item.key)}>
                {item.label}
              </Button>
            </Grid>
          ))}
        </Grid>
        {renderFDSection()}
        <Dialog
          open={Boolean(fdSubmitDialog)}
          onClose={() => setFdSubmitDialog(null)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #dbe3ef', boxShadow: '0 24px 60px rgba(15,23,42,.24)' } }}
        >
          <DialogTitle sx={{ color: '#0B1F4D', fontWeight: 900, pb: 1 }}>FD Request Submitted</DialogTitle>
          <DialogContent>
            <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>
              FD request submitted successfully. Please wait for manager approval.
            </Alert>
            <Paper sx={{ p: 2.25, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px' }}>
              <Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>{fdSubmitDialog?.fdId || 'FD Request'}</Typography>
              <Typography sx={{ color: '#475569', mt: .8, lineHeight: 1.7 }}>
                Your request has been sent to the Manager Dashboard. Once the manager approves it, the FD amount will be debited from your linked account, and you will receive an email plus a dashboard notification.
              </Typography>
            </Paper>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1 }}>
            <Button
              variant="contained"
              onClick={() => setFdSubmitDialog(null)}
              sx={{ bgcolor: '#1D4ED8', borderRadius: '12px', px: 3, fontWeight: 900, '&:hover': { bgcolor: '#0B1F4D' } }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar open={Boolean(message || error)} autoHideDuration={3500} onClose={() => { setMessage(''); setError(''); }}>
          <Alert severity={error ? 'error' : 'success'}>{error || message}</Alert>
        </Snackbar>
      </Box>
    );
  }

  const rdActions = [
    { key: 'create', label: 'Create RD', icon: <Savings /> },
    { key: 'calculator', label: 'RD Calculator', icon: <Calculate /> },
    { key: 'accounts', label: 'My RD Accounts', icon: <AccountBalance /> },
    { key: 'withdrawal', label: 'Premature Withdrawal', icon: <PendingActions /> },
    { key: 'certificates', label: 'RD Certificates', icon: <Download /> },
    { key: 'renewal', label: 'RD Renewal', icon: <Settings /> },
  ];
  const activeRDs = records.filter((record) => record.status === 'Active');
  const rdCertificateRows = records.filter((record) => ['Active', 'Matured', 'Closed'].includes(record.status));
  const rdRenewalRows = records.filter((record) => ['Active', 'Matured'].includes(record.status) && record.renewalRequest?.status !== 'Pending');

  const rdTable = (tableRows = records) => (
    <TableContainer sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
      <Table sx={{ minWidth: 1100 }} size="small">
        <TableHead><TableRow sx={{ bgcolor: '#0B1F4D' }}>
          {['RD ID', 'Linked Account', 'Monthly Amount', 'Rate', 'Tenure', 'Paid', 'Missed', 'Start Date', 'Maturity Date', 'Maturity Amount', 'Status'].map((head) => (
            <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>{head}</TableCell>
          ))}
        </TableRow></TableHead>
        <TableBody>
          {tableRows.map((row) => (
            <TableRow key={row._id} sx={{ '& td': { color: '#334155', borderColor: '#e2e8f0', py: 1.45 }, '&:hover': { bgcolor: '#eff6ff' } }}>
              <TableCell sx={{ fontWeight: 900 }}>{row.rdId}</TableCell>
              <TableCell>{row.linkedAccountNumber}</TableCell>
              <TableCell>{money(row.monthlyContribution)}</TableCell>
              <TableCell>{row.interestRate}%</TableCell>
              <TableCell>{row.tenure} mo</TableCell>
              <TableCell>{row.installmentsPaid}</TableCell>
              <TableCell>{row.missedInstallments}</TableCell>
              <TableCell>{date(row.startDate)}</TableCell>
              <TableCell>{date(row.maturityDate)}</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>{money(row.maturityAmount || row.expectedMaturityAmount)}</TableCell>
              <TableCell><Chip size="small" label={row.status} sx={statusSx(row.status)} /></TableCell>
            </TableRow>
          ))}
          {tableRows.length === 0 && <TableRow><TableCell colSpan={11} align="center" sx={{ color: '#64748b', py: 6 }}>No RD records found.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderRDSection = () => {
    if (activeSection === 'calculator') {
      return (
        <SectionCard title="RD Calculator" subtitle="Estimate recurring deposit maturity before creating an RD request.">
          <Grid container spacing={2.2}>
            <Grid item xs={12} md={6}><TextField fullWidth label="Monthly Contribution" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField select fullWidth label="Tenure" value={form.tenure} onChange={(e) => setForm({ ...form, tenure: e.target.value })} sx={fieldSx}>{ruleTenures.map((tenure) => <MenuItem key={tenure} value={tenure}>{tenure} months</MenuItem>)}</TextField></Grid>
            <Grid item xs={12}><Button variant="contained" startIcon={<Calculate />} onClick={() => calculate()} sx={primaryFdButtonSx}>Calculate Returns</Button></Grid>
            {preview && <Grid item xs={12}><Paper sx={{ p: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px' }}><Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>Interest Rate: {preview.interestRate}% p.a.</Typography><Typography sx={{ color: '#334155', mt: .7 }}>Maturity Date: {date(preview.maturityDate)}</Typography><Typography sx={{ color: '#334155' }}>Total Deposited: {money(Number(form.amount || 0) * Number(form.tenure || 0))}</Typography><Typography sx={{ color: '#334155' }}>Interest Earned: {money(preview.accruedInterest)}</Typography><Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>Expected Maturity Amount: {money(preview.expectedMaturityAmount)}</Typography></Paper></Grid>}
          </Grid>
        </SectionCard>
      );
    }
    if (activeSection === 'accounts') {
      return (
        <SectionCard title="My RD Accounts" subtitle="Track RD requests, auto-debits, maturity values, missed installments, and certificates.">
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              ['Total RD Investment', rdSummary.investment, '#2563eb', <Savings />],
              ['Total Interest Earned', rdSummary.interest, '#059669', <MonetizationOn />],
              ['Total Maturity Amount', rdSummary.maturity, '#7c3aed', <AccountBalance />],
              ['Upcoming Maturity', rdSummary.upcoming, '#f97316', <PendingActions />],
            ].map(([label, value, color, icon]) => (
              <Grid item xs={12} md={3} key={label}><Paper sx={{ p: 2.2, borderRadius: '16px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 9px 24px rgba(15,23,42,.09)' }}><Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '13px', bgcolor: `${color}14`, color, mb: 1.2 }}>{icon}</Box><Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.82rem' }}>{label}</Typography><Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.35rem', mt: .45 }}>{typeof value === 'number' && label !== 'Upcoming Maturity' ? money(value) : value}</Typography></Paper></Grid>
            ))}
          </Grid>
          {rdTable(records)}
        </SectionCard>
      );
    }
    if (activeSection === 'withdrawal') {
      return (
        <SectionCard title="Premature Withdrawal Request" subtitle="Request early closure of your Recurring Deposit before maturity. Applicable penalty will be deducted.">
          <Grid container spacing={2.2}>
            <Grid item xs={12}><TextField select fullWidth label="Select RD Account" value={selected} onChange={(e) => { setSelected(e.target.value); setPreview(null); }} helperText="Only active RDs are eligible for premature withdrawal." sx={fieldSx}><MenuItem value="" disabled>Select RD Account</MenuItem>{activeRDs.map((record) => <MenuItem key={record._id} value={record._id}>{record.rdId} - {money(record.monthlyContribution)} monthly - {record.status}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Total Deposited Till Date" value={prematureCalculation ? money(prematurePrincipal) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Start Date" value={prematureCalculation ? date(prematureCalculation.startDate) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Withdrawal Request Date" value={prematureCalculation ? date(prematureCalculation.withdrawalRequestDate) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Completed Period" value={prematureCalculation?.completedPeriod || ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Actual Accrued Interest Till Date" value={prematureCalculation ? money(prematureInterest) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Admin Penalty Rate" value={prematureCalculation ? `${prematureAdminPenaltyRate}%` : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Penalty Applied" value={prematureCalculation ? `${prematureAppliedPenaltyRate}% (2x as per premature closure rule)` : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Penalty Amount" value={prematureCalculation ? money(prematurePenalty) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Revised Payout" value={prematureCalculation ? money(revisedPayout) : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Paid Installments Included" value={prematureCalculation ? prematureCalculation.paidInstallmentsCount || 0 : ''} InputProps={{ readOnly: true }} sx={fieldSx} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Reason for Premature Withdrawal" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} sx={fieldSx} /></Grid>
            {prematureCalculation?.installmentBreakdown?.length > 0 && (
              <Grid item xs={12}>
                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <Table size="small">
                    <TableHead><TableRow>{['Installment', 'Paid Date', 'Amount', 'Days', 'Interest'].map((head) => <TableCell key={head} sx={{ fontWeight: 900 }}>{head}</TableCell>)}</TableRow></TableHead>
                    <TableBody>{prematureCalculation.installmentBreakdown.map((item) => (
                      <TableRow key={item.installmentNo}>
                        <TableCell>{item.installmentNo}</TableCell>
                        <TableCell>{date(item.paidDate)}</TableCell>
                        <TableCell>{money(item.amount)}</TableCell>
                        <TableCell>{item.daysAccrued}</TableCell>
                        <TableCell>{money(item.interest)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            )}
            <Grid item xs={12}>
              <Paper sx={{ p: 1.6, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                <Typography sx={{ color: '#92400e', fontWeight: 700, fontSize: '.86rem' }}>Your request will be reviewed by the bank manager. You will receive a notification once approved.</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5, alignItems: 'stretch' }}>
              <Button fullWidth variant="outlined" onClick={() => { setSelected(''); setPreview(null); setForm((current) => ({ ...current, reason: '' })); }} sx={outlineFdButtonSx}>Reset</Button>
              <Button
                fullWidth
                variant="contained"
                startIcon={requestLoading ? <CircularProgress size={18} color="inherit" /> : <Send />}
                disabled={requestLoading || !canSubmitWithdrawal}
                onClick={submitRequest}
                sx={primaryFdButtonSx}
              >
                {requestLoading ? 'Submitting...' : 'Submit Withdrawal Request'}
              </Button>
              <Button fullWidth variant="contained" startIcon={previewLoading ? <CircularProgress size={18} color="inherit" /> : <Calculate />} disabled={!selectedRecord || previewLoading} onClick={loadPrematurePreview} sx={primaryFdButtonSx}>
                {previewLoading ? 'Calculating...' : 'View Calculation'}
              </Button>
            </Grid>
          </Grid>
        </SectionCard>
      );
    }
    if (activeSection === 'renewal') {
      return <SectionCard title="RD Renewal" subtitle="Request manager approval to renew an active or matured RD using current admin-defined rates."><Grid container spacing={2.2}><Grid item xs={12}><TextField select fullWidth label="Select RD Account" value={selected} onChange={(e) => setSelected(e.target.value)} sx={fieldSx}>{rdRenewalRows.map((record) => <MenuItem key={record._id} value={record._id}>{record.rdId} - Maturity {date(record.maturityDate)}</MenuItem>)}</TextField></Grid><Grid item xs={12}><Button variant="contained" startIcon={renewalLoading ? <CircularProgress size={18} color="inherit" /> : <Refresh />} disabled={renewalLoading || !selected || selectedRecord?.renewalRequest?.status === 'Pending'} onClick={updateRenewal} sx={primaryFdButtonSx}>{renewalLoading ? 'Sending Request...' : 'Renew RD'}</Button></Grid></Grid></SectionCard>;
    }
    if (activeSection === 'certificates') {
      return (
        <SectionCard title="RD Certificates" subtitle="Download certificates for active, matured, or closed recurring deposits.">
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <FDField label="Select RD Account">
                <TextField select fullWidth value={selected} onChange={(e) => setSelected(e.target.value)} SelectProps={{ displayEmpty: true }} sx={createFdFieldSx}>
                  <MenuItem value="" disabled>Select RD Account</MenuItem>
                  {rdCertificateRows.map((record) => (
                    <MenuItem key={record._id} value={record._id}>
                      {record.rdId} &bull; {money(record.monthlyContribution)} monthly &bull; {record.status}
                    </MenuItem>
                  ))}
                </TextField>
              </FDField>
            </Grid>
            <Grid item xs={12}>
              {selectedRecord ? (
                <Paper sx={{ p: { xs: 2, md: 2.6 }, borderRadius: '18px', bgcolor: '#f8fafc', border: '1px solid #dbe4f0', boxShadow: '0 10px 26px rgba(15,23,42,.08)' }}>
                  <Grid container spacing={2}>
                    {[
                      ['RD ID', selectedRecord.rdId],
                      ['Monthly Contribution', money(selectedRecord.monthlyContribution)],
                      ['Total Deposited', money(selectedRecord.totalDepositedAmount || Number(selectedRecord.monthlyContribution || 0) * Number(selectedRecord.installmentsPaid || 0))],
                      ['Installments Paid', selectedRecord.installmentsPaid],
                      ['Maturity Date', date(selectedRecord.maturityDate)],
                      ['Expected Maturity Amount', money(selectedRecord.expectedMaturityAmount || selectedRecord.maturityAmount)],
                    ].map(([label, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={label}>
                        <Paper sx={{ p: 1.8, borderRadius: '14px', bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                          <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.78rem' }}>{label}</Typography>
                          <Typography sx={{ color: '#0B1F4D', fontWeight: 900, mt: .6 }}>{value ?? '-'}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <Button variant="contained" startIcon={<Download />} onClick={() => certificate(selectedRecord)} sx={{ ...primaryFdButtonSx, mt: 2.5 }}>
                    Download RD Certificate
                  </Button>
                </Paper>
              ) : (
                <Paper sx={{ p: 3.5, textAlign: 'center', borderRadius: '16px', bgcolor: '#fff', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: 800 }}>
                  Select an eligible RD account to download its certificate.
                </Paper>
              )}
            </Grid>
          </Grid>
        </SectionCard>
      );
    }
    return (
      <SectionCard title="Create Recurring Deposit" subtitle="Create an RD request using your linked account. The RD becomes active only after manager approval.">
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}><FDField label="Linked Account"><TextField select fullWidth value={form.linkedAccountId} onChange={(e) => { setPreview(null); setForm({ ...form, linkedAccountId: e.target.value }); }} SelectProps={{ displayEmpty: true }} sx={createFdFieldSx}><MenuItem value="" disabled>Select linked account</MenuItem>{accounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.accountNumber} - {account.accountType} - Balance {money(account.balance)}</MenuItem>)}</TextField></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Monthly Contribution"><TextField fullWidth type="number" value={form.amount} onChange={(e) => { setPreview(null); setForm({ ...form, amount: e.target.value }); }} helperText={`Minimum: ${money(rule?.minMonthlyAmount ?? rule?.minAmount ?? 0)} | Maximum: ${money(rule?.maxMonthlyAmount ?? rule?.maxAmount ?? 0)}`} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Interest Rate"><TextField fullWidth value={form.linkedAccountId ? `${fdRate || 0}% p.a.` : ''} placeholder="Auto-filled from RD rules" InputProps={{ readOnly: true }} helperText={form.linkedAccountId ? `${selectedClassification} classification rate` : 'Select linked account to view rate'} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Tenure"><TextField select fullWidth value={form.tenure} onChange={(e) => { setPreview(null); setForm({ ...form, tenure: e.target.value }); }} SelectProps={{ displayEmpty: true }} sx={createFdFieldSx}><MenuItem value="" disabled>Select tenure</MenuItem>{ruleTenures.map((tenure) => <MenuItem key={tenure} value={tenure}>{tenure} months</MenuItem>)}</TextField></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Start Date"><TextField fullWidth type="date" value={form.startDate} onChange={(e) => { setPreview(null); setForm({ ...form, startDate: e.target.value }); }} inputProps={{ min: todayDate }} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Monthly Debit Date"><TextField fullWidth value={liveRDPreview.monthlyDebitDate ? date(liveRDPreview.monthlyDebitDate) : ''} InputProps={{ readOnly: true }} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Maturity Date"><TextField fullWidth value={liveRDPreview.maturityDate ? date(liveRDPreview.maturityDate) : ''} InputProps={{ readOnly: true }} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12} md={6}><FDField label="Expected Maturity Amount"><TextField fullWidth value={liveRDPreview.maturityAmount ? money(liveRDPreview.maturityAmount) : ''} InputProps={{ readOnly: true }} sx={createFdFieldSx} /></FDField></Grid>
          <Grid item xs={12}><Paper sx={{ p: 2.2, borderRadius: '16px', border: '1px solid #cbd5e1', bgcolor: '#f8fbff', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>{[['Total Deposited', money(liveRDPreview.totalDepositedAmount), '#0B1F4D'], ['Interest Earned', money(liveRDPreview.interestEarned), '#16a34a'], ['Expected Maturity Amount', money(liveRDPreview.maturityAmount), '#2563eb']].map(([label, value, color]) => <Box key={label}><Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.82rem' }}>{label}</Typography><Typography sx={{ color, fontWeight: 900, fontSize: '1.3rem', mt: .5 }}>{value}</Typography></Box>)}</Paper></Grid>
          <Grid item xs={12} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '160px minmax(190px, 1fr) minmax(230px, 1.25fr)' }, gap: 1.8 }}><Button variant="outlined" onClick={resetFDForm} disabled={submitLoading} sx={{ color: '#0B1F4D', borderColor: '#cbd5e1', borderRadius: '12px', py: 1.2, fontWeight: 900 }}>Reset</Button><Button variant="contained" startIcon={<Calculate />} onClick={() => calculate(form)} disabled={submitLoading} sx={primaryFdButtonSx}>Calculate</Button><Button variant="contained" startIcon={submitLoading ? <CircularProgress size={18} color="inherit" /> : <Send />} onClick={submitCreate} disabled={submitLoading} sx={primaryFdButtonSx}>{submitLoading ? 'Submitting...' : 'Submit RD Request'}</Button></Grid>
        </Grid>
      </SectionCard>
    );
  };

  return (
    <Box sx={{ color: '#fff', width: '100%', overflowX: 'hidden' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 900 }}>Recurring Deposits</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,.55)' }}>Create, calculate, track, withdraw, renew, and download RD certificates.</Typography>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {rdActions.map((item) => (
          <Grid item xs={12} sm={6} md={4} xl={2} key={item.key}>
            <Button fullWidth startIcon={item.icon} onClick={() => { setActiveSection(item.key); setPreview(null); }} sx={fdActionSx(activeSection === item.key)}>{item.label}</Button>
          </Grid>
        ))}
      </Grid>
      {renderRDSection()}
      <Dialog open={Boolean(fdSubmitDialog)} onClose={() => setFdSubmitDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #dbe3ef', boxShadow: '0 24px 60px rgba(15,23,42,.24)' } }}>
        <DialogTitle sx={{ color: '#0B1F4D', fontWeight: 900, pb: 1 }}>RD Request Submitted</DialogTitle>
        <DialogContent><Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>RD request submitted successfully. Please wait for manager approval.</Alert><Paper sx={{ p: 2.25, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px' }}><Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>{fdSubmitDialog?.rdId || 'RD Request'}</Typography><Typography sx={{ color: '#475569', mt: .8, lineHeight: 1.7 }}>Once approved, monthly auto-debit will start from your linked account.</Typography></Paper></DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}><Button variant="contained" onClick={() => setFdSubmitDialog(null)} sx={{ bgcolor: '#1D4ED8', borderRadius: '12px', px: 3, fontWeight: 900, '&:hover': { bgcolor: '#0B1F4D' } }}>OK</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(message || error)} autoHideDuration={3500} onClose={() => { setMessage(''); setError(''); }}>
        <Alert severity={error ? 'error' : 'success'}>{error || message}</Alert>
      </Snackbar>
    </Box>
  );

  return (
    <Box sx={{ color: '#fff', width: '100%', overflowX: 'hidden' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 900 }}>{title}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,.55)' }}>Manage {isFD ? 'fixed deposits, maturity instructions, certificates, and withdrawal requests.' : 'monthly deposits, auto-debits, installments, and closure requests.'}</Typography>
      </Box>

      <Grid container spacing={2.2} sx={{ mb: 3 }}>
        {[
          { label: isFD ? 'Create New FD' : 'Create New RD', icon: <Savings />, action: () => setOpen('create') },
          { label: `${type} Calculator`, icon: <Calculate />, action: () => setOpen('calculator') },
          { label: `My ${type} Accounts`, icon: <AccountBalance />, action: () => setOpen('accounts') },
          { label: isFD ? 'Premature Withdrawal' : 'Premature Closure', icon: <PendingActions />, action: () => setOpen('request') },
          ...(isFD ? [
            { label: 'Renewal Instructions', icon: <Settings />, action: () => setOpen('renewal') },
            { label: 'FD Certificates', icon: <Download />, action: () => setOpen('certificates') },
          ] : [
            { label: 'Installment Tracking', icon: <TrackChanges />, action: () => setOpen('installmentsList') },
          ]),
        ].map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.label}>
            <Button fullWidth startIcon={item.icon} onClick={item.action} sx={actionButtonSx}>{item.label}</Button>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ bgcolor: '#fff', borderRadius: '18px', boxShadow: '0 12px 34px rgba(15,23,42,.14)' }}>
        <CardContent>
          <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.1rem', mb: 2 }}>My {type} Accounts</Typography>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 980 }} size="small">
              <TableHead><TableRow sx={{ bgcolor: '#0B1F4D' }}>
                {(isFD ? ['ID', 'Linked Account', 'Amount', 'Rate', 'Tenure', 'Start', 'Maturity', 'Maturity Amount', 'Auto Renewal', 'Status', 'Action'] : ['ID', 'Monthly Contribution', 'Linked Account', 'Rate', 'Tenure', 'Paid', 'Missed', 'Maturity', 'Expected Amount', 'Status', 'Action']).map((head) => (
                  <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>{head}</TableCell>
                ))}
              </TableRow></TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id} sx={{ '& td': { color: '#334155', borderColor: '#e2e8f0', py: 1.4 }, '&:hover': { bgcolor: '#eff6ff' } }}>
                    {isFD ? (
                      <>
                        <TableCell sx={{ fontWeight: 900 }}>{row.fdId}</TableCell>
                        <TableCell>{row.linkedAccountNumber}</TableCell>
                        <TableCell>{money(row.depositAmount)}</TableCell>
                        <TableCell>{row.interestRate}%</TableCell>
                        <TableCell>{row.tenure} mo</TableCell>
                        <TableCell>{date(row.startDate)}</TableCell>
                        <TableCell>{date(row.maturityDate)}</TableCell>
                        <TableCell>{money(row.maturityAmount)}</TableCell>
                        <TableCell>{row.autoRenewal ? 'ON' : 'OFF'}</TableCell>
                        <TableCell><Chip size="small" label={row.status} sx={statusSx(row.status)} /></TableCell>
                        <TableCell><Button size="small" disabled={row.status !== 'Active'} onClick={() => certificate(row)} startIcon={<Download />}>Certificate</Button></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell sx={{ fontWeight: 900 }}>{row.rdId}</TableCell>
                        <TableCell>{money(row.monthlyContribution)}</TableCell>
                        <TableCell>{row.linkedAccountNumber}</TableCell>
                        <TableCell>{row.interestRate}%</TableCell>
                        <TableCell>{row.tenure} mo</TableCell>
                        <TableCell>{row.installmentsPaid}</TableCell>
                        <TableCell>{row.missedInstallments}</TableCell>
                        <TableCell>{date(row.maturityDate)}</TableCell>
                        <TableCell>{money(row.expectedMaturityAmount)}</TableCell>
                        <TableCell><Chip size="small" label={row.status} sx={statusSx(row.status)} /></TableCell>
                        <TableCell><Button size="small" onClick={() => openInstallments(row)} startIcon={<History />}>Installments</Button></TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={11} align="center" sx={{ color: '#64748b', py: 6 }}>No {type} records found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={['create', 'calculator'].includes(open)} onClose={() => setOpen('')} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: '#fff', borderRadius: '18px' } }}>
        <DialogTitle sx={{ color: '#0B1F4D', fontWeight: 900 }}>{open === 'create' ? `Create New ${type}` : `${type} Calculator`}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2.2} sx={{ mt: 0.5 }}>
            {open === 'create' && (
              <Grid item xs={12}>
                <TextField select fullWidth label="Linked Account" value={form.linkedAccountId} onChange={(e) => setForm({ ...form, linkedAccountId: e.target.value })} sx={fieldSx}>
                  {accounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.accountType} - {account.accountNumber} ({money(account.balance)})</MenuItem>)}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={isFD ? 'Deposit Amount' : 'Monthly Contribution'} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField select fullWidth label="Tenure" value={form.tenure} onChange={(e) => setForm({ ...form, tenure: e.target.value })} sx={fieldSx}>
                {ruleTenures.map((tenure) => <MenuItem key={tenure} value={tenure}>{tenure} months</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" startIcon={<Calculate />} onClick={() => calculate()} sx={{ bgcolor: '#0B1F4D', borderRadius: '12px', fontWeight: 900 }}>Calculate Returns</Button>
            </Grid>
            {preview && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px' }}>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>Interest Rate: {preview.interestRate}% p.a.</Typography>
                  <Typography sx={{ color: '#334155', mt: 0.7 }}>Maturity Date: {date(preview.maturityDate)}</Typography>
                  <Typography sx={{ color: '#334155' }}>{isFD ? 'Interest Earned' : 'Expected Interest'}: {money(preview.accruedInterest)}</Typography>
                  <Typography sx={{ color: '#0B1F4D', fontWeight: 900 }}>{isFD ? 'Final Maturity Amount' : 'Expected Maturity Amount'}: {money(preview.maturityAmount || preview.expectedMaturityAmount)}</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpen('')}>Cancel</Button>
          {open === 'create' && <Button variant="contained" startIcon={submitLoading ? <CircularProgress size={18} color="inherit" /> : <Send />} disabled={submitLoading} onClick={submitCreate} sx={{ bgcolor: '#0B1F4D', borderRadius: '12px', fontWeight: 900 }}>{submitLoading ? 'Submitting...' : 'Submit for Approval'}</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={['request', 'renewal', 'certificates', 'installmentsList'].includes(open)} onClose={() => setOpen('')} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#fff', borderRadius: '18px' } }}>
        <DialogTitle sx={{ color: '#0B1F4D', fontWeight: 900 }}>{open === 'request' ? (isFD ? 'Premature Withdrawal' : 'Premature Closure') : open === 'renewal' ? 'Renewal Instructions' : open === 'certificates' ? 'FD Certificates' : 'Installment Tracking'}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label={`Select ${type}`} value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ ...fieldSx, mt: 1 }}>
            {records.map((record) => <MenuItem key={record._id} value={record._id}>{isFD ? record.fdId : record.rdId} - {record.status}</MenuItem>)}
          </TextField>
          {open === 'request' && <TextField fullWidth multiline minRows={3} label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} sx={{ ...fieldSx, mt: 2 }} />}
          {open === 'renewal' && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField select fullWidth label="Auto Renewal" value={form.autoRenewal ? 'on' : 'off'} onChange={(e) => setForm({ ...form, autoRenewal: e.target.value === 'on' })} sx={fieldSx}><MenuItem value="on">ON</MenuItem><MenuItem value="off">OFF</MenuItem></TextField></Grid>
              <Grid item xs={12}><TextField select fullWidth label="Maturity Instruction" value={form.maturityInstruction} onChange={(e) => setForm({ ...form, maturityInstruction: e.target.value })} sx={fieldSx}>{['Credit to linked account', 'Renew principal only', 'Renew principal + interest'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Grid>
            </Grid>
          )}
          {open === 'certificates' && selectedRecord && <Button sx={{ mt: 2 }} startIcon={<Download />} onClick={() => certificate(selectedRecord)}>Download Certificate</Button>}
          {open === 'installmentsList' && selectedRecord && <Button sx={{ mt: 2 }} startIcon={<History />} onClick={() => openInstallments(selectedRecord)}>View Installments</Button>}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpen('')}>Close</Button>
          {open === 'request' && <Button variant="contained" disabled={requestLoading} onClick={submitRequest} sx={{ bgcolor: '#0B1F4D' }}>{requestLoading ? 'Submitting...' : 'Submit Request'}</Button>}
          {open === 'renewal' && <Button variant="contained" onClick={updateRenewal} sx={{ bgcolor: '#0B1F4D' }}>Save Instructions</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={open === 'installments'} onClose={() => setOpen('')} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: '#fff', borderRadius: '18px' } }}>
        <DialogTitle sx={{ color: '#0B1F4D', fontWeight: 900 }}>RD Installment History</DialogTitle>
        <DialogContent>
          <TableContainer><Table size="small"><TableHead><TableRow>{['No', 'Due Date', 'Paid Date', 'Amount', 'Penalty', 'Status'].map((h) => <TableCell key={h} sx={{ fontWeight: 900 }}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{installments.map((item) => <TableRow key={item._id || item.installmentNo}><TableCell>{item.installmentNo}</TableCell><TableCell>{date(item.dueDate)}</TableCell><TableCell>{date(item.paidDate)}</TableCell><TableCell>{money(item.amount)}</TableCell><TableCell>{money(item.penalty)}</TableCell><TableCell>{item.status}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        </DialogContent>
      </Dialog>

      <Snackbar open={Boolean(message || error)} autoHideDuration={3500} onClose={() => { setMessage(''); setError(''); }}>
        <Alert severity={error ? 'error' : 'success'}>{error || message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomerInvestments;

