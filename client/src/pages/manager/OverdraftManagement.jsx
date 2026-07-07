import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Alert,
  Avatar, Skeleton, IconButton, Tooltip,
} from '@mui/material';
import { CheckCircle, Refresh, Warning } from '@mui/icons-material';
import { managerAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(v || 0);

const getRisk = (used, limit) => {
  if (!limit || !used) return { label: 'Normal', color: '#15803d', bg: '#dcfce7', border: '#86efac' };
  const pct = (used / limit) * 100;
  if (pct >= 90) return { label: 'Critical', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
  if (pct >= 60) return { label: 'Warning', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' };
  return { label: 'Normal', color: '#15803d', bg: '#dcfce7', border: '#86efac' };
};

const mutedDash = <Typography sx={{ color: '#94a3b8', fontWeight: 800 }}>-</Typography>;

const OverdraftManagement = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { page, setPage, paginatedRecords: paginatedAccounts } = useTablePagination(accounts, [accounts.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const accRes = await managerAPI.getOverdraftAccounts();
      const allAccounts = accRes.data.accounts || [];
      setAccounts(allAccounts.filter((a) => a.overdraftLimit > 0));
    } catch {
      setMessage({ type: 'error', text: 'Failed to load overdraft data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    window.addEventListener('focus', fetchData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchData);
    };
  }, [fetchData]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, mb: 0.5 }}>Overdraft Management</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>
            Monitor customer overdraft usage
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchData} sx={{ color: '#bfdbfe', border: '1px solid rgba(191,219,254,.25)', bgcolor: 'rgba(255,255,255,.05)', '&:hover': { color: '#fff', bgcolor: '#2563eb' } }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {message.text && (
        <Alert
          severity={message.type}
          sx={{ mb: 3, borderRadius: '12px' }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      <Card sx={{ bgcolor: '#fff', border: '1px solid #dbe3ef', borderRadius: '18px', boxShadow: '0 18px 42px rgba(2,12,36,.16)', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#eff6ff' }}>
                {['Customer', 'Account Type', 'OD Limit', 'Outstanding Amount', 'Penalty Amount', 'Total Due', 'Usage %', 'Status', 'Monthly Usage', 'Risk'].map((h) => (
                  <TableCell key={h} sx={{ color: '#0B1F4D', borderColor: '#dbeafe', fontSize: '0.73rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>{[...Array(10)].map((__, j) => <TableCell key={j} sx={{ borderColor: '#e2e8f0' }}><Skeleton height={20} sx={{ bgcolor: '#e2e8f0' }} /></TableCell>)}</TableRow>
                ))
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 8, border: 'none' }}>
                    <CheckCircle sx={{ fontSize: '3rem', color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ color: '#64748b', fontWeight: 700 }}>No overdraft accounts found.</Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedAccounts.map((acc) => {
                const pct = acc.overdraftLimit > 0 ? Math.min((acc.overdraftUsed / acc.overdraftLimit) * 100, 100) : 0;
                const risk = getRisk(acc.overdraftUsed, acc.overdraftLimit);
                const penalty = acc.penaltyAmount || 0;
                const totalDue = acc.totalAmountDue || 0;
                const monthlyUsage = acc.monthlyUsageCount || acc.monthlyOverdraftCount || 0;
                const status = acc.overdraftStatus || 'ACTIVE';
                const usageColor = pct >= 90 ? '#dc2626' : pct >= 60 ? '#f59e0b' : '#22c55e';
                return (
                  <TableRow key={acc._id} sx={{ '&:hover': { bgcolor: '#eff6ff' }, '& td': { borderColor: '#e2e8f0' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 30, height: 30, background: '#dbeafe', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #93c5fd' }}>
                          {acc.userId?.name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography sx={{ color: '#0f172a', fontSize: '0.82rem', fontWeight: 800 }}>{acc.userId?.name}</Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600 }}>{acc.userId?.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#334155', fontSize: '0.82rem', textTransform: 'capitalize', fontWeight: 800 }}>{acc.accountType}</TableCell>
                    <TableCell sx={{ color: '#1d4ed8', fontSize: '0.82rem', fontWeight: 800 }}>{fmt(acc.overdraftLimit)}</TableCell>
                    <TableCell><Typography sx={{ color: acc.overdraftUsed > 0 ? '#dc2626' : '#64748b', fontWeight: 800, fontSize: '0.82rem' }}>{acc.overdraftUsed > 0 ? fmt(acc.overdraftUsed) : mutedDash}</Typography></TableCell>
                    <TableCell><Typography sx={{ color: penalty > 0 ? '#dc2626' : '#64748b', fontWeight: 800, fontSize: '0.82rem' }}>{penalty > 0 ? fmt(penalty) : mutedDash}</Typography></TableCell>
                    <TableCell><Typography sx={{ color: totalDue > 0 ? '#7c3aed' : '#64748b', fontWeight: 800, fontSize: '0.82rem' }}>{totalDue > 0 ? fmt(totalDue) : mutedDash}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 110 }}>
                      <Typography sx={{ color: usageColor, fontSize: '0.78rem', fontWeight: 900 }}>{pct.toFixed(0)}%</Typography>
                      <Box sx={{ mt: .55, height: 7, width: 82, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 99, bgcolor: usageColor }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={status}
                        size="small"
                        sx={{
                          height: 22,
                          bgcolor: status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                          color: status === 'ACTIVE' ? '#15803d' : '#dc2626',
                          border: `1px solid ${status === 'ACTIVE' ? '#86efac' : '#fca5a5'}`,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#1d4ed8', fontSize: '0.82rem', fontWeight: 800 }}>
                      {monthlyUsage} / 3
                    </TableCell>
                    <TableCell>
                      <Chip label={risk.label} size="small" icon={risk.label !== 'Normal' ? <Warning sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} /> : <CheckCircle sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} />} sx={{ bgcolor: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, fontSize: '0.7rem', fontWeight: 800 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls page={page} totalRecords={accounts.length} onPageChange={setPage} />
      </Card>
    </Box>
  );
};

export default OverdraftManagement;
