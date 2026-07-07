import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Avatar } from '@mui/material';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tab,
  Tabs,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Send, CheckCircle, Person, AccountCircle, CurrencyRupee, SwapHoriz, AccountBalance, Info,
} from '@mui/icons-material';
import { accountAPI, transactionAPI } from '../../services/api';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const accountTypeColors = { savings: '#22c55e', current: '#3b82f6', salary: '#a855f7' };

// ─────────────────────────────────────────────────────────────────────────────
// TransferFundsPage — Beneficiary Transfer + Self Transfer
// ─────────────────────────────────────────────────────────────────────────────
const TransferFundsPage = () => {
  const [tab, setTab] = useState(0); // 0 = Beneficiary Transfer, 1 = Self Transfer
  const [accounts, setAccounts] = useState([]);
  const [savedBeneficiaries, setSavedBeneficiaries] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // ── Beneficiary Transfer state ──────────────────────────────────────────────
  const [formData, setFormData] = useState({
    fromAccountId: '',
    amount: '',
    receiverAccountNumber: '',
    receiverName: '',
    receiverNickname: '',
    receiverCustomerId: '',
    receiverAccountType: '',
    category: 'transfer',
  });
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [lookupSource, setLookupSource] = useState('');
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [overdraftConfirmation, setOverdraftConfirmation] = useState(null);

  // ── Self Transfer state ────────────────────────────────────────────────────
  const [selfForm, setSelfForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', remarks: '' });
  const [selfLoading, setSelfLoading] = useState(false);
  const [selfError, setSelfError] = useState('');
  const [selfSuccess, setSelfSuccess] = useState(null);

  // Load accounts on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, beneficiaryRes] = await Promise.all([
          accountAPI.getAll(),
          accountAPI.getBeneficiaries(),
        ]);
        const accs = accRes.data.accounts || [];
        setAccounts(accs);
        setSavedBeneficiaries(beneficiaryRes.data.beneficiaries || []);
        if (accs.length) {
          setFormData((prev) => ({ ...prev, fromAccountId: accs[0]._id }));
        }
      } catch (err) {
        console.error('Failed to load accounts', err);
      } finally {
        setAccountsLoading(false);
      }
    };
    load();
  }, []);

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const hasMultipleAccounts = activeAccounts.length >= 2;

  // ── Beneficiary Transfer handlers ──────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'receiverAccountNumber') {
      setLookupSource('account');
      setAccountVerified(false);
      setError('');
      setFormData((prev) => ({
        ...prev,
        receiverAccountNumber: value,
        receiverName: '',
        receiverNickname: '',
        receiverCustomerId: '',
        receiverAccountType: '',
      }));
    } else if (name === 'receiverNickname') {
      setError('');
      if (!accountVerified) setLookupSource('nickname');
    }
  };

  useEffect(() => {
    if (lookupSource !== 'account' || !formData.receiverAccountNumber.trim()) return undefined;
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      setError('');
      try {
        const response = await accountAPI.lookupAccountNumber(formData.receiverAccountNumber.trim());
        const details = response.data.account;
        setFormData((prev) => ({
          ...prev,
          receiverAccountNumber: details.accountNumber,
          receiverName: details.customerName,
          receiverNickname: details.beneficiaryNickname || '',
          receiverCustomerId: details.customerId,
          receiverAccountType: details.accountType,
        }));
        setAccountVerified(true);
      } catch (lookupError) {
        setFormData((prev) => ({
          ...prev,
          receiverName: '',
          receiverCustomerId: '',
          receiverAccountType: '',
        }));
        setAccountVerified(false);
        setError(lookupError.response?.data?.message || 'Invalid account number. No customer found.');
      } finally {
        setLookupLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.receiverAccountNumber, lookupSource]);

  useEffect(() => {
    if (lookupSource !== 'nickname' || accountVerified || !formData.receiverNickname.trim()) return undefined;
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      setError('');
      try {
        const response = await accountAPI.lookupBeneficiaryNickname(formData.receiverNickname.trim());
        const details = response.data.account;
        setFormData((prev) => ({
          ...prev,
          receiverAccountNumber: details.accountNumber,
          receiverName: details.customerName,
          receiverNickname: details.beneficiaryNickname,
          receiverCustomerId: details.customerId,
          receiverAccountType: details.accountType,
        }));
        setLookupSource('');
        setAccountVerified(true);
      } catch (lookupError) {
        setFormData((prev) => ({
          ...prev,
          receiverAccountNumber: '',
          receiverName: '',
          receiverCustomerId: '',
          receiverAccountType: '',
        }));
        setAccountVerified(false);
        setError(lookupError.response?.data?.message || 'No saved beneficiary found with this nickname.');
      } finally {
        setLookupLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.receiverNickname, lookupSource, accountVerified]);

  const executeBeneficiaryTransfer = async (confirmOverdraft = false) => {
    const payload = {
      fromAccountId: formData.fromAccountId,
      receiverAccountNumber: formData.receiverAccountNumber,
      receiverNickname: formData.receiverNickname,
      amount: parseFloat(formData.amount),
      category: formData.category,
      confirmOverdraft,
    };

    setLoading(true);
    try {
      const res = await transactionAPI.transferByCustomerId(payload);
      if (res.data?.success !== true) {
        throw new Error(res.data?.message || 'Transfer failed. Please try again.');
      }
      setSuccessData({
        transactionId: res.data.transactionId || 'N/A',
        amount: payload.amount,
        beneficiary: { beneficiaryName: formData.receiverName, nickname: formData.receiverNickname },
        fromAccountBalance: res.data.fromAccountBalance,
        category: formData.category,
      });
      const accRes = await accountAPI.getAll();
      setAccounts(accRes.data.accounts || []);
      window.dispatchEvent(new CustomEvent('paynest:data-changed', { detail: { source: 'fund-transfer' } }));
      setTimeout(() => {
        setFormData((prev) => ({
          ...prev,
          amount: '', receiverAccountNumber: '', receiverName: '', receiverNickname: '', receiverCustomerId: '',
          receiverAccountType: '', category: 'transfer',
        }));
        setAccountVerified(false);
        setLookupSource('');
      }, 2000);
    } catch (err) {
      if (err.response?.data?.requiresOverdraftConfirmation) {
        setOverdraftConfirmation({
          amount: Number(err.response.data.overdraftAmountUsed) || 0,
          cashAmount: Number(err.response.data.balanceAmountUsed) || 0,
        });
        setError('');
      } else {
        setError(err.response?.data?.message || err.message || 'Transfer failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBeneficiarySubmit = async () => {
    setError('');
    const receiverDetailsValid = formData.receiverAccountNumber && formData.receiverName
      && formData.receiverCustomerId && formData.receiverAccountType;
    if (!formData.fromAccountId || !accountVerified || !receiverDetailsValid || !formData.amount || !formData.category) {
      setError(accountVerified ? 'Please fill in the source account, amount, and category.' : 'Enter a valid account number or saved beneficiary nickname.');
      return;
    }
    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid transfer amount.');
      return;
    }
    const selectedAccount = accounts.find((account) => account._id === formData.fromAccountId);
    if (!selectedAccount) {
      setError('Selected source account was not found.');
      return;
    }

    const cashBalance = Number(selectedAccount.balance) || 0;
    const overdraftAmount = Math.max(0, amount - cashBalance);
    if (overdraftAmount > 0) {
      const availableOverdraft = Math.max(0, Number(selectedAccount.overdraftLimit || 0) - Number(selectedAccount.overdraftUsed || 0));
      const overdraftActive = selectedAccount.overdraftStatus === 'ACTIVE'
        && Number(selectedAccount.monthlyOverdraftCount || 0) < 3;
      if (!overdraftActive) {
        setError('Your account has insufficient cash balance and overdraft is not active.');
        return;
      }
      if (overdraftAmount > availableOverdraft) {
        setError(`Insufficient funds. Available overdraft: ${formatCurrency(availableOverdraft)}.`);
        return;
      }
      setOverdraftConfirmation({ amount: overdraftAmount, cashAmount: Math.min(amount, cashBalance) });
      return;
    }

    await executeBeneficiaryTransfer(false);
  };

  // ── Self Transfer handlers ─────────────────────────────────────────────────
  const handleSelfChange = (e) => {
    const { name, value } = e.target;
    setSelfForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelfSubmit = async () => {
    setSelfError('');
    if (!selfForm.fromAccountId || !selfForm.toAccountId || !selfForm.amount) {
      setSelfError('Please select both accounts and enter an amount.');
      return;
    }
    if (selfForm.fromAccountId === selfForm.toAccountId) {
      setSelfError('Source and destination accounts must be different.');
      return;
    }
    const amt = parseFloat(selfForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setSelfError('Please enter a valid amount.');
      return;
    }
    // Client-side balance check
    const fromAcc = activeAccounts.find((a) => a._id === selfForm.fromAccountId);
    if (fromAcc && amt > fromAcc.balance) {
      setSelfError(`Insufficient balance. Available: ${formatCurrency(fromAcc.balance)}`);
      return;
    }
    setSelfLoading(true);
    try {
      const res = await transactionAPI.selfTransfer({
        fromAccountId: selfForm.fromAccountId,
        toAccountId: selfForm.toAccountId,
        amount: amt,
        remarks: selfForm.remarks,
      });
      setSelfSuccess(res.data);
      // Refresh account balances
      const accRes = await accountAPI.getAll();
      setAccounts(accRes.data.accounts || []);
      setSelfForm((prev) => ({ ...prev, amount: '', remarks: '' }));
    } catch (err) {
      setSelfError(err.response?.data?.message || 'Self transfer failed. Please try again.');
    } finally {
      setSelfLoading(false);
    }
  };

  const { user } = useSelector((state) => state.auth);

  // ── Shared input styles ────────────────────────────────────────────────────
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      borderRadius: '10px',
      bgcolor: 'rgba(255,255,255,0.06)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
      '&.Mui-focused fieldset': { borderColor: '#10b981' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#10b981' },
    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
  };

  // ── Success Dialog for Beneficiary Transfer ─────────────────────────────────
  const BenSuccessDialog = ({ open, onClose, data }) => {
    if (!data) return null;
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#10b981', bgcolor: '#F0FDF4', borderBottom: '1px solid #E5E7EB', fontWeight: 700 }}>
          Transfer Successful!
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 4, pb: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: '5rem', color: '#10b981', mb: 2 }} />
          <Typography sx={{ color: '#111827', fontSize: '1.4rem', fontWeight: 800, mb: 1 }}>
            Funds sent to {getDisplayName(data.beneficiary.beneficiaryName, '')}
          </Typography>
          <Box sx={{ p: 2.5, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', mb: 3, textAlign: 'left' }}>
            {[
              { label: 'Amount Sent', value: `₹${data.amount.toLocaleString('en-IN')}`, color: '#10b981' },
              { label: 'Receiver', value: getDisplayName(data.beneficiary.beneficiaryName, '') },
              { label: 'Account Number', value: data.transaction?.toAccountNumber || data.beneficiary.accountNumber },
              { label: 'Account Type', value: data.beneficiary.accountType ? `${data.beneficiary.accountType.charAt(0).toUpperCase()}${data.beneficiary.accountType.slice(1)}` : '—' },
              { label: 'Nickname', value: data.beneficiary.nickname || '—' },
              { label: 'Category', value: data.category },
              { label: 'Transaction ID', value: data.transactionId },
              ...(typeof data.fromAccountBalance !== 'undefined'
                ? [{ label: 'Updated Balance', value: `₹${data.fromAccountBalance.toLocaleString('en-IN')}` }]
                : []),
            ].map(({ label, value, color }) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ color: '#6B7280', fontSize: '0.78rem' }}>{label}:</Typography>
                <Typography sx={{ color: color || '#111827', fontSize: '0.85rem', fontWeight: color ? 700 : 400 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', p: 2, bgcolor: '#FFFFFF', borderTop: '1px solid #E5E7EB' }}>
          <Button variant="contained" fullWidth onClick={onClose} sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1.2 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // ── Self Transfer Success Dialog ─────────────────────────────────────────────
  const SelfSuccessDialog = ({ open, onClose, data }) => {
    if (!data) return null;
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#4f46e5', bgcolor: '#EEF2FF', borderBottom: '1px solid #E5E7EB', fontWeight: 700 }}>
          Self Transfer Successful!
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 4, pb: 4, textAlign: 'center' }}>
          <SwapHoriz sx={{ fontSize: '5rem', color: '#818cf8', mb: 2 }} />
          <Typography sx={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, mb: 3 }}>
            Transfer completed instantly
          </Typography>
          <Box sx={{ p: 2.5, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', mb: 3, textAlign: 'left' }}>
            {[
              { label: 'From Account', value: `${(data.fromAccountType || '').toUpperCase()} — Updated Balance: ${formatCurrency(data.fromAccountBalance)}` },
              { label: 'To Account', value: `${(data.toAccountType || '').toUpperCase()} — Updated Balance: ${formatCurrency(data.toAccountBalance)}` },
              { label: 'Transaction Ref', value: data.transactionId, mono: true },
            ].map(({ label, value, mono }) => (
              <Box key={label} sx={{ mb: 1.5 }}>
                <Typography sx={{ color: '#6B7280', fontSize: '0.74rem', mb: 0.3 }}>{label}</Typography>
                <Typography sx={{ color: '#111827', fontSize: '0.85rem', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 600 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', p: 2, bgcolor: '#FFFFFF', borderTop: '1px solid #E5E7EB' }}>
          <Button variant="contained" fullWidth onClick={onClose} sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1.2 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
          Transfer Funds
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
          Send money securely to beneficiaries or between your own accounts
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setError(''); setSelfError(''); }}
        sx={{
          mb: 3,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.45)', textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' },
          '& .Mui-selected': { color: '#fff !important' },
          '& .MuiTabs-indicator': { height: 3, borderRadius: 2 },
        }}
        TabIndicatorProps={{ style: { background: tab === 0 ? '#10b981' : '#6366f1' } }}
      >
        <Tab icon={<Send sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Beneficiary Transfer" />
        <Tab
          icon={<SwapHoriz sx={{ fontSize: '1.1rem' }} />}
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Self Transfer
              {!hasMultipleAccounts && !accountsLoading && (
                <Tooltip title="Requires at least 2 active accounts">
                  <Info sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }} />
                </Tooltip>
              )}
            </Box>
          }
          disabled={!hasMultipleAccounts && !accountsLoading}
        />
      </Tabs>

      {/* ── Tab 0: Beneficiary Transfer ── */}
      {tab === 0 && (
        <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, pb: 2, borderBottom: '2px solid rgba(16,185,129,0.25)' }}>
              <Box sx={{ width: 8, height: 24, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '4px', mr: 1.5 }} />
              <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 700, fontSize: '1.05rem' }}>
                Transfer to Beneficiary
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              {/* Bank Account */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Bank Account</Typography>
                <FormControl fullWidth sx={fieldSx}>
                  <Select name="fromAccountId" value={formData.fromAccountId} onChange={handleChange} displayEmpty sx={{ color: '#fff' }}>
                    <MenuItem value="" disabled sx={{ color: 'rgba(0,0,0,0.4)' }}>Select your bank account</MenuItem>
                    {accounts.map((acc) => (
                      <MenuItem key={acc._id} value={acc._id} sx={{ color: '#000' }}>
                        {acc.accountType.toUpperCase()} — {acc.accountNumber}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {(() => {
                  const sel = accounts.find((a) => a._id === formData.fromAccountId);
                  if (!sel) return null;
                  return (
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', mt: 0.5, ml: 0.5 }}>
                      Balance: {formatCurrency(sel.balance)}
                    </Typography>
                  );
                })()}
              </Grid>

              {/* Receiver Account Number */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Receiver Account Number</Typography>
                <TextField
                  placeholder="Enter receiver account number"
                  name="receiverAccountNumber"
                  value={formData.receiverAccountNumber}
                  onChange={handleChange}
                  fullWidth
                  error={!!error && !accountVerified && !!formData.receiverAccountNumber}
                  helperText={lookupLoading ? 'Checking account...' : accountVerified ? 'Account verified' : ''}
                  InputProps={{
                    startAdornment: <AccountBalance sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: '1.2rem' }} />,
                    endAdornment: lookupLoading ? <CircularProgress size={18} /> : accountVerified ? <CheckCircle sx={{ color: '#22c55e' }} /> : null,
                  }}
                  sx={fieldSx}
                />
              </Grid>

              {/* Receiver Name */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Receiver Name</Typography>
                <TextField
                  placeholder="Enter receiver full name"
                  name="receiverName"
                  value={getDisplayName(formData.receiverName, '')}
                  fullWidth
                  InputProps={{ readOnly: true, startAdornment: <Person sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: '1.2rem' }} /> }}
                  sx={fieldSx}
                />
              </Grid>

              {/* Receiver Nickname */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Receiver Nickname</Typography>
                <TextField
                  placeholder="Enter beneficiary nickname"
                  name="receiverNickname"
                  value={formData.receiverNickname}
                  onChange={handleChange}
                  fullWidth
                  inputProps={{ list: 'saved-beneficiary-nicknames' }}
                  InputProps={{ startAdornment: <Person sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: '1.2rem' }} /> }}
                  sx={fieldSx}
                />
                <datalist id="saved-beneficiary-nicknames">
                  {savedBeneficiaries.map((beneficiary) => (
                    <option key={beneficiary._id} value={beneficiary.nickname} />
                  ))}
                </datalist>
              </Grid>

              {/* Receiver Customer ID */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Receiver Customer ID</Typography>
                <TextField
                  placeholder="Enter receiver customer ID"
                  name="receiverCustomerId"
                  value={formData.receiverCustomerId}
                  fullWidth
                  InputProps={{ readOnly: true, startAdornment: <AccountCircle sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: '1.2rem' }} /> }}
                  sx={fieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Account Type</Typography>
                <TextField value={formData.receiverAccountType ? `${formData.receiverAccountType.charAt(0).toUpperCase()}${formData.receiverAccountType.slice(1)}` : ''} fullWidth InputProps={{ readOnly: true }} sx={fieldSx} />
              </Grid>

              {/* Amount */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Amount</Typography>
                <TextField
                  placeholder="Enter amount"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange}
                  fullWidth
                  InputProps={{
                    startAdornment: <CurrencyRupee sx={{ color: 'rgba(255,255,255,0.4)', mr: 0.5, fontSize: '1.1rem' }} />,
                    endAdornment: <Typography sx={{ color: 'rgba(255,255,255,0.6)', ml: 1, fontWeight: 600 }}>INR</Typography>,
                  }}
                  sx={fieldSx}
                />
              </Grid>

              {/* Category */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Category</Typography>
                <FormControl fullWidth sx={fieldSx}>
                  <Select name="category" value={formData.category} onChange={handleChange}>
                    {['transfer', 'food', 'shopping', 'utilities', 'travel', 'entertainment', 'investment', 'other'].map((cat) => (
                      <MenuItem key={cat} value={cat} sx={{ color: '#000', textTransform: 'capitalize' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Submit */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  disabled={loading || lookupLoading || !accountVerified}
                  onClick={handleBeneficiarySubmit}
                  fullWidth
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
                  sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1.5, fontSize: '1rem',
                    '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                    '&:disabled': { opacity: 0.6 },
                  }}
                >
                  {loading ? 'Processing...' : 'Send Funds'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 1: Self Transfer ── */}
      {tab === 1 && (
        <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, pb: 2, borderBottom: '2px solid rgba(99,102,241,0.25)' }}>
              <Box sx={{ width: 8, height: 24, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '4px', mr: 1.5 }} />
              <Typography variant="h6" sx={{ color: '#818cf8', fontWeight: 700, fontSize: '1.05rem' }}>
                Self Transfer — Between Your Accounts
              </Typography>
            </Box>

            {/* Balance Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {activeAccounts.map((acc) => {
                const color = accountTypeColors[acc.accountType] || '#f59e0b';
                return (
                  <Grid item xs={12} sm={6} key={acc._id}>
                    <Box sx={{ p: 2, borderRadius: '12px', background: `${color}10`, border: `1px solid ${color}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>{acc.accountType} Account</Typography>
                        <Typography sx={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, mt: 0.3 }}>{formatCurrency(acc.balance)}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', fontFamily: 'monospace' }}>{acc.accountNumber}</Typography>
                      </Box>
                      <AccountBalance sx={{ color, fontSize: '2rem', opacity: 0.7 }} />
                    </Box>
                  </Grid>
                );
              })}
            </Grid>

            {selfError && (
              <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                {selfError}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              {/* From Account */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>From Account</Typography>
                <FormControl fullWidth sx={{ ...fieldSx, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#6366f1' } }}>
                  <Select name="fromAccountId" value={selfForm.fromAccountId} onChange={handleSelfChange} displayEmpty sx={{ color: '#fff' }}>
                    <MenuItem value="" disabled sx={{ color: 'rgba(0,0,0,0.4)' }}>Select source account</MenuItem>
                    {activeAccounts.map((acc) => (
                      <MenuItem key={acc._id} value={acc._id} disabled={acc._id === selfForm.toAccountId} sx={{ color: '#000' }}>
                        {acc.accountType.toUpperCase()} — {acc.accountNumber} ({formatCurrency(acc.balance)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selfForm.fromAccountId && (() => {
                  const acc = activeAccounts.find((a) => a._id === selfForm.fromAccountId);
                  return acc ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', mt: 0.5, ml: 0.5 }}>
                      Available: {formatCurrency(acc.balance)}
                    </Typography>
                  ) : null;
                })()}
              </Grid>

              {/* To Account */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>To Account</Typography>
                <FormControl fullWidth sx={{ ...fieldSx, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#6366f1' } }}>
                  <Select name="toAccountId" value={selfForm.toAccountId} onChange={handleSelfChange} displayEmpty sx={{ color: '#fff' }}>
                    <MenuItem value="" disabled sx={{ color: 'rgba(0,0,0,0.4)' }}>Select destination account</MenuItem>
                    {activeAccounts.map((acc) => (
                      <MenuItem key={acc._id} value={acc._id} disabled={acc._id === selfForm.fromAccountId} sx={{ color: '#000' }}>
                        {acc.accountType.toUpperCase()} — {acc.accountNumber} ({formatCurrency(acc.balance)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Amount */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Transfer Amount</Typography>
                <TextField
                  placeholder="Enter amount"
                  name="amount"
                  type="number"
                  value={selfForm.amount}
                  onChange={handleSelfChange}
                  fullWidth
                  InputProps={{
                    startAdornment: <CurrencyRupee sx={{ color: 'rgba(255,255,255,0.4)', mr: 0.5, fontSize: '1.1rem' }} />,
                    endAdornment: <Typography sx={{ color: 'rgba(255,255,255,0.6)', ml: 1, fontWeight: 600 }}>INR</Typography>,
                  }}
                  sx={{ ...fieldSx, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#6366f1' } }}
                />
              </Grid>

              {/* Remarks */}
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.8 }}>Remarks (Optional)</Typography>
                <TextField
                  placeholder="Add a note for this transfer"
                  name="remarks"
                  value={selfForm.remarks}
                  onChange={handleSelfChange}
                  fullWidth
                  sx={{ ...fieldSx, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#6366f1' } }}
                />
              </Grid>

              {/* Submit */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  disabled={selfLoading}
                  onClick={handleSelfSubmit}
                  fullWidth
                  startIcon={selfLoading ? <CircularProgress size={20} color="inherit" /> : <SwapHoriz />}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1.5, fontSize: '1rem',
                    '&:hover': { background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' },
                    '&:disabled': { opacity: 0.6 },
                  }}
                >
                  {selfLoading ? 'Processing...' : 'Transfer Between Accounts'}
                </Button>
              </Grid>
            </Grid>

            {/* Info banner */}
            <Box sx={{ mt: 2.5, p: 1.5, borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Info sx={{ color: '#818cf8', fontSize: '1rem', mt: 0.1 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                Self transfers are instant and recorded in your transaction history with a unique reference number. No transfer limits apply.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Disabled Self Transfer Notice */}
      {tab === 0 && !hasMultipleAccounts && !accountsLoading && (
        <Box sx={{ mt: 2, p: 2, borderRadius: '12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SwapHoriz sx={{ color: '#818cf8', fontSize: '1.4rem' }} />
          <Box>
            <Typography sx={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>Self Transfer Unavailable</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
              You need at least 2 active accounts to use Self Transfer.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Success Dialogs */}
      <Dialog
        open={!!overdraftConfirmation}
        onClose={() => setOverdraftConfirmation(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', borderRadius: '14px' } }}
      >
        <DialogTitle sx={{ color: '#b45309', fontWeight: 800 }}>Confirm Overdraft Usage</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your account has insufficient cash balance. {formatCurrency(overdraftConfirmation?.amount || 0)} will be deducted from your overdraft. Are you sure you want to use overdraft?
          </Alert>
          <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>
            Cash used first: {formatCurrency(overdraftConfirmation?.cashAmount || 0)}
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>
            Overdraft used: {formatCurrency(overdraftConfirmation?.amount || 0)}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOverdraftConfirmation(null)} disabled={loading} sx={{ color: '#475569' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={async () => {
              setOverdraftConfirmation(null);
              await executeBeneficiaryTransfer(true);
            }}
            sx={{ bgcolor: '#d97706', '&:hover': { bgcolor: '#b45309' } }}
          >
            {loading ? 'Processing...' : 'Use Overdraft & Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
      <BenSuccessDialog open={!!successData} onClose={() => setSuccessData(null)} data={successData} />
      <SelfSuccessDialog open={!!selfSuccess} onClose={() => setSelfSuccess(null)} data={selfSuccess} />
    </Box>
  );
};

export default TransferFundsPage;
