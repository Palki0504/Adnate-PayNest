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
} from '@mui/material';
import { Search, Refresh } from '@mui/icons-material';
import { transactionAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';

const PERIOD_OPTIONS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'Last 6 Months', value: '6months' },
  { label: 'This Year', value: 'year' },
];

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
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
        sortBy: 'createdAt',
        sortOrder: 'desc',
        _ts: Date.now(),
      };
      const res = await transactionAPI.getAdminAll(params);
      const data = res.data;
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
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
  }, [page, limit, period, search, refreshKey]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 15000);
    const refreshOnFocus = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
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

  const pillStyles = (active) => ({
    color: active ? '#0b132a' : '#fff',
    background: active ? '#7c3aed' : 'rgba(255,255,255,0.05)',
    borderColor: active ? 'transparent' : 'rgba(255,255,255,0.12)',
    minWidth: 120,
    textTransform: 'none',
    borderRadius: '999px',
    '&:hover': { background: active ? '#6d28d9' : 'rgba(255,255,255,0.12)' },
  });

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        minHeight: '100vh',
        background: 'radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 20%), linear-gradient(180deg, #07101f 0%, #0b0f26 100%)',
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#fff', fontSize: { xs: '1.9rem', md: '2.4rem' }, fontWeight: 800, mb: 1 }}>
          Transaction Monitoring
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem', maxWidth: 680 }}>
          Monitor every customer transfer in real time. Use search, filters, and period controls to quickly pinpoint suspicious or high-value activity.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '26px',
              background: 'linear-gradient(180deg, rgba(14,165,233,0.16) 0%, rgba(9,30,63,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              minHeight: 180,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -28,
                right: -32,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(14,165,233,0.16)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 5, pb: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 2 }}>
                Total Transactions
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>
                {totalTransactions.toLocaleString('en-IN')}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, fontSize: '0.95rem' }}>All Time</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '26px',
              background: 'linear-gradient(180deg, rgba(124,58,237,0.18) 0%, rgba(13,19,54,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              minHeight: 180,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -24,
                right: -28,
                width: 112,
                height: 112,
                borderRadius: '50%',
                background: 'rgba(168,85,247,0.16)',
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, pt: 5, pb: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 2 }}>
                Total Amount
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>
                {formattedAmount}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, fontSize: '0.95rem' }}>All Time</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: '26px', background: '#0d1431', border: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by Transaction ID, Sender, Receiver, or Account"
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
                sx={{ background: '#09122c', borderRadius: '14px' }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchTransactions}
                fullWidth
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.12)',
                  height: '100%',
                }}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>

          <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mt: 3 }}>
            {PERIOD_OPTIONS.map((option) => (
              <Button key={option.value} onClick={() => setPeriod(option.value)} sx={pillStyles(period === option.value)}>
                {option.label}
              </Button>
            ))}
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchTransactions}
              sx={{
                ml: 'auto',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.12)',
                '&:hover': { borderColor: 'rgba(255,255,255,0.24)' },
              }}
            >
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: '26px', background: '#0c1227', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#7c3aed' }} />
            </Box>
          ) : error ? (
            <Typography sx={{ color: '#f87171', py: 4, textAlign: 'center' }}>{error}</Typography>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table sx={{ minWidth: 1100 }}>
                  <TableHead>
                    <TableRow sx={{ background: 'rgba(255,255,255,0.03)' }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Transaction ID</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Date & Time</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Sender Name</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>From Account</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>To Account</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Receiver Name</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Amount</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ py: 8, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.04)' }, borderRadius: '16px' }}>
                          <TableCell sx={{ color: '#fff', fontFamily: 'monospace' }}>{tx.reference}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {new Date(tx.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell sx={{ color: '#fff' }}>{tx.senderName || tx.user?.name || 'Unknown'}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{tx.fromAccountNumber || '—'}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{tx.toAccountNumber || '—'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>
                            {tx.receiverName || tx.metadata?.receiverName || tx.metadata?.receiverNickname || 'Unknown'}
                          </TableCell>
                          <TableCell sx={{ color: '#93c5fd', fontWeight: 700 }}>
                            {tx.type === 'overdraft_transfer' ? 'Overdraft Transfer' : tx.type}
                          </TableCell>
                          <TableCell sx={{ color: '#22c55e', fontWeight: 700 }}>
                            {tx.amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={tx.status?.charAt(0).toUpperCase() + tx.status?.slice(1)}
                              size="small"
                              sx={{
                                bgcolor: tx.status === 'completed' ? 'rgba(34,197,94,0.12)' : tx.status === 'pending' ? 'rgba(249,115,22,0.12)' : 'rgba(244,63,94,0.12)',
                                color: tx.status === 'completed' ? '#4ade80' : tx.status === 'pending' ? '#f97316' : '#f43f5e',
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
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

export default AdminTransactions;
