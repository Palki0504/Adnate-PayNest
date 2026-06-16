import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  MenuItem,
  TableSortLabel,
} from '@mui/material';
import { Search, Refresh } from '@mui/icons-material';
import { managerAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const PERIOD_OPTIONS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'Last 6 Months', value: '6months' },
  { label: 'This Year', value: 'year' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Rejected', value: 'rejected' },
];

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Overdraft', value: 'overdraft' },
  { label: 'Overdraft Transfer', value: 'overdraft_transfer' },
];

const ManagerTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(TABLE_ROWS_PER_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit,
        search: search.trim(),
        period,
        sortBy,
        sortOrder,
      };
      if (status !== 'all') params.status = status;
      if (type !== 'all') params.type = type;

      const res = await managerAPI.getTransactions(params);
      const data = res.data;
      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalTransactions(data.totalTransactions || 0);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load transactions.');
      setTransactions([]);
      setTotalPages(1);
      setTotalTransactions(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, period, status, type, search, sortBy, sortOrder, refreshKey]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const formattedAmount = useMemo(
    () =>
      totalAmount.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }),
    [totalAmount]
  );

  const handleSort = (property) => {
    const isAsc = sortBy === property && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(property);
    setPage(1);
  };

  const pillStyles = (active) => ({
    color: active ? '#0a0e27' : '#fff',
    background: active ? '#f59e0b' : 'rgba(255,255,255,0.05)',
    borderColor: active ? 'transparent' : 'rgba(255,255,255,0.12)',
    minWidth: 100,
    textTransform: 'none',
    borderRadius: '999px',
    fontWeight: 600,
    fontSize: '0.8rem',
    '&:hover': { background: active ? '#d97706' : 'rgba(255,255,255,0.12)' },
  });

  const selectSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      borderRadius: '12px',
      background: '#09122c',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiSelect-icon': { color: '#fff' },
  };

  const selectMenuProps = {
    MenuProps: {
      PaperProps: {
        sx: {
          backgroundColor: '#1e293b',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.08)',
          '& .MuiMenuItem-root': {
            color: '#fff',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
            '&.Mui-selected': {
              backgroundColor: '#f59e0b',
              color: '#000',
              '&:hover': {
                backgroundColor: '#d97706',
              },
            },
          },
        },
      },
    },
  };

  return (
    <Box
      sx={{
        p: { xs: 1, md: 2 },
        minHeight: '100vh',
      }}
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, mb: 0.5 }}>
            Customer Transactions
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', maxWidth: 680 }}>
            Read-only interface to monitor all customer transactions, account activity, and transfers in real-time.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={() => setRefreshKey((prev) => prev + 1)}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#0a0e27',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '10px',
            '&:hover': { background: '#d97706' }
          }}
        >
          Refresh Now
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, rgba(245,158,11,0.1) 0%, rgba(9,15,40,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              minHeight: 140,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -28,
                right: -32,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(245,158,11,0.1)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 3, pb: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1.5 }}>
                Total Transactions Found
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>
                {totalTransactions.toLocaleString('en-IN')}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, fontSize: '0.85rem' }}>Based on selected filters</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, rgba(99,102,241,0.1) 0%, rgba(9,15,40,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              minHeight: 140,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -24,
                right: -28,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.1)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 3, pb: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1.5 }}>
                Total Transacted Amount
              </Typography>
              <Typography sx={{ color: '#818cf8', fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>
                {formattedAmount}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, fontSize: '0.85rem' }}>Based on selected filters</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: '20px', background: '#0c1227', border: '1px solid rgba(255,255,255,0.06)', mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search Reference, Customer Name, Account Number..."
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'rgba(255,255,255,0.45)' }} />
                    </InputAdornment>
                  ),
                  sx: { color: '#fff' },
                }}
                sx={{
                  background: '#09122c',
                  borderRadius: '12px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
                  }
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Type"
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                sx={selectSx}
                SelectProps={selectMenuProps}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                sx={selectSx}
                SelectProps={selectMenuProps}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Stack direction="row" flexWrap="wrap" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', mr: 1 }}>Period:</Typography>
            {PERIOD_OPTIONS.map((option) => (
              <Button key={option.value} onClick={() => { setPeriod(option.value); setPage(1); }} sx={pillStyles(period === option.value)}>
                {option.label}
              </Button>
            ))}

            <Box sx={{ ml: 'auto' }} />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: '20px', background: '#0c1227', border: '1px solid rgba(255,255,255,0.06)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading && transactions.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          ) : error ? (
            <Typography sx={{ color: '#f87171', py: 4, textAlign: 'center' }}>{error}</Typography>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow sx={{ background: 'rgba(255,255,255,0.02)' }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                        <TableSortLabel
                          active={sortBy === 'reference'}
                          direction={sortBy === 'reference' ? sortOrder : 'asc'}
                          onClick={() => handleSort('reference')}
                          sx={{ color: 'rgba(255,255,255,0.7) !important', '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' } }}
                        >
                          Transaction ID
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                        <TableSortLabel
                          active={sortBy === 'createdAt'}
                          direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                          onClick={() => handleSort('createdAt')}
                          sx={{ color: 'rgba(255,255,255,0.7) !important', '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' } }}
                        >
                          Date & Time
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Customer</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>From Account</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>To Account</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                        <TableSortLabel
                          active={sortBy === 'amount'}
                          direction={sortBy === 'amount' ? sortOrder : 'asc'}
                          onClick={() => handleSort('amount')}
                          sx={{ color: 'rgba(255,255,255,0.7) !important', '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' } }}
                        >
                          Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                          No transactions match your search/filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.8rem' }}>{tx.reference}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem' }}>
                            {new Date(tx.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell sx={{ color: '#fff', fontSize: '0.85rem' }}>
                            <Box>
                              <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{tx.user?.name || 'Unknown'}</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>ID: {tx.user?.customerId || tx.user?._id || '—'}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{tx.fromAccountNumber || '—'}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {tx.toAccountNumber || '—'}
                            {tx.beneficiaryName && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', mt: 0.25 }}>{tx.beneficiaryName}</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={tx.type === 'overdraft_transfer' ? 'OVERDRAFT TRANSFER' : tx.type?.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: tx.type === 'transfer' ? 'rgba(99,102,241,0.12)' : tx.type === 'deposit' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                color: tx.type === 'transfer' ? '#818cf8' : tx.type === 'deposit' ? '#4ade80' : '#f87171',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: tx.type === 'deposit' || tx.status === 'completed' ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                            {tx.type === 'deposit' ? '+' : '-'} {tx.amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={tx.status?.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: tx.status === 'completed' ? 'rgba(34,197,94,0.15)' : tx.status === 'pending' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)',
                                color: tx.status === 'completed' ? '#22c55e' : tx.status === 'pending' ? '#f97316' : '#ef4444',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                  Showing {transactions.length} of {totalTransactions} transactions
                </Typography>
                <TablePaginationControls
                  page={page}
                  totalRecords={totalTransactions}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ManagerTransactions;
