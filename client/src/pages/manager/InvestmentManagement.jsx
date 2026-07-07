import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, MenuItem, Paper, Snackbar, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Autorenew, CalendarMonth, CheckCircle, Close, MonetizationOn,
  Refresh, Savings, Search, TrendingUp, Visibility,
} from '@mui/icons-material';
import { investmentAPI } from '../../services/api';

const navy = '#0B1F4D';
const blue = '#2563EB';
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const iso = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const now = new Date();
const penaltyAppliedLabel = (rate, ruleName) => `${Number(rate || 0)}% (2x applied as per ${ruleName})`;

const statusSx = (status = '') => {
  const key = String(status).toLowerCase();
  if (['active', 'approved', 'paid', 'matured'].includes(key)) return { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 900 };
  if (['pending', 'pending manager approval'].includes(key)) return { bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 900 };
  if (['rejected', 'failed', 'missed', 'premature closed'].includes(key)) return { bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 900 };
  return { bgcolor: '#e5e7eb', color: '#475569', fontWeight: 900 };
};

const getRateForClassification = (rule, classification) => {
  const rates = rule?.classificationInterestRates || [];
  const match = rates.find((item) => String(item.classificationName || item.classification || '').toUpperCase() === String(classification || '').toUpperCase());
  return Number(match?.interestRate ?? rates[0]?.interestRate ?? 0);
};

const uniqueById = (rows = []) => Array.from(new Map(rows.map((row) => [String(row._id), row])).values());
const requestCalculation = (row) => row?.prematureWithdrawalRequest?.calculationBreakdown || row?.prematureClosureRequest?.calculationBreakdown || null;
const calculationRows = (row) => {
  const calc = requestCalculation(row);
  if (!calc) return [];
  const isRDCalc = calc.productType === 'RD';
  return [
    ['FD/RD ID', calc.fdId || calc.rdId || row.fdId || row.rdId],
    [isRDCalc ? 'Total Deposited Amount Till Date' : 'Principal Amount', money(calc.totalDepositedAmount ?? calc.principalAmount ?? calc.depositAmount)],
    ['Start Date', date(calc.startDate)],
    ['Withdrawal Request Date', date(calc.withdrawalRequestDate)],
    ['Completed Period', calc.completedPeriod || '-'],
    ['Interest Rate', `${calc.interestRate || 0}%`],
    ['Actual Accrued Interest Till Date', money(calc.actualAccruedInterest ?? calc.accruedInterest)],
    ['Admin Penalty Rate', `${calc.adminPenaltyRate || 0}%`],
    ['Applied Penalty Rate 2x', `${calc.appliedPenaltyRate || 0}%`],
    ['Penalty Amount', money(calc.penaltyAmount)],
    ['Revised Payout Amount', money(calc.revisedPayoutAmount)],
    ['Reason', calc.reason || row.prematureWithdrawalRequest?.reason || row.prematureClosureRequest?.reason || '-'],
  ];
};

