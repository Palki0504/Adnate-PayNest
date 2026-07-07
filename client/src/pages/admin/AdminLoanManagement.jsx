import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Add, Assessment, CalendarMonth, Delete, Download, Edit,
  Paid, PieChart as PieIcon, Refresh, Rule, ToggleOff, ToggleOn,
  Home, Person, BusinessCenter, DirectionsCar, School, LocalHospital,
  Percent, AccountBalanceWallet, Payments, Savings, Search, RestartAlt, ChevronLeft, ChevronRight,
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { loanAPI, classificationAPI } from '../../services/api';

const navy = '#0B1F4D';
const chartColors = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2'];
const loanTypes = ['home', 'personal', 'business', 'vehicle', 'education', 'medical'];
const statuses = ['Submitted', 'Under Review', 'More Info Required', 'Approved', 'Rejected', 'Disbursed', 'Closed'];
const emiStatuses = ['Pending', 'Paid', 'Missed', 'Failed', 'Processing', 'PartiallyPaid'];
const adminEmiStatuses = ['Pending', 'Paid', 'Missed', 'Failed', 'Processing', 'PartiallyPaid', 'Overdue'];

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const titleCase = (value) => String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const isoMonth = () => new Date().toISOString().slice(0, 7);
const customerLoanInitialFilters = () => ({ loanType: '', classification: '', month: isoMonth(), search: '', page: 1 });
const emiInitialFilters = () => ({ status: '', loanType: '', customer: '', search: '', month: isoMonth(), startDate: '', endDate: '', page: 1 });
const loanIconMap = {
  home: <Home />,
  personal: <Person />,
  business: <BusinessCenter />,
  vehicle: <DirectionsCar />,
  education: <School />,
  medical: <LocalHospital />,
};
const accentForIndex = (index) => chartColors[index % chartColors.length];
const getRuleStatus = (rule) => rule?.status || (rule?.isActive === false ? 'Inactive' : 'Active');
const getTenureMin = (rule) => rule?.tenureMin ?? rule?.minTenure ?? 3;
const getTenureMax = (rule) => rule?.tenureMax ?? rule?.maxTenure ?? 60;
const getTenureUnit = (rule) => rule?.tenureUnit ?? 'months';
const getLatePenalty = (rule) => rule?.lateEmiPenalty ?? rule?.penaltyRate ?? 0;
const getInterestRate = (rule) => rule?.interestRate ?? 0;
const getMaxAmount = (rule) => typeof rule?.maxAmount === 'number' ? rule.maxAmount : Math.max(0, ...Object.values(rule?.maxAmount || {}).map((amount) => Number(amount) || 0));
const getProcessingFee = (rule) => rule?.processingFee ?? 0;
const getPrepaymentCharge = (rule) => rule?.prepaymentCharge ?? rule?.foreclosureChargePercent ?? 0;

const cardSx = {
  bgcolor: '#fff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  boxShadow: '0 12px 30px rgba(15,23,42,.10)',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: '#0F172A',
    borderRadius: '12px',
    '& fieldset': { borderColor: '#D1D9E6' },
    '&:hover fieldset': { borderColor: '#3B82F6' },
    '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: 2 },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    color: '#0F172A',
    WebkitTextFillColor: '#0F172A',
    fontWeight: 700,
  },
  '& input[type="number"]': {
    color: '#0F172A',
    WebkitTextFillColor: '#0F172A',
  },
  '& .MuiInputLabel-root': { color: '#0F172A', fontWeight: 600 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#0F172A' },
  '& .MuiSelect-icon': { color: '#0B1F4D' },
};

