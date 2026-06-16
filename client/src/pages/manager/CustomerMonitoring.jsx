import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, TextField, InputAdornment,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Collapse, IconButton, Grid,
} from '@mui/material';
import { Search, ExpandMore, ExpandLess } from '@mui/icons-material';
import { managerAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const accountTypeColors = { savings: '#22c55e', current: '#3b82f6', salary: '#a855f7' };

const CustomerRow = ({ customer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '0.88rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
              {customer.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{customer.name}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{customer.email}</Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>{customer.phone}</TableCell>
        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <Typography sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem' }}>{formatCurrency(customer.totalBalance)}</Typography>
        </TableCell>
        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <Typography sx={{ color: customer.totalODUsed > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: customer.totalODUsed > 0 ? 700 : 400, fontSize: '0.82rem' }}>
            {customer.totalODUsed > 0 ? formatCurrency(customer.totalODUsed) : '—'}
          </Typography>
        </TableCell>
        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <Chip label={customer.isActive ? 'Active' : 'Inactive'} size="small" sx={{ bgcolor: customer.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: customer.isActive ? '#22c55e' : '#ef4444', fontSize: '0.7rem', fontWeight: 700 }} />
        </TableCell>
        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#f59e0b' } }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ borderColor: 'rgba(255,255,255,0.05)', p: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, background: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', mb: 1.5 }}>Account Details</Typography>
              <Grid container spacing={1.5}>
                {(customer.accounts || []).map((acc) => (
                  <Grid item xs={12} sm={4} key={acc._id}>
                    <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${accountTypeColors[acc.accountType]}25` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'capitalize', fontWeight: 600 }}>{acc.accountType}</Typography>
                        <Chip label={acc.classification} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }} />
                      </Box>
                      <Typography sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>{formatCurrency(acc.balance)}</Typography>
                      {acc.overdraftUsed > 0 && (
                        <Typography sx={{ color: '#ef4444', fontSize: '0.7rem', mt: 0.3 }}>OD Used: {formatCurrency(acc.overdraftUsed)}</Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const CustomerMonitoring = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { page, setPage, paginatedRecords: paginatedCustomers } = useTablePagination(customers, [search, customers.length]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await managerAPI.getCustomers({ search: search || undefined });
        setCustomers(res.data.customers || []);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const inputSx = {
    '& .MuiOutlinedInput-root': { color: '#fff', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Customer Monitoring</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Inspect customer accounts, balances, and overdraft usage
      </Typography>

      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <CardContent sx={{ p: 2.5 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            size="small"
            sx={{ ...inputSx, width: { xs: '100%', sm: 380 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.35)' }} /></InputAdornment> }}
          />
        </CardContent>
      </Card>

      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Customer', 'Phone', 'Total Balance', 'OD Used', 'Status', 'Details'].map((h) => (
                  <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.05)' }}><Skeleton height={20} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>No customers found</TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((c) => <CustomerRow key={c._id} customer={c} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls page={page} totalRecords={customers.length} onPageChange={setPage} />
      </Card>
    </Box>
  );
};

export default CustomerMonitoring;