const KpiCard = ({ label, value, icon, color }) => (
  <Paper sx={{ p: 2.25, bgcolor: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 12px 30px rgba(15,23,42,.1)' }}>
    <Box sx={{ width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: '14px', bgcolor: `${color}16`, color, mb: 1.4 }}>
      {icon}
    </Box>
    <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.82rem' }}>{label}</Typography>
    <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.35rem', mt: .5 }}>{value}</Typography>
  </Paper>
);

const FilterBar = ({ filters, setFilters, onReset }) => (
  <Paper sx={{ p: 2.2, mb: 2.4, bgcolor: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 12px 30px rgba(15,23,42,.08)' }}>
    <Grid container spacing={2} alignItems="end">
      <Grid item xs={12} md={5}>
        <Typography sx={{ color: navy, fontWeight: 900, mb: .8 }}>Search</Typography>
        <TextField
          fullWidth
          placeholder="Customer name, customer ID, account number, FD/RD ID"
          value={filters.search}
          onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value, page: 1 }))}
          InputProps={{ startAdornment: <Search sx={{ color: '#64748b', mr: 1 }} /> }}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: navy, borderRadius: '13px', minHeight: 52 } }}
        />
      </Grid>
      <Grid item xs={12} sm={4} md={2}>
        <Typography sx={{ color: navy, fontWeight: 900, mb: .8 }}>Status</Typography>
        <TextField
          select
          fullWidth
          value={filters.status}
          onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value, page: 1 }))}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: navy, borderRadius: '13px', minHeight: 52 } }}
        >
          {['All', 'Pending', 'Approved', 'Rejected'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={4} md={2}>
        <Typography sx={{ color: navy, fontWeight: 900, mb: .8 }}>Start Date</Typography>
        <TextField type="date" fullWidth value={filters.startDate} onChange={(e) => setFilters((current) => ({ ...current, startDate: e.target.value, page: 1 }))} sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: navy, borderRadius: '13px', minHeight: 52 } }} />
      </Grid>
      <Grid item xs={12} sm={4} md={2}>
        <Typography sx={{ color: navy, fontWeight: 900, mb: .8 }}>End Date</Typography>
        <TextField type="date" fullWidth value={filters.endDate} onChange={(e) => setFilters((current) => ({ ...current, endDate: e.target.value, page: 1 }))} sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: navy, borderRadius: '13px', minHeight: 52 } }} />
      </Grid>
      <Grid item xs={12} md={1}>
        <Button fullWidth onClick={onReset} sx={{ minHeight: 52, borderRadius: '13px', color: navy, border: '1px solid #cbd5e1', fontWeight: 900 }}>Reset</Button>
      </Grid>
    </Grid>
  </Paper>
);

