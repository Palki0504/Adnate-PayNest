import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, TextField, InputAdornment,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Collapse, IconButton, Grid, Divider, Button, FormControl, InputLabel,
  Select, MenuItem, Alert,
} from '@mui/material';
import { Search, ExpandMore, ExpandLess, AccountBalance, Download, RestartAlt } from '@mui/icons-material';
import { managerAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';
import { getAccountTypeLabel } from '../../constants/accountTypes';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (date) => {
  if (!date) return 'Not provided';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Not provided';
  return `${String(value.getDate()).padStart(2, '0')}-${shortMonthNames[value.getMonth()]}-${value.getFullYear()}`;
};

const accountTypeColors = { savings: '#16a34a', current: '#2563eb', salary: '#7c3aed' };

const DetailItem = ({ label, value, tone = 'default' }) => {
  const color = tone === 'accent' ? '#b45309' : tone === 'success' ? '#15803d' : '#334155';

  return (
    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 72 }}>
      <Typography sx={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color, fontSize: '0.9rem', fontWeight: 700, mt: 0.5, wordBreak: 'break-word' }}>
        {value || 'Not provided'}
      </Typography>
    </Box>
  );
};

const CustomerRow = ({ customer, rowIndex }) => {
  const [expanded, setExpanded] = useState(false);
  const displayName = getDisplayName(customer.name, 'Customer');
  const guardian = customer.guardianDetails || {};

  return (
    <>
      <TableRow sx={{ bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc', '&:hover': { background: '#fff7ed' } }}>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 38, height: 38, background: '#fff7ed', color: '#c2410c', fontSize: '0.88rem', fontWeight: 800, border: '1px solid #fed7aa' }}>
              {displayName.charAt(0)}
            </Avatar>
            <Box>
              <Typography sx={{ color: '#0f172a', fontSize: '0.88rem', fontWeight: 800 }}>{displayName}</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>{customer.email}</Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ color: '#475569', borderColor: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}>
          {customer.phone || 'Not provided'}
        </TableCell>
        <TableCell sx={{ color: '#334155', borderColor: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
          {formatDate(customer.createdAt)}
        </TableCell>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <Typography sx={{ color: '#0f766e', fontWeight: 800, fontSize: '0.9rem' }}>{formatCurrency(customer.totalBalance)}</Typography>
        </TableCell>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <Typography sx={{ color: customer.totalODUsed > 0 ? '#dc2626' : '#64748b', fontWeight: 800, fontSize: '0.82rem' }}>
            {customer.totalODUsed > 0 ? formatCurrency(customer.totalODUsed) : '-'}
          </Typography>
        </TableCell>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <Chip
            label={customer.isActive ? 'Active' : 'Inactive'}
            size="small"
            sx={{
              bgcolor: customer.isActive ? '#dcfce7' : '#fee2e2',
              color: customer.isActive ? '#166534' : '#991b1b',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}
          />
        </TableCell>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <Chip
            label={customer.isKycComplete ? 'KYC Verified' : 'KYC Pending'}
            size="small"
            sx={{
              bgcolor: customer.isKycComplete ? '#dcfce7' : '#fef3c7',
              color: customer.isKycComplete ? '#166534' : '#92400e',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}
          />
        </TableCell>
        <TableCell sx={{ borderColor: '#e2e8f0' }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: '#475569', '&:hover': { color: '#d97706', bgcolor: '#fff7ed' } }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ borderColor: '#e2e8f0', p: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: { xs: 2, md: 2.5 }, background: '#ffffff' }}>
              <Typography sx={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 800, mb: 1.5 }}>
                Profile Details
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Customer ID" value={customer.customerId} tone="accent" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Full Name" value={displayName} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Email Address" value={customer.email} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Phone Number" value={customer.phone} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Primary Account" value={getAccountTypeLabel(customer.primaryAccountType)} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Classification" value={customer.classification || 'PENDING'} tone="accent" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Date of Birth" value={formatDate(customer.dateOfBirth)} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Joined On" value={formatDate(customer.createdAt)} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Aadhaar Card" value={customer.maskedAadhaarNumber || (customer.hasAadhaar ? 'Saved' : 'Not provided')} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="PAN Card" value={customer.maskedPanNumber || (customer.hasPan ? 'Saved' : 'Not provided')} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="Customer Status" value={customer.isActive ? 'Active' : 'Inactive'} tone={customer.isActive ? 'success' : 'default'} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DetailItem label="KYC Status" value={customer.isKycComplete ? 'Complete' : 'Incomplete'} tone={customer.isKycComplete ? 'success' : 'accent'} />
                </Grid>
              </Grid>

              {(guardian.name || guardian.relationship || guardian.phone || guardian.dateOfBirth) && (
                <>
                  <Divider sx={{ borderColor: '#e2e8f0', my: 2 }} />
                  <Typography sx={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 800, mb: 1.5 }}>
                    Guardian Details
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} md={3}>
                      <DetailItem label="Guardian Name" value={guardian.name} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DetailItem label="Relationship" value={guardian.relationship} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DetailItem label="Guardian Phone" value={guardian.phone} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DetailItem label="Guardian DOB" value={formatDate(guardian.dateOfBirth)} />
                    </Grid>
                  </Grid>
                </>
              )}

              <Divider sx={{ borderColor: '#e2e8f0', my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AccountBalance sx={{ color: '#d97706', fontSize: 20 }} />
                <Typography sx={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 800 }}>
                  Account Details
                </Typography>
              </Box>
              <Grid container spacing={1.5}>
                {(customer.accounts || []).map((acc) => (
                  <Grid item xs={12} sm={6} md={4} key={acc._id}>
                    <Box sx={{ p: 1.5, borderRadius: '8px', background: '#f8fafc', border: `1px solid ${accountTypeColors[acc.accountType] || '#94a3b8'}` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                        <Typography sx={{ color: '#0f172a', fontSize: '0.78rem', textTransform: 'capitalize', fontWeight: 800 }}>
                          {acc.accountTypeLabel || getAccountTypeLabel(acc.accountType)}
                        </Typography>
                        <Chip label={acc.classification || customer.classification || 'PENDING'} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#ffedd5', color: '#9a3412' }} />
                      </Box>
                      <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', mb: 0.5 }}>{acc.accountNumber}</Typography>
                      <Typography sx={{ color: '#0f766e', fontSize: '0.92rem', fontWeight: 800 }}>{formatCurrency(acc.balance)}</Typography>
                      {acc.overdraftUsed > 0 && (
                        <Typography sx={{ color: '#dc2626', fontSize: '0.72rem', mt: 0.35, fontWeight: 700 }}>
                          OD Used: {formatCurrency(acc.overdraftUsed)}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
                {(customer.accounts || []).length === 0 && (
                  <Grid item xs={12}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.85rem' }}>No accounts available for this customer.</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const CustomerMonitoring = () => {
  const now = new Date();
  const defaultFilters = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    search: '',
    status: 'all',
  };

  const [customers, setCustomers] = useState([]);
  const [years, setYears] = useState([defaultFilters.year]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const { page, setPage, paginatedRecords: paginatedCustomers } = useTablePagination(customers, [appliedFilters, customers.length]);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const res = await managerAPI.getCustomerYears();
        setYears(res.data.years?.length ? res.data.years : [defaultFilters.year]);
      } catch {
        setYears([defaultFilters.year]);
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await managerAPI.getCustomers({
          year: appliedFilters.year,
          month: appliedFilters.month,
          search: appliedFilters.search || undefined,
          status: appliedFilters.status,
        });
        setCustomers(res.data.customers || []);
        setPage(1);
      } catch (err) {
        setCustomers([]);
        setError(err.response?.data?.message || 'Unable to load customers.');
      } finally {
        setLoading(false);
      }
    };
    loadCustomers();
  }, [appliedFilters]);

  const handleSearch = () => {
    setAppliedFilters({
      ...filters,
      year: Number(filters.year),
      month: Number(filters.month),
    });
  };

  const applyFilterChange = (nextValues) => {
    setFilters((prev) => {
      const nextFilters = { ...prev, ...nextValues };
      setAppliedFilters({
        ...nextFilters,
        year: Number(nextFilters.year),
        month: Number(nextFilters.month),
      });
      return nextFilters;
    });
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const response = await managerAPI.downloadCustomerMonthlyReport({
        year: appliedFilters.year,
        month: appliedFilters.month,
        search: appliedFilters.search || undefined,
        status: appliedFilters.status,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Adnate_PayNest_Monthly_Customer_Registration_Report_${appliedFilters.year}-${String(appliedFilters.month).padStart(2, '0')}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to download monthly customer report.');
    } finally {
      setDownloading(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: '#0f172a',
      borderRadius: '10px',
      background: '#ffffff',
      '& fieldset': { borderColor: '#cbd5e1' },
      '&:hover fieldset': { borderColor: '#f59e0b' },
      '&.Mui-focused fieldset': { borderColor: '#d97706' },
    },
    '& .MuiInputBase-input::placeholder': { color: '#64748b', opacity: 1 },
  };

  const selectSx = {
    ...inputSx,
    '& .MuiInputLabel-root': { color: '#475569', fontWeight: 700 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#d97706' },
    '& .MuiSelect-icon': { color: '#475569' },
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Customer Monitoring</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.88rem', mb: 4 }}>
        Inspect customer profile, KYC, account, balance, and overdraft details
      </Typography>

      <Card sx={{ mb: 3, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 18px 45px rgba(15,23,42,0.12)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small" sx={selectSx}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={filters.year}
                  label="Year"
                  onChange={(e) => applyFilterChange({ year: e.target.value })}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>{year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small" sx={selectSx}>
                <InputLabel>Month</InputLabel>
                <Select
                  value={filters.month}
                  label="Month"
                  onChange={(e) => applyFilterChange({ month: e.target.value })}
                >
                  {monthNames.map((month, index) => (
                    <MenuItem key={month} value={index + 1}>{month}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Name, Customer ID, Email, or Account Number"
                size="small"
                fullWidth
                sx={inputSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#64748b' }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small" sx={selectSx}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => applyFilterChange({ status: e.target.value })}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Button
                  variant="contained"
                  startIcon={<Search />}
                  onClick={handleSearch}
                  sx={{ bgcolor: '#f59e0b', color: '#0f172a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#d97706' } }}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  onClick={handleReset}
                  sx={{ borderColor: '#94a3b8', color: '#334155', fontWeight: 800, textTransform: 'none' }}
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  disabled={downloading}
                  onClick={handleDownload}
                  sx={{ bgcolor: '#0f766e', color: '#ffffff', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#115e59' } }}
                >
                  {downloading ? 'Downloading...' : 'Download Monthly Report'}
                </Button>
              </Box>
            </Grid>
          </Grid>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 18px 45px rgba(15,23,42,0.14)', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {['Customer', 'Phone', 'Joining Date', 'Total Balance', 'OD Used', 'Status', 'KYC', 'Details'].map((h) => (
                  <TableCell key={h} sx={{ bgcolor: '#f8fafc', color: '#334155', borderColor: '#e2e8f0', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: '#e2e8f0' }}>
                        <Skeleton height={22} sx={{ bgcolor: '#e2e8f0' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: '#64748b', border: 'none', fontWeight: 700 }}>
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((c, index) => <CustomerRow key={c._id} customer={c} rowIndex={index} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ borderTop: '1px solid #e2e8f0', color: '#334155' }}>
          <TablePaginationControls page={page} totalRecords={customers.length} onPageChange={setPage} />
        </Box>
      </Card>
    </Box>
  );
};

export default CustomerMonitoring;