const statusSx = (status) => {
  if (['Active', 'Approved', 'Disbursed', 'Paid'].includes(status)) return { bgcolor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' };
  if (['Pending', 'Submitted'].includes(status)) return { bgcolor: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' };
  if (['Under Review', 'Processing', 'More Info Required'].includes(status)) return { bgcolor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' };
  if (['Rejected', 'Missed', 'Failed'].includes(status)) return { bgcolor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' };
  if (status === 'Overdue') return { bgcolor: '#fecaca', color: '#991b1b', border: '1px solid #ef4444' };
  return { bgcolor: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1' };
};

const getLoanDisplayStatus = (loan) => {
  if (loan?.status === 'Disbursed' && loan?.nextEMIDueDate && new Date(loan.nextEMIDueDate) < new Date() && Number(loan.outstandingBalance || 0) > 0) {
    return 'Overdue';
  }
  return loan?.status || 'Pending';
};

const getEmiDisplayStatus = (emi) => {
  if (['Pending', 'Failed', 'Missed'].includes(emi?.status) && emi?.dueDate && new Date(emi.dueDate) < new Date()) {
    return 'Overdue';
  }
  return emi?.status || 'Pending';
};

const downloadBlob = (response, filename) => {
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers?.['content-type'] || 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const PageShell = ({ title, subtitle, action, children }) => (
  <Box sx={{ color: '#fff', width: '100%', overflowX: 'hidden' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
      <Box>
        <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 900 }}>{title}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '.9rem', mt: .4 }}>{subtitle}</Typography>
      </Box>
      {action}
    </Box>
    {children}
  </Box>
);

const ruleDialogNumberFields = [
  ['Tenure Min', 'tenureMin'],
  ['Tenure Max', 'tenureMax'],
  ['Late EMI Penalty (%)', 'lateEmiPenalty'],
  ['Processing Fee (%)', 'processingFee'],
  ['Prepayment Charge (%)', 'prepaymentCharge'],
];

const toLoanSlug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const LoanRuleDialog = React.memo(({
  open,
  editingRule,
  ruleForm,
  onClose,
  onSave,
  onFieldChange,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
    <DialogTitle sx={{ color: navy, fontWeight: 900 }}>{editingRule ? 'Edit Rules' : 'Add New Loan Type'}</DialogTitle>
    <DialogContent>
      <Grid container spacing={2} sx={{ mt: .5 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Loan Type Name"
            value={ruleForm?.displayName || ''}
            onChange={(e) => onFieldChange({ displayName: e.target.value, loanType: toLoanSlug(e.target.value) })}
            sx={fieldSx}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth type="number" label="Interest Rate (%)" value={ruleForm?.interestRate || ''} onChange={(e) => onFieldChange({ interestRate: e.target.value })} sx={fieldSx} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth type="number" label="Min Amount" value={ruleForm?.minAmount || ''} onChange={(e) => onFieldChange({ minAmount: e.target.value })} sx={fieldSx} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth type="number" label="Max Amount" value={ruleForm?.maxAmount || ''} onChange={(e) => onFieldChange({ maxAmount: e.target.value })} sx={fieldSx} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField select fullWidth label="Tenure Unit" value={ruleForm?.tenureUnit || 'months'} onChange={(e) => onFieldChange({ tenureUnit: e.target.value })} sx={fieldSx}>
            <MenuItem value="months">Months</MenuItem>
            <MenuItem value="years">Years</MenuItem>
          </TextField>
        </Grid>
        {ruleDialogNumberFields.map(([label, key]) => (
          <Grid item xs={12} md={3} key={key}>
            <TextField fullWidth type="number" label={label} value={ruleForm?.[key] || ''} onChange={(e) => onFieldChange({ [key]: e.target.value })} sx={fieldSx} />
          </Grid>
        ))}
      </Grid>
    </DialogContent>
    <DialogActions sx={{ p: 3 }}>
      <Button onClick={onClose} sx={{ color: '#475569', fontWeight: 800 }}>Cancel</Button>
      <Button onClick={onSave} sx={{ bgcolor: navy, color: '#fff', fontWeight: 900, borderRadius: '10px', px: 3 }}>Save Rules</Button>
    </DialogActions>
  </Dialog>
));

const customerLoanFieldSx = {
  ...fieldSx,
  '& .MuiOutlinedInput-root': {
    ...fieldSx['& .MuiOutlinedInput-root'],
    minHeight: 52,
    boxShadow: '0 4px 12px rgba(15,23,42,.06)',
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    ...fieldSx['& .MuiInputBase-input, & .MuiSelect-select'],
    padding: '14px 16px',
  },
};

const LabeledFilterField = ({ label, children }) => (
  <Box>
    <Typography sx={{ color: navy, fontWeight: 800, fontSize: '.82rem', mb: .9 }}>{label}</Typography>
    {children}
  </Box>
);

const CustomerLoansFilters = React.memo(({
  filters,
  classifications,
  onChange,
  onReset,
}) => (
  <Paper sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', p: { xs: 2, md: 2.5 }, mb: 2.5, boxShadow: '0 14px 34px rgba(15,23,42,.10)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
      <Box>
        <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.05rem' }}>Filters</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '.82rem', mt: .25 }}>Search and filter customer loans from live MongoDB records.</Typography>
      </Box>
      <Button startIcon={<RestartAlt />} onClick={onReset} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '12px', px: 2, minHeight: 42, fontWeight: 900, bgcolor: '#fff', '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' } }}>
        Reset Filters
      </Button>
    </Box>
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <LabeledFilterField label="Search">
          <TextField
            fullWidth
            placeholder="Name, email, customer ID, loan number"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#64748b' }} /></InputAdornment> }}
            sx={customerLoanFieldSx}
          />
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Loan Type">
          <TextField select fullWidth value={filters.loanType} onChange={(e) => onChange({ loanType: e.target.value })} sx={customerLoanFieldSx}>
            <MenuItem value="">All Types</MenuItem>
            {loanTypes.map((type) => <MenuItem key={type} value={type}>{titleCase(type)}</MenuItem>)}
          </TextField>
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Classification">
          <TextField select fullWidth value={filters.classification} onChange={(e) => onChange({ classification: e.target.value })} sx={customerLoanFieldSx}>
            <MenuItem value="">All Classes</MenuItem>
            {classifications.map((classification) => <MenuItem key={classification.name} value={classification.name}>{classification.name}</MenuItem>)}
          </TextField>
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Month">
          <TextField fullWidth type="month" value={filters.month} onChange={(e) => onChange({ month: e.target.value })} sx={customerLoanFieldSx} />
        </LabeledFilterField>
      </Grid>
    </Grid>
  </Paper>
));

const EmiFilters = React.memo(({
  filters,
  onChange,
  onReset,
}) => (
  <Paper sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', p: { xs: 2, md: 2.5 }, mb: 2.5, boxShadow: '0 14px 34px rgba(15,23,42,.10)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
      <Box>
        <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.05rem' }}>Filters</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '.82rem', mt: .25 }}>Search and filter live EMI records from customer loans.</Typography>
      </Box>
      <Button startIcon={<RestartAlt />} onClick={onReset} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '12px', px: 2, minHeight: 42, fontWeight: 900, bgcolor: '#fff', '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' } }}>
        Reset Filters
      </Button>
    </Box>
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <LabeledFilterField label="Search">
          <TextField
            fullWidth
            placeholder="Name, customer ID, email, loan number"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#64748b' }} /></InputAdornment> }}
            sx={customerLoanFieldSx}
          />
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Status">
          <TextField select fullWidth value={filters.status} onChange={(e) => onChange({ status: e.target.value })} sx={customerLoanFieldSx}>
            <MenuItem value="">All Statuses</MenuItem>
            {adminEmiStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </TextField>
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Loan Type">
          <TextField select fullWidth value={filters.loanType} onChange={(e) => onChange({ loanType: e.target.value })} sx={customerLoanFieldSx}>
            <MenuItem value="">All Types</MenuItem>
            {loanTypes.map((type) => <MenuItem key={type} value={type}>{titleCase(type)}</MenuItem>)}
          </TextField>
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Customer">
          <TextField fullWidth placeholder="Customer name or ID" value={filters.customer} onChange={(e) => onChange({ customer: e.target.value })} sx={customerLoanFieldSx} />
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <LabeledFilterField label="Month">
          <TextField fullWidth type="month" value={filters.month} onChange={(e) => onChange({ month: e.target.value, startDate: '', endDate: '' })} sx={customerLoanFieldSx} />
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <LabeledFilterField label="Start Date">
          <TextField fullWidth type="date" value={filters.startDate} onChange={(e) => onChange({ startDate: e.target.value, month: '' })} sx={customerLoanFieldSx} />
        </LabeledFilterField>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <LabeledFilterField label="End Date">
          <TextField fullWidth type="date" value={filters.endDate} onChange={(e) => onChange({ endDate: e.target.value, month: '' })} sx={customerLoanFieldSx} />
        </LabeledFilterField>
      </Grid>
    </Grid>
  </Paper>
));

const AdminLoanManagement = ({ section = 'overview' }) => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overview, setOverview] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanPagination, setLoanPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [emis, setEmis] = useState([]);
  const [emisLoading, setEmisLoading] = useState(false);
  const [emiPagination, setEmiPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [emiSummary, setEmiSummary] = useState({});
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState(null);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [loanFilters, setLoanFilters] = useState(customerLoanInitialFilters);
  const [emiFilters, setEmiFilters] = useState(emiInitialFilters);

  const activeClassifications = useMemo(() => classifications.filter((item) => item.isActive !== false), [classifications]);

  const loadClassifications = async () => {
    const res = await classificationAPI.getDefinitions();
    setClassifications(res.data.classifications || []);
    return res.data.classifications || [];
  };

  const loadOverview = async () => {
    const res = await loanAPI.getAdminLoanOverview();
    setOverview(res.data.overview);
  };

  const loadRules = async () => {
    const ruleRes = await loanAPI.getConfigs();
    const nextRules = ruleRes.data.rules || ruleRes.data.configs || [];
    setConfigs(nextRules);
    setSelectedRuleId((current) => current || nextRules[0]?._id || '');
  };

  const loadLoans = async () => {
    setLoansLoading(true);
    try {
      const params = {
        ...loanFilters,
        limit: 10,
        month: loanFilters.month,
      };
      const res = await loanAPI.getAdminCustomerLoans(params);
      setLoans(res.data.loans || []);
      setLoanPagination(res.data.pagination || { total: 0, page: loanFilters.page, limit: 10, pages: 1 });
    } finally {
      setLoansLoading(false);
    }
  };

  const loadEmis = async () => {
    setEmisLoading(true);
    try {
      const params = {
        ...emiFilters,
        limit: 10,
        month: emiFilters.startDate || emiFilters.endDate ? undefined : emiFilters.month,
      };
      const res = await loanAPI.getAdminEMIRecords(params);
      setEmis(res.data.emis || []);
      setEmiSummary(res.data.summary || {});
      setEmiPagination(res.data.pagination || { total: 0, page: emiFilters.page, limit: 10, pages: 1 });
    } finally {
      setEmisLoading(false);
    }
  };

  const refresh = async () => {
    setError('');
    try {
      if (section === 'overview') await loadOverview();
      if (section === 'rules') await loadRules();
      if (section === 'customer-loans') {
        await loadClassifications();
        await loadLoans();
      }
      if (section === 'emis') await loadEmis();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load loan management data.');
    }
  };

  useEffect(() => { refresh(); }, [section]);
  useEffect(() => { if (section === 'customer-loans') loadLoans().catch(() => {}); }, [loanFilters]);
  useEffect(() => {
    if (section !== 'customer-loans') return undefined;
    const intervalId = setInterval(() => loadLoans().catch(() => {}), 30000);
    return () => clearInterval(intervalId);
  }, [section, loanFilters]);
  useEffect(() => { if (section === 'emis') loadEmis().catch(() => {}); }, [emiFilters]);
  useEffect(() => {
    if (section !== 'emis') return undefined;
    const intervalId = setInterval(() => loadEmis().catch(() => {}), 30000);
    return () => clearInterval(intervalId);
  }, [section, emiFilters]);

  const updateLoanFilter = useCallback((updates) => {
    setLoanFilters((current) => ({ ...current, ...updates, page: updates.page || 1 }));
  }, []);

  const resetLoanFilters = useCallback(() => {
    setLoanFilters(customerLoanInitialFilters());
  }, []);

  const updateEmiFilter = useCallback((updates) => {
    setEmiFilters((current) => ({ ...current, ...updates, page: updates.page || 1 }));
  }, []);

  const resetEmiFilters = useCallback(() => {
    setEmiFilters(emiInitialFilters());
  }, []);

  const downloadCustomerLoansMonthlyReport = useCallback(async () => {
    try {
      if (!loanFilters.month) {
        setError('Please select a month before downloading the customer loans report.');
        return;
      }
      const response = await loanAPI.downloadAdminCustomerLoansMonthlyReport(loanFilters.month);
      downloadBlob(response, `customer-loans-monthly-${loanFilters.month}.xlsx`);
      setSuccess('Customer loans monthly report downloaded successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to download customer loans monthly report.');
    }
  }, [loanFilters.month]);

  const downloadEmiMonthlyReport = useCallback(async () => {
    try {
      if (!emiFilters.month) {
        setError('Please select a month before downloading the EMI report.');
        return;
      }
      const response = await loanAPI.downloadAdminEMIMonthlyReport(emiFilters.month);
      downloadBlob(response, `emi-monthly-${emiFilters.month}.xlsx`);
      setSuccess('EMI monthly report downloaded successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to download EMI monthly report.');
    }
  }, [emiFilters.month]);

  const updateRuleForm = useCallback((updates) => {
    setRuleForm((current) => ({ ...(current || {}), ...updates }));
  }, []);

  const closeRuleDialog = useCallback(() => {
    setRuleDialogOpen(false);
  }, []);

  const openRuleDialog = useCallback((rule = null) => {
    const isEdit = Boolean(rule);
    setEditingRule(rule);
    setRuleForm({
      _id: rule?._id || '',
      loanType: rule?.loanType || '',
      displayName: rule?.displayName || '',
      interestRate: isEdit ? getInterestRate(rule) : '',
      minAmount: isEdit ? (rule?.minAmount || 10000) : '',
      maxAmount: isEdit ? getMaxAmount(rule) : '',
      tenureMin: isEdit ? getTenureMin(rule) : '',
      tenureMax: isEdit ? getTenureMax(rule) : '',
      tenureUnit: isEdit ? getTenureUnit(rule) : 'months',
      lateEmiPenalty: isEdit ? (getLatePenalty(rule) || 2) : '',
      processingFee: isEdit ? getProcessingFee(rule) : '',
      prepaymentCharge: isEdit ? getPrepaymentCharge(rule) : '',
      status: isEdit ? getRuleStatus(rule) : 'Active',
    });
    setRuleDialogOpen(true);
  }, []);

  const saveRule = useCallback(async () => {
    try {
      const normalizedLoanType = ruleForm.loanType || ruleForm.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = {
        ...ruleForm,
        _id: editingRule?._id || ruleForm._id || undefined,
        loanType: normalizedLoanType,
        interestRate: ruleForm.interestRate,
        minAmount: ruleForm.minAmount,
        maxAmount: ruleForm.maxAmount,
        tenureMin: ruleForm.tenureMin,
        tenureMax: ruleForm.tenureMax,
        lateEmiPenalty: ruleForm.lateEmiPenalty,
        processingFee: ruleForm.processingFee,
        prepaymentCharge: ruleForm.prepaymentCharge,
      };
      await loanAPI.updateConfig(payload);
      setSuccess('Loan rule saved successfully.');
      setRuleDialogOpen(false);
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save loan rule.');
    }
  }, [editingRule, ruleForm]);

  const toggleRule = async (rule) => {
    const nextStatus = getRuleStatus(rule) === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await loanAPI.updateConfig({ _id: rule._id, loanType: rule.loanType, status: nextStatus });
      const updatedRule = res.data.rule || res.data.config || { ...rule, status: nextStatus };
      setConfigs((current) => current.map((item) => (item._id === rule._id ? { ...item, ...updatedRule, status: nextStatus } : item)));
      setSuccess(`Loan rule ${nextStatus === 'Active' ? 'activated' : 'deactivated'} successfully.`);
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${nextStatus === 'Active' ? 'activate' : 'deactivate'} loan rule.`);
    }
  };

  const deleteRule = async (rule) => {
    if (!rule?._id) return;
    await loanAPI.deleteConfig(rule._id);
    await loadRules();
  };

  const Overview = () => (
    <PageShell title="Loans Overview" subtitle="Key lending health indicators and live portfolio trends." action={<Button startIcon={<Refresh />} onClick={refresh} sx={{ bgcolor: '#fff', color: navy, borderRadius: '11px', fontWeight: 900 }}>Refresh</Button>}>
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Active Loan Customers', value: overview?.activeLoanCustomers || 0, icon: <AccountBalance />, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Total Loan Amount', value: money(overview?.totalLoanAmount), icon: <Assessment />, color: '#16a34a', bg: '#ecfdf5' },
          { label: 'Total EMI Collected', value: money(overview?.totalEmiCollected), icon: <Paid />, color: '#f59e0b', bg: '#fff7ed' },
        ].map((card) => (
          <Grid item xs={12} md={4} key={card.label}>
            <Card sx={cardSx}><CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2.5 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: card.bg, color: card.color }}>{card.icon}</Box>
              <Box><Typography sx={{ color: navy, fontWeight: 900 }}>{card.label}</Typography><Typography sx={{ color: card.color, fontSize: '1.55rem', fontWeight: 900 }}>{card.value}</Typography></Box>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}><ChartCard title="Loan Disbursement Trend"><ResponsiveContainer width="100%" height={260}><BarChart data={overview?.disbursementTrend || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard></Grid>
        <Grid item xs={12} lg={5}><ChartCard title="Loan Distribution by Type"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={overview?.loanDistribution || []} dataKey="count" nameKey="loanType" outerRadius={88}>{(overview?.loanDistribution || []).map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></ChartCard></Grid>
        <Grid item xs={12}><ChartCard title="EMI Collection Trend"><ResponsiveContainer width="100%" height={260}><LineChart data={overview?.emiCollectionTrend || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></ChartCard></Grid>
      </Grid>
    </PageShell>
  );

  const ChartCard = ({ title, children }) => <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><Typography sx={{ color: navy, fontWeight: 900, mb: 2 }}>{title}</Typography>{children}</CardContent></Card>;

  const LoanRules = () => {
    const selectedRule = configs.find((rule) => rule._id === selectedRuleId) || configs[0];
    return (
      <PageShell title="Loan Rules" subtitle="Manage loan-type interest rates, amount limits, tenure, fees, and penalties." action={<Button startIcon={<Add />} onClick={() => openRuleDialog()} sx={{ bgcolor: navy, color: '#fff', borderRadius: '11px', fontWeight: 900, '&:hover': { bgcolor: '#12336f' } }}>Add New Loan Type</Button>}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                  <Box>
                    <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.05rem' }}>Loan Types</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: '.82rem', mt: .25 }}>Select a loan type to view and manage rules.</Typography>
                  </Box>
                  <Button startIcon={<Add />} onClick={() => openRuleDialog()} sx={{ border: '1px dashed #bfdbfe', color: navy, borderRadius: '12px', px: 2, py: 1.15, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    Add New Loan Type
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: .5, '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#bfdbfe', borderRadius: 999 } }}>
                  {configs.map((rule, index) => {
                  const active = selectedRule?._id === rule._id;
                  const color = accentForIndex(index);
                  return (
                    <Paper
                      key={rule._id}
                      onClick={() => setSelectedRuleId(rule._id)}
                      sx={{
                        p: 1.5,
                        minWidth: { xs: 250, md: 280 },
                        flex: '0 0 auto',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        border: `1.5px solid ${active ? '#3B82F6' : '#e2e8f0'}`,
                        bgcolor: active ? '#eff6ff' : '#fff',
                        boxShadow: active ? '0 10px 24px rgba(59,130,246,.14)' : '0 5px 14px rgba(15,23,42,.05)',
                        transition: 'all .2s ease',
                        '&:hover': { transform: 'translateY(-2px)', borderColor: '#93c5fd', boxShadow: '0 12px 26px rgba(15,23,42,.1)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.3 }}>
                        <Box sx={{ width: 42, height: 42, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${color}14`, color }}>{loanIconMap[rule.loanType] || <AccountBalance />}</Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: navy, fontWeight: 900 }}>{rule.displayName}</Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '.78rem' }}>{getInterestRate(rule)}% p.a. | Up to {money(getMaxAmount(rule))}</Typography>
                        </Box>
                        <Chip label={getRuleStatus(rule)} size="small" sx={{ ...statusSx(getRuleStatus(rule)), fontWeight: 800 }} />
                      </Box>
                    </Paper>
                  );
                })}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            {selectedRule ? <LoanRuleDetails rule={selectedRule} /> : (
              <Card sx={cardSx}><CardContent><Typography sx={{ color: navy, fontWeight: 900 }}>No loan rule selected.</Typography></CardContent></Card>
            )}
          </Grid>
        </Grid>
        <LoanRuleDialog
          open={ruleDialogOpen}
          editingRule={editingRule}
          ruleForm={ruleForm}
          onClose={closeRuleDialog}
          onSave={saveRule}
          onFieldChange={updateRuleForm}
        />
      </PageShell>
    );
  };

  const LoanRuleDetails = ({ rule }) => {
    const headerColor = accentForIndex(configs.findIndex((item) => item._id === rule._id));
    const ruleStatus = getRuleStatus(rule);
    const generalRules = [
      { label: 'Interest Rate', value: `${getInterestRate(rule)}% p.a.`, icon: <Percent />, color: '#2563eb' },
      { label: 'Min Amount', value: money(rule.minAmount), icon: <AccountBalanceWallet />, color: '#2563eb' },
      { label: 'Max Amount', value: money(getMaxAmount(rule)), icon: <Savings />, color: '#16a34a' },
      { label: 'Tenure Period', value: `${getTenureMin(rule)} - ${getTenureMax(rule)} ${getTenureUnit(rule)}`, icon: <CalendarMonth />, color: '#7c3aed' },
      { label: 'Late EMI Penalty', value: `${getLatePenalty(rule)}% per EMI`, icon: <Payments />, color: '#dc2626' },
      { label: 'Processing Fee', value: `${getProcessingFee(rule)}%`, icon: <Paid />, color: '#f59e0b' },
      { label: 'Prepayment Charge', value: `${getPrepaymentCharge(rule)}%`, icon: <Rule />, color: '#0891b2' },
      { label: 'Status', value: ruleStatus, icon: ruleStatus === 'Active' ? <ToggleOn /> : <ToggleOff />, color: ruleStatus === 'Active' ? '#16a34a' : '#64748b' },
    ];
    return (
      <Card sx={cardSx}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box sx={{ width: 58, height: 58, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: `${headerColor}14`, color: headerColor }}>{loanIconMap[rule.loanType] || <AccountBalance />}</Box>
            <Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.25rem' }}>{rule.displayName}</Typography>
                <Chip label={ruleStatus} size="small" sx={{ ...statusSx(ruleStatus), fontWeight: 800 }} />
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '.84rem' }}>Configure limits, rates, tenure, penalties, and charges for this loan type.</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button startIcon={<Edit />} onClick={() => openRuleDialog(rule)} sx={{ color: navy, border: '1px solid #dbe3ef', borderRadius: '10px', fontWeight: 900 }}>Edit</Button>
            <Button startIcon={ruleStatus === 'Active' ? <ToggleOff /> : <ToggleOn />} onClick={() => toggleRule(rule)} sx={{ color: ruleStatus === 'Active' ? '#dc2626' : '#16a34a', border: '1px solid #dbe3ef', borderRadius: '10px', fontWeight: 900 }}>{ruleStatus === 'Active' ? 'Deactivate' : 'Activate'}</Button>
            <Button startIcon={<Delete />} onClick={() => deleteRule(rule)} sx={{ color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: 900 }}>Delete</Button>
          </Box>
        </Box>
        <CardContent sx={{ p: 2.5 }}>
          <Typography sx={{ color: navy, fontWeight: 900, mb: 1.5 }}>General Loan Rules</Typography>
          <Grid container spacing={1.6}>
            {generalRules.map((item) => (
              <Grid item xs={12} sm={6} lg={3} key={item.label}>
                <Paper sx={{ p: 1.7, border: '1px solid #dbe3ef', borderRadius: '14px', bgcolor: '#fff', boxShadow: '0 8px 18px rgba(15,23,42,.06)', display: 'flex', gap: 1.2, alignItems: 'center' }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${item.color}14`, color: item.color }}>{item.icon}</Box>
                  <Box><Typography sx={{ color: '#475569', fontSize: '.74rem', fontWeight: 800 }}>{item.label}</Typography><Typography sx={{ color: navy, fontWeight: 900, fontSize: '1rem' }}>{item.value}</Typography></Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const CustomerLoans = () => {
    const fromRecord = loanPagination.total === 0 ? 0 : ((loanPagination.page - 1) * loanPagination.limit) + 1;
    const toRecord = Math.min(loanPagination.total, loanPagination.page * loanPagination.limit);
    return (
      <PageShell
        title="Customer Loans"
        subtitle="Live customer loan records from applications, approvals, disbursals, and repayments."
        action={<ReportButton onClick={downloadCustomerLoansMonthlyReport} />}
      >
        <Box sx={{ bgcolor: '#f6f8fc', border: '1px solid #dbe3ef', borderRadius: '20px', p: { xs: 1.5, md: 2.5 }, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)' }}>
          <CustomerLoansFilters
            filters={loanFilters}
            classifications={activeClassifications}
            onChange={updateLoanFilter}
            onReset={resetLoanFilters}
          />
          <Paper sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 14px 34px rgba(15,23,42,.10)' }}>
            <Box sx={{ p: 2.25, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' }, borderBottom: '1px solid #e2e8f0' }}>
              <Box>
                <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.05rem' }}>Customer Loan Records</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '.82rem', mt: .25 }}>
                  {loansLoading ? 'Refreshing records...' : `${loanPagination.total} records found`}
                </Typography>
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '.82rem', fontWeight: 800 }}>
                Showing {fromRecord}-{toRecord} of {loanPagination.total}
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1680, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: navy }}>
                    {[
                      ['Customer Name', 160], ['Customer ID', 130], ['Email', 210], ['Classification', 130],
                      ['Loan Number', 150], ['Loan Type', 130], ['Requested Amount', 140], ['Approved Amount', 140],
                      ['Outstanding Balance', 160], ['Interest Rate', 120], ['Tenure', 110], ['Status', 130],
                      ['Applied Date', 130], ['Disbursed Date', 140], ['Next EMI Date', 140], ['Action', 100],
                    ].map(([heading, width]) => (
                      <TableCell key={heading} sx={{ width, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', py: 1.35 }}>{heading}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loansLoading && (
                    <TableRow>
                      <TableCell colSpan={16} sx={{ py: 6, textAlign: 'center' }}>
                        <CircularProgress size={30} sx={{ color: navy }} />
                        <Typography sx={{ color: '#64748b', mt: 1, fontWeight: 700 }}>Loading customer loans...</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loansLoading && loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={16} sx={{ py: 6, textAlign: 'center' }}>
                        <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1rem' }}>No customer loans found</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '.85rem', mt: .5 }}>Try changing filters or clearing the search box.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loansLoading && loans.map((loan) => {
                    const displayStatus = getLoanDisplayStatus(loan);
                    return (
                      <TableRow key={loan._id} sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#f8fafc' }, '& td': { borderColor: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', py: 1.25, color: '#0f172a' } }}>
                        <TableCell sx={{ fontWeight: 900 }}>{loan.userId?.name || 'Customer'}</TableCell>
                        <TableCell>{loan.userId?.customerId || loan.customerId || '-'}</TableCell>
                        <TableCell>{loan.userId?.email || '-'}</TableCell>
                        <TableCell>{loan.userId?.classification || loan.customerClassification || '-'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{loan.loanNumber}</TableCell>
                        <TableCell>{titleCase(loan.loanType)}</TableCell>
                        <TableCell>{money(loan.amount)}</TableCell>
                        <TableCell>{money(loan.approvedAmount)}</TableCell>
                        <TableCell sx={{ color: Number(loan.outstandingBalance || 0) > 0 ? '#dc2626 !important' : '#16a34a !important', fontWeight: 800 }}>{money(loan.outstandingBalance)}</TableCell>
                        <TableCell>{loan.interestRate}%</TableCell>
                        <TableCell>{loan.tenure} months</TableCell>
                        <TableCell><Chip label={displayStatus} size="small" sx={{ ...statusSx(displayStatus), fontWeight: 900, minWidth: 92 }} /></TableCell>
                        <TableCell>{date(loan.createdAt)}</TableCell>
                        <TableCell>{date(loan.disbursedAt)}</TableCell>
                        <TableCell>{date(loan.nextEMIDueDate)}</TableCell>
                        <TableCell><Button size="small" sx={{ color: navy, fontWeight: 900, borderRadius: '9px' }}>View</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.84rem' }}>
                Page {loanPagination.page || 1} of {loanPagination.pages || 1}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button startIcon={<ChevronLeft />} disabled={loansLoading || loanPagination.page <= 1} onClick={() => updateLoanFilter({ page: Math.max(1, loanPagination.page - 1) })} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 900, '&.Mui-disabled': { color: '#94a3b8' } }}>Previous</Button>
                <Button endIcon={<ChevronRight />} disabled={loansLoading || loanPagination.page >= loanPagination.pages} onClick={() => updateLoanFilter({ page: Math.min(loanPagination.pages, loanPagination.page + 1) })} sx={{ color: '#fff', bgcolor: navy, borderRadius: '10px', fontWeight: 900, '&:hover': { bgcolor: '#12336f' }, '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#64748b' } }}>Next</Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </PageShell>
    );
  };

  const EmiManagement = () => {
    const byStatus = emiSummary.byStatus || {};
    const kpis = [
      ['Total EMIs', emiSummary.totalEmis || emiPagination.total || 0, '#2563eb'],
      ['EMIs Collected', byStatus.Paid?.count || 0, '#16a34a'],
      ['EMIs Pending', byStatus.Pending?.count || 0, '#f59e0b'],
      ['Overdue EMIs', emiSummary.overdueCount || 0, '#dc2626'],
    ];
    const fromRecord = emiPagination.total === 0 ? 0 : ((emiPagination.page - 1) * emiPagination.limit) + 1;
    const toRecord = Math.min(emiPagination.total, emiPagination.page * emiPagination.limit);
    return (
      <PageShell title="EMI Management" subtitle="Live EMI records, collection status, overdue tracking, and monthly exports." action={<ReportButton onClick={downloadEmiMonthlyReport} />}>
        <Box sx={{ bgcolor: '#f6f8fc', border: '1px solid #dbe3ef', borderRadius: '20px', p: { xs: 1.5, md: 2.5 }, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)' }}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {kpis.map(([label, value, color]) => (
              <Grid item xs={12} sm={6} md={3} key={label}>
                <Card sx={cardSx}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Typography sx={{ color: navy, fontWeight: 900 }}>{label}</Typography>
                    <Typography sx={{ color, fontSize: '1.55rem', fontWeight: 900, mt: .5 }}>{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <EmiFilters filters={emiFilters} onChange={updateEmiFilter} onReset={resetEmiFilters} />
          <Paper sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 14px 34px rgba(15,23,42,.10)' }}>
            <Box sx={{ p: 2.25, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' }, borderBottom: '1px solid #e2e8f0' }}>
              <Box>
                <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.05rem' }}>EMI Payment Records</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '.82rem', mt: .25 }}>{emisLoading ? 'Refreshing records...' : `${emiPagination.total} records found`}</Typography>
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '.82rem', fontWeight: 800 }}>Showing {fromRecord}-{toRecord} of {emiPagination.total}</Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1480, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: navy }}>
                    {[
                      ['Customer Name', 160], ['Customer ID', 130], ['Loan Number', 150], ['EMI No', 95], ['Due Date', 130],
                      ['Principal Paid', 140], ['Interest Paid', 130], ['EMI Amount', 130], ['Outstanding Balance', 160],
                      ['Status', 120], ['Paid Date', 130], ['Payment Mode', 150], ['Action', 95],
                    ].map(([heading, width]) => (
                      <TableCell key={heading} sx={{ width, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', py: 1.35 }}>{heading}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emisLoading && (
                    <TableRow>
                      <TableCell colSpan={13} sx={{ py: 6, textAlign: 'center' }}>
                        <CircularProgress size={30} sx={{ color: navy }} />
                        <Typography sx={{ color: '#64748b', mt: 1, fontWeight: 700 }}>Loading EMI records...</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {!emisLoading && emis.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} sx={{ py: 6, textAlign: 'center' }}>
                        <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1rem' }}>No EMI records found</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '.85rem', mt: .5 }}>Try changing filters or clearing the search box.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {!emisLoading && emis.map((emi) => {
                    const displayStatus = getEmiDisplayStatus(emi);
                    return (
                      <TableRow key={emi._id} sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#f8fafc' }, '& td': { borderColor: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', py: 1.25, color: '#0f172a' } }}>
                        <TableCell sx={{ fontWeight: 900 }}>{emi.userId?.name || 'Customer'}</TableCell>
                        <TableCell>{emi.userId?.customerId || '-'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{emi.loanId?.loanNumber || '-'}</TableCell>
                        <TableCell>{emi.emiNumber}</TableCell>
                        <TableCell>{date(emi.dueDate)}</TableCell>
                        <TableCell>{money(emi.principalPaid)}</TableCell>
                        <TableCell>{money(emi.interestPaid)}</TableCell>
                        <TableCell>{money(emi.emiAmount)}</TableCell>
                        <TableCell sx={{ color: Number(emi.outstandingAfter || 0) > 0 ? '#dc2626 !important' : '#16a34a !important', fontWeight: 800 }}>{money(emi.outstandingAfter)}</TableCell>
                        <TableCell><Chip label={displayStatus} size="small" sx={{ ...statusSx(displayStatus), fontWeight: 900, minWidth: 88 }} /></TableCell>
                        <TableCell>{date(emi.paidAt)}</TableCell>
                        <TableCell>{emi.transactionRef ? 'Auto/Online Debit' : '-'}</TableCell>
                        <TableCell><Button size="small" sx={{ color: navy, fontWeight: 900, borderRadius: '9px' }}>View</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ color: '#64748b', fontWeight: 800, fontSize: '.84rem' }}>Page {emiPagination.page || 1} of {emiPagination.pages || 1}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button startIcon={<ChevronLeft />} disabled={emisLoading || emiPagination.page <= 1} onClick={() => updateEmiFilter({ page: Math.max(1, emiPagination.page - 1) })} sx={{ color: navy, border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 900, '&.Mui-disabled': { color: '#94a3b8' } }}>Previous</Button>
                <Button endIcon={<ChevronRight />} disabled={emisLoading || emiPagination.page >= emiPagination.pages} onClick={() => updateEmiFilter({ page: Math.min(emiPagination.pages, emiPagination.page + 1) })} sx={{ color: '#fff', bgcolor: navy, borderRadius: '10px', fontWeight: 900, '&:hover': { bgcolor: '#12336f' }, '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#64748b' } }}>Next</Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </PageShell>
    );
  };

  const FilterBar = ({ filters, setFilters, showClassification, emi }) => (
    <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} md={2}><TextField select fullWidth size="small" label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} sx={fieldSx}><MenuItem value="">All</MenuItem>{(emi ? emiStatuses : statuses).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} sm={6} md={2}><TextField select fullWidth size="small" label="Loan Type" value={filters.loanType} onChange={(e) => setFilters({ ...filters, loanType: e.target.value })} sx={fieldSx}><MenuItem value="">All</MenuItem>{loanTypes.map((t) => <MenuItem key={t} value={t}>{titleCase(t)}</MenuItem>)}</TextField></Grid>
        {showClassification && <Grid item xs={12} sm={6} md={2}><TextField select fullWidth size="small" label="Classification" value={filters.classification} onChange={(e) => setFilters({ ...filters, classification: e.target.value })} sx={fieldSx}><MenuItem value="">All</MenuItem>{activeClassifications.map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}</TextField></Grid>}
        {emi && <Grid item xs={12} sm={6} md={2}><TextField fullWidth size="small" label="Customer" value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })} sx={fieldSx} /></Grid>}
        <Grid item xs={12} sm={6} md={2}><TextField fullWidth size="small" type="month" label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value, startDate: '', endDate: '' })} InputLabelProps={{ shrink: true }} sx={fieldSx} /></Grid>
        <Grid item xs={12} sm={6} md={2}><TextField fullWidth size="small" type="date" label="Start Date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} /></Grid>
        <Grid item xs={12} sm={6} md={2}><TextField fullWidth size="small" type="date" label="End Date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} /></Grid>
      </Grid>
    </Paper>
  );

  const ReportButton = ({ onClick }) => <Button startIcon={<Download />} onClick={onClick} sx={{ bgcolor: navy, color: '#fff', borderRadius: '12px', px: 2.5, minHeight: 44, fontWeight: 900, '&:hover': { bgcolor: '#12336f', transform: 'translateY(-1px)' } }}>Download Monthly Report</Button>;
  const DataCard = ({ children }) => <Paper sx={{ ...cardSx, overflow: 'hidden' }}>{children}</Paper>;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {section === 'overview' && Overview()}
      {section === 'rules' && LoanRules()}
      {section === 'customer-loans' && CustomerLoans()}
      {section === 'emis' && EmiManagement()}
    </>
  );
};

export default AdminLoanManagement;
