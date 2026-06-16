import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, LinearProgress, Avatar, Skeleton,
} from '@mui/material';
import { Warning, CheckCircle } from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const getRiskLevel = (used, limit) => {
  if (limit === 0 || used === 0) return { label: 'Normal', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
  const pct = (used / limit) * 100;
  if (pct >= 90) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
  if (pct >= 60) return { label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
  return { label: 'Normal', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
};

const OverdraftMonitoring = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, paginatedRecords: paginatedAccounts } = useTablePagination(accounts, [accounts.length]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // Get accounts that are using overdraft
        const res = await adminAPI.getAccounts({ overdraftOnly: 'false' });
        // Filter those with OD limit > 0
        const withOD = (res.data.accounts || []).filter((a) => a.overdraftLimit > 0);
        setAccounts(withOD);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const criticalCount = accounts.filter((a) => a.overdraftLimit > 0 && (a.overdraftUsed / a.overdraftLimit) >= 0.9).length;
  const warningCount = accounts.filter((a) => a.overdraftLimit > 0 && (a.overdraftUsed / a.overdraftLimit) >= 0.6 && (a.overdraftUsed / a.overdraftLimit) < 0.9).length;
  const activeOD = accounts.filter((a) => a.overdraftUsed > 0).length;

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Overdraft Monitoring</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Track overdraft usage across all customer accounts
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, mb: 4, flexWrap: 'wrap' }}>
        {[
          { label: 'Active OD Accounts', value: activeOD, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Warning Level (≥60%)', value: warningCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
          { label: 'Critical Level (≥90%)', value: criticalCount, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
          { label: 'Total OD Accounts', value: accounts.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
        ].map(({ label, value, color, bg, border }) => (
          <Card key={label} sx={{ flex: '1 1 180px', background: bg, border: `1px solid ${border}`, borderRadius: '16px' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ color, fontSize: '2rem', fontWeight: 800 }}>{loading ? '—' : value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Customer', 'Account Type', 'Account No.', 'OD Limit', 'Outstanding Amount', 'Penalty Amount', 'Total Due', 'Usage %', 'OD Status', 'Risk Level'].map((h) => (
                  <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(TABLE_ROWS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(10)].map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.05)' }}><Skeleton height={20} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6, border: 'none' }}>
                    <CheckCircle sx={{ fontSize: '2.5rem', color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No accounts with overdraft limits found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((acc) => {
                  const pct = acc.overdraftLimit > 0 ? Math.min((acc.overdraftUsed / acc.overdraftLimit) * 100, 100) : 0;
                  const risk = getRiskLevel(acc.overdraftUsed, acc.overdraftLimit);
                  const penalty = acc.overdraftPenalty || 0;
                  const totalDue = (acc.overdraftUsed || 0) + (acc.overdraftPenalty || 0);
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
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', textTransform: 'capitalize', fontWeight: 600 }}>{acc.accountType}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{acc.accountNumber}</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{formatCurrency(acc.overdraftLimit)}</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: acc.overdraftUsed > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: acc.overdraftUsed > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {acc.overdraftUsed > 0 ? formatCurrency(acc.overdraftUsed) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: penalty > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: penalty > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {penalty > 0 ? formatCurrency(penalty) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: totalDue > 0 ? '#a855f7' : 'rgba(255,255,255,0.4)', fontWeight: totalDue > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                          {totalDue > 0 ? formatCurrency(totalDue) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', minWidth: 120 }}>
                        <Box>
                          <Typography sx={{ color: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e', fontSize: '0.78rem', fontWeight: 700, mb: 0.5 }}>{pct.toFixed(0)}%</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)',
                              '& .MuiLinearProgress-bar': {
                                background: pct >= 90 ? '#ef4444' : pct >= 60 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : '#22c55e',
                                borderRadius: 3,
                              },
                            }}
                          />
                        </Box>
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
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip
                          label={risk.label}
                          size="small"
                          icon={risk.label !== 'Normal' ? <Warning sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} /> : <CheckCircle sx={{ fontSize: '0.75rem !important', color: `${risk.color} !important` }} />}
                          sx={{ bgcolor: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, fontSize: '0.7rem', fontWeight: 700 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls page={page} totalRecords={accounts.length} onPageChange={setPage} />
      </Card>
    </Box>
  );
};

export default OverdraftMonitoring;
