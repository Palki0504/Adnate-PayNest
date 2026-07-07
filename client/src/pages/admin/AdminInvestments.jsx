import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  Autorenew,
  CheckCircle,
  Download,
  Edit,
  Percent,
  Rule,
  Savings,
  Search,
  Shield,
  WarningAmber,
} from '@mui/icons-material';
import { investmentAPI } from '../../services/api';

const navy = '#0B1F4D';
const blue = '#1D4ED8';
const brightBlue = '#2563EB';
const softBlue = '#EFF6FF';
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const fixedTenures = [6, 12, 24, 60];
const tenureLabel = (months) => ({ 6: '6 Months', 12: '1 Year', 24: '2 Years', 60: '5 Years' }[months] || `${months} Months`);

const pageSx = {
  bgcolor: '#f8fafc',
  mx: { xs: -2, sm: -3 },
  my: { xs: -2, sm: -3 },
  minHeight: 'calc(100vh - 64px)',
  p: { xs: 2, sm: 3 },
};

const cardSx = {
  bgcolor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  boxShadow: '0 16px 38px rgba(15,23,42,.08)',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: '12px',
    minHeight: 56,
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#93c5fd' },
    '&.Mui-focused fieldset': { borderColor: brightBlue },
    '&.Mui-disabled': { bgcolor: '#f8fafc' },
    '&.Mui-disabled fieldset': { borderColor: '#dbe3ef' },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': { color: '#0f172a', fontWeight: 800 },
  '& .MuiInputBase-input.Mui-disabled, & .MuiSelect-select.Mui-disabled': {
    WebkitTextFillColor: '#0f172a',
    color: '#0f172a',
  },
  '& .MuiInputLabel-root': { color: '#334155', fontWeight: 800, bgcolor: '#fff', px: .45 },
  '& .MuiInputLabel-root.Mui-disabled': { color: `${navy} !important` },
  '& .MuiInputLabel-root.Mui-focused': { color: brightBlue },
};

const ruleInputLabelProps = {
  shrink: true,
  sx: { color: navy, fontWeight: 900, bgcolor: '#fff', px: .45 },
};

const statusSx = (status) => {
  const map = {
    Pending: ['#ffedd5', '#c2410c', '#fdba74'],
    Active: ['#dcfce7', '#15803d', '#86efac'],
    Matured: ['#dbeafe', '#1d4ed8', '#93c5fd'],
    'Premature Closed': ['#f3e8ff', '#7e22ce', '#d8b4fe'],
    Rejected: ['#fee2e2', '#dc2626', '#fca5a5'],
    Renewed: ['#e0f2fe', '#0369a1', '#7dd3fc'],
    Closed: ['#e2e8f0', '#475569', '#cbd5e1'],
  };
  const [bg, color, border] = map[status] || map.Pending;
  return { bgcolor: bg, color, border: `1px solid ${border}`, fontWeight: 900, borderRadius: '9px' };
};

const defaultForm = (type) => ({
  type,
  minAmount: 5000,
  maxAmount: 1000000,
  minMonthlyAmount: 500,
  maxMonthlyAmount: 100000,
  prematureWithdrawalPenalty: 1,
  prematureClosurePenalty: 1,
  missedInstallmentPenalty: 2,
  autoRenewalAllowed: true,
  autoDebitAllowed: true,
  allowedTenures: fixedTenures,
  classificationInterestRates: [],
});

const buildRates = (classifications, ruleRates = []) => classifications.map((classification) => {
  const name = String(classification.name || '').toUpperCase();
  const match = ruleRates.find((rate) => String(rate.classificationName || rate.classification || '').toUpperCase() === name);
  return {
    classificationId: classification._id,
    classificationName: name,
    classification: name,
    interestRate: Number(match?.interestRate ?? 0),
    isActive: classification.isActive !== false,
  };
});

const StatCard = ({ icon, label, value, tone }) => (
  <Paper sx={{ p: 2.2, borderRadius: '16px', border: `1px solid ${tone.border}`, bgcolor: tone.bg, boxShadow: '0 10px 26px rgba(15,23,42,.06)' }}>
    <Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: '13px', bgcolor: tone.iconBg, color: tone.color, mb: 1.2 }}>
      {icon}
    </Box>
    <Typography sx={{ color: '#475569', fontWeight: 900, fontSize: '.8rem' }}>{label}</Typography>
    <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.2rem', mt: .35 }}>{value}</Typography>
  </Paper>
);

