import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  Skeleton, FormControl, InputLabel, Select, MenuItem, Grid, InputAdornment,
} from '@mui/material';
import { Search, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const statusColors = {
  completed: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  failed: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const TransactionMonitoring = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const rowsPerPage = TABLE_ROWS_PER_PAGE;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getTransactions({
        page, limit: rowsPerPage,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        _ts: Date.now(),
      });
      setTransactions(Array.isArray(res.data.transactions) ? res.data.transactions : []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 350);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const inputSx = {
    '--mui-field-label-bg': '#151933',
    '& .MuiOutlinedInput-root': { color: '#fff', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', minHeight: 44, overflow: 'visible', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#818cf8' } },
    '& .MuiInputBase-input': { color: '#fff', WebkitTextFillColor: '#fff', lineHeight: 1.45 },
    '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.42)', opacity: 1 },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.62)', backgroundColor: 'var(--mui-field-label-bg)', px: 0.75, zIndex: 2, overflow: 'visible' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
    '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Transaction Monitoring</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>All system-wide transactions</Typography>

      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by description, reference..."
                size="small"
                fullWidth
                sx={inputSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.35)' }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  {['credit', 'debit', 'transfer', 'overdraft'].map((t) => (
                    <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  {['completed', 'pending', 'failed', 'rejected'].map((s) => (
                    <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{total} transactions found</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Date', 'Customer', 'Description', 'Type', 'Status', 'Amount', 'Reference'].map((h) => (
                  <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.05)' }}><Skeleton height={20} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>No records found</TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const sc = statusColors[tx.status] || statusColors.completed;
                  return (
                    <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{tx.userId?.name || '—'}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>{tx.userId?.email}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '—'}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {tx.type === 'credit' ? <ArrowDownward sx={{ color: '#22c55e', fontSize: '0.85rem' }} /> : <ArrowUpward sx={{ color: '#ef4444', fontSize: '0.85rem' }} />}
                          <Typography sx={{ color: tx.type === 'credit' ? '#22c55e' : '#ef4444', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>{tx.type}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={tx.status} size="small" sx={{ bgcolor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '0.68rem', fontWeight: 600, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                        <Typography sx={{ color: tx.type === 'credit' ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                          {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {tx.reference?.substring(0, 14)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls
          page={page}
          totalRecords={total}
          onPageChange={setPage}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Card>
    </Box>
  );
};

export default TransactionMonitoring;
