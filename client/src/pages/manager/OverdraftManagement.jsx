import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Alert,
  Avatar, Skeleton, IconButton, Tooltip,
} from '@mui/material';
import { CheckCircle, Refresh, Warning } from '@mui/icons-material';
import { managerAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(v || 0);

const getRisk = (used, limit) => {
  if (!limit || !used) return { label: 'Normal', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
  const pct = (used / limit) * 100;
  if (pct >= 90) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
  if (pct >= 60) return { label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
  return { label: 'Normal', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
};

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
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Overdraft Management</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Monitor customer overdraft usage
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchData} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#f59e0b' } }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {message.text && (
        <Alert
          severity={message.type}
          sx={{ mb: 3, borderRadius: '12px', bgcolor: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: message.type === 'success' ? '#86efac' : '#fca5a5', border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      {/* ─── Tab 1: OD Account Monitoring ────────────────────────────────────── */}
      {(
        <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Customer', 'Account Type', 'OD Limit', 'Outstanding Amount', 'Penalty Amount', 'Total Due', 'Usage %', 'Status', 'Monthly Usage', 'Risk'].map((h) => (
                    <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                    <TableRow key={i}>{[...Array(10)].map((__, j) => <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.05)' }}><Skeleton height={20} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></TableCell>)}</TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ textAlign: 'center', py: 8, border: 'none' }}>
                      <CheckCircle sx={{ fontSize: '3rem', color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No overdraft accounts found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : paginatedAccounts.map((acc) => {
                  const pct = acc.overdraftLimit > 0 ? Math.min((acc.overdraftUsed / acc.overdraftLimit) * 100, 100) : 0;
                  const risk = getRisk(acc.overdraftUsed, acc.overdraftLimit);
                  const penalty = acc.penaltyAmount || 0;
                  const totalDue = acc.totalAmountDue || 0;
                  const monthlyUsage = acc.monthlyUsageCount || acc.monthlyOverdraftCount || 0;
                  const status = acc.overdraftStatus || 'ACTIVE';
                  return (
                    <TableRow key={acc._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 30, height: 30, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                            {acc.userId?.name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{acc.userId?.name}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>{acc.userId?.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem', textTransform: 'capitalize', fontWeight: 600 }}>{acc.accountType}</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{fmt(acc.overdraftLimit)}</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: acc.overdraftUsed > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: acc.overdraftUsed > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {acc.overdraftUsed > 0 ? fmt(acc.overdraftUsed) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: penalty > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: penalty > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {penalty > 0 ? fmt(penalty) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: totalDue > 0 ? '#a855f7' : 'rgba(255,255,255,0.4)', fontWeight: totalDue > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {totalDue > 0 ? fmt(totalDue) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                        <Typography sx={{ color: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>{pct.toFixed(0)}%</Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip
                          label={status}
                          size="small"
                          sx={{
                            height: 20,
                            bgcolor: status === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                            border: `1px solid ${status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                        {monthlyUsage} / 3
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={risk.label} size="small" icon={risk.label !== 'Normal' ? <Warning sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} /> : <CheckCircle sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} />} sx={{ bgcolor: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, fontSize: '0.7rem', fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationControls page={page} totalRecords={accounts.length} onPageChange={setPage} />
        </Card>
      )}

    </Box>
  );
};

export default OverdraftManagement;
