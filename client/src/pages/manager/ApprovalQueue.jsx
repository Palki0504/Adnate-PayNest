import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, Avatar, Skeleton, IconButton, Tooltip, Tabs, Tab,
  FormControl, Select, MenuItem,
} from '@mui/material';
import { CheckCircle, Cancel, Refresh, FilterList } from '@mui/icons-material';
import { accountTypeRequestAPI, transferLimitAPI } from '../../services/api';
import { getAccountTypeLabel } from '../../constants/accountTypes';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const getRequestDate = (request) => request.reviewedAt || request.createdAt;

const getMonthKey = (date) => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const buildMonthOptions = (requests) => [...new Set(requests
  .map((request) => getMonthKey(getRequestDate(request)))
  .filter(Boolean))]
  .sort((a, b) => b.localeCompare(a));

const formatLimit = (value) => value == null ? 'Not available' : `₹${Number(value).toLocaleString('en-IN')}`;

const getLimitValues = (request) => {
  if (request.limitType === 'daily') {
    return {
      current: [`Daily: ${formatLimit(request.currentDailyLimit)}`],
      requested: [`Daily: ${formatLimit(request.requestedLimit ?? request.requestedDailyLimit)}`],
    };
  }
  if (request.limitType === 'monthly') {
    return {
      current: [`Monthly: ${formatLimit(request.currentMonthlyLimit)}`],
      requested: [`Monthly: ${formatLimit(request.requestedLimit ?? request.requestedMonthlyLimit)}`],
    };
  }
  return {
    current: [`Daily: ${formatLimit(request.currentDailyLimit)}`, `Monthly: ${formatLimit(request.currentMonthlyLimit)}`],
    requested: [`Daily: ${formatLimit(request.requestedDailyLimit)}`, `Monthly: ${formatLimit(request.requestedMonthlyLimit)}`],
  };
};

const statusSx = (status) => {
  if (status === 'Approved' || status === 'approved') return { bgcolor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' };
  if (status === 'Rejected' || status === 'rejected') return { bgcolor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' };
  return { bgcolor: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' };
};

const MonthFilter = ({ value, onChange, options, ariaLabel }) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', px: 2.5, py: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff' }}>
    <Typography sx={{ color: '#475569', fontSize: '0.75rem', fontWeight: 800, mr: 1 }}>
      Month
    </Typography>
    <FormControl size="small">
      <Select
        value={value}
        onChange={onChange}
        IconComponent={FilterList}
        aria-label={ariaLabel}
        sx={{
          minWidth: 170,
          height: 34,
          color: '#0f172a',
          bgcolor: '#f8fafc',
          borderRadius: '9px',
          fontSize: '0.76rem',
          fontWeight: 800,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#93c5fd' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb' },
          '& .MuiSelect-icon': { color: '#2563eb', right: 8 },
        }}
        MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0' } } }}
      >
        <MenuItem value="all">All months</MenuItem>
        {options.map((monthKey) => (
          <MenuItem value={monthKey} key={monthKey}>{getMonthLabel(monthKey)}</MenuItem>
        ))}
      </Select>
    </FormControl>
  </Box>
);

