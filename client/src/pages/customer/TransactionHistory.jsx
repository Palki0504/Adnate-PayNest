import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton, Button,
  InputAdornment, Alert, Skeleton, TableSortLabel, Grid,
} from '@mui/material';
import { Search, ArrowUpward, ArrowDownward, Clear, Download } from '@mui/icons-material';
import { transactionAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const statusColors = {
  completed: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  pending:   { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  failed:    { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  rejected:  { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const TransactionHistory = () => {
  const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalTransactions: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportMonth, setExportMonth] = useState(getCurrentMonth());
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await transactionAPI.getAll({
        page,
        limit: TABLE_ROWS_PER_PAGE,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        sortBy,
        sortOrder,
      });
      setTransactions(res.data.transactions);
      setPagination(res.data.pagination);
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 400);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const handleDownload = async () => {
    if (!exportMonth) return;

    try {
      setExporting(true);
      setError('');
      const response = await transactionAPI.exportMonthly({ month: exportMonth });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${exportMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download transaction sheet.');
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = search || typeFilter || statusFilter || categoryFilter;

  const tableHeaders = [
    { id: 'createdAt', label: 'Date & Time', sortable: true },
    { id: 'description', label: 'Description', sortable: false },
    { id: 'fromAccount', label: 'From Account', sortable: false },
    { id: 'toAccount', label: 'To Account', sortable: false },
    { id: 'category', label: 'Category', sortable: true },
    { id: 'type', label: 'Type', sortable: true },
    { id: 'status', label: 'Status', sortable: true },
    { id: 'amount', label: 'Amount', sortable: true },
    { id: 'reference', label: 'Reference', sortable: false },
  ];

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5, fontFamily: "'Inter', sans-serif" }}>
        Transaction History
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Search, filter, and sort all your transactions
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by description, reference..."
                size="small"
                fullWidth
                sx={inputSx}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '1.1rem' }} /></InputAdornment>,
                  endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')} sx={{ color: 'rgba(255,255,255,0.35)' }}><Clear fontSize="small" /></IconButton></InputAdornment> : null,
                }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel sx={labelSx}>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  {['credit', 'debit', 'transfer', 'overdraft'].map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel sx={labelSx}>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  {['completed', 'pending', 'failed', 'rejected'].map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel sx={labelSx}>Category</InputLabel>
                <Select value={categoryFilter} label="Category" onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  {['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'transfer', 'other'].map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                type="month"
                size="small"
                fullWidth
                sx={inputSx}
                InputProps={{ sx: { colorScheme: 'dark' } }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                startIcon={<Download />}
                onClick={handleDownload}
                disabled={exporting || !exportMonth}
                variant="contained"
                sx={{
                  height: 40,
                  textTransform: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#111827',
                  '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' },
                }}
              >
                {exporting ? 'Downloading...' : 'Download transaction sheet'}
              </Button>
            </Grid>
            {hasFilters && (
              <Grid item xs={6} sm={2}>
                <Box
                  onClick={clearFilters}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                    color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600,
                    '&:hover': { opacity: 0.8 },
                  }}
                >
                  <Clear fontSize="small" /> Clear Filters
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2.5, pb: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
            {pagination.totalTransactions} transactions found
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {tableHeaders.map((h) => (
                  <TableCell
                    key={h.id}
                    sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    {h.sortable ? (
                      <TableSortLabel
                        active={sortBy === h.id}
                        direction={sortBy === h.id ? sortOrder : 'asc'}
                        onClick={() => handleSort(h.id)}
                        sx={{
                          color: 'rgba(255,255,255,0.35) !important',
                          '& .MuiTableSortLabel-icon': { color: '#f59e0b !important' },
                          '&.Mui-active': { color: '#f59e0b !important' },
                        }}
                      >
                        {h.label}
                      </TableSortLabel>
                    ) : h.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {tableHeaders.map((h) => (
                      <TableCell key={h.id} sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Skeleton height={20} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const sc = statusColors[tx.status] || statusColors.completed;
                  const receiverName = tx.metadata?.receiverName || tx.metadata?.beneficiaryName || null;
                  const receiverCustomerId = tx.metadata?.receiverCustomerId || null;
                  return (
                    <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' }, transition: 'background 0.15s' }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{tx.description || '—'}</Typography>
                        {receiverName && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>To: {receiverName}</Typography>}
                        {receiverCustomerId && <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>ID: {receiverCustomerId}</Typography>}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {tx.fromAccountNumber ? (
                          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{tx.fromAccountNumber}</Typography>
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {tx.toAccountNumber ? (
                          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{tx.toAccountNumber}</Typography>
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={tx.category} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.7rem', textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {tx.type === 'credit' ? <ArrowDownward sx={{ color: '#22c55e', fontSize: '0.9rem' }} /> : <ArrowUpward sx={{ color: '#ef4444', fontSize: '0.9rem' }} />}
                          <Typography sx={{ color: tx.type === 'credit' ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>
                            {tx.type === 'overdraft_transfer' ? 'Overdraft Transfer' : tx.type}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={tx.status} size="small" sx={{ bgcolor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '0.7rem', textTransform: 'capitalize', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                        <Typography sx={{ color: tx.type === 'credit' ? '#22c55e' : '#ef4444', fontSize: '0.88rem', fontWeight: 700 }}>
                          {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
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
          totalRecords={pagination.totalTransactions}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Card>
    </Box>
  );
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
};
const labelSx = { color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#f59e0b' } };

export default TransactionHistory;