const InvestmentManagement = ({ type = 'FD' }) => {
  const isFD = type === 'FD';
  const [queue, setQueue] = useState({});
  const [monitoring, setMonitoring] = useState({ fds: [], rds: [] });
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState(isFD ? 'requests' : 'rdRequests');
  const [filters, setFilters] = useState({ search: '', status: 'All', startDate: '', endDate: '', page: 1 });
  const [modal, setModal] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const pageSize = 10;

  const load = async () => {
    try {
      const [queueRes, monitorRes, bootstrapRes] = await Promise.all([
        investmentAPI.getManagerQueue(),
        investmentAPI.getManagerMonitoring(),
        investmentAPI.getBootstrap(),
      ]);
      setQueue(queueRes.data || {});
      setMonitoring(monitorRes.data || { fds: [], rds: [] });
      setRules(bootstrapRes.data?.rules || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load investments management.');
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    setActiveTab(isFD ? 'requests' : 'rdRequests');
    setFilters({ search: '', status: 'All', startDate: '', endDate: '', page: 1 });
  }, [isFD]);

  const fdRule = useMemo(() => rules.find((item) => item.type === 'FD'), [rules]);
  const rdRule = useMemo(() => rules.find((item) => item.type === 'RD'), [rules]);
  const fds = monitoring.fds || [];
  const rds = monitoring.rds || [];

  const kpis = useMemo(() => {
    if (isFD) {
      const maturityThisMonth = fds.filter((fd) => {
        const d = new Date(fd.maturityDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      return [
        ['Total FD Accounts', fds.length, <Savings />, '#2563eb'],
        ['Total FD Amount', money(fds.reduce((sum, fd) => sum + Number(fd.depositAmount || 0), 0)), <AccountBalance />, '#16a34a'],
        ['Total Interest Earned', money(fds.reduce((sum, fd) => sum + Number(fd.interestEarned || fd.accruedInterest || 0), 0)), <MonetizationOn />, '#f97316'],
        ['Maturity This Month', maturityThisMonth, <CalendarMonth />, '#7c3aed'],
      ];
    }
    const missed = rds.reduce((sum, rd) => sum + Number(rd.missedInstallments || 0), 0);
    return [
      ['Total RD Accounts', rds.length, <Autorenew />, '#2563eb'],
      ['Monthly RD Amount', money(rds.reduce((sum, rd) => sum + Number(rd.monthlyContribution || 0), 0)), <AccountBalance />, '#16a34a'],
      ['Missed Installments', missed, <CalendarMonth />, '#dc2626'],
      ['Matured RD Accounts', rds.filter((rd) => rd.status === 'Matured').length, <TrendingUp />, '#7c3aed'],
    ];
  }, [fds, rds, isFD]);

  const tabs = isFD
    ? [
      ['requests', 'FD Requests'],
      ['active', 'Active FD Accounts'],
      ['matured', 'Matured FD Accounts'],
      ['withdrawals', 'Premature Withdrawal Requests'],
      ['renewals', 'FD Renewal Requests'],
    ]
    : [
      ['rdRequests', 'RD Requests'],
      ['rdActive', 'Active RD Accounts'],
      ['rdMatured', 'Matured RD Accounts'],
      ['rdClosures', 'Premature Withdrawal Requests'],
      ['rdRenewals', 'RD Renewal Requests'],
    ];

  const tabConfig = useMemo(() => {
    const fdRenewals = fds.filter((fd) => fd.renewalRequest?.requested || fd.renewalRequest?.status === 'Pending');
    const fdWithdrawals = fds.filter((fd) => fd.prematureWithdrawalRequest?.requested || fd.prematureWithdrawalRequest?.status === 'Pending');
    const rdClosures = rds.filter((rd) => rd.prematureClosureRequest?.requested || rd.prematureClosureRequest?.status === 'Pending');
    const rdRenewals = rds.filter((rd) => rd.renewalRequest?.requested || rd.renewalRequest?.status === 'Pending');
    const rdMissed = rds.filter((rd) => Number(rd.missedInstallments || 0) > 0 || (rd.installmentHistory || []).some((item) => ['Missed', 'Failed'].includes(item.status)));
    return {
      requests: { rows: uniqueById([...(queue.pendingFDs || []), ...fds.filter((fd) => fd.status === 'Pending')]), kind: 'fd', dateField: 'createdAt' },
      active: { rows: fds.filter((fd) => fd.status === 'Active'), kind: 'view', dateField: 'maturityDate' },
      matured: { rows: fds.filter((fd) => ['Matured', 'Closed', 'Renewed'].includes(fd.status)), kind: 'view', dateField: 'maturityDate' },
      withdrawals: { rows: uniqueById([...(queue.fdWithdrawals || []), ...fdWithdrawals]), kind: 'fdWithdrawal', dateField: 'prematureWithdrawalRequest.requestedAt' },
      renewals: { rows: uniqueById([...(queue.fdRenewals || []), ...fdRenewals]), kind: 'fdRenewal', dateField: 'renewalRequest.requestedAt' },
      rdRequests: { rows: uniqueById([...(queue.pendingRDs || []), ...rds.filter((rd) => rd.status === 'Pending')]), kind: 'rd', dateField: 'createdAt' },
      rdActive: { rows: rds.filter((rd) => rd.status === 'Active'), kind: 'view', dateField: 'maturityDate' },
      missed: { rows: rdMissed.length ? rdMissed : (queue.missedRDs || []), kind: 'view', dateField: 'updatedAt' },
      rdClosures: { rows: uniqueById([...(queue.rdClosures || []), ...rdClosures]), kind: 'rdClosure', dateField: 'prematureClosureRequest.requestedAt' },
      rdMatured: { rows: rds.filter((rd) => ['Matured', 'Closed', 'Renewed'].includes(rd.status)), kind: 'view', dateField: 'maturityDate' },
      rdRenewals: { rows: uniqueById([...(queue.rdRenewals || []), ...rdRenewals]), kind: 'rdRenewal', dateField: 'renewalRequest.requestedAt' },
    };
  }, [fds, rds, queue]);

  const readPath = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
  const rowStatus = (row, tab) => {
    if (tab === 'withdrawals') return row.prematureWithdrawalRequest?.status || 'Pending';
    if (tab === 'renewals') return row.renewalRequest?.status || 'Pending';
    if (tab === 'rdClosures') return row.prematureClosureRequest?.status || 'Pending';
    if (tab === 'rdRenewals') return row.renewalRequest?.status || 'Pending';
    return row.status || row.managerApprovalStatus || '-';
  };
  const rowDate = (row, tab) => readPath(row, tabConfig[tab]?.dateField || 'createdAt') || row.createdAt || row.updatedAt;
  const searchText = (row) => [
    row.customerName, row.customerId, row.linkedAccountNumber, row.fdId, row.rdId,
  ].join(' ').toLowerCase();

  const filteredRows = useMemo(() => {
    const source = tabConfig[activeTab]?.rows || [];
    return source.filter((row) => {
      const searchOk = !filters.search || searchText(row).includes(filters.search.toLowerCase());
      const status = String(rowStatus(row, activeTab)).toLowerCase();
      const statusOk = filters.status === 'All'
        || (filters.status === 'Approved' ? ['approved', 'active', 'matured', 'closed'].includes(status) : status === filters.status.toLowerCase());
      const d = iso(rowDate(row, activeTab));
      const startOk = !filters.startDate || (d && d >= filters.startDate);
      const endOk = !filters.endDate || (d && d <= filters.endDate);
      return searchOk && statusOk && startOk && endOk;
    });
  }, [tabConfig, activeTab, filters]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((filters.page - 1) * pageSize, filters.page * pageSize);

  const openModal = (mode, kind, row) => {
    setModal({ mode, kind, row });
    setRemarks('');
  };

  const decide = async () => {
    if (decisionLoading || !modal) return;
    setDecisionLoading(true);
    try {
      const payload = { action: modal.mode, remarks };
      const calls = {
        fd: () => investmentAPI.decideFD(modal.row._id, payload),
        fdWithdrawal: () => investmentAPI.decideFDWithdrawal(modal.row._id, payload),
        fdRenewal: () => investmentAPI.decideFDRenewal(modal.row._id, payload),
        rd: () => investmentAPI.decideRD(modal.row._id, payload),
        rdClosure: () => investmentAPI.decideRDClosure(modal.row._id, payload),
        rdRenewal: () => investmentAPI.decideRDRenewal(modal.row._id, payload),
      };
      const res = await calls[modal.kind]();
      const updated = res.data.fd || res.data.rd || res.data.loan || res.data.application;
      if (updated?._id) {
        setMonitoring((current) => ({
          fds: (current.fds || []).map((item) => (item._id === updated._id ? { ...item, ...updated } : item)),
          rds: (current.rds || []).map((item) => (item._id === updated._id ? { ...item, ...updated } : item)),
        }));
        setQueue((current) => Object.fromEntries(Object.entries(current || {}).map(([key, rows]) => [
          key,
          Array.isArray(rows) ? rows.filter((item) => item._id !== updated._id) : rows,
        ])));
      }
      setNotice(res.data.message);
      setModal(null);
      setRemarks('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const canDecide = (kind, row, tab) => kind !== 'view' && String(rowStatus(row, tab)).toLowerCase().includes('pending');
  const newRate = (row) => getRateForClassification(row.rdId ? rdRule : fdRule, row.classification);

  const columns = {
    requests: [
      ['Request ID', (r) => r.fdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId],
      ['Linked Account', (r) => r.linkedAccountNumber], ['FD Amount', (r) => money(r.depositAmount)], ['Interest Rate', (r) => `${r.interestRate}%`],
      ['Tenure', (r) => `${r.tenure} mo`], ['Maturity Date', (r) => date(r.maturityDate)], ['Request Date', (r) => date(r.createdAt)],
    ],
    active: [
      ['FD ID', (r) => r.fdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['Linked Account', (r) => r.linkedAccountNumber],
      ['FD Amount', (r) => money(r.depositAmount)], ['Interest Rate', (r) => `${r.interestRate}%`], ['Start Date', (r) => date(r.startDate)],
      ['Maturity Date', (r) => date(r.maturityDate)], ['Maturity Amount', (r) => money(r.maturityAmount)],
    ],
    matured: [
      ['FD ID', (r) => r.fdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['FD Amount', (r) => money(r.depositAmount)],
      ['Maturity Date', (r) => date(r.maturityDate)], ['Maturity Amount', (r) => money(r.maturityAmount)], ['Renewals', (r) => r.renewalHistory?.length || 0],
    ],
    withdrawals: [
      ['Customer Name', (r) => r.prematureWithdrawalRequest?.customerName || r.customerName], ['Customer ID', (r) => r.prematureWithdrawalRequest?.customerId || r.customerId],
      ['FD ID', (r) => r.prematureWithdrawalRequest?.fdId || r.fdId], ['Linked Account', (r) => r.prematureWithdrawalRequest?.linkedAccountNumber || r.linkedAccountNumber],
      ['Deposit Amount', (r) => money(r.prematureWithdrawalRequest?.depositAmount || r.depositAmount)], ['Accrued Interest', (r) => money(r.prematureWithdrawalRequest?.accruedInterest || r.interestEarned || r.accruedInterest)],
      ['Penalty Applied', (r) => penaltyAppliedLabel(r.prematureWithdrawalRequest?.penaltyRate ?? 0, 'premature withdrawal rule')], ['Penalty Amount', (r) => money(r.prematureWithdrawalRequest?.penaltyAmount || r.penaltyAmount)],
      ['Revised Payout', (r) => money(r.prematureWithdrawalRequest?.revisedPayoutAmount || r.revisedPayoutAmount)], ['Reason', (r) => r.prematureWithdrawalRequest?.reason || '-'],
      ['Request Date', (r) => date(r.prematureWithdrawalRequest?.requestedAt)], ['Manager Remarks', (r) => r.prematureWithdrawalRequest?.managerRemarks || '-'],
    ],
    renewals: [
      ['Customer Name', (r) => r.renewalRequest?.customerName || r.customerName], ['Customer ID', (r) => r.renewalRequest?.customerId || r.customerId],
      ['FD ID', (r) => r.renewalRequest?.fdId || r.fdId], ['Amount', (r) => money(r.renewalRequest?.depositAmount || r.depositAmount)],
      ['Interest Rate', (r) => `${r.renewalRequest?.interestRate ?? r.interestRate}%`], ['Tenure', (r) => `${r.renewalRequest?.tenure || r.tenure} mo`],
      ['Maturity Date', (r) => date(r.renewalRequest?.oldMaturityDate || r.maturityDate)], ['Maturity Amount', (r) => money(r.renewalRequest?.maturityAmount || r.maturityAmount)],
      ['New Rate', (r) => `${newRate(r)}%`], ['Request Date', (r) => date(r.renewalRequest?.requestedAt)],
    ],
    rdRequests: [
      ['Request ID', (r) => r.rdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['Linked Account', (r) => r.linkedAccountNumber],
      ['Monthly Amount', (r) => money(r.monthlyContribution)], ['Interest Rate', (r) => `${r.interestRate}%`], ['Tenure', (r) => `${r.tenure} mo`],
      ['Maturity Date', (r) => date(r.maturityDate)], ['Request Date', (r) => date(r.createdAt)],
    ],
    rdActive: [
      ['RD ID', (r) => r.rdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['Monthly Amount', (r) => money(r.monthlyContribution)],
      ['Paid', (r) => r.installmentsPaid], ['Missed', (r) => r.missedInstallments], ['Maturity Date', (r) => date(r.maturityDate)], ['Expected Amount', (r) => money(r.expectedMaturityAmount)],
    ],
    missed: [
      ['RD ID', (r) => r.rdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['Linked Account', (r) => r.linkedAccountNumber],
      ['Monthly Amount', (r) => money(r.monthlyContribution)], ['Missed Installments', (r) => r.missedInstallments || (r.installmentHistory || []).filter((i) => ['Missed', 'Failed'].includes(i.status)).length],
      ['Last Updated', (r) => date(r.updatedAt)],
    ],
    rdClosures: [
      ['Customer Name', (r) => r.prematureClosureRequest?.customerName || r.customerName], ['Customer ID', (r) => r.prematureClosureRequest?.customerId || r.customerId],
      ['RD ID', (r) => r.prematureClosureRequest?.rdId || r.rdId], ['Linked Account', (r) => r.prematureClosureRequest?.linkedAccountNumber || r.linkedAccountNumber],
      ['Deposit Amount', (r) => money(r.prematureClosureRequest?.depositAmount || (r.installmentsPaid || 0) * (r.monthlyContribution || 0))], ['Accrued Interest', (r) => money(r.prematureClosureRequest?.accruedInterest || r.interestEarned)],
      ['Penalty Applied', (r) => penaltyAppliedLabel(r.prematureClosureRequest?.penaltyRate ?? 0, 'premature closure rule')], ['Penalty Amount', (r) => money(r.prematureClosureRequest?.penaltyAmount || r.penaltyAmount)],
      ['Revised Payout', (r) => money(r.prematureClosureRequest?.revisedPayoutAmount || r.revisedPayoutAmount)], ['Reason', (r) => r.prematureClosureRequest?.reason || '-'],
      ['Request Date', (r) => date(r.prematureClosureRequest?.requestedAt)], ['Manager Remarks', (r) => r.prematureClosureRequest?.managerRemarks || '-'],
    ],
    rdMatured: [
      ['RD ID', (r) => r.rdId], ['Customer Name', (r) => r.customerName], ['Customer ID', (r) => r.customerId], ['Monthly Amount', (r) => money(r.monthlyContribution)],
      ['Maturity Date', (r) => date(r.maturityDate)], ['Expected Amount', (r) => money(r.expectedMaturityAmount || r.maturityAmount)], ['Renewals', (r) => r.renewalHistory?.length || 0],
    ],
    rdRenewals: [
      ['Customer Name', (r) => r.renewalRequest?.customerName || r.customerName], ['Customer ID', (r) => r.renewalRequest?.customerId || r.customerId],
      ['RD ID', (r) => r.renewalRequest?.rdId || r.rdId], ['Amount', (r) => money(r.renewalRequest?.monthlyContribution || r.monthlyContribution)],
      ['Interest Rate', (r) => `${r.renewalRequest?.interestRate ?? r.interestRate}%`], ['Tenure', (r) => `${r.renewalRequest?.tenure || r.tenure} mo`],
      ['Maturity Date', (r) => date(r.renewalRequest?.oldMaturityDate || r.maturityDate)], ['Maturity Amount', (r) => money(r.renewalRequest?.expectedMaturityAmount || r.expectedMaturityAmount || r.maturityAmount)],
      ['New Rate', (r) => `${newRate(r)}%`], ['Request Date', (r) => date(r.renewalRequest?.requestedAt)],
    ],
  };

  const currentColumns = columns[activeTab] || columns.requests;
  const currentKind = tabConfig[activeTab]?.kind || 'view';

  return (
    <Box sx={{ color: '#0f172a' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 900 }}>Investments Management - {type}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.62)' }}>
            {isFD ? 'Manage Fixed Deposit requests and accounts created by customers.' : 'Manage Recurring Deposit requests, installments, and accounts created by customers.'}
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load} sx={{ bgcolor: '#fff', color: navy, borderRadius: '12px', px: 2.4, fontWeight: 900 }}>Refresh</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2.4 }}>
        {kpis.map(([label, value, icon, color]) => <Grid item xs={12} sm={6} md={3} key={label}><KpiCard label={label} value={value} icon={icon} color={color} /></Grid>)}
      </Grid>

      <Card sx={{ bgcolor: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(15,23,42,.12)', overflow: 'hidden' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', mb: 2.4 }}>
            {tabs.map(([key, label]) => (
              <Button
                key={key}
                onClick={() => { setActiveTab(key); setFilters((current) => ({ ...current, page: 1 })); }}
                sx={{
                  bgcolor: activeTab === key ? blue : '#f8fafc',
                  color: activeTab === key ? '#fff' : navy,
                  border: '1px solid',
                  borderColor: activeTab === key ? blue : '#dbe3ef',
                  borderRadius: '12px',
                  px: 2,
                  py: 1,
                  fontWeight: 900,
                  boxShadow: activeTab === key ? '0 10px 22px rgba(37,99,235,.24)' : 'none',
                }}
              >
                {label}
              </Button>
            ))}
          </Box>

          <FilterBar filters={filters} setFilters={setFilters} onReset={() => setFilters({ search: '', status: 'All', startDate: '', endDate: '', page: 1 })} />

          <TableContainer sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <Table size="small" sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: navy }}>
                  {currentColumns.map(([label]) => <TableCell key={label} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>{label}</TableCell>)}
                  <TableCell sx={{ color: '#fff', fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 900 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={`${activeTab}-${row._id}`} sx={{ '& td': { color: '#334155', py: 1.35, borderColor: '#e2e8f0' }, '&:hover': { bgcolor: '#eff6ff' } }}>
                    {currentColumns.map(([label, render]) => <TableCell key={label} sx={{ whiteSpace: label.includes('Reason') ? 'normal' : 'nowrap', maxWidth: label.includes('Reason') ? 220 : 'none' }}>{render(row)}</TableCell>)}
                    <TableCell><Chip size="small" label={rowStatus(row, activeTab)} sx={statusSx(rowStatus(row, activeTab))} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" disabled={decisionLoading} onClick={() => openModal('view', currentKind, row)} sx={{ color: navy }}><Visibility fontSize="small" /></IconButton>
                      {canDecide(currentKind, row, activeTab) && (
                        <>
                          <IconButton size="small" disabled={decisionLoading} onClick={() => openModal('approve', currentKind, row)} sx={{ color: '#16a34a' }}><CheckCircle fontSize="small" /></IconButton>
                          <IconButton size="small" disabled={decisionLoading} onClick={() => openModal('reject', currentKind, row)} sx={{ color: '#dc2626' }}><Close fontSize="small" /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {visibleRows.length === 0 && (
                  <TableRow><TableCell colSpan={currentColumns.length + 2} align="center" sx={{ color: '#64748b', py: 6, fontWeight: 800 }}>No records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography sx={{ color: '#64748b', fontWeight: 800 }}>Showing {visibleRows.length} of {filteredRows.length} records</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 900 }}>Previous</Button>
              <Button disabled={filters.page >= pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} sx={{ color: '#fff', bgcolor: navy, borderRadius: '10px', fontWeight: 900, '&:hover': { bgcolor: '#12336f' } }}>Next</Button>
              <Typography sx={{ color: navy, fontWeight: 900, alignSelf: 'center' }}>Page {filters.page} / {pages}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={Boolean(modal)} onClose={decisionLoading ? undefined : () => setModal(null)} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #dbe3ef' } }}>
        <DialogTitle sx={{ color: navy, fontWeight: 900 }}>
          {modal?.mode === 'view' ? 'View Investment Request' : modal?.mode === 'approve' ? 'Approve Request' : 'Reject Request'}
        </DialogTitle>
        <DialogContent>
          {modal?.row && (
            <Grid container spacing={1.6} sx={{ mt: .2 }}>
              {[
                ['Customer Name', modal.row.customerName],
                ['Customer ID', modal.row.customerId],
                ['Linked Account', modal.row.linkedAccountNumber],
                ['FD/RD ID', modal.row.fdId || modal.row.rdId],
                ['Amount', money(modal.row.depositAmount || modal.row.monthlyContribution || modal.row.revisedPayoutAmount)],
                ['Interest Rate', `${modal.row.interestRate || newRate(modal.row)}%`],
                ['Tenure', `${modal.row.tenure || '-'} months`],
                ['Maturity Date', date(modal.row.maturityDate)],
                ['Status', rowStatus(modal.row, activeTab)],
                ...(modal.row.prematureWithdrawalRequest?.requested ? [
                  ['Penalty Applied', penaltyAppliedLabel(modal.row.prematureWithdrawalRequest?.penaltyRate ?? 0, 'premature withdrawal rule')],
                  ['Penalty Amount', money(modal.row.prematureWithdrawalRequest?.penaltyAmount || modal.row.penaltyAmount)],
                  ['Revised Payout', money(modal.row.prematureWithdrawalRequest?.revisedPayoutAmount || modal.row.revisedPayoutAmount)],
                ] : []),
                ...(modal.row.prematureClosureRequest?.requested ? [
                  ['Penalty Applied', penaltyAppliedLabel(modal.row.prematureClosureRequest?.penaltyRate ?? 0, 'premature closure rule')],
                  ['Penalty Amount', money(modal.row.prematureClosureRequest?.penaltyAmount || modal.row.penaltyAmount)],
                  ['Revised Payout', money(modal.row.prematureClosureRequest?.revisedPayoutAmount || modal.row.revisedPayoutAmount)],
                ] : []),
              ].map(([label, value]) => (
                <Grid item xs={12} sm={6} md={4} key={label}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.76rem' }}>{label}</Typography>
                    <Typography sx={{ color: navy, fontWeight: 900, mt: .45 }}>{value || '-'}</Typography>
                  </Paper>
                </Grid>
              ))}
              {calculationRows(modal.row).length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, mt: 1, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px' }}>
                    <Typography sx={{ color: navy, fontWeight: 900, mb: 1.5 }}>Premature Withdrawal Calculation</Typography>
                    <Grid container spacing={1.2}>
                      {calculationRows(modal.row).map(([label, value]) => (
                        <Grid item xs={12} sm={6} md={4} key={label}>
                          <Paper sx={{ p: 1.25, bgcolor: '#fff', border: '1px solid #dbeafe', borderRadius: '10px' }}>
                            <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.72rem' }}>{label}</Typography>
                            <Typography sx={{ color: navy, fontWeight: 900, mt: .35 }}>{value || '-'}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Grid>
              )}
              {requestCalculation(modal.row)?.installmentBreakdown?.length > 0 && (
                <Grid item xs={12}>
                  <TableContainer sx={{ border: '1px solid #dbeafe', borderRadius: '12px', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead><TableRow>{['Installment', 'Paid Date', 'Amount', 'Days', 'Interest'].map((head) => <TableCell key={head} sx={{ fontWeight: 900 }}>{head}</TableCell>)}</TableRow></TableHead>
                      <TableBody>{requestCalculation(modal.row).installmentBreakdown.map((item) => (
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
              {modal.mode !== 'view' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Manager Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: navy, borderRadius: '13px' }, '& .MuiInputLabel-root': { color: '#475569' } }}
                  />
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setModal(null)} disabled={decisionLoading} sx={{ color: navy, fontWeight: 900 }}>Close</Button>
          {modal?.mode === 'approve' && <Button onClick={decide} disabled={decisionLoading} startIcon={decisionLoading ? <CircularProgress size={18} color="inherit" /> : undefined} variant="contained" sx={{ bgcolor: blue, borderRadius: '12px', fontWeight: 900, px: 3 }}>{decisionLoading ? 'Approving...' : 'Approve'}</Button>}
          {modal?.mode === 'reject' && <Button onClick={decide} disabled={decisionLoading} startIcon={decisionLoading ? <CircularProgress size={18} color="inherit" /> : undefined} variant="outlined" sx={{ color: '#dc2626', borderColor: '#fecaca', borderRadius: '12px', fontWeight: 900, px: 3 }}>{decisionLoading ? 'Rejecting...' : 'Reject'}</Button>}
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice || error)} autoHideDuration={3600} onClose={() => { setNotice(''); setError(''); }}>
        <Alert severity={error ? 'error' : 'success'}>{error || notice}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InvestmentManagement;
