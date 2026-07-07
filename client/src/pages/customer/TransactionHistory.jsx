import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowDownward,
  ArrowUpward,
  CalendarMonth,
  Clear,
  Download,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  ReceiptLong,
  Search,
} from '@mui/icons-material';
import { transactionAPI } from '../../services/api';
import { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const statusColors = {
  completed: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  pending: { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
  failed: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  rejected: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  processing: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
};

const categoryColors = {
  salary: { bg: '#dbeafe', color: '#0969da', border: '#bfdbfe' },
  deposit: { bg: '#ccfbf1', color: '#047857', border: '#99f6e4' },
  transfer: { bg: '#ffedd5', color: '#ea580c', border: '#fed7aa' },
  shopping: { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' },
  other: { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
  emi: { bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' },
  food: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  utilities: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  travel: { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
  entertainment: { bg: '#fae8ff', color: '#a21caf', border: '#f5d0fe' },
};

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

const TransactionHistory = () => {
  const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalTransactions: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportMonth, setExportMonth] = useState(getCurrentMonth());
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(TABLE_ROWS_PER_PAGE);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await transactionAPI.getAll({
        page,
        limit: rowsPerPage,
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
  }, [page, rowsPerPage, search, typeFilter, statusFilter, categoryFilter, sortBy, sortOrder]);

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

  const totalTransactions = Number(pagination.totalTransactions || 0);
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(totalTransactions / rowsPerPage));
  const hasFilters = search || typeFilter || statusFilter || categoryFilter;
  const firstRecord = totalTransactions ? (page - 1) * rowsPerPage + 1 : 0;
  const lastRecord = Math.min(page * rowsPerPage, totalTransactions);
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((pageNumber) => totalPages <= 5 || pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1);

  const getCategoryStyle = (category = '') =>
    categoryColors[String(category).toLowerCase()] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };

  const getDateParts = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return { date: '-', time: '' };
    return {
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  const isCreditTransaction = (type = '') => String(type).toLowerCase() === 'credit';
  const prettyType = (type = '') => String(type || '-').replace(/_/g, ' ');
  const renderAccount = (value, role) => {
    if (!value) return <Typography sx={dashSx}>-</Typography>;
    const color = role === 'from' ? '#6d28d9' : role === 'creditTo' ? '#047857' : '#ea580c';
    return <Typography sx={{ ...accountSx, color }}>{value}</Typography>;
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography sx={{ color: '#fff', fontSize: { xs: '1.55rem', md: '1.8rem' }, fontWeight: 900, mb: 0.7 }}>
        Transactions
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.98rem', mb: 3.4, fontWeight: 600 }}>
        Search, filter, and sort all your transactions
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '14px' }}>{error}</Alert>}

      <Card sx={{ mb: 2.4, background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '18px', boxShadow: '0 18px 42px rgba(0,0,0,0.16)' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.2 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                lg: 'minmax(240px, 1.35fr) repeat(3, minmax(116px, .62fr)) minmax(132px, .68fr) minmax(178px, .9fr)',
              },
              gap: 1.6,
              alignItems: 'center',
            }}
          >
            <TextField
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search by description, reference ID..."
              size="small"
              fullWidth
              sx={inputSx}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '1.15rem' }} /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel sx={labelSx}>Type</InputLabel>
              <Select value={typeFilter} label="Type" onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                <MenuItem value="">All</MenuItem>
                {['credit', 'debit', 'transfer', 'overdraft'].map((type) => <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>{type}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel sx={labelSx}>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                <MenuItem value="">All</MenuItem>
                {['completed', 'pending', 'failed', 'rejected'].map((status) => <MenuItem key={status} value={status} sx={{ textTransform: 'capitalize' }}>{status}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel sx={labelSx}>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                <MenuItem value="">All</MenuItem>
                {['food', 'shopping', 'utilities', 'travel', 'entertainment', 'salary', 'deposit', 'transfer', 'emi', 'other'].map((category) => (
                  <MenuItem key={category} value={category} sx={{ textTransform: 'capitalize' }}>{category}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              value={exportMonth}
              onChange={(event) => setExportMonth(event.target.value)}
              type="month"
              size="small"
              fullWidth
              sx={inputSx}
              InputProps={{
                startAdornment: <InputAdornment position="start"><CalendarMonth sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 19 }} /></InputAdornment>,
                sx: { colorScheme: 'dark' },
              }}
            />

            <Button
              fullWidth
              startIcon={<Download />}
              onClick={handleDownload}
              disabled={exporting || !exportMonth}
              variant="contained"
              sx={{
                height: 52,
                minWidth: 0,
                px: { xs: 1.4, lg: 1.6 },
                textTransform: 'none',
                borderRadius: '11px',
                fontWeight: 900,
                fontSize: { xs: '0.82rem', lg: '0.86rem', xl: '0.92rem' },
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#071b3a',
                boxShadow: '0 16px 28px rgba(245,158,11,0.24)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'all 0.22s ease',
                '& .MuiButton-startIcon': { mr: 0.8, flexShrink: 0 },
                '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', transform: 'translateY(-2px)', boxShadow: '0 20px 34px rgba(245,158,11,0.34)' },
                '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' },
              }}
            >
              {exporting ? 'Downloading...' : 'Download Sheet'}
            </Button>
          </Box>

          {hasFilters && (
            <Button
              startIcon={<Clear fontSize="small" />}
              onClick={clearFilters}
              sx={{ mt: 1.7, color: '#fbbf24', textTransform: 'none', fontWeight: 800, borderRadius: '9px', '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' } }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card sx={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 26px 56px rgba(2,8,23,0.28)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: { xs: 2.2, md: 3 }, py: 2.6, borderBottom: '1px solid #e5e7eb' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
            <Avatar sx={{ bgcolor: '#e0edff', color: '#165dff', width: 38, height: 38 }}>
              <ReceiptLong fontSize="small" />
            </Avatar>
            <Typography sx={{ color: '#071b3a', fontSize: '1rem', fontWeight: 900 }}>
              {totalTransactions} transactions found
            </Typography>
          </Box>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, color: '#64748b', fontSize: '.82rem', fontWeight: 700 }}>
            Real-time transaction records
          </Typography>
        </Box>

        <TableContainer sx={{ maxHeight: { xs: 560, md: 'calc(100vh - 360px)' }, overflowX: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                {tableHeaders.map((header) => (
                  <TableCell
                    key={header.id}
                    align={header.id === 'amount' ? 'right' : 'left'}
                    sx={{ bgcolor: '#ffffff', color: '#1e2a44', borderBottom: '1px solid #e5e7eb', fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', py: 2.1, whiteSpace: 'nowrap' }}
                  >
                    {header.sortable ? (
                      <TableSortLabel
                        active={sortBy === header.id}
                        direction={sortBy === header.id ? sortOrder : 'asc'}
                        onClick={() => handleSort(header.id)}
                        sx={{
                          color: '#1e2a44 !important',
                          '& .MuiTableSortLabel-icon': { color: '#165dff !important' },
                          '&.Mui-active': { color: '#165dff !important' },
                        }}
                      >
                        {header.label}
                      </TableSortLabel>
                    ) : header.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(rowsPerPage)].map((_, index) => (
                  <TableRow key={index}>
                    {tableHeaders.map((header) => (
                      <TableCell key={header.id} sx={{ borderColor: '#edf2f7' }}>
                        <Skeleton height={26} sx={{ bgcolor: '#eef2f7' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableHeaders.length} sx={{ textAlign: 'center', py: 7, color: '#64748b', border: 'none', fontWeight: 700 }}>
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => {
                  const statusStyle = statusColors[transaction.status] || statusColors.completed;
                  const categoryStyle = getCategoryStyle(transaction.category);
                  const credit = isCreditTransaction(transaction.type);
                  const dateParts = getDateParts(transaction.createdAt);
                  const receiverName = transaction.metadata?.receiverName || transaction.metadata?.beneficiaryName || null;
                  const receiverDisplayName = receiverName ? getDisplayName(receiverName, '') : '';
                  const receiverCustomerId = transaction.metadata?.receiverCustomerId || null;

                  return (
                    <TableRow key={transaction._id} sx={{ bgcolor: '#fff', '&:hover': { background: '#f5faff' }, transition: 'background 0.18s ease' }}>
                      <TableCell sx={bodyCellSx}>
                        <Typography sx={{ fontSize: '0.88rem', color: '#334155', fontWeight: 900 }}>{dateParts.date}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#718096', fontWeight: 700, mt: 0.25 }}>{dateParts.time}</Typography>
                      </TableCell>

                      <TableCell sx={{ ...bodyCellSx, minWidth: 210 }}>
                        <Typography sx={{ fontSize: '0.92rem', color: '#071b3a', fontWeight: 900, maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {transaction.description || '-'}
                        </Typography>
                        {receiverDisplayName && <Typography sx={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, mt: 0.35 }}>To: {receiverDisplayName}</Typography>}
                        {receiverCustomerId && <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace', mt: 0.15 }}>ID: {receiverCustomerId}</Typography>}
                      </TableCell>

                      <TableCell sx={bodyCellSx}>{renderAccount(transaction.fromAccountNumber, 'from')}</TableCell>
                      <TableCell sx={bodyCellSx}>{renderAccount(transaction.toAccountNumber, credit ? 'creditTo' : 'debitTo')}</TableCell>

                      <TableCell sx={bodyCellSx}>
                        <Chip
                          label={transaction.category || 'Other'}
                          size="small"
                          sx={{ bgcolor: categoryStyle.bg, color: categoryStyle.color, border: `1px solid ${categoryStyle.border}`, fontSize: '0.76rem', textTransform: 'capitalize', fontWeight: 900, height: 30, borderRadius: '10px' }}
                        />
                      </TableCell>

                      <TableCell sx={bodyCellSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {credit ? <ArrowUpward sx={{ color: '#059669', fontSize: '1rem' }} /> : <ArrowDownward sx={{ color: '#e11d48', fontSize: '1rem' }} />}
                          <Typography sx={{ color: credit ? '#059669' : '#e11d48', fontSize: '0.86rem', fontWeight: 900, textTransform: 'capitalize' }}>
                            {prettyType(transaction.type)}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell sx={bodyCellSx}>
                        <Chip
                          label={transaction.status || 'Completed'}
                          size="small"
                          sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, fontSize: '0.76rem', textTransform: 'capitalize', fontWeight: 900, height: 30, borderRadius: '10px' }}
                        />
                      </TableCell>

                      <TableCell align="right" sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                        <Typography sx={{ color: credit ? '#059669' : '#e11d48', fontSize: '0.98rem', fontWeight: 950, fontVariantNumeric: 'tabular-nums' }}>
                          {credit ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ ...bodyCellSx, color: '#64748b', fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 800 }}>
                        {transaction.reference?.substring(0, 16) || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', px: { xs: 2, md: 3 }, py: 2.1, borderTop: '1px solid #e5e7eb', bgcolor: '#fff' }}>
          <Typography sx={{ color: '#475569', fontWeight: 700, fontSize: '.86rem' }}>
            Showing {firstRecord} to {lastRecord} of {totalTransactions} transactions
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, flexWrap: 'wrap' }}>
            <IconButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} sx={paginationButtonSx}>
              <KeyboardArrowLeft />
            </IconButton>

            {visiblePages.map((pageNumber, index) => {
              const previous = visiblePages[index - 1];
              const showGap = previous && pageNumber - previous > 1;
              return (
                <React.Fragment key={pageNumber}>
                  {showGap && <Typography sx={{ color: '#94a3b8', fontWeight: 900 }}>...</Typography>}
                  <Button onClick={() => setPage(pageNumber)} sx={pageNumber === page ? activePageSx : pageButtonSx}>
                    {pageNumber}
                  </Button>
                </React.Fragment>
              );
            })}

            <IconButton disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} sx={paginationButtonSx}>
              <KeyboardArrowRight />
            </IconButton>

            <FormControl size="small" sx={{ minWidth: 132, ml: { xs: 0, sm: 1 } }}>
              <Select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(1);
                }}
                sx={{
                  height: 42,
                  borderRadius: '10px',
                  color: '#071b3a',
                  fontWeight: 800,
                  '& fieldset': { borderColor: '#dbe3ee' },
                  '&:hover fieldset': { borderColor: '#165dff !important' },
                  '&.Mui-focused fieldset': { borderColor: '#165dff !important' },
                }}
              >
                {[10, 25, 50].map((value) => <MenuItem key={value} value={value}>{value} per page</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    height: 52,
    borderRadius: '11px',
    background: 'rgba(255,255,255,0.06)',
    transition: 'all 0.2s ease',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover': { background: 'rgba(255,255,255,0.09)', transform: 'translateY(-1px)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.36)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
};

const labelSx = {
  color: 'rgba(255,255,255,0.52)',
  '&.Mui-focused': { color: '#f59e0b' },
};

const bodyCellSx = {
  borderBottom: '1px solid #edf2f7',
  py: 2,
  color: '#0f172a',
  verticalAlign: 'middle',
};

const accountSx = {
  fontSize: '0.78rem',
  fontFamily: 'monospace',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const dashSx = {
  color: '#64748b',
  fontWeight: 900,
};

const paginationButtonSx = {
  width: 42,
  height: 42,
  borderRadius: '10px',
  border: '1px solid #dbe3ee',
  color: '#071b3a',
  transition: 'all 0.2s ease',
  '&:hover': { bgcolor: '#eff6ff', borderColor: '#165dff', transform: 'translateY(-1px)' },
  '&.Mui-disabled': { color: '#cbd5e1', borderColor: '#edf2f7' },
};

const pageButtonSx = {
  minWidth: 42,
  height: 42,
  borderRadius: '10px',
  border: '1px solid #dbe3ee',
  color: '#071b3a',
  fontWeight: 900,
  transition: 'all 0.2s ease',
  '&:hover': { bgcolor: '#eff6ff', borderColor: '#165dff', transform: 'translateY(-1px)' },
};

const activePageSx = {
  ...pageButtonSx,
  bgcolor: '#0b2a6f',
  color: '#fff',
  borderColor: '#0b2a6f',
  boxShadow: '0 10px 20px rgba(11,42,111,0.24)',
  '&:hover': { bgcolor: '#165dff', borderColor: '#165dff', transform: 'translateY(-1px)' },
};

export default TransactionHistory;
