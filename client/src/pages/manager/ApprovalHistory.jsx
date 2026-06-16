import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  Skeleton, FormControl, InputLabel, Select, MenuItem, Grid,
} from '@mui/material';
import { approvalAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const statusStyles = {
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const ApprovalHistory = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const rowsPerPage = TABLE_ROWS_PER_PAGE;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalAPI.getHistory({ page, limit: rowsPerPage, status: statusFilter || undefined });
      setApprovals(res.data.approvals || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const inputSx = {
    '& .MuiOutlinedInput-root': { color: '#fff', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Approval History</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>Past approved and rejected transfer requests</Typography>

      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel>Filter by Status</InputLabel>
                <Select value={statusFilter} label="Filter by Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} sx={{ color: '#fff' }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Customer', 'Type', 'Amount', 'Status', 'Reviewed By', 'Remark', 'Date'].map((h) => (
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
              ) : approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>No history found</TableCell>
                </TableRow>
              ) : (
                approvals.map((ap) => {
                  const sc = statusStyles[ap.status] || statusStyles.approved;
                  return (
                    <TableRow key={ap._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 30, height: 30, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                            {ap.customerId?.name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{ap.customerId?.name}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>{ap.customerId?.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={ap.transferType === 'own_account' ? 'Own Acc.' : 'Beneficiary'} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: '0.68rem' }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem' }}>{formatCurrency(ap.amount)}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={ap.status.toUpperCase()} size="small" sx={{ bgcolor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '0.68rem', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
                        {ap.managerId?.name || '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ap.remark || '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {ap.reviewedAt ? new Date(ap.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
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

export default ApprovalHistory;
