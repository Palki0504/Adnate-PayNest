import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  Grid,
  InputAdornment,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  CheckCircle,
  History,
  ReceiptLong,
  Refresh,
  Search,
  Visibility,
  Cancel,
} from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

const classificationLabel = (val) => (val === 'GOLD' ? 'Gold' : val === 'PLATINUM' ? 'Platinum' : 'Silver');

const CLASSIFICATION_STYLES = {
  Gold:     { color: '#b7791f', bg: '#fff7db', border: '#f6d365' },
  Silver:   { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  Platinum: { color: '#6d28d9', bg: '#f5f0ff', border: '#c4b5fd' },
};

const STATUS_STYLES = {
  ACTIVE:               { label: 'Active',               color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  DEACTIVATED:          { label: 'Deactivated',          color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
};

const OverdraftManagement = () => {
  // ── Main table state ─────────────────────────────────────────────────────
  const [accounts, setAccounts]     = useState([]);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState('');
  const [summary,  setSummary]      = useState(null);
  const [chartData, setChartData]   = useState([]);
  const [search,   setSearch]       = useState('');
  const [page,     setPage]         = useState(1);



  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await adminAPI.getOverdraftSummary({ _ts: Date.now() });
      setSummary(res.data);
    } catch (err) {
      console.error(err);
      setSummary(null);
    }
  }, []);

  const fetchChart = useCallback(async () => {
    try {
      const res = await adminAPI.getOverdraftMonthlyUsage({ _ts: Date.now() });
      const records = Array.isArray(res.data.data) ? res.data.data : [];
      const map = {};
      records.forEach((d) => {
        const { year, month } = d._id;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        map[key] = d.totalOD;
      });
      const now = new Date();
      const arr = [];
      for (let i = 11; i >= 0; i--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        arr.push({
          month: dt.toLocaleString('default', { month: 'short', year: 'numeric' }),
          value: map[key] || 0,
        });
      }
      setChartData(arr);
    } catch (err) {
      console.error(err);
      setChartData([]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getOverdraftAccounts({ page: 1, limit: 500, _ts: Date.now() });
      setAccounts(Array.isArray(res.data.accounts) ? res.data.accounts : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load overdraft accounts.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchSummary();
    fetchChart();
    fetchAccounts();
  }, [fetchSummary, fetchChart, fetchAccounts]);



  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(refreshAll, 15000);
    window.addEventListener('focus', refreshAll);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshAll);
    };
  }, [refreshAll]);




  // ── Filtered / paginated data ─────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      accounts.filter((acc) => {
        if (!search) return true;
        const query = search.toLowerCase();
        return (
          (acc.customerId || '').toString().toLowerCase().includes(query) ||
          (acc.customerName || '').toLowerCase().includes(query) ||
          (acc.userId?.name || '').toLowerCase().includes(query) ||
          (acc.accountType || '').toLowerCase().includes(query) ||
          (acc.accountNumber || '').toLowerCase().includes(query) ||
          (acc.classification || '').toLowerCase().includes(query)
        );
      }),
    [accounts, search]
  );

  const paginatedAccounts = useMemo(
    () => filtered.slice((page - 1) * TABLE_ROWS_PER_PAGE, page * TABLE_ROWS_PER_PAGE),
    [filtered, page]
  );



  useEffect(() => { setPage(1); }, [search]);

  // ── Chips ──────────────────────────────────────────────────────────────────
  const renderStatusChip = (status = 'ACTIVE') => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.ACTIVE;
    return (
      <Chip
        label={style.label}
        size="small"
        sx={{ height: 24, borderRadius: '999px', color: style.color, bgcolor: style.bg, border: `1px solid ${style.border}`, fontSize: '0.68rem', fontWeight: 800 }}
      />
    );
  };

  const renderClassificationChip = (classification) => {
    const label = classificationLabel(classification);
    const style = CLASSIFICATION_STYLES[label] || CLASSIFICATION_STYLES.Silver;
    return (
      <Chip
        label={label}
        size="small"
        sx={{ height: 23, borderRadius: '999px', color: style.color, bgcolor: style.bg, border: `1px solid ${style.border}`, fontSize: '0.68rem', fontWeight: 800 }}
      />
    );
  };



  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = [
    { title: 'Total OD Accounts', value: summary ? summary.totalODAccounts : '-', icon: <AccountBalance sx={{ fontSize: '1.25rem' }} />, color: '#0ea5e9', bg: '#e0f2fe' },
    { title: 'Monthly Requests',  value: summary ? summary.monthlyODRequests : '-', icon: <ReceiptLong sx={{ fontSize: '1.25rem' }} />, color: '#ea580c', bg: '#ffedd5' },
  ];

  return (
    <Box sx={{ minHeight: '100%', bgcolor: '#f5f7fb', borderRadius: '18px', p: { xs: 1.25, sm: 1.5 }, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* Header */}
      <Box sx={{ px: 0.25 }}>
        <Typography sx={{ color: '#0f172a', fontSize: '1.35rem', fontWeight: 800 }}>Overdraft Management</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.3 }}>Centralized control for customer overdraft facilities</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: '10px', py: 0.25 }}>{error}</Alert>}

      {/* Summary cards */}
      <Grid container spacing={1.25} alignItems="stretch">
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={6} key={card.title} sx={{ display: 'flex' }}>
            <Card sx={{ width: '100%', minHeight: 108, borderRadius: '12px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 8px 22px rgba(15,23,42,0.06)' }}>
              <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>{card.title}</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: { xs: '1.12rem', sm: '1.25rem' }, fontWeight: 900, mt: 1, lineHeight: 1.15, wordBreak: 'break-word' }}>{card.value}</Typography>
                </Box>
                <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: card.bg, color: card.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{card.icon}</Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Chart */}
      <Card sx={{ bgcolor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 22px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75, gap: 1 }}>
            <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>Monthly Overdraft Usage</Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>Last 12 months</Typography>
          </Box>
          <Box sx={{ width: '100%', height: { xs: 150, md: 172 } }}>
            {chartData.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress size={24} sx={{ color: '#0f3a66' }} />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overdraftUsageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(val) => (val >= 1000 ? `INR ${Math.round(val / 1000)}k` : `INR ${val}`)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ReTooltip
                    formatter={(value) => [formatCurrency(value), 'Usage']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.12)' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 800 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0f3a66" strokeWidth={2.5} fill="url(#overdraftUsageGradient)" activeDot={{ r: 5, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* ── Overdraft Accounts ───────────────────────────────────────── */}
      <Card sx={{ flex: 1, minHeight: 0, bgcolor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 22px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.25, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 1, borderBottom: '1px solid #e2e8f0' }}>
            <Box>
              <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>Overdraft Accounts</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.72rem', mt: 0.25 }}>{filtered.length} accounts found</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                placeholder="Search customer, ID, or classification"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ width: { xs: '100%', md: 360 }, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8fafc', fontSize: '0.82rem' } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#64748b' }} /></InputAdornment> }}
              />
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={refreshAll}
                sx={{ borderRadius: '10px', borderColor: '#cbd5e1', color: '#0f3a66', fontWeight: 800, textTransform: 'none' }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

            {loading ? (
              <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress size={26} sx={{ color: '#0f3a66' }} /></Box>
            ) : (
              <>
                <TableContainer component={Paper} sx={{ flex: 1, maxHeight: { xs: 420, lg: 370 }, boxShadow: 'none', borderRadius: 0 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        {['Customer Name', 'Customer ID', 'Account Type', 'Account Number', 'Classification', 'OD Limit', 'Used OD Amount', 'Available OD', 'Outstanding Amount', 'Penalty Amount', 'Total Due', 'Monthly Usage', 'Interest Rate', 'Status'].map((h) => (
                          <TableCell
                            key={h}
                            align={['OD Limit', 'Used OD Amount', 'Available OD', 'Outstanding Amount', 'Penalty Amount', 'Total Due', 'Monthly Usage', 'Interest Rate'].includes(h) ? 'right' : 'left'}
                            sx={{ bgcolor: '#0f3a66', color: '#fff', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', py: 0.95, borderBottom: 'none', whiteSpace: 'nowrap' }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={14} sx={{ textAlign: 'center', py: 5, color: '#64748b' }}>No records found</TableCell></TableRow>
                      ) : (
                        paginatedAccounts.map((acc) => {
                          const odUsed      = acc.overdraftUsed  || 0;
                          const available   = Math.max(0, (acc.overdraftLimit || 0) - odUsed);
                          const monthlyUsage = acc.monthlyUsageCount || acc.monthlyOverdraftCount || 0;
                          const penalty     = acc.penaltyAmount || 0;
                          const totalDue    = acc.totalAmountDue || 0;
                          return (
                            <TableRow key={acc._id} hover sx={{ bgcolor: 'transparent', '&:nth-of-type(even)': { bgcolor: '#f8fafc' }, '&:hover': { bgcolor: '#e0f2fe !important' } }}>
                              <TableCell sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', minWidth: 150 }}>{acc.customerName || acc.userId?.name || '-'}</TableCell>
                              <TableCell sx={{ color: '#0f3a66', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{acc.customerId || '-'}</TableCell>
                              <TableCell sx={{ color: '#334155', fontWeight: 700, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', textTransform: 'capitalize' }}>{acc.accountType || '-'}</TableCell>
                              <TableCell sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{acc.accountNumber || '-'}</TableCell>
                              <TableCell sx={{ py: 0.85, borderBottom: '1px solid #e2e8f0' }}>{renderClassificationChip(acc.classification)}</TableCell>
                              <TableCell align="right" sx={{ color: '#0f3a66', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(acc.overdraftLimit)}</TableCell>
                              <TableCell align="right" sx={{ color: '#dc2626', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(odUsed)}</TableCell>
                              <TableCell align="right" sx={{ color: '#15803d', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(available)}</TableCell>
                              <TableCell align="right" sx={{ color: '#dc2626', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(acc.outstandingAmount || odUsed)}</TableCell>
                              <TableCell align="right" sx={{ color: penalty > 0 ? '#dc2626' : '#64748b', fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(penalty)}</TableCell>
                              <TableCell align="right" sx={{ color: totalDue > 0 ? '#7c3aed' : '#64748b', fontWeight: 800, fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatCurrency(totalDue)}</TableCell>
                              <TableCell align="right" sx={{ color: '#475569', fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0' }}>{`${monthlyUsage}/3`}</TableCell>
                              <TableCell align="right" sx={{ color: '#475569', fontSize: '0.76rem', py: 0.85, borderBottom: '1px solid #e2e8f0' }}>{`${acc.interestRate || 0}%`}</TableCell>
                              <TableCell sx={{ py: 0.85, borderBottom: '1px solid #e2e8f0' }}>{renderStatusChip(monthlyUsage >= 3 ? 'DEACTIVATED' : 'ACTIVE')}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePaginationControls
                  page={page}
                  totalRecords={filtered.length}
                  onPageChange={setPage}
                  sx={{ borderTop: '1px solid #e2e8f0' }}
                />
              </>
            )}
          </CardContent>
      </Card>

    </Box>
  );
};

export default OverdraftManagement;
