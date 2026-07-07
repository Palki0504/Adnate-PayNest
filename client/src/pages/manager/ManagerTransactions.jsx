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
    color: active ? '#fff' : '#0B1F4D',
    background: active ? 'linear-gradient(135deg, #2563eb, #0891b2)' : '#ffffff',
    border: active ? '1px solid transparent' : '1px solid #dbe7f5',
    minWidth: 100,
    textTransform: 'none',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '0.8rem',
    boxShadow: active ? '0 10px 22px rgba(37,99,235,0.24)' : '0 8px 18px rgba(15,23,42,0.08)',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: active ? 'linear-gradient(135deg, #1d4ed8, #0e7490)' : '#eff6ff',
      transform: 'translateY(-1px)',
    },
  });

  const selectSx = {
    '& .MuiOutlinedInput-root': {
      color: '#0f172a',
      borderRadius: '12px',
      background: '#ffffff',
      fontWeight: 700,
      '& fieldset': { borderColor: '#dbe7f5' },
      '&:hover fieldset': { borderColor: '#93c5fd' },
      '&.Mui-focused fieldset': { borderColor: '#2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.14)' },
    },
    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 700 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
    '& .MuiSelect-icon': { color: '#2563eb' },
  };

  const selectMenuProps = {
    MenuProps: {
      PaperProps: {
        sx: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          border: '1px solid #dbe7f5',
          boxShadow: '0 18px 42px rgba(15,23,42,0.18)',
          '& .MuiMenuItem-root': {
            color: '#0f172a',
            fontWeight: 700,
            '&:hover': {
              backgroundColor: '#eff6ff',
            },
            '&.Mui-selected': {
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              '&:hover': {
                backgroundColor: '#bfdbfe',
              },
            },
          },
        },
      },
    },
  };

  const summaryCardSx = (accent, tint) => ({
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #dbe7f5',
    minHeight: 140,
    boxShadow: '0 18px 42px rgba(2,12,36,0.16)',
    transition: 'all 0.22s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: `0 24px 54px ${tint}`,
    },
    '&:before': {
      content: '""',
      position: 'absolute',
      inset: '0 auto 0 0',
      width: 6,
      background: accent,
    },
  });

  const headCellSx = {
    color: '#0B1F4D',
    fontWeight: 900,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #cfe0f3',
    whiteSpace: 'nowrap',
  };

  const bodyCellSx = {
    color: '#1e293b',
    borderBottom: '1px solid #e5edf7',
    fontSize: '0.84rem',
  };

  const sortLabelSx = {
    color: '#0B1F4D !important',
    fontWeight: 900,
    '& .MuiTableSortLabel-icon': { color: '#2563eb !important' },
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
            background: 'linear-gradient(135deg, #2563eb, #0891b2)',
            color: '#ffffff',
            fontWeight: 800,
            textTransform: 'none',
            borderRadius: '14px',
            boxShadow: '0 12px 28px rgba(37,99,235,0.28)',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8, #0e7490)',
              transform: 'translateY(-2px)',
              boxShadow: '0 16px 34px rgba(37,99,235,0.34)',
            }
          }}
        >
          Refresh Now
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={summaryCardSx('linear-gradient(180deg, #2563eb, #06b6d4)', 'rgba(37,99,235,0.2)')}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -28,
                right: -32,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(37,99,235,0.1)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 3, pb: 3 }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5, fontWeight: 900 }}>
                Total Transactions Found
              </Typography>
              <Typography sx={{ color: '#0B1F4D', fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
                {totalTransactions.toLocaleString('en-IN')}
              </Typography>
              <Typography sx={{ color: '#64748b', mt: 1, fontSize: '0.85rem', fontWeight: 700 }}>Based on selected filters</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={summaryCardSx('linear-gradient(180deg, #10b981, #7c3aed)', 'rgba(16,185,129,0.2)')}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -24,
                right: -28,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.12)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 3, pb: 3 }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5, fontWeight: 900 }}>
                Total Transacted Amount
              </Typography>
              <Typography sx={{ color: '#047857', fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
                {formattedAmount}
              </Typography>
              <Typography sx={{ color: '#64748b', mt: 1, fontSize: '0.85rem', fontWeight: 700 }}>Based on selected filters</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card
        sx={{
          borderRadius: '20px',
          background: '#ffffff',
          border: '1px solid #dbe7f5',
          mb: 3,
          boxShadow: '0 18px 42px rgba(2,12,36,0.16)',
        }}
      >
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
                      <Search sx={{ color: '#2563eb' }} />
                    </InputAdornment>
                  ),
                  sx: { color: '#0f172a', fontWeight: 700 },
                }}
                sx={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    '& fieldset': { borderColor: '#dbe7f5' },
                    '&:hover fieldset': { borderColor: '#93c5fd' },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.14)' },
                  },
                  '& input::placeholder': { color: '#64748b', opacity: 1 },
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
            <Typography sx={{ color: '#475569', fontSize: '0.8rem', mr: 1, fontWeight: 900 }}>Period:</Typography>
            {PERIOD_OPTIONS.map((option) => (
              <Button key={option.value} onClick={() => { setPeriod(option.value); setPage(1); }} sx={pillStyles(period === option.value)}>
                {option.label}
              </Button>
            ))}

            <Box sx={{ ml: 'auto' }} />
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: '20px',
          background: '#ffffff',
          border: '1px solid #dbe7f5',
          boxShadow: '0 18px 42px rgba(2,12,36,0.16)',
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {loading && transactions.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#2563eb' }} />
            </Box>
          ) : error ? (
            <Typography sx={{ color: '#dc2626', py: 4, textAlign: 'center', fontWeight: 800 }}>{error}</Typography>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ background: '#ffffff', boxShadow: 'none' }}>
                <Table sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow sx={{ background: '#eff6ff' }}>
                      <TableCell sx={headCellSx}>
                        <TableSortLabel
                          active={sortBy === 'reference'}
                          direction={sortBy === 'reference' ? sortOrder : 'asc'}
                          onClick={() => handleSort('reference')}
                          sx={sortLabelSx}
                        >
                          Transaction ID
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={headCellSx}>
                        <TableSortLabel
                          active={sortBy === 'createdAt'}
                          direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                          onClick={() => handleSort('createdAt')}
                          sx={sortLabelSx}
                        >
                          Date & Time
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={headCellSx}>Customer</TableCell>
                      <TableCell sx={headCellSx}>From Account</TableCell>
                      <TableCell sx={headCellSx}>To Account</TableCell>
                      <TableCell sx={headCellSx}>Type</TableCell>
                      <TableCell sx={headCellSx}>
                        <TableSortLabel
                          active={sortBy === 'amount'}
                          direction={sortBy === 'amount' ? sortOrder : 'asc'}
                          onClick={() => handleSort('amount')}
                          sx={sortLabelSx}
                        >
                          Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={headCellSx}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', color: '#64748b', fontWeight: 800, borderBottom: 0 }}>
                          No transactions match your search/filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow
                          key={tx._id}
                          sx={{
                            background: '#ffffff',
                            transition: 'background 0.18s ease',
                            '&:hover': { background: '#f1f7ff' },
                          }}
                        >
                          <TableCell sx={{ ...bodyCellSx, color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 900 }}>{tx.reference}</TableCell>
                          <TableCell sx={{ ...bodyCellSx, color: '#475569', fontWeight: 700 }}>
                            {new Date(tx.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell sx={bodyCellSx}>
                            <Box>
                              <Typography sx={{ color: '#0f172a', fontSize: '0.85rem', fontWeight: 900 }}>{tx.user?.name || 'Unknown'}</Typography>
                              <Typography sx={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700 }}>ID: {tx.user?.customerId || tx.user?._id || '-'}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ ...bodyCellSx, color: '#334155', fontFamily: 'monospace', fontWeight: 800 }}>{tx.fromAccountNumber || '-'}</TableCell>
                          <TableCell sx={{ ...bodyCellSx, color: '#334155', fontFamily: 'monospace', fontWeight: 800 }}>
                            {tx.toAccountNumber || '-'}
                            {tx.beneficiaryName && (
                              <Typography sx={{ color: '#64748b', fontSize: '0.68rem', mt: 0.25, fontWeight: 700 }}>{tx.beneficiaryName}</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={bodyCellSx}>
                            <Chip
                              label={tx.type === 'overdraft_transfer' ? 'OVERDRAFT TRANSFER' : tx.type?.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: tx.type === 'transfer' ? '#dbeafe' : tx.type === 'deposit' ? '#dcfce7' : tx.type === 'overdraft' || tx.type === 'overdraft_transfer' ? '#ede9fe' : '#fee2e2',
                                color: tx.type === 'transfer' ? '#1d4ed8' : tx.type === 'deposit' ? '#15803d' : tx.type === 'overdraft' || tx.type === 'overdraft_transfer' ? '#6d28d9' : '#dc2626',
                                fontWeight: 900,
                                fontSize: '0.65rem',
                                border: '1px solid currentColor',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ ...bodyCellSx, color: tx.type === 'deposit' ? '#15803d' : '#dc2626', fontWeight: 900, fontSize: '0.9rem' }}>
                            {tx.type === 'deposit' ? '+' : '-'} {tx.amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                          </TableCell>
                          <TableCell sx={bodyCellSx}>
                            <Chip
                              label={tx.status?.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: tx.status === 'completed' ? '#dcfce7' : tx.status === 'pending' ? '#ffedd5' : tx.status === 'processing' ? '#dbeafe' : '#fee2e2',
                                color: tx.status === 'completed' ? '#15803d' : tx.status === 'pending' ? '#c2410c' : tx.status === 'processing' ? '#1d4ed8' : '#dc2626',
                                fontWeight: 900,
                                fontSize: '0.65rem',
                                border: '1px solid currentColor',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5edf7', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 800 }}>
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
