import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Avatar, Skeleton, Alert, LinearProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider,
  CircularProgress, Collapse, IconButton, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  AccountBalance, Savings, CreditCard, WorkspacePremium, TrendingUp, ExpandMore, ExpandLess,
  CheckCircle, Cancel, HourglassEmpty,
} from '@mui/icons-material';
import { accountAPI, overdraftAPI, transferLimitAPI } from '../../services/api';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const classificationColors = {
  PENDING: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  SILVER:  { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
  GOLD:    { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  PLATINUM:{ bg: 'rgba(99,102,241,0.15)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
};

const accountIcons = {
  savings: <Savings sx={{ fontSize: '2rem' }} />,
  current: <CreditCard sx={{ fontSize: '2rem' }} />,
  salary:  <WorkspacePremium sx={{ fontSize: '2rem' }} />,
};

const accountColors = {
  savings: '#22c55e',
  current: '#3b82f6',
  salary:  '#a855f7',
};

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Limit Increase Modal
// ─────────────────────────────────────────────────────────────────────────────
const TransferLimitIncreaseModal = ({ open, account, onClose, onSuccess }) => {
  const [limitType, setLimitType] = useState('daily');
  const [requestedLimit, setRequestedLimit] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const limits = account?.limits || {};
  const currentDaily = limits.dailyTransferLimit || 0;
  const currentMonthly = limits.monthlyTransferLimit || 0;
  const currentLimit = limitType === 'daily' ? currentDaily : currentMonthly;

  // Reset on open
  useEffect(() => {
    if (open) {
      setLimitType('daily');
      setRequestedLimit('');
      setReason('');
      setError('');
      setSuccess('');
    }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    if (!requestedLimit || !reason.trim()) {
      setError('All fields are required.');
      return;
    }
    const nextLimit = parseFloat(requestedLimit);
    if (isNaN(nextLimit) || nextLimit <= 0) {
      setError('Enter valid positive amounts.');
      return;
    }
    if (nextLimit <= currentLimit) {
      setError('Requested limit must be greater than the current limit.');
      return;
    }
    setLoading(true);
    try {
      await transferLimitAPI.submitRequest({
        accountId: account._id,
        accountType: account.accountType,
        limitType,
        requestedLimit: nextLimit,
        reason: reason.trim(),
      });
      setSuccess('Request submitted! It will appear in your request history below once the manager reviews it.');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    mt: 0.5,
    '& .MuiOutlinedInput-root': {
      color: '#111827',
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputLabel-root': {
      color: '#6B7280',
      backgroundColor: '#FFFFFF',
      px: 0.5,
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiFormHelperText-root': { color: '#ef4444' },
  };

  if (!account) return null;

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          color: '#111827',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp sx={{ color: '#fff', fontSize: '1.1rem' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827' }}>
              Request Transfer Limit Increase
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
              {account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)} Account ({account.accountNumber})
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 4, pb: 2, backgroundColor: '#FFFFFF', color: '#111827' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>{success}</Alert>
        )}

        <Grid container spacing={2.5} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel shrink>Limit Type</InputLabel>
              <Select
                label="Limit Type"
                notched
                value={limitType}
                onChange={(e) => {
                  setLimitType(e.target.value);
                  setRequestedLimit('');
                  setError('');
                }}
              >
                <MenuItem value="daily">Daily Transfer Limit</MenuItem>
                <MenuItem value="monthly">Monthly Transfer Limit</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Current Limit"
              value={formatCurrency(currentLimit)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{
                readOnly: true,
                sx: { color: '#111827' },
              }}
              sx={inputSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Requested Limit"
              type="number"
              value={requestedLimit}
              onChange={(e) => setRequestedLimit(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{
                inputProps: { min: 1 },
                sx: { color: '#111827' }
              }}
              sx={inputSx}
            />
          </Grid>
        </Grid>

        {/* Reason */}
        <TextField
          label="Reason for Increase *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          rows={3}
          placeholder="Explain why you need a higher transfer limit..."
          InputProps={{
            sx: { color: '#111827' }
          }}
          InputLabelProps={{ shrink: true }}
          sx={inputSx}
          inputProps={{ maxLength: 500 }}
          helperText={`${reason.length}/500`}
          FormHelperTextProps={{ sx: { color: '#6B7280 !important', textAlign: 'right' } }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600, borderRadius: '10px' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !!success}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: '10px', px: 3,
            '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Submit Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Account Card
// ─────────────────────────────────────────────────────────────────────────────
const AccountCard = ({ account, onIncreaseLimit }) => {
  const color = accountColors[account.accountType] || '#f59e0b';
  const cls = classificationColors[account.classification] || classificationColors.PENDING;
  const odPercent = account.overdraftLimit > 0
    ? Math.min((account.overdraftUsed / account.overdraftLimit) * 100, 100)
    : 0;

  const limits = account.limits || {};
  const dailyPercent = limits.dailyTransferLimit
    ? Math.min(((limits.dailyTransferUsed || 0) / limits.dailyTransferLimit) * 100, 100)
    : 0;
  const monthlyPercent = limits.monthlyTransferLimit
    ? Math.min(((account.monthlyTransferTotal || 0) / limits.monthlyTransferLimit) * 100, 100)
    : 0;

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        border: `1px solid ${color}25`,
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 20px 40px ${color}20` },
      }}
    >
      <Box sx={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

      <CardContent sx={{ p: 3.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              {account.accountType} Account
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {account.accountNumber}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <Avatar sx={{ width: 48, height: 48, background: `${color}20`, border: `1px solid ${color}30` }}>
              {React.cloneElement(accountIcons[account.accountType] || <AccountBalance sx={{ fontSize: '2rem' }} />, { sx: { color, fontSize: '1.5rem' } })}
            </Avatar>
            <Chip
              label={account.classification}
              size="small"
              icon={<WorkspacePremium sx={{ fontSize: '0.85rem !important', color: `${cls.text} !important` }} />}
              sx={{ bgcolor: cls.bg, color: cls.text, border: `1px solid ${cls.border}`, fontSize: '0.72rem', fontWeight: 700 }}
            />
          </Box>
        </Box>

        {/* Balance */}
        <Typography sx={{ color: '#fff', fontSize: '2rem', fontWeight: 800, fontFamily: "'Inter', sans-serif", lineHeight: 1, mb: 0.5 }}>
          {formatCurrency(account.balance)}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>
          Cash Balance
        </Typography>

        {/* Transfer Limits Section */}
        {limits && (limits.dailyTransferLimit || limits.monthlyTransferLimit) && (
          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, mb: 1.5 }}>Transfer Limits</Typography>

            {limits.dailyTransferLimit && (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>Daily</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', fontWeight: 600 }}>
                    ₹0 / {formatCurrency(limits.dailyTransferLimit).replace('₹', '')}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={dailyPercent}
                  sx={{
                    height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': { background: dailyPercent > 80 ? '#ef4444' : '#6366f1', borderRadius: 2 },
                  }}
                />
              </Box>
            )}

            {limits.monthlyTransferLimit && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>Monthly</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', fontWeight: 600 }}>
                    {formatCurrency(account.monthlyTransferTotal || 0).replace('₹', '')} / {formatCurrency(limits.monthlyTransferLimit).replace('₹', '')}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={monthlyPercent}
                  sx={{
                    height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': { background: monthlyPercent > 80 ? '#ef4444' : '#22c55e', borderRadius: 2 },
                  }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Overdraft section */}
        {account.overdraftLimit > 0 && (
          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Overdraft Usage</Typography>
              <Typography sx={{ color: account.overdraftUsed > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontSize: '0.78rem', fontWeight: 600 }}>
                {formatCurrency(account.overdraftUsed)} / {formatCurrency(account.overdraftLimit)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={odPercent}
              sx={{
                height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  background: odPercent > 70 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : `linear-gradient(90deg, ${color}, ${color}80)`,
                  borderRadius: 3,
                },
              }}
            />
            {account.monthlyOverdraftCount !== undefined && (
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                  Monthly Usage: {account.monthlyOverdraftCount}/3
                </Typography>
                <Chip
                  label={account.overdraftStatus || 'ACTIVE'}
                  size="small"
                  sx={{
                    height: 18,
                    bgcolor: (account.overdraftStatus || 'ACTIVE') === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: (account.overdraftStatus || 'ACTIVE') === 'ACTIVE' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${(account.overdraftStatus || 'ACTIVE') === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '0.62rem', fontWeight: 700,
                  }}
                />
              </Box>
            )}
            {account.overdraftPenalty > 0 && (
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Accumulated Penalty:</Typography>
                <Typography sx={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 700 }}>
                  {formatCurrency(account.overdraftPenalty)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Status */}
        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={account.status.toUpperCase()}
            size="small"
            sx={{
              bgcolor: account.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: account.status === 'active' ? '#22c55e' : '#ef4444',
              border: `1px solid ${account.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontSize: '0.7rem', fontWeight: 700,
            }}
          />
          {account.interestRate > 0 && (
            <Typography sx={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 600 }}>
              {account.interestRate}% p.a.
            </Typography>
          )}
        </Box>

        <Button
          fullWidth
          startIcon={<TrendingUp sx={{ fontSize: '1rem !important' }} />}
          onClick={() => onIncreaseLimit(account)}
          disabled={account.status !== 'active'}
          sx={{
            mt: 2,
            color,
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'none',
            border: `1px solid ${color}55`,
            borderRadius: '10px',
            py: 0.8,
            '&:hover': { background: `${color}12`, borderColor: color },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Increase Transfer Limit
        </Button>
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// My Limit Requests Section
// ─────────────────────────────────────────────────────────────────────────────
const statusConfig = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  icon: <HourglassEmpty sx={{ fontSize: '1rem' }} /> },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.3)',  icon: <CheckCircle sx={{ fontSize: '1rem' }} /> },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  icon: <Cancel sx={{ fontSize: '1rem' }} /> },
};

const LimitRequestsSection = ({ refresh }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await transferLimitAPI.getMyRequests();
      setRequests(res.data.requests || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refresh]);

  if (!loading && requests.length === 0) return null;

  return (
    <Card sx={{ mt: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: expanded ? 2.5 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 6, height: 22, background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '3px' }} />
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
              Transfer Limit Increase Requests
            </Typography>
            <Chip
              label={requests.length}
              size="small"
              sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, height: 20 }}
            />
          </Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          {loading ? (
            [...Array(2)].map((_, i) => (
              <Skeleton key={i} height={70} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '12px', mb: 1 }} />
            ))
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {requests.map((req) => {
                const cfg = statusConfig[req.status] || statusConfig.pending;
                const isTypedRequest = req.limitType === 'daily' || req.limitType === 'monthly';
                const typeLabel = req.limitType === 'monthly' ? 'Monthly Transfer Limit' : 'Daily Transfer Limit';
                const currentValue = isTypedRequest ? req.currentLimit : null;
                const requestedValue = isTypedRequest ? req.requestedLimit : null;
                return (
                  <Box
                    key={req._id}
                    sx={{
                      p: 2.5,
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cfg.border}`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Status accent */}
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: cfg.color, borderRadius: '14px 0 0 14px' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', ml: 0.5 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600, textTransform: 'capitalize' }}>
                            {isTypedRequest ? typeLabel : `${req.accountId?.accountType || 'Transfer'} Account`}
                          </Typography>
                          {req.accountId?.accountNumber && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                              {req.accountId.accountNumber}
                            </Typography>
                          )}
                        </Box>

                        {isTypedRequest ? (
                          <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={6}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Current Limit</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>
                                {formatCurrency(currentValue)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Requested Limit</Typography>
                              <Typography sx={{ color: cfg.color, fontSize: '0.82rem', fontWeight: 700 }}>
                                {formatCurrency(requestedValue)}
                              </Typography>
                            </Grid>
                          </Grid>
                        ) : (
                          <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={6} sm={3}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Current Daily</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>
                                {formatCurrency(req.currentDailyLimit)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Requested Daily</Typography>
                              <Typography sx={{ color: cfg.color, fontSize: '0.82rem', fontWeight: 700 }}>
                                {formatCurrency(req.requestedDailyLimit)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Current Monthly</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>
                                {formatCurrency(req.currentMonthlyLimit)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', mb: 0.2 }}>Requested Monthly</Typography>
                              <Typography sx={{ color: cfg.color, fontSize: '0.82rem', fontWeight: 700 }}>
                                {formatCurrency(req.requestedMonthlyLimit)}
                              </Typography>
                            </Grid>
                          </Grid>
                        )}

                        {req.reason && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', mt: 1, fontStyle: 'italic' }}>
                            "{req.reason}"
                          </Typography>
                        )}

                        {req.managerComment && (
                          <Box sx={{ mt: 1, p: 1, borderRadius: '8px', background: `${cfg.color}10`, border: `1px solid ${cfg.color}30` }}>
                            <Typography sx={{ color: cfg.color, fontSize: '0.75rem', fontWeight: 600, mb: 0.2 }}>
                              Manager Comment:
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                              {req.managerComment}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Box sx={{ textAlign: 'right', ml: 2, flexShrink: 0 }}>
                        <Chip
                          icon={React.cloneElement(cfg.icon, { sx: { color: `${cfg.color} !important`, fontSize: '0.8rem !important' } })}
                          label={cfg.label}
                          size="small"
                          sx={{ bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: '0.72rem', fontWeight: 700, mb: 1 }}
                        />
                        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem', display: 'block' }}>
                          {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main AccountSummary Component
// ─────────────────────────────────────────────────────────────────────────────
const AccountSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [selectedLimitAccount, setSelectedLimitAccount] = useState(null);
  const [requestRefresh, setRequestRefresh] = useState(0);

  const loadAccounts = useCallback(() => {
    accountAPI.getAll()
      .then((res) => {
        let payload = res.data;
        if (!payload) payload = { accounts: [], summary: { totalBalance: 0, totalOverdraftUsed: 0, totalOverdraftLimit: 0, accountCount: 0 } };
        else if (Array.isArray(payload)) {
          const arr = payload;
          payload = {
            accounts: arr,
            summary: {
              totalBalance: arr.reduce((s, a) => s + (Number(a.balance) || 0), 0),
              totalOverdraftUsed: arr.reduce((s, a) => s + (Number(a.overdraftUsed) || 0), 0),
              totalOverdraftLimit: arr.reduce((s, a) => s + (Number(a.overdraftLimit) || 0), 0),
              accountCount: arr.length,
            },
          };
        }
        setData(payload);
      })
      .catch(() => setError('Failed to load accounts.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAccounts();
    const interval = setInterval(loadAccounts, 15000);
    window.addEventListener('focus', loadAccounts);
    window.addEventListener('paynest:data-changed', loadAccounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', loadAccounts);
      window.removeEventListener('paynest:data-changed', loadAccounts);
    };
  }, [loadAccounts]);

  const handleLimitSuccess = () => {
    setRequestRefresh((n) => n + 1);
    loadAccounts();
  };

  const openLimitModal = (account) => {
    setSelectedLimitAccount(account);
    setLimitModalOpen(true);
  };

  const closeLimitModal = () => {
    setLimitModalOpen(false);
    setSelectedLimitAccount(null);
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5, fontFamily: "'Inter', sans-serif" }}>
        Account Summary
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Manage and view all your banking accounts
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </Alert>
      )}

      {/* Total summary row */}
      {data && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.05) 100%)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px' }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {[
                { label: 'Cash Balance',     value: formatCurrency(data.summary.totalBalance),        color: '#f59e0b' },
                { label: 'Overdraft Used',   value: formatCurrency(data.summary.totalOverdraftUsed),  color: '#ef4444' },
                { label: 'Available Balance', value: formatCurrency(data.summary.totalAvailableBalance ?? data.summary.totalBalance), color: '#6366f1' },
                { label: 'Active Accounts',  value: data.summary.accountCount,                        color: '#22c55e' },
              ].map(({ label, value, color }) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
                  <Typography sx={{ color, fontSize: '1.3rem', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {loading
          ? [...Array(3)].map((_, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Skeleton variant="rectangular" height={320} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '20px' }} />
              </Grid>
            ))
          : data?.accounts?.map((acc) => (
              <Grid item xs={12} md={4} key={acc._id}>
                <AccountCard
                  account={acc}
                  onIncreaseLimit={openLimitModal}
                />
              </Grid>
            ))}
      </Grid>

      {/* My Limit Requests */}
      <LimitRequestsSection refresh={requestRefresh} />

      {/* Transfer Limit Increase Modal */}
      <TransferLimitIncreaseModal
        open={limitModalOpen}
        account={selectedLimitAccount}
        onClose={closeLimitModal}
        onSuccess={handleLimitSuccess}
      />
    </Box>
  );
};

export default AccountSummary;
