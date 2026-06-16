import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  TextField,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fade,
  Stack,
  IconButton,
  Tooltip,
  TableSortLabel,
} from '@mui/material';
import {
  Edit,
  Add,
  Delete,
  Refresh,
  Category,
  Group,
  Search,
  CheckCircle,
} from '@mui/icons-material';
import { classificationAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const CustomerClassifications = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(0);

  // Central Customers state
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [sortBy, setSortBy] = useState('customerId');
  const [sortOrder, setSortOrder] = useState('asc');

  // Classification Dialog Edit state
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedCust, setSelectedCust] = useState(null);
  const [targetClass, setTargetClass] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  // Original Requests states
  const [requests, setRequests] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState(null);
  const [definitionForm, setDefinitionForm] = useState({
    name: '',
    dailyTransferLimit: '',
    monthlyTransferLimit: '',
    overdraftLimit: '',
    overdraftPenaltyPerDay: '',
  });
  const [savingDefinition, setSavingDefinition] = useState(false);
  const [definitionError, setDefinitionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingDefinition, setDeletingDefinition] = useState(false);
  const [selectedMap, setSelectedMap] = useState({});
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');
  const {
    page: customersPage,
    setPage: setCustomersPage,
    paginatedRecords: paginatedCustomers,
  } = useTablePagination(customers, [activeTab, searchCustomer, filterClass, sortBy, sortOrder, customers.length]);
  const {
    page: requestsPage,
    setPage: setRequestsPage,
    paginatedRecords: paginatedRequests,
  } = useTablePagination(requests, [activeTab, search, requests.length]);

  // Shared field styles used across inputs in this page
  const fieldSx = {
    '--mui-field-label-bg': '#121731',
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      background: 'transparent',
      minHeight: 44,
      overflow: 'visible',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputBase-input': {
      color: '#fff',
      WebkitTextFillColor: '#fff',
      lineHeight: 1.45,
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255,255,255,0.62)',
      backgroundColor: 'var(--mui-field-label-bg)',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
    '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.72)' },
  };

  const lightDialogFieldSx = {
    '--mui-field-label-bg': '#ffffff',
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      color: '#111827',
      minHeight: 58,
      overflow: 'visible',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputBase-input': {
      color: '#111827',
      WebkitTextFillColor: '#111827',
      lineHeight: 1.45,
      paddingTop: '16.5px',
      paddingBottom: '16.5px',
    },
    '& .MuiInputLabel-root': {
      color: '#4B5563',
      backgroundColor: 'var(--mui-field-label-bg)',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#d97706',
    },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
  };

  // Helper: toggle sort column and direction
  const handleRequestSort = (property) => {
    const isAsc = sortBy === property && sortOrder === 'asc';
    setSortBy(property);
    setSortOrder(isAsc ? 'desc' : 'asc');
  };

  // Helper: classification chip styles
  const getClassificationChipStyles = (classification) => {
    const map = {
      PENDING: { bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.12)' },
      SILVER: { bgcolor: 'rgba(147,197,253,0.12)', color: '#60a5fa', border: '1px solid rgba(147,197,253,0.12)' },
      GOLD: { bgcolor: 'rgba(250,204,21,0.12)', color: '#f59e0b', border: '1px solid rgba(250,204,21,0.12)' },
      PLATINUM: { bgcolor: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.12)' },
      default: { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' },
    };
    return map[classification] || map.default;
  };

  const activeClassifications = classifications.filter((cls) => cls.isActive !== false);
  const defaultClassificationName = activeClassifications[0]?.name || '';
  const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

  const loadDefinitions = async () => {
    const classRes = await classificationAPI.getDefinitions();
    setClassifications(classRes.data.classifications || []);
    return classRes.data.classifications || [];
  };

  // Load Requests (Original pending tab)
  const loadRequests = async () => {
    try {
      setLoading(true);
      const [requestsRes, classRes] = await Promise.all([
        classificationAPI.getRequests({ status: 'Pending', search }),
        classificationAPI.getDefinitions(),
      ]);

      setRequests(requestsRes.data.requests || []);
      setSummary({
        totalCustomers: requestsRes.data.totalCustomers || 0,
        pendingCount: requestsRes.data.pendingCount || 0,
        approvedCount: requestsRes.data.approvedCount || 0,
        rejectedCount: requestsRes.data.rejectedCount || 0,
      });
      setClassifications(classRes.data.classifications || []);
      setSelectedMap({});
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Unable to load classification requests.' });
    } finally {
      setLoading(false);
    }
  };

  // Load Customer classifications (New centralized tab)
  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const params = {};
      if (searchCustomer.trim()) params.search = searchCustomer.trim();
      if (filterClass !== 'ALL') params.classification = filterClass;
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      const res = await classificationAPI.getCustomers(params);
      setCustomers(res.data.customers || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Unable to load customer list.' });
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [search]);

  useEffect(() => {
    loadDefinitions().catch((err) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Unable to load classification definitions.' });
    });
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [searchCustomer, filterClass, sortBy, sortOrder]);

  const handleApprove = async (requestId) => {
    const selected = selectedMap[requestId] || defaultClassificationName;
    if (!selected) {
      setMessage({ type: 'error', text: 'Create a classification before approving requests.' });
      return;
    }
    try {
      setLoading(true);
      await classificationAPI.approveRequest(requestId, { classification: selected });
      setMessage({ type: 'success', text: `Classification request approved as ${selected}.` });
      await Promise.all([loadRequests(), loadCustomers()]);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Unable to approve request.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setLoading(true);
      await classificationAPI.rejectRequest(requestId, { comments: 'Rejected by admin' });
      setMessage({ type: 'success', text: 'Classification request rejected.' });
      await Promise.all([loadRequests(), loadCustomers()]);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Unable to reject request.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (requestId) => (event) => {
    setSelectedMap((prev) => ({ ...prev, [requestId]: event.target.value }));
  };

  const openNewDefinitionDialog = () => {
    setEditingDefinition(null);
    setDefinitionError('');
    setDefinitionForm({ name: '', dailyTransferLimit: '', monthlyTransferLimit: '', overdraftLimit: '', overdraftPenaltyPerDay: '' });
    setDefinitionDialogOpen(true);
  };

  const openEditDefinitionDialog = (classification) => {
    setEditingDefinition(classification);
    setDefinitionError('');
    setDefinitionForm({
      name: classification.name || '',
      dailyTransferLimit: classification.dailyTransferLimit ?? '',
      monthlyTransferLimit: classification.monthlyTransferLimit ?? '',
      overdraftLimit: classification.overdraftLimit ?? '',
      overdraftPenaltyPerDay: classification.overdraftPenaltyPerDay ?? '',
    });
    setDefinitionDialogOpen(true);
  };

  const handleDefinitionFormChange = (field) => (event) => {
    const value = field === 'name' ? event.target.value.toUpperCase() : event.target.value;
    setDefinitionForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveDefinition = async (event) => {
    event?.preventDefault();
    setDefinitionError('');
    const payload = {
      name: definitionForm.name.trim().toUpperCase(),
      dailyTransferLimit: Number(definitionForm.dailyTransferLimit),
      monthlyTransferLimit: Number(definitionForm.monthlyTransferLimit),
      overdraftLimit: Number(definitionForm.overdraftLimit),
      overdraftPenaltyPerDay: Number(definitionForm.overdraftPenaltyPerDay),
    };

    if (!payload.name || [payload.dailyTransferLimit, payload.monthlyTransferLimit, payload.overdraftLimit, payload.overdraftPenaltyPerDay].some((value) => Number.isNaN(value) || value < 0)) {
      setDefinitionError('Enter a unique name and valid non-negative limits.');
      return;
    }

    try {
      setSavingDefinition(true);
      const res = editingDefinition
        ? await classificationAPI.updateDefinition(editingDefinition._id, payload)
        : await classificationAPI.createDefinition(payload);
      setMessage(res.data.emailError
        ? { type: 'warning', text: `${res.data.message} ${res.data.emailError}` }
        : { type: 'success', text: res.data.message || 'Classification saved successfully.' });
      setDefinitionDialogOpen(false);
      await Promise.all([loadDefinitions(), loadCustomers(), loadRequests()]);
    } catch (err) {
      setDefinitionError(err.response?.data?.message || 'Failed to save classification.');
    } finally {
      setSavingDefinition(false);
    }
  };

  const confirmDeleteDefinition = (classification) => {
    setDeleteTarget(classification);
  };

  const deleteDefinition = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingDefinition(true);
      const res = await classificationAPI.deleteDefinition(deleteTarget._id);
      setMessage({ type: 'success', text: res.data.message || 'Classification deleted successfully.' });
      setDeleteTarget(null);
      await Promise.all([loadDefinitions(), loadCustomers(), loadRequests()]);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete classification.' });
    } finally {
      setDeletingDefinition(false);
    }
  };

  // New tab handlers
  const handleOpenEdit = (customer) => {
    setSelectedCust(customer);
    setTargetClass(customer.classification === 'PENDING' ? '' : customer.classification || '');
    setAssignmentError('');
    setOpenEditDialog(true);
  };
  const handleSaveClassification = async () => {
    setAssignmentError('');
    if (!selectedCust || !targetClass) {
      setAssignmentError('Select a classification tier before applying.');
      return;
    }
    try {
      setLoadingCustomers(true);
      await classificationAPI.updateCustomerClassification(selectedCust.id, { classification: targetClass });
      setMessage({ type: 'success', text: `Successfully updated ${selectedCust.name}'s classification to ${targetClass}.` });
      setOpenEditDialog(false);
      setSelectedCust(null);
      await Promise.all([loadCustomers(), loadRequests()]);
    } catch (err) {
      setAssignmentError(err.response?.data?.message || 'Failed to update customer classification.');
    } finally {
      setLoadingCustomers(false);
    }
  };
  
    const isSaveClassificationDisabled = !targetClass;

    return (
      <Box>
        {/* Dynamic Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Total Customers', value: summary.totalCustomers, color: '#38bdf8', icon: <Group /> },
          { label: 'Pending Requests', value: summary.pendingCount, color: '#f59e0b', icon: <Category /> },
          { label: 'Approved Requests', value: summary.approvedCount, color: '#22c55e', icon: <CheckCircle /> },
          { label: 'Tier Types Available', value: classifications.length || 3, color: '#a855f7', icon: <Category /> },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' } }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {card.label}
                  </Typography>
                  <Typography sx={{ color: '#fff', fontSize: '1.9rem', fontWeight: 800 }}>
                    {card.value ?? 0}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.05)', color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newTab) => setActiveTab(newTab)}
          sx={{
            '& .MuiTabs-indicator': { bgcolor: '#f59e0b' },
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' },
            '& .Mui-selected': { color: '#f59e0b !important' },
          }}
        >
          <Tab label="All Customer Classifications" />
          <Tab label={`Pending Requests (${summary.pendingCount || 0})`} />
        </Tabs>
      </Box>

      {/* Classification Definitions */}
      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Classification Rules</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>Database-driven limits used across accounts, transfers, dashboards, and overdraft workflows.</Typography>
            </Box>
            <Button startIcon={<Add />} onClick={openNewDefinitionDialog} variant="contained" sx={{ textTransform: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#111827', fontWeight: 800, borderRadius: '10px' }}>
              New Classification
            </Button>
          </Box>
          <Grid container spacing={2}>
            {classifications.map((cls) => (
              <Grid item xs={12} md={4} key={cls._id}>
                <Card sx={{ height: '100%', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                      <Chip label={cls.name} size="small" sx={{ ...getClassificationChipStyles(cls.name), fontWeight: 800 }} />
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit Classification">
                          <IconButton size="small" onClick={() => openEditDefinitionDialog(cls)} sx={{ color: '#f59e0b' }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Classification">
                          <IconButton size="small" onClick={() => confirmDeleteDefinition(cls)} sx={{ color: '#ef4444' }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Stack spacing={0.75}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>Daily: <strong>{currency(cls.dailyTransferLimit)}</strong></Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>Monthly: <strong>{currency(cls.monthlyTransferLimit)}</strong></Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>Overdraft: <strong>{currency(cls.overdraftLimit)}</strong></Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>OD Penalty / Day: <strong>{currency(cls.overdraftPenaltyPerDay)}</strong></Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            {/* Search and Filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
              <TextField
                label="Search Customer ID or Name"
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                sx={{ minWidth: 280, ...fieldSx }}
                size="small"
                InputProps={{
                  startAdornment: <Search sx={{ color: 'rgba(255,255,255,0.4)', mr: 1 }} />,
                  sx: { color: '#fff' },
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
              />

              <FormControl size="small" sx={{ minWidth: 180, ...fieldSx }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Classification Type</InputLabel>
                <Select
                  value={filterClass}
                  label="Classification Type"
                  onChange={(e) => setFilterClass(e.target.value)}
                  sx={{ color: '#fff' }}
                >
                  <MenuItem value="ALL">All Classifications</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  {classifications.map((cls) => (
                    <MenuItem key={cls._id} value={cls.name}>{cls.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                startIcon={<Refresh />}
                onClick={() => loadCustomers()}
                variant="outlined"
                sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)', textTransform: 'none', borderRadius: '10px', height: '40px', '&:hover': { borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)' } }}
              >
                Refresh List
              </Button>
            </Box>

            {loadingCustomers ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress sx={{ color: '#f59e0b' }} />
              </Box>
            ) : customers.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', py: 8, textAlign: 'center', fontSize: '0.95rem' }}>
                No customers found matching your criteria.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>
                        <TableSortLabel
                          active={sortBy === 'customerId'}
                          direction={sortBy === 'customerId' ? sortOrder : 'asc'}
                          onClick={() => handleRequestSort('customerId')}
                          sx={{
                            color: 'inherit',
                            '&.Mui-active': { color: '#f59e0b' },
                            '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' },
                          }}
                        >
                          Customer ID
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>
                        <TableSortLabel
                          active={sortBy === 'name'}
                          direction={sortBy === 'name' ? sortOrder : 'asc'}
                          onClick={() => handleRequestSort('name')}
                          sx={{
                            color: 'inherit',
                            '&.Mui-active': { color: '#f59e0b' },
                            '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' },
                          }}
                        >
                          Customer Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>Email</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>Account Type(s)</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>
                        <TableSortLabel
                          active={sortBy === 'classification'}
                          direction={sortBy === 'classification' ? sortOrder : 'asc'}
                          onClick={() => handleRequestSort('classification')}
                          sx={{
                            color: 'inherit',
                            '&.Mui-active': { color: '#f59e0b' },
                            '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' },
                          }}
                        >
                          Current Classification
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }}>Status</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, py: 1.5 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedCustomers.map((cust) => (
                      <TableRow key={cust.id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.03)' }, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <TableCell sx={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600 }}>{cust.customerId}</TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 600 }}>{cust.name}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{cust.email}</TableCell>
                        <TableCell sx={{ color: '#fff' }}>
                          {cust.accountTypes && cust.accountTypes.length > 0 ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {cust.accountTypes.map((t) => (
                                <Chip
                                  key={t}
                                  label={t.charAt(0).toUpperCase() + t.slice(1)}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}
                                />
                              ))}
                            </Stack>
                          ) : (
                            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>None</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cust.classification}
                            size="small"
                            sx={{ ...getClassificationChipStyles(cust.classification), fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cust.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            sx={{
                              bgcolor: cust.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                              color: cust.isActive ? '#4ade80' : '#f87171',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit Classification">
                              <IconButton size="small" onClick={() => handleOpenEdit(cust)} sx={{ color: '#f59e0b', bgcolor: 'rgba(245,158,11,0.06)', '&:hover': { bgcolor: 'rgba(245,158,11,0.15)' } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls page={customersPage} totalRecords={customers.length} onPageChange={setCustomersPage} />
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
              <TextField
                label="Search by customer name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ minWidth: 280, ...fieldSx }}
                size="small"
                InputProps={{
                  startAdornment: <Search sx={{ color: 'rgba(255,255,255,0.4)', mr: 1 }} />,
                  sx: { color: '#fff' },
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
              />
              <Button
                startIcon={<Refresh />}
                onClick={() => loadRequests()}
                variant="outlined"
                sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)', textTransform: 'none', borderRadius: '10px', height: '40px', '&:hover': { borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)' } }}
              >
                Refresh
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress sx={{ color: '#f59e0b' }} />
              </Box>
            ) : requests.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', py: 8, textAlign: 'center', fontSize: '0.95rem' }}>
                There are no pending classification requests right now.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Customer</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Requested Role</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Requested Classification</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Current Classification</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }}>Submitted</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 700 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedRequests.map((request) => (
                      <TableRow key={request._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.03)' }, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                          <Typography sx={{ fontWeight: 600 }}>{request.userId?.name || 'Unknown'}</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{request.userId?.email}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>{request.userId?.role || 'customer'}</TableCell>
                        <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                          <Typography sx={{ fontWeight: 700 }}>{request.requestedClassification}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                          {request.userId?.classification || 'PENDING'}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                          <Chip
                            label={request.status}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(245,158,11,0.12)',
                              color: '#f59e0b',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.08)' }}>
                          {new Date(request.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }} align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <FormControl size="small" sx={{ minWidth: 140, ...fieldSx }}>
                              <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Approve as</InputLabel>
                              <Select
                                value={selectedMap[request._id] || (request.requestedClassification === 'PENDING' ? defaultClassificationName : request.requestedClassification)}
                                label="Approve as"
                                onChange={handleSelectChange(request._id)}
                                sx={{ color: '#fff' }}
                              >
                                {classifications.map((cls) => (
                                  <MenuItem key={cls._id} value={cls.name}>{cls.name}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Button
                              onClick={() => handleApprove(request._id)}
                              variant="contained"
                              sx={{ textTransform: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', fontWeight: 700 }}
                            >
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleReject(request._id)}
                              variant="outlined"
                              sx={{ textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}
                            >
                              Reject
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls page={requestsPage} totalRecords={requests.length} onPageChange={setRequestsPage} />
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Classification Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        TransitionComponent={Fade}
        transitionDuration={200}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            color: '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            backgroundImage: 'none',
            p: 0,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 700, px: 3, pt: 3, pb: 2, backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
          Update Classification
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', color: '#111827', px: 3, py: 2 }}>
          {selectedCust && (
            <Stack spacing={2.5} sx={{ color: '#111827' }}>
              {assignmentError && <Alert severity="error">{assignmentError}</Alert>}
              <Box>
                <Typography sx={{ color: '#6B7280', fontSize: '0.85rem' }}>Customer ID & Name</Typography>
                <Typography sx={{ color: '#111827', fontWeight: 600, fontSize: '1rem' }}>
                  {selectedCust.name} ({selectedCust.customerId})
                </Typography>
              </Box>

              <FormControl
                fullWidth
                size="medium"
                sx={{
                  '--mui-field-label-bg': '#ffffff',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    background: '#FFFFFF',
                    color: '#111827',
                    minHeight: 58,
                    overflow: 'visible',
                    '& fieldset': { borderColor: '#D1D5DB' },
                    '&:hover fieldset': { borderColor: '#9CA3AF' },
                    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#6B7280',
                    backgroundColor: 'var(--mui-field-label-bg)',
                    px: 0.75,
                    zIndex: 2,
                    overflow: 'visible',
                  },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
                  '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
                  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
                }}
              >
                <InputLabel sx={{ color: '#6B7280' }}>Classification Tier</InputLabel>
                <Select
                  value={targetClass}
                  label="Classification Tier"
                  onChange={(e) => setTargetClass(e.target.value)}
                  sx={{
                    color: '#111827',
                    minHeight: '56px',
                    backgroundColor: '#FFFFFF',
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: '#FFFFFF',
                        color: '#111827',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                      },
                    },
                  }}
                >
                  <MenuItem value="" disabled sx={{ color: '#6B7280' }}>
                    Pending
                  </MenuItem>
                  {classifications.map((cls) => (
                    <MenuItem key={cls._id} value={cls.name}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB' }}>
          <Button onClick={() => setOpenEditDialog(false)} sx={{ textTransform: 'none', color: '#4B5563', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveClassification}
            variant="contained"
            disabled={isSaveClassificationDisabled}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              opacity: isSaveClassificationDisabled ? 0.65 : 1,
            }}
          >
            Apply Tier
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Classification Definition Dialog */}
      <Dialog
        open={definitionDialogOpen}
        onClose={() => setDefinitionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            color: '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#111827' }}>{editingDefinition ? 'Edit Classification' : 'New Classification'}</DialogTitle>
        <Box component="form" onSubmit={saveDefinition}>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', color: '#111827' }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {definitionError && <Alert severity="error">{definitionError}</Alert>}
            <TextField label="Classification Name" value={definitionForm.name} onChange={handleDefinitionFormChange('name')} fullWidth InputLabelProps={{ shrink: true }} sx={lightDialogFieldSx} />
            <TextField label="Daily Transfer Limit" value={definitionForm.dailyTransferLimit} onChange={handleDefinitionFormChange('dailyTransferLimit')} type="number" fullWidth InputLabelProps={{ shrink: true }} sx={lightDialogFieldSx} />
            <TextField label="Monthly Transfer Limit" value={definitionForm.monthlyTransferLimit} onChange={handleDefinitionFormChange('monthlyTransferLimit')} type="number" fullWidth InputLabelProps={{ shrink: true }} sx={lightDialogFieldSx} />
            <TextField label="Overdraft Limit" value={definitionForm.overdraftLimit} onChange={handleDefinitionFormChange('overdraftLimit')} type="number" fullWidth InputLabelProps={{ shrink: true }} sx={lightDialogFieldSx} />
            <TextField label="Overdraft Penalty Per Day" value={definitionForm.overdraftPenaltyPerDay} onChange={handleDefinitionFormChange('overdraftPenaltyPerDay')} type="number" fullWidth InputLabelProps={{ shrink: true }} inputProps={{ min: 0 }} sx={lightDialogFieldSx} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setDefinitionDialogOpen(false)} sx={{ textTransform: 'none', color: '#4B5563', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button type="submit" disabled={savingDefinition} variant="contained" sx={{ textTransform: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#111827', fontWeight: 800 }}>
            {savingDefinition ? 'Saving...' : 'Save Classification'}
          </Button>
        </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { backgroundColor: '#FFFFFF', color: '#111827', borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 800 }}>Delete Classification</DialogTitle>
        <DialogContent sx={{ color: '#111827' }}>
          <Typography sx={{ color: '#374151' }}>
            Delete {deleteTarget?.name}? This is only allowed when no customers or accounts are assigned to it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', color: '#4B5563', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button onClick={deleteDefinition} disabled={deletingDefinition} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 800 }}>
            {deletingDefinition ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerClassifications;
