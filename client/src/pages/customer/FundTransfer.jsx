import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Alert, CircularProgress, Avatar, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Chip, Tab, Tabs, InputAdornment,
} from '@mui/material';
import {
  SwapHoriz, Send, AccountBalance, Person, CheckCircle, Warning,
  ArrowForward, CurrencyRupee,
} from '@mui/icons-material';
import { accountAPI, beneficiaryAPI, transferAPI } from '../../services/api';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const APPROVAL_THRESHOLD = 50000;

const accountTypeColors = { savings: '#22c55e', current: '#3b82f6', salary: '#a855f7' };

const FundTransfer = () => {
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error'|'approval', message }

  // Own account transfer state
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [ownAmount, setOwnAmount] = useState('');
  const [ownDesc, setOwnDesc] = useState('');
  const [ownError, setOwnError] = useState('');

  // Beneficiary transfer state
  const [benFromAccount, setBenFromAccount] = useState('');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState('');
  const [benAmount, setBenAmount] = useState('');
  const [benDesc, setBenDesc] = useState('');
  const [benError, setBenError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, benRes] = await Promise.all([accountAPI.getAll(), beneficiaryAPI.getAll()]);
        setAccounts(accRes.data.accounts || []);
        setBeneficiaries(benRes.data.beneficiaries || []);
      } catch {
        // handled gracefully
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const getAvailableBalance = (accId) => {
    const acc = accounts.find((a) => a._id === accId);
    if (!acc) return 0;
    return acc.balance + (acc.overdraftLimit - acc.overdraftUsed);
  };

  const validateOwn = () => {
    if (!fromAccount) return 'Please select a source account.';
    if (!toAccount) return 'Please select a destination account.';
    if (fromAccount === toAccount) return 'Source and destination accounts must be different.';
    const amt = parseFloat(ownAmount);
    if (!ownAmount || isNaN(amt) || amt <= 0) return 'Please enter a valid amount.';
    const avail = getAvailableBalance(fromAccount);
    if (amt > avail) return `Insufficient funds. Available: ${formatCurrency(avail)}`;
    return '';
  };

  const validateBen = () => {
    if (!benFromAccount) return 'Please select a source account.';
    if (!selectedBeneficiary) return 'Please select a beneficiary.';
    const amt = parseFloat(benAmount);
    if (!benAmount || isNaN(amt) || amt <= 0) return 'Please enter a valid amount.';
    const avail = getAvailableBalance(benFromAccount);
    if (amt > avail) return `Insufficient funds. Available: ${formatCurrency(avail)}`;
    return '';
  };

  const handleOwnSubmit = (e) => {
    e.preventDefault();
    const err = validateOwn();
    if (err) { setOwnError(err); return; }
    setOwnError('');
    setConfirmOpen(true);
  };

  const handleBenSubmit = (e) => {
    e.preventDefault();
    const err = validateBen();
    if (err) { setBenError(err); return; }
    setBenError('');
    setConfirmOpen(true);
  };

  const executeTransfer = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setResult(null);
    try {
      if (tab === 0) {
        const res = await transferAPI.ownAccount({
          fromAccountId: fromAccount,
          toAccountId: toAccount,
          amount: parseFloat(ownAmount),
          description: ownDesc || 'Own account transfer',
        });
        if (res.data.requiresApproval) {
          setResult({ type: 'approval', message: res.data.message });
        } else {
          setResult({ type: 'success', message: res.data.message });
          setOwnAmount(''); setOwnDesc('');
          // Refresh balances
          const accRes = await accountAPI.getAll();
          setAccounts(accRes.data.accounts || []);
        }
      } else {
        const res = await transferAPI.toBeneficiary({
          fromAccountId: benFromAccount,
          beneficiaryId: selectedBeneficiary,
          amount: parseFloat(benAmount),
          description: benDesc || 'Beneficiary transfer',
        });
        if (res.data.requiresApproval) {
          setResult({ type: 'approval', message: res.data.message });
        } else {
          setResult({ type: 'success', message: res.data.message });
          setBenAmount(''); setBenDesc('');
          const accRes = await accountAPI.getAll();
          setAccounts(accRes.data.accounts || []);
        }
      }
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.message || 'Transfer failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentAmount = tab === 0 ? parseFloat(ownAmount) || 0 : parseFloat(benAmount) || 0;
  const needsApproval = currentAmount >= APPROVAL_THRESHOLD;

  const confirmDetails = () => {
    if (tab === 0) {
      const from = accounts.find((a) => a._id === fromAccount);
      const to = accounts.find((a) => a._id === toAccount);
      return {
        from: from ? `${from.accountType.charAt(0).toUpperCase() + from.accountType.slice(1)} (${from.accountNumber})` : '',
        to: to ? `${to.accountType.charAt(0).toUpperCase() + to.accountType.slice(1)} (${to.accountNumber})` : '',
        amount: parseFloat(ownAmount),
        desc: ownDesc,
      };
    } else {
      const from = accounts.find((a) => a._id === benFromAccount);
      const ben = beneficiaries.find((b) => b._id === selectedBeneficiary);
      return {
        from: from ? `${from.accountType.charAt(0).toUpperCase() + from.accountType.slice(1)} (${from.accountNumber})` : '',
        to: ben ? `${ben.nickname} — ${ben.accountNumber}` : '',
        amount: parseFloat(benAmount),
        desc: benDesc,
      };
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.05)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiFormHelperText-root': { color: '#f87171' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress sx={{ color: '#f59e0b' }} />
      </Box>
    );
  }

  const details = confirmOpen ? confirmDetails() : null;

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5, fontFamily: "'Inter', sans-serif" }}>
        Fund Transfer
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Transfer funds between your accounts or to registered beneficiaries
      </Typography>

      {result && (
        <Alert
          severity={result.type === 'approval' ? 'warning' : result.type}
          icon={result.type === 'approval' ? <Warning /> : result.type === 'success' ? <CheckCircle /> : undefined}
          sx={{
            mb: 3,
            borderRadius: '12px',
            bgcolor: result.type === 'success' ? 'rgba(34,197,94,0.1)' : result.type === 'approval' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
            color: result.type === 'success' ? '#86efac' : result.type === 'approval' ? '#fde68a' : '#fca5a5',
            border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.25)' : result.type === 'approval' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
          onClose={() => setResult(null)}
        >
          {result.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Transfer Form */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 0 }}>
              {/* Tabs */}
              <Tabs
                value={tab}
                onChange={(_, v) => { setTab(v); setResult(null); setOwnError(''); setBenError(''); }}
                sx={{
                  px: 3, pt: 2,
                  '& .MuiTab-root': { color: 'rgba(255,255,255,0.45)', textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' },
                  '& .Mui-selected': { color: '#f59e0b' },
                  '& .MuiTabs-indicator': { backgroundColor: '#f59e0b', height: 3, borderRadius: 2 },
                }}
              >
                <Tab icon={<SwapHoriz sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Own Account Transfer" />
                <Tab icon={<Send sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Beneficiary Transfer" />
              </Tabs>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mt: 1 }} />

              <Box sx={{ p: 3.5 }}>
                {/* Own Account Transfer */}
                {tab === 0 && (
                  <Box component="form" onSubmit={handleOwnSubmit}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={inputSx}>
                          <InputLabel>From Account</InputLabel>
                          <Select
                            value={fromAccount}
                            label="From Account"
                            onChange={(e) => setFromAccount(e.target.value)}
                            sx={{ color: '#fff' }}
                          >
                            {activeAccounts.map((acc) => (
                              <MenuItem key={acc._id} value={acc._id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accountTypeColors[acc.accountType] }} />
                                  <Box>
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                      {acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                      {formatCurrency(acc.balance)} available
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {fromAccount && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', mt: 0.5, ml: 0.5 }}>
                            Available (incl. OD): {formatCurrency(getAvailableBalance(fromAccount))}
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={inputSx}>
                          <InputLabel>To Account</InputLabel>
                          <Select
                            value={toAccount}
                            label="To Account"
                            onChange={(e) => setToAccount(e.target.value)}
                            sx={{ color: '#fff' }}
                          >
                            {activeAccounts.filter((a) => a._id !== fromAccount).map((acc) => (
                              <MenuItem key={acc._id} value={acc._id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accountTypeColors[acc.accountType] }} />
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                    {acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1)}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Amount (₹)"
                          type="number"
                          value={ownAmount}
                          onChange={(e) => setOwnAmount(e.target.value)}
                          fullWidth
                          sx={inputSx}
                          InputProps={{
                            startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.1rem' }} /></InputAdornment>,
                          }}
                          inputProps={{ min: 1, step: 0.01 }}
                        />
                        {parseFloat(ownAmount) >= APPROVAL_THRESHOLD && (
                          <Typography sx={{ color: '#f59e0b', fontSize: '0.75rem', mt: 0.5, ml: 0.5 }}>
                            ⚠ Transfers ≥ ₹50,000 require manager approval
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Description (optional)"
                          value={ownDesc}
                          onChange={(e) => setOwnDesc(e.target.value)}
                          fullWidth
                          sx={inputSx}
                          placeholder="e.g. Monthly savings"
                        />
                      </Grid>
                    </Grid>

                    {ownError && (
                      <Alert severity="error" sx={{ mt: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                        {ownError}
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={18} /> : <ArrowForward />}
                      sx={{
                        mt: 3, py: 1.5, fontWeight: 700, fontSize: '0.95rem',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#0a0e27', borderRadius: '12px',
                        '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
                        '&:disabled': { opacity: 0.6 },
                      }}
                    >
                      {submitting ? 'Processing...' : 'Proceed to Transfer'}
                    </Button>
                  </Box>
                )}

                {/* Beneficiary Transfer */}
                {tab === 1 && (
                  <Box component="form" onSubmit={handleBenSubmit}>
                    {beneficiaries.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Person sx={{ fontSize: '3rem', color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', mb: 1 }}>No beneficiaries added yet</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                          Go to Beneficiary Management to add one.
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth sx={inputSx}>
                            <InputLabel>From Account</InputLabel>
                            <Select
                              value={benFromAccount}
                              label="From Account"
                              onChange={(e) => setBenFromAccount(e.target.value)}
                              sx={{ color: '#fff' }}
                            >
                              {activeAccounts.map((acc) => (
                                <MenuItem key={acc._id} value={acc._id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accountTypeColors[acc.accountType] }} />
                                    <Box>
                                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1)}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                        {formatCurrency(acc.balance)} available
                                      </Typography>
                                    </Box>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {benFromAccount && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', mt: 0.5, ml: 0.5 }}>
                              Available (incl. OD): {formatCurrency(getAvailableBalance(benFromAccount))}
                            </Typography>
                          )}
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth sx={inputSx}>
                            <InputLabel>Beneficiary</InputLabel>
                            <Select
                              value={selectedBeneficiary}
                              label="Beneficiary"
                              onChange={(e) => setSelectedBeneficiary(e.target.value)}
                              sx={{ color: '#fff' }}
                            >
                              {beneficiaries.map((ben) => (
                                <MenuItem key={ben._id} value={ben._id}>
                                  <Box>
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{ben.nickname}</Typography>
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                      {getDisplayName(ben.beneficiaryName, '')} • {ben.accountNumber}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Amount (₹)"
                            type="number"
                            value={benAmount}
                            onChange={(e) => setBenAmount(e.target.value)}
                            fullWidth
                            sx={inputSx}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.1rem' }} /></InputAdornment>,
                            }}
                            inputProps={{ min: 1, step: 0.01 }}
                          />
                          {parseFloat(benAmount) >= APPROVAL_THRESHOLD && (
                            <Typography sx={{ color: '#f59e0b', fontSize: '0.75rem', mt: 0.5, ml: 0.5 }}>
                              ⚠ Transfers ≥ ₹50,000 require manager approval
                            </Typography>
                          )}
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Description (optional)"
                            value={benDesc}
                            onChange={(e) => setBenDesc(e.target.value)}
                            fullWidth
                            sx={inputSx}
                          />
                        </Grid>
                      </Grid>
                    )}

                    {benError && (
                      <Alert severity="error" sx={{ mt: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                        {benError}
                      </Alert>
                    )}

                    {beneficiaries.length > 0 && (
                      <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} /> : <Send />}
                        sx={{
                          mt: 3, py: 1.5, fontWeight: 700, fontSize: '0.95rem',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#fff', borderRadius: '12px',
                          '&:hover': { background: 'linear-gradient(135deg, #818cf8, #6366f1)' },
                          '&:disabled': { opacity: 0.6 },
                        }}
                      >
                        {submitting ? 'Processing...' : 'Send to Beneficiary'}
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Info Panel */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 2, fontSize: '0.95rem' }}>Account Balances</Typography>
              {activeAccounts.map((acc) => (
                <Box key={acc._id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: accountTypeColors[acc.accountType] }} />
                    <Box>
                      <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600, textTransform: 'capitalize' }}>{acc.accountType}</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{acc.accountNumber}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ color: accountTypeColors[acc.accountType], fontWeight: 700, fontSize: '0.88rem' }}>
                    {formatCurrency(acc.balance)}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card sx={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Warning sx={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                <Typography sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.9rem' }}>Transfer Guidelines</Typography>
              </Box>
              {[
                'Transfers ≥ ₹50,000 require manager approval.',
                'You will be notified once approved or rejected.',
                'Insufficient balance includes overdraft limit.',
                'All transactions are logged and traceable.',
              ].map((tip) => (
                <Typography key={tip} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', mb: 1, display: 'flex', gap: 1 }}>
                  <span style={{ color: '#f59e0b' }}>•</span> {tip}
                </Typography>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            minWidth: 380
          },
        }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>Confirm Transfer</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          {details && (
            <Box>
              {needsApproval && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
                  This transfer requires manager approval before execution.
                </Alert>
              )}
              {[
                { label: 'From', value: details.from },
                { label: 'To', value: details.to },
                { label: 'Amount', value: formatCurrency(details.amount) },
                ...(details.desc ? [{ label: 'Description', value: details.desc }] : []),
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ color: '#6B7280', fontSize: '0.85rem' }}>{label}</Typography>
                  <Typography sx={{ color: '#111827', fontSize: '0.85rem', fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{value}</Typography>
                </Box>
              ))}
              <Divider sx={{ borderColor: '#E5E7EB', my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#6B7280', fontSize: '0.85rem' }}>Status after submit</Typography>
                <Chip
                  label={needsApproval ? 'Pending Approval' : 'Instant Transfer'}
                  size="small"
                  sx={{
                    bgcolor: needsApproval ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                    color: needsApproval ? '#f59e0b' : '#22c55e',
                    fontSize: '0.72rem', fontWeight: 700,
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={executeTransfer}
            variant="contained"
            sx={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 700, borderRadius: '10px', textTransform: 'none', px: 3 }}
          >
            Confirm Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FundTransfer;