const FilterField = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ color: navy, fontWeight: 900, fontSize: '.82rem', mb: .8 }}>{label}</Typography>
    {children}
  </Box>
);

const cloneForm = (value) => JSON.parse(JSON.stringify(value));

const AdminInvestments = ({ type = 'FD' }) => {
  const isFD = type === 'FD';
  const [activeTab, setActiveTab] = useState('rules');
  const [classifications, setClassifications] = useState([]);
  const [form, setForm] = useState(defaultForm(type));
  const [savedForm, setSavedForm] = useState(defaultForm(type));
  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportFormat, setReportFormat] = useState('excel');
  const [reportOpen, setReportOpen] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const pages = Math.max(1, Math.ceil(total / 10));
  const title = isFD ? 'Investments - Fixed Deposits (FD)' : 'Investments - Recurring Deposits (RD)';
  const subtitle = isFD
    ? 'Set FD rules, view all customer FD accounts, and download monthly FD reports.'
    : 'Set RD rules, view all customer RD accounts, and download monthly RD reports.';
  const productIcon = isFD ? <Savings /> : <Autorenew />;

  const portfolioTotal = useMemo(() => rows.reduce((sum, row) => sum + Number(isFD ? row.depositAmount : row.monthlyContribution, 0), 0), [rows, isFD]);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const [classRes, ruleRes] = await Promise.all([
        investmentAPI.getAdminClassifications(),
        investmentAPI.getAdminRule(type),
      ]);
      const liveClassifications = classRes.data.classifications || [];
      const rule = ruleRes.data.rule || {};
      setClassifications(liveClassifications);
      const nextForm = {
        ...defaultForm(type),
        ...rule,
        minAmount: rule.minAmount ?? 5000,
        maxAmount: rule.maxAmount ?? 1000000,
        minMonthlyAmount: rule.minMonthlyAmount ?? rule.minAmount ?? 500,
        maxMonthlyAmount: rule.maxMonthlyAmount ?? rule.maxAmount ?? 100000,
        prematureWithdrawalPenalty: rule.prematureWithdrawalPenalty ?? rule.prematurePenalty ?? 1,
        prematureClosurePenalty: rule.prematureClosurePenalty ?? rule.prematurePenalty ?? 1,
        allowedTenures: rule.allowedTenures?.length ? rule.allowedTenures : fixedTenures,
        classificationInterestRates: buildRates(liveClassifications, rule.classificationInterestRates || []),
      };
      setForm(nextForm);
      setSavedForm(cloneForm(nextForm));
      setEditMode(false);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${type} rules.`);
    } finally {
      setLoadingRules(false);
    }
  };

  const loadAccounts = async (overrides = {}) => {
    setLoadingAccounts(true);
    try {
      const params = { page, limit: 10, search, status, ...overrides };
      const res = isFD ? await investmentAPI.getAdminFDAccounts(params) : await investmentAPI.getAdminRDAccounts(params);
      setRows(isFD ? (res.data.fds || []) : (res.data.rds || []));
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${type} accounts.`);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    setForm(defaultForm(type));
    setActiveTab('rules');
    setPage(1);
    setSearch('');
    setStatus('');
    loadRules();
  }, [type]);

  useEffect(() => {
    loadAccounts();
  }, [type, page, status]);

  const updateRate = (classificationName, value) => {
    setForm((current) => ({
      ...current,
      classificationInterestRates: current.classificationInterestRates.map((rate) => (
        rate.classificationName === classificationName ? { ...rate, interestRate: value } : rate
      )),
    }));
  };

  const validateRules = () => {
    const min = Number(isFD ? form.minAmount : form.minMonthlyAmount);
    const max = Number(isFD ? form.maxAmount : form.maxMonthlyAmount);
    if (!min || !max || min <= 0 || max <= 0) return 'Minimum and maximum amount must be greater than zero.';
    if (min > max) return 'Minimum amount cannot be greater than maximum amount.';
    if (!form.allowedTenures?.length) return `Please enable at least one ${type} tenure option.`;
    if (form.classificationInterestRates.some((rate) => Number(rate.interestRate) < 0)) return 'Interest rates cannot be negative.';
    return '';
  };

  const saveRule = async () => {
    const validationMessage = validateRules();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        type,
        allowedTenures: form.allowedTenures,
        tenureOptions: form.allowedTenures,
        classificationInterestRates: form.classificationInterestRates.map((rate) => ({
          classificationId: rate.classificationId,
          classificationName: rate.classificationName,
          classification: rate.classificationName,
          interestRate: Number(rate.interestRate || 0),
        })),
      };
      const res = await investmentAPI.saveRule(payload);
      setNotice(res.data.message || `${type} rules updated successfully.`);
      await loadRules();
      setEditMode(false);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update ${type} rules.`);
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = () => {
    setPage(1);
    loadAccounts({ page: 1 });
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setPage(1);
    loadAccounts({ page: 1, search: '', status: '' });
  };

  const cancelRuleEdit = () => {
    setForm(cloneForm(savedForm));
    setEditMode(false);
  };

  const toggleTenure = (tenure) => {
    if (!editMode) return;
    setForm((current) => {
      const currentTenures = current.allowedTenures || [];
      const nextTenures = currentTenures.includes(tenure)
        ? currentTenures.filter((item) => item !== tenure)
        : [...currentTenures, tenure].sort((a, b) => a - b);
      return { ...current, allowedTenures: nextTenures };
    });
  };

  const downloadMonthlyReport = async () => {
    try {
      const res = await investmentAPI.downloadMonthlyReport(type, 'full', { month: reportMonth, year: reportYear, format: reportFormat });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Adnate_PayNest_${type}_Monthly_Report_${reportYear}-${String(reportMonth).padStart(2, '0')}.${reportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      URL.revokeObjectURL(url);
      setReportOpen(false);
      setNotice('Monthly report downloaded successfully.');
    } catch {
      setError('Report download failed.');
    }
  };

  const tabSx = (selected) => ({
    minHeight: 48,
    px: 2.4,
    borderRadius: '14px',
    textTransform: 'none',
    fontWeight: 900,
    color: selected ? '#fff' : navy,
    bgcolor: selected ? brightBlue : '#fff',
    border: selected ? `1px solid ${brightBlue}` : '1px solid #cbd5e1',
    boxShadow: selected ? '0 14px 28px rgba(37,99,235,.28)' : '0 8px 18px rgba(15,23,42,.06)',
    '&:hover': { bgcolor: selected ? blue : softBlue, borderColor: '#93c5fd', transform: 'translateY(-1px)' },
  });

  const renderRules = () => (
    <Box>
      <Grid container spacing={2.2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={3}>
          <StatCard icon={<Savings />} label={isFD ? 'Minimum FD Amount' : 'Minimum Monthly Amount'} value={money(isFD ? form.minAmount : form.minMonthlyAmount)} tone={{ bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', color: '#1d4ed8' }} />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard icon={<AccountBalance />} label={isFD ? 'Maximum FD Amount' : 'Maximum Monthly Amount'} value={money(isFD ? form.maxAmount : form.maxMonthlyAmount)} tone={{ bg: '#ecfdf5', border: '#bbf7d0', iconBg: '#dcfce7', color: '#15803d' }} />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard icon={<WarningAmber />} label={isFD ? 'Withdrawal Penalty' : 'Closure Penalty'} value={`${isFD ? form.prematureWithdrawalPenalty : form.prematureClosurePenalty}%`} tone={{ bg: '#fff7ed', border: '#fed7aa', iconBg: '#ffedd5', color: '#ea580c' }} />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard icon={<CheckCircle />} label={isFD ? 'Auto Renewal' : 'Auto Debit'} value={(isFD ? form.autoRenewalAllowed : form.autoDebitAllowed) ? 'Allowed' : 'Not Allowed'} tone={{ bg: '#f5f3ff', border: '#ddd6fe', iconBg: '#ede9fe', color: '#7c3aed' }} />
        </Grid>
      </Grid>

      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.2 }}>
            <Box>
              <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.12rem' }}>
                <Rule sx={{ verticalAlign: 'middle', mr: 1, color: brightBlue }} />{type} Rules & Interest Rates
              </Typography>
              <Typography sx={{ color: '#64748b', fontWeight: 700, mt: .4 }}>Classifications come from MongoDB in real time.</Typography>
            </Box>
            {editMode ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" disabled={saving || loadingRules} onClick={saveRule} sx={{ bgcolor: brightBlue, borderRadius: '12px', px: 3, fontWeight: 900, '&:hover': { bgcolor: navy } }}>
                  {saving ? 'Saving...' : 'Save Rules'}
                </Button>
                <Button onClick={cancelRuleEdit} disabled={saving} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '12px', px: 2.5, fontWeight: 900 }}>
                  Cancel
                </Button>
              </Box>
            ) : (
              <Button variant="contained" startIcon={<Edit />} disabled={loadingRules} onClick={() => setEditMode(true)} sx={{ bgcolor: brightBlue, borderRadius: '12px', px: 3, fontWeight: 900, '&:hover': { bgcolor: navy } }}>
                Edit Rules
              </Button>
            )}
          </Box>

          {loadingRules ? (
            <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
          ) : (
            <Grid container spacing={2.2}>
              <Grid item xs={12}>
                <Typography sx={{ color: navy, fontWeight: 900, mb: -.5 }}>Common {type} Rules</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField disabled={!editMode} fullWidth type="number" label={isFD ? 'Minimum FD Amount' : 'Minimum Monthly Contribution'} InputLabelProps={ruleInputLabelProps} value={isFD ? form.minAmount : form.minMonthlyAmount} onChange={(e) => setForm({ ...form, [isFD ? 'minAmount' : 'minMonthlyAmount']: e.target.value })} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField disabled={!editMode} fullWidth type="number" label={isFD ? 'Maximum FD Amount' : 'Maximum Monthly Contribution'} InputLabelProps={ruleInputLabelProps} value={isFD ? form.maxAmount : form.maxMonthlyAmount} onChange={(e) => setForm({ ...form, [isFD ? 'maxAmount' : 'maxMonthlyAmount']: e.target.value })} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField disabled={!editMode} fullWidth type="number" label={isFD ? 'Premature Withdrawal Penalty (%)' : 'Premature Closure Penalty (%)'} InputLabelProps={ruleInputLabelProps} value={isFD ? form.prematureWithdrawalPenalty : form.prematureClosurePenalty} onChange={(e) => setForm({ ...form, [isFD ? 'prematureWithdrawalPenalty' : 'prematureClosurePenalty']: e.target.value })} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                {isFD ? (
                  <FormControlLabel control={<Switch disabled={!editMode} checked={Boolean(form.autoRenewalAllowed)} onChange={(e) => setForm({ ...form, autoRenewalAllowed: e.target.checked })} />} label="Auto Renewal Allowed" sx={{ mt: 1, color: navy, fontWeight: 900 }} />
                ) : (
                  <FormControlLabel control={<Switch disabled={!editMode} checked={Boolean(form.autoDebitAllowed)} onChange={(e) => setForm({ ...form, autoDebitAllowed: e.target.checked })} />} label="Auto Debit Allowed" sx={{ mt: 1, color: navy, fontWeight: 900 }} />
                )}
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: softBlue, border: '1px solid #bfdbfe' }}>
                  <Typography sx={{ color: navy, fontWeight: 900, mb: 1 }}>Allowed {type} Tenures</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {fixedTenures.map((tenure) => (
                      <Chip
                        key={tenure}
                        icon={<Shield />}
                        label={tenureLabel(tenure)}
                        onClick={() => toggleTenure(tenure)}
                        sx={{
                          bgcolor: form.allowedTenures?.includes(tenure) ? '#fff' : '#e2e8f0',
                          color: form.allowedTenures?.includes(tenure) ? brightBlue : '#64748b',
                          border: form.allowedTenures?.includes(tenure) ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                          fontWeight: 900,
                          cursor: editMode ? 'pointer' : 'default',
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Typography sx={{ color: navy, fontWeight: 900, mb: 1.4 }}>Classification Interest Rates</Typography>
                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: navy }}>
                        {['Classification', 'Interest Rate (%)', 'Status'].map((head) => <TableCell key={head} sx={{ color: '#fff', fontWeight: 900 }}>{head}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {form.classificationInterestRates.map((rate, index) => (
                        <TableRow key={rate.classificationName} sx={{ '& td': { color: '#334155', py: 1.4 }, '&:hover': { bgcolor: '#f8fafc' } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                              <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '11px', bgcolor: index % 2 ? '#ede9fe' : '#dbeafe', color: index % 2 ? '#7c3aed' : brightBlue }}>
                                <Percent fontSize="small" />
                              </Box>
                              <Typography sx={{ color: navy, fontWeight: 900 }}>{rate.classificationName}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ width: 240 }}>
                            <TextField disabled={!editMode} fullWidth type="number" label="Interest Rate (%)" InputLabelProps={ruleInputLabelProps} value={rate.interestRate} onChange={(e) => updateRate(rate.classificationName, e.target.value)} sx={fieldSx} />
                          </TableCell>
                          <TableCell><Chip size="small" label={rate.isActive ? 'Active' : 'Inactive'} sx={rate.isActive ? statusSx('Active') : statusSx('Closed')} /></TableCell>
                        </TableRow>
                      ))}
                      {form.classificationInterestRates.length === 0 && (
                        <TableRow><TableCell colSpan={3}><Alert severity="info">No active customer classifications found.</Alert></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  const renderAccounts = () => (
    <Card sx={cardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.4 }}>
          <Box>
            <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.12rem' }}>Customers {type} Accounts</Typography>
            <Typography sx={{ color: '#64748b', fontWeight: 700, mt: .4 }}>Search, filter, and review live customer records from MongoDB.</Typography>
          </Box>
          <Button startIcon={<Download />} onClick={() => setReportOpen(true)} sx={{ bgcolor: brightBlue, color: '#fff', borderRadius: '12px', px: 2.4, minHeight: 44, fontWeight: 900, '&:hover': { bgcolor: navy, transform: 'translateY(-1px)' } }}>
            Download Monthly Report
          </Button>
        </Box>

        <Paper sx={{ p: 2, mb: 2, borderRadius: '18px', bgcolor: '#f8fbff', border: '1px solid #dbeafe', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)' }}>
          <Grid container spacing={2} alignItems="end">
            <Grid item xs={12} md={6}>
              <FilterField label="Search Customer">
                <TextField fullWidth placeholder={`Customer Name, Customer ID, ${type} ID, Email, or Account Number`} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }} sx={fieldSx} />
              </FilterField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FilterField label="Status">
                <TextField select fullWidth value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={fieldSx}>
                  <MenuItem value="">All Statuses</MenuItem>
                  {['Pending', 'Active', 'Matured', 'Premature Closed', 'Rejected', 'Renewed'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </TextField>
              </FilterField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FilterField label="Search">
                <Button fullWidth startIcon={<Search />} onClick={submitSearch} sx={{ bgcolor: brightBlue, color: '#fff', borderRadius: '12px', minHeight: 56, fontWeight: 900, '&:hover': { bgcolor: navy } }}>Search</Button>
              </FilterField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FilterField label="Reset">
                <Button fullWidth onClick={resetFilters} sx={{ color: brightBlue, bgcolor: '#fff', border: '1px solid #93c5fd', borderRadius: '12px', minHeight: 56, fontWeight: 900, '&:hover': { bgcolor: softBlue } }}>Reset</Button>
              </FilterField>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}><StatCard icon={<AccountBalance />} label="Filtered Portfolio" value={money(portfolioTotal)} tone={{ bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', color: brightBlue }} /></Grid>
          <Grid item xs={12} md={4}><StatCard icon={<CheckCircle />} label="Active Accounts" value={rows.filter((row) => row.status === 'Active').length} tone={{ bg: '#ecfdf5', border: '#bbf7d0', iconBg: '#dcfce7', color: '#15803d' }} /></Grid>
          <Grid item xs={12} md={4}><StatCard icon={<WarningAmber />} label="Pending Review" value={rows.filter((row) => row.status === 'Pending').length} tone={{ bg: '#fff7ed', border: '#fed7aa', iconBg: '#ffedd5', color: '#ea580c' }} /></Grid>
        </Grid>

        <TableContainer sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
          <Table size="small" sx={{ minWidth: isFD ? 1440 : 1540 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: navy }}>
                {(isFD
                  ? ['Customer Name', 'Customer ID', 'Classification', 'Account Number', 'FD ID', 'Deposit Amount', 'Interest Rate', 'Tenure', 'Start Date', 'Maturity Date', 'Maturity Amount', 'Status', 'Created Date']
                  : ['Customer Name', 'Customer ID', 'Classification', 'Account Number', 'RD ID', 'Monthly Contribution', 'Interest Rate', 'Tenure', 'Installments Paid', 'Missed', 'Start Date', 'Maturity Date', 'Expected Amount', 'Status', 'Created Date']
                ).map((head) => <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>{head}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingAccounts ? (
                <TableRow><TableCell colSpan={isFD ? 13 : 15} align="center" sx={{ py: 5 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row._id} sx={{ '& td': { color: '#334155', borderColor: '#e2e8f0', py: 1.35 }, '&:hover': { bgcolor: '#f8fafc' } }}>
                  <TableCell sx={{ fontWeight: 900 }}>{row.customerName}</TableCell>
                  <TableCell>{row.customerId}</TableCell>
                  <TableCell>{row.classification}</TableCell>
                  <TableCell>{row.linkedAccountNumber}</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: `${brightBlue} !important` }}>{isFD ? row.fdId : row.rdId}</TableCell>
                  <TableCell>{money(isFD ? row.depositAmount : row.monthlyContribution)}</TableCell>
                  <TableCell>{row.interestRate}%</TableCell>
                  <TableCell>{tenureLabel(row.tenure)}</TableCell>
                  {!isFD && <TableCell>{row.installmentsPaid}</TableCell>}
                  {!isFD && <TableCell>{row.missedInstallments}</TableCell>}
                  <TableCell>{date(row.startDate)}</TableCell>
                  <TableCell>{date(row.maturityDate)}</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>{money(isFD ? row.maturityAmount : row.expectedMaturityAmount)}</TableCell>
                  <TableCell><Chip size="small" label={row.status} sx={statusSx(row.status)} /></TableCell>
                  <TableCell>{date(row.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!loadingAccounts && rows.length === 0 && (
                <TableRow><TableCell colSpan={isFD ? 13 : 15} align="center" sx={{ color: '#64748b', py: 5 }}>No {type} records found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ color: '#64748b', fontWeight: 800 }}>Showing 10 records per page. Total {total}</Typography>
          <Pagination count={pages} page={page} onChange={(_, value) => setPage(value)} color="primary" />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={pageSx}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2.6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6 }}>
          <Box sx={{ width: 50, height: 50, display: 'grid', placeItems: 'center', borderRadius: '16px', bgcolor: '#dbeafe', color: brightBlue, boxShadow: '0 12px 24px rgba(37,99,235,.18)' }}>
            {productIcon}
          </Box>
          <Box>
            <Typography sx={{ color: navy, fontSize: { xs: '1.35rem', md: '1.65rem' }, fontWeight: 900 }}>{title}</Typography>
            <Typography sx={{ color: '#64748b', fontWeight: 700, mt: .35 }}>{subtitle}</Typography>
          </Box>
        </Box>
      </Box>

      <Paper sx={{ p: 1, display: 'inline-flex', gap: 1, mb: 2.6, borderRadius: '16px', bgcolor: '#fff', border: '1px solid #dbeafe', boxShadow: '0 10px 24px rgba(15,23,42,.08)', flexWrap: 'wrap' }}>
        <Button startIcon={<Rule />} onClick={() => setActiveTab('rules')} sx={tabSx(activeTab === 'rules')}>{type} Rules</Button>
        <Button startIcon={<AccountBalance />} onClick={() => setActiveTab('accounts')} sx={tabSx(activeTab === 'accounts')}>Customers {type} Accounts</Button>
      </Paper>

      {activeTab === 'rules' ? renderRules() : renderAccounts()}

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ color: navy, fontWeight: 900 }}>Download Monthly {type} Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: .5 }}>
            <Grid item xs={12} sm={6}>
              <FilterField label="Month">
                <TextField select fullWidth value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} sx={fieldSx}>
                  {Array.from({ length: 12 }, (_, index) => <MenuItem key={index + 1} value={String(index + 1)}>{new Date(2024, index, 1).toLocaleString('en-IN', { month: 'long' })}</MenuItem>)}
                </TextField>
              </FilterField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FilterField label="Year">
                <TextField fullWidth type="number" value={reportYear} onChange={(e) => setReportYear(e.target.value)} sx={fieldSx} />
              </FilterField>
            </Grid>
            <Grid item xs={12}>
              <FilterField label="Format">
                <TextField select fullWidth value={reportFormat} onChange={(e) => setReportFormat(e.target.value)} sx={fieldSx}>
                  <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                  <MenuItem value="pdf">PDF (.pdf)</MenuItem>
                </TextField>
              </FilterField>
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2, borderRadius: '12px', bgcolor: softBlue, color: navy }}>
            This report is generated from all MongoDB {type} records for the selected month, regardless of table filters.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setReportOpen(false)} sx={{ color: navy, fontWeight: 900 }}>Cancel</Button>
          <Button startIcon={<Download />} onClick={downloadMonthlyReport} sx={{ bgcolor: brightBlue, color: '#fff', borderRadius: '12px', px: 2.5, fontWeight: 900, '&:hover': { bgcolor: navy } }}>
            Download
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice || error)} autoHideDuration={3500} onClose={() => { setNotice(''); setError(''); }}>
        <Alert severity={error ? 'error' : 'success'}>{error || notice}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminInvestments;
