import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TextField, MenuItem, InputAdornment,
} from '@mui/material';
import { Security, Login, PersonOff, AdminPanelSettings, Warning, Search } from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import TablePaginationControls, { TABLE_ROWS_PER_PAGE } from '../../components/common/TablePaginationControls';

const ACTION_LABELS = {
  login: { label: 'Login', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  logout: { label: 'Logout', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  register: { label: 'Registration', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  login_failed: { label: 'Login Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  user_created: { label: 'User Created', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  user_updated: { label: 'User Updated', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  user_activated: { label: 'User Activated', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  user_deactivated: { label: 'User Deactivated', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  transfer_completed: { label: 'Transfer Done', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  transfer_failed: { label: 'Transfer Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  overdraft_used: { label: 'OD Used', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  notification_sent: { label: 'Notification', color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
  business_rule_created: { label: 'Rule Created', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  business_rule_updated: { label: 'Rule Updated', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  business_rule_deleted: { label: 'Rule Deleted', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  settings_updated: { label: 'Settings', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  kyc_updated: { label: 'KYC Updated', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  classification_changed: { label: 'Classification', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
};

const SEVERITY_COLORS = {
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const LogsAndSecurity = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ loginCount: 0, failedLoginCount: 0, adminActions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const rowsPerPage = TABLE_ROWS_PER_PAGE;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getAuditLogs({
        page,
        limit: rowsPerPage,
        search: search || undefined,
        action: actionFilter || undefined,
        severity: severityFilter || undefined,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.pagination?.total || 0);
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load security logs.');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, severityFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 350);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff', borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#818cf8' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Security sx={{ color: '#818cf8', fontSize: '1.5rem' }} />
        </Box>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700 }}>Logs & Security</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Monitor all system activity, logins, and security events</Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Logins', value: stats.loginCount, icon: <Login sx={{ color: '#22c55e', fontSize: '1.8rem' }} />, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Failed Logins', value: stats.failedLoginCount, icon: <PersonOff sx={{ color: '#ef4444', fontSize: '1.8rem' }} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Admin Actions', value: stats.adminActions, icon: <AdminPanelSettings sx={{ color: '#818cf8', fontSize: '1.8rem' }} />, color: '#818cf8', bg: 'rgba(99,102,241,0.08)' },
          { label: 'Security Events', value: logs.filter(l => l.severity === 'warning' || l.severity === 'critical').length, icon: <Warning sx={{ color: '#f59e0b', fontSize: '1.8rem' }} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        ].map((s) => (
          <Grid item xs={12} sm={6} md={3} key={s.label}>
            <Card sx={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: '18px' }}>
              <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                {s.icon}
                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</Typography>
                  <Typography sx={{ color: s.color, fontWeight: 800, fontSize: '1.6rem' }}>{s.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by user or action details..." size="small" fullWidth sx={inputSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.35)' }} /></InputAdornment> }} />
            </Grid>
            <Grid item xs={6} sm={3.5}>
              <TextField select fullWidth size="small" label="Action Type" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} sx={inputSx} InputLabelProps={{ shrink: true }}>
                <MenuItem value="">All Actions</MenuItem>
                {Object.keys(ACTION_LABELS).map((k) => <MenuItem key={k} value={k}>{ACTION_LABELS[k].label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2.5}>
              <TextField select fullWidth size="small" label="Severity" value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }} sx={inputSx} InputLabelProps={{ shrink: true }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress sx={{ color: '#818cf8' }} /></Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {['Timestamp', 'User', 'Role', 'Action', 'Details', 'Severity'].map((h) => (
                      <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderColor: 'rgba(255,255,255,0.06)', py: 2, px: 2.5, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>No logs found</TableCell>
                    </TableRow>
                  ) : logs.map((log) => {
                    const actionMeta = ACTION_LABELS[log.action] || { label: log.action, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                    const sevMeta = SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info;
                    return (
                      <TableRow key={log._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', whiteSpace: 'nowrap', px: 2.5 }}>
                          {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', px: 2.5 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem' }}>{log.userName || log.userId?.name || 'System'}</Typography>
                          {log.ipAddress && <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem', fontFamily: 'monospace' }}>{log.ipAddress}</Typography>}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Chip label={log.userRole || 'system'} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Chip label={actionMeta.label} size="small" sx={{ bgcolor: actionMeta.bg, color: actionMeta.color, fontWeight: 700, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Chip label={log.severity} size="small" sx={{ bgcolor: sevMeta.bg, color: sevMeta.color, fontWeight: 700, fontSize: '0.68rem', textTransform: 'capitalize' }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <TablePaginationControls
            page={page}
            totalRecords={total}
            onPageChange={setPage}
            sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default LogsAndSecurity;