const ApprovalQueue = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [limitMonth, setLimitMonth] = useState('all');
  const [accountMonth, setAccountMonth] = useState('all');
  const [limitRequests, setLimitRequests] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [limitLoading, setLimitLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [limitActionItem, setLimitActionItem] = useState(null);
  const [accountActionItem, setAccountActionItem] = useState(null);
  const [limitComment, setLimitComment] = useState('');
  const [accountComment, setAccountComment] = useState('');
  const [limitCommentError, setLimitCommentError] = useState('');
  const [accountCommentError, setAccountCommentError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchLimitRequests = useCallback(async ({ silent = false } = {}) => {
    setLimitLoading(true);
    try {
      const res = await transferLimitAPI.getPendingRequests();
      setLimitRequests(res.data.requests || []);
    } catch {
      if (!silent) setMessage({ type: 'error', text: 'Failed to load transfer limit requests.' });
    } finally {
      setLimitLoading(false);
    }
  }, []);

  const fetchAccountRequests = useCallback(async ({ silent = false } = {}) => {
    setAccountLoading(true);
    try {
      const res = await accountTypeRequestAPI.getPendingRequests({ status: 'all' });
      setAccountRequests(res.data.requests || []);
    } catch {
      if (!silent) setMessage({ type: 'error', text: 'Failed to load account type requests.' });
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimitRequests();
    fetchAccountRequests();
  }, [fetchLimitRequests, fetchAccountRequests]);

  const refreshActiveTab = () => {
    if (activeTab === 0) fetchLimitRequests();
    else fetchAccountRequests();
  };

  const limitMonthOptions = useMemo(() => buildMonthOptions(limitRequests), [limitRequests]);
  const accountMonthOptions = useMemo(() => buildMonthOptions(accountRequests), [accountRequests]);

  useEffect(() => {
    if (limitMonth !== 'all' && !limitMonthOptions.includes(limitMonth)) setLimitMonth('all');
  }, [limitMonth, limitMonthOptions]);

  useEffect(() => {
    if (accountMonth !== 'all' && !accountMonthOptions.includes(accountMonth)) setAccountMonth('all');
  }, [accountMonth, accountMonthOptions]);

  const filteredLimitRequests = useMemo(() => (
    limitMonth === 'all'
      ? limitRequests
      : limitRequests.filter((request) => getMonthKey(getRequestDate(request)) === limitMonth)
  ), [limitRequests, limitMonth]);

  const filteredAccountRequests = useMemo(() => (
    accountMonth === 'all'
      ? accountRequests
      : accountRequests.filter((request) => getMonthKey(getRequestDate(request)) === accountMonth)
  ), [accountRequests, accountMonth]);

  const {
    page: limitPage,
    setPage: setLimitPage,
    paginatedRecords: paginatedLimitRequests,
  } = useTablePagination(filteredLimitRequests, [activeTab, limitMonth, filteredLimitRequests.length]);
  const {
    page: accountPage,
    setPage: setAccountPage,
    paginatedRecords: paginatedAccountRequests,
  } = useTablePagination(filteredAccountRequests, [activeTab, accountMonth, filteredAccountRequests.length]);

  const renderLimitLines = (lines) => lines.map((line) => (
    <Typography
      component="span"
      display="block"
      key={line}
      sx={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 1.55 }}
    >
      {line}
    </Typography>
  ));

  const handleLimitAction = async () => {
    if (!limitActionItem || processing) return;
    if (limitActionItem.type === 'reject' && !limitComment.trim()) {
      setLimitCommentError('Rejection reason is required.');
      return;
    }
    setProcessing(true);
    try {
      if (limitActionItem.type === 'approve') {
        const response = await transferLimitAPI.approveRequest(limitActionItem.id, { comment: limitComment });
        if (response.data?.success !== true) {
          throw new Error(response.data?.message || 'Transfer limit approval failed.');
        }
        setLimitRequests((requests) => requests.map((request) =>
          request._id === limitActionItem.id
            ? { ...request, ...response.data.request, status: 'approved' }
            : request
        ));
        setMessage(response.data.emailError
          ? { type: 'warning', text: response.data.emailError }
          : { type: 'success', text: 'Transfer limit increase approved successfully.' });
      } else {
        const response = await transferLimitAPI.rejectRequest(limitActionItem.id, { comment: limitComment });
        if (response.data?.success !== true) throw new Error(response.data?.message || 'Transfer limit rejection failed.');
        setLimitRequests((requests) => requests.map((request) =>
          request._id === limitActionItem.id
            ? { ...request, ...response.data.request, status: 'rejected' }
            : request
        ));
        setMessage({ type: 'success', text: 'Transfer limit request rejected.' });
      }
      setLimitActionItem(null);
      setLimitComment('');
    } catch (err) {
      setLimitActionItem(null);
      setLimitComment('');
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Action failed. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleAccountAction = async () => {
    if (!accountActionItem || processing) return;
    if (accountActionItem.type === 'reject' && !accountComment.trim()) {
      setAccountCommentError('Rejection reason is required.');
      return;
    }
    setProcessing(true);
    try {
      if (accountActionItem.type === 'approve') {
        const response = await accountTypeRequestAPI.approveRequest(accountActionItem.id, { comment: accountComment });
        if (response.data?.success !== true) {
          throw new Error(response.data?.message || 'Account type approval failed.');
        }
        setAccountRequests((requests) => requests.map((request) =>
          request._id === accountActionItem.id
            ? { ...request, ...response.data.request, status: 'Approved' }
            : request
        ));
        setMessage(response.data.emailError
          ? { type: 'warning', text: response.data.emailError }
          : { type: 'success', text: 'Account type request approved and account added.' });
      } else {
        const response = await accountTypeRequestAPI.rejectRequest(accountActionItem.id, { comment: accountComment });
        if (response.data?.success !== true) throw new Error(response.data?.message || 'Account type rejection failed.');
        setAccountRequests((requests) => requests.map((request) =>
          request._id === accountActionItem.id
            ? { ...request, ...response.data.request, status: 'Rejected' }
            : request
        ));
        setMessage({ type: 'success', text: 'Account type request rejected.' });
      }
      setAccountActionItem(null);
      setAccountComment('');
    } catch (err) {
      setAccountActionItem(null);
      setAccountComment('');
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Action failed. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const openLimitDialog = (req, type) => {
    setLimitActionItem({
      id: req._id,
      type,
      customerName: req.userId?.name,
      accountType: req.accountType || req.accountId?.accountType || 'unknown',
      accountNumber: req.accountId?.accountNumber,
      limitType: req.limitType || null,
      requestedDailyLimit: req.requestedDailyLimit,
      requestedMonthlyLimit: req.requestedMonthlyLimit,
      requestedLimit: req.requestedLimit,
    });
    setLimitComment('');
    setLimitCommentError('');
  };

  const openAccountDialog = (req, type) => {
    setAccountActionItem({
      id: req._id,
      type,
      customerName: req.userId?.name,
      customerId: req.userId?.customerId,
      requestedAccountType: req.requestedAccountTypeLabel || getAccountTypeLabel(req.requestedAccountType),
      currentAccountTypes: req.currentAccountTypeLabels || (req.currentAccountTypes || []).map(getAccountTypeLabel),
    });
    setAccountComment('');
    setAccountCommentError('');
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: '#111827', borderRadius: '8px', background: '#FFFFFF',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#2563eb' },
    },
    '& .MuiInputLabel-root': { color: '#6B7280' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
    '& .MuiFormHelperText-root': { color: '#ef4444' },
  };

  const tableCardSx = {
    bgcolor: '#fff',
    border: '1px solid #dbe3ef',
    borderRadius: '18px',
    boxShadow: '0 18px 42px rgba(2,12,36,.16)',
    overflow: 'hidden',
    '& .MuiTableHead-root .MuiTableCell-root': {
      bgcolor: '#eff6ff !important',
      color: '#0B1F4D !important',
      borderColor: '#dbeafe !important',
      fontSize: '0.73rem',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    '& .MuiTableBody-root .MuiTableCell-root': {
      bgcolor: '#fff !important',
      color: '#334155 !important',
      borderColor: '#e2e8f0 !important',
      fontSize: '0.8rem',
    },
    '& .MuiTableBody-root .MuiTypography-root': {
      color: '#334155 !important',
    },
    '& .MuiTableBody-root .MuiChip-root': {
      fontWeight: 800,
    },
    '& .MuiTableRow-root:hover .MuiTableCell-root': {
      bgcolor: '#eff6ff !important',
    },
  };

  const actionButtons = (onApprove, onReject) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button
        size="small"
        startIcon={<CheckCircle sx={{ fontSize: '0.9rem !important' }} />}
        onClick={onApprove}
        sx={{ color: '#15803d', bgcolor: '#dcfce7', border: '1px solid #86efac', borderRadius: '9px', textTransform: 'none', fontSize: '0.78rem', fontWeight: 800, px: 1.5, '&:hover': { bgcolor: '#bbf7d0' } }}
      >
        Approve
      </Button>
      <Button
        size="small"
        startIcon={<Cancel sx={{ fontSize: '0.9rem !important' }} />}
        onClick={onReject}
        sx={{ color: '#dc2626', bgcolor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '9px', textTransform: 'none', fontSize: '0.78rem', fontWeight: 800, px: 1.5, '&:hover': { bgcolor: '#fecaca' } }}
      >
        Reject
      </Button>
    </Box>
  );

  const skeletonRows = (colSpan) => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        {[...Array(colSpan)].map((__, j) => (
          <TableCell key={j} sx={{ borderColor: '#e2e8f0' }}>
            <Skeleton height={20} sx={{ bgcolor: '#e2e8f0' }} />
          </TableCell>
        ))}
      </TableRow>
    ))
  );

  const renderCustomerCell = (userData) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar sx={{ width: 32, height: 32, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: '0.8rem', fontWeight: 800, color: '#1d4ed8' }}>
        {userData?.name?.charAt(0)?.toUpperCase()}
      </Avatar>
      <Box>
        <Typography sx={{ color: '#0f172a', fontSize: '0.82rem', fontWeight: 800 }}>{userData?.name}</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>{userData?.customerId || userData?.email}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Pending Approvals</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Review transfer limit increases and account type requests submitted by customers.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refreshActiveTab} sx={{ color: '#bfdbfe', border: '1px solid rgba(191,219,254,.25)', bgcolor: 'rgba(255,255,255,.05)', '&:hover': { color: '#fff', bgcolor: '#2563eb' } }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {message.text && (
        <Alert
          severity={message.type}
          sx={{
            mb: 3, borderRadius: '12px',
            bgcolor: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'success' ? '#86efac' : '#fca5a5',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      <Card sx={tableCardSx}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            px: 2,
            bgcolor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': { color: '#64748b', textTransform: 'none', fontWeight: 900, minHeight: 58 },
            '& .Mui-selected': { color: '#1d4ed8 !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#2563eb', height: 3 },
          }}
        >
          <Tab label={`Increase Transfer Limit Requests (${filteredLimitRequests.length})`} />
          <Tab label={`Account Type Requests (${filteredAccountRequests.length})`} />
        </Tabs>

        {activeTab === 0 && (
          <Box>
            <MonthFilter
              value={limitMonth}
              onChange={(event) => setLimitMonth(event.target.value)}
              options={limitMonthOptions}
              ariaLabel="Filter transfer limit requests by month"
            />
            <TableContainer>
              <Table>
              <TableHead>
                <TableRow>
                  {['Customer', 'Account Type', 'Current Limit', 'Requested Limit', 'Reason', 'Date', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {limitLoading ? skeletonRows(7) : filteredLimitRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, border: 'none' }}>
                      <CheckCircle sx={{ fontSize: '3rem', color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No transfer limit requests match this filter.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLimitRequests.map((req) => (
                    <TableRow key={req._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>{renderCustomerCell(req.userId)}</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={(req.accountType || req.accountId?.accountType || 'Unknown').toUpperCase()} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '0.7rem', fontWeight: 600 }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mt: 0.5, fontFamily: 'monospace' }}>
                          {req.accountId?.accountNumber}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
                        {renderLimitLines(getLimitValues(req).current)}
                      </TableCell>
                      <TableCell sx={{ color: '#818cf8', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', fontWeight: 700 }}>
                        {renderLimitLines(getLimitValues(req).requested)}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 180, wordBreak: 'break-word' }}>
                        {req.reason}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatDate(getRequestDate(req))}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        {req.status === 'pending'
                          ? actionButtons(() => openLimitDialog(req, 'approve'), () => openLimitDialog(req, 'reject'))
                          : <Chip label={req.status === 'approved' ? 'Approved' : 'Rejected'} size="small" sx={{ ...statusSx(req.status), fontWeight: 700 }} />}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </TableContainer>
            <TablePaginationControls page={limitPage} totalRecords={filteredLimitRequests.length} onPageChange={setLimitPage} />
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <MonthFilter
              value={accountMonth}
              onChange={(event) => setAccountMonth(event.target.value)}
              options={accountMonthOptions}
              ariaLabel="Filter account type requests by month"
            />
            <TableContainer>
              <Table>
              <TableHead>
                <TableRow>
                  {['Customer', 'Requested Account Type', 'Current Account Types', 'Reason', 'Request Date', 'Status', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {accountLoading ? skeletonRows(7) : filteredAccountRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, border: 'none' }}>
                      <CheckCircle sx={{ fontSize: '3rem', color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No account type requests match this filter.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAccountRequests.map((req) => (
                    <TableRow key={req._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>{renderCustomerCell(req.userId)}</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={req.requestedAccountTypeLabel || getAccountTypeLabel(req.requestedAccountType)} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 220 }}>
                        {(req.currentAccountTypeLabels || (req.currentAccountTypes || []).map(getAccountTypeLabel)).join(', ') || 'None'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', maxWidth: 220, wordBreak: 'break-word' }}>
                        {req.reason || 'No reason provided'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatDate(getRequestDate(req))}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Chip label={req.status} size="small" sx={{ ...statusSx(req.status), fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        {req.status === 'Pending'
                          ? actionButtons(() => openAccountDialog(req, 'approve'), () => openAccountDialog(req, 'reject'))
                          : <Chip label={req.status} size="small" sx={{ ...statusSx(req.status), fontWeight: 700 }} />}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </TableContainer>
            <TablePaginationControls page={accountPage} totalRecords={filteredAccountRequests.length} onPageChange={setAccountPage} />
          </Box>
        )}
      </Card>

      <Dialog
        open={!!limitActionItem}
        onClose={() => { if (!processing) setLimitActionItem(null); }}
        PaperProps={{ sx: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', minWidth: 380 } }}
      >
        <DialogTitle sx={{ color: limitActionItem?.type === 'approve' ? '#16a34a' : '#ef4444', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          {limitActionItem?.type === 'approve' ? 'Approve Transfer Limit Increase' : 'Reject Transfer Limit Request'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          {limitActionItem && (
            <Box>
              <Box sx={{ p: 2, mb: 2.5, borderRadius: '12px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', mb: 0.5 }}>Customer: <span style={{ color: '#111827', fontWeight: 600 }}>{limitActionItem.customerName}</span></Typography>
                <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', mb: 0.5 }}>
                  Account Type: <span style={{ color: '#111827', fontWeight: 700, textTransform: 'capitalize' }}>{limitActionItem.accountType}</span>
                  {limitActionItem.accountNumber ? ` (${limitActionItem.accountNumber})` : ''}
                </Typography>
                {(limitActionItem.limitType === 'daily' || !limitActionItem.limitType) && (
                  <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', mb: limitActionItem.limitType === 'daily' ? 0 : 0.5 }}>
                    Requested Daily Limit: <span style={{ color: '#d97706', fontWeight: 700 }}>₹{(limitActionItem.limitType === 'daily' ? limitActionItem.requestedLimit : limitActionItem.requestedDailyLimit)?.toLocaleString('en-IN')}</span>
                  </Typography>
                )}
                {(limitActionItem.limitType === 'monthly' || !limitActionItem.limitType) && (
                  <Typography sx={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    Requested Monthly Limit: <span style={{ color: '#d97706', fontWeight: 700 }}>₹{(limitActionItem.limitType === 'monthly' ? limitActionItem.requestedLimit : limitActionItem.requestedMonthlyLimit)?.toLocaleString('en-IN')}</span>
                  </Typography>
                )}
              </Box>
              <TextField
                label={limitActionItem.type === 'approve' ? 'Comment (optional)' : 'Rejection Reason *'}
                value={limitComment}
                onChange={(e) => { setLimitComment(e.target.value); setLimitCommentError(''); }}
                fullWidth
                multiline
                rows={3}
                InputProps={{ sx: { color: '#111827' } }}
                sx={inputSx}
                error={!!limitCommentError}
                helperText={limitCommentError}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setLimitActionItem(null)} disabled={processing} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleLimitAction} disabled={processing} variant="contained" sx={{ background: limitActionItem?.type === 'approve' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#ef4444', color: '#fff', fontWeight: 700, borderRadius: '10px', textTransform: 'none', px: 3 }}>
            {processing ? <CircularProgress size={18} color="inherit" /> : limitActionItem?.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!accountActionItem}
        onClose={() => { if (!processing) setAccountActionItem(null); }}
        PaperProps={{ sx: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', minWidth: 380 } }}
      >
        <DialogTitle sx={{ color: accountActionItem?.type === 'approve' ? '#16a34a' : '#ef4444', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          {accountActionItem?.type === 'approve' ? 'Approve Account Type Request' : 'Reject Account Type Request'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          {accountActionItem && (
            <Box>
              <Box sx={{ p: 2, mb: 2.5, borderRadius: '12px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', mb: 0.5 }}>Customer: <span style={{ color: '#111827', fontWeight: 600 }}>{accountActionItem.customerName} ({accountActionItem.customerId})</span></Typography>
                <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', mb: 0.5 }}>Requested Account Type: <span style={{ color: '#d97706', fontWeight: 700 }}>{accountActionItem.requestedAccountType}</span></Typography>
                <Typography sx={{ color: '#6B7280', fontSize: '0.82rem' }}>Current Account Types: <span style={{ color: '#111827', fontWeight: 600 }}>{accountActionItem.currentAccountTypes.join(', ') || 'None'}</span></Typography>
              </Box>
              <TextField
                label={accountActionItem.type === 'approve' ? 'Comment (optional)' : 'Rejection Reason *'}
                value={accountComment}
                onChange={(e) => { setAccountComment(e.target.value); setAccountCommentError(''); }}
                fullWidth
                multiline
                rows={3}
                InputProps={{ sx: { color: '#111827' } }}
                sx={inputSx}
                error={!!accountCommentError}
                helperText={accountCommentError}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setAccountActionItem(null)} disabled={processing} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleAccountAction} disabled={processing} variant="contained" sx={{ background: accountActionItem?.type === 'approve' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#ef4444', color: '#fff', fontWeight: 700, borderRadius: '10px', textTransform: 'none', px: 3 }}>
            {processing ? <CircularProgress size={18} color="inherit" /> : accountActionItem?.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApprovalQueue;
