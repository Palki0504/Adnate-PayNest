import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, TextField, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Alert, CircularProgress, IconButton,
  MenuItem, Select, FormControl, InputLabel, Avatar,
} from '@mui/material';
import {
  Add, Edit, Delete, Person, Check, Close, CheckCircle, Send,
} from '@mui/icons-material';
import { accountAPI, transactionAPI } from '../../services/api';
import { getDisplayName } from '../../utils/textFormat';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n || 0);

const BeneficiaryForm = ({ open, onClose, onSubmit, initialData = null, loading = false }) => {
  const [formData, setFormData] = useState({
    nickname: '',
    accountNumber: '',
    customerId: '',
    beneficiaryName: '',
    accountType: '',
    relationship: 'other',
    notes: '',
  });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [accountVerified, setAccountVerified] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        nickname: '',
        accountNumber: '',
        customerId: '',
        beneficiaryName: '',
        accountType: '',
        relationship: 'other',
        notes: '',
      });
    }
    setLookupError('');
    setAccountVerified(Boolean(initialData?.accountNumber));
  }, [initialData, open]);

  useEffect(() => {
    if (!open || initialData || !formData.accountNumber.trim()) return undefined;
    setAccountVerified(false);
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      setLookupError('');
      try {
        const response = await accountAPI.lookupAccountNumber(formData.accountNumber.trim());
        const details = response.data.account;
        setFormData((prev) => ({
          ...prev,
          accountNumber: details.accountNumber,
          customerId: details.customerId,
          beneficiaryName: details.customerName,
          accountType: details.accountType,
        }));
        setAccountVerified(true);
      } catch (error) {
        setFormData((prev) => ({ ...prev, customerId: '', beneficiaryName: '', accountType: '' }));
        setLookupError(error.response?.data?.message || 'Invalid account number or customer ID. No customer found.');
      } finally {
        setLookupLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.accountNumber, initialData, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.nickname || !formData.accountNumber || !accountVerified) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit(formData);
  };

  const inputSx = {
    '--mui-field-label-bg': '#FFFFFF',
    '& .MuiOutlinedInput-root': {
      color: '#111827',
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      minHeight: 56,
      overflow: 'visible',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputBase-input': {
      color: '#111827',
      WebkitTextFillColor: '#111827',
      lineHeight: 1.45,
    },
    '& .MuiInputBase-input::placeholder': {
      color: 'rgba(17,24,39,0.55)',
      opacity: 1,
    },
    '& .MuiInputLabel-root': {
      color: '#111827',
      backgroundColor: '#FFFFFF',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#111827' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
    '& .MuiFormHelperText-root': { color: '#ef4444' },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
      <DialogTitle sx={{ color: '#111827', pb: 1.5, borderBottom: '1px solid #E5E7EB', fontWeight: 700, backgroundColor: '#FFFFFF' }}>
        {initialData ? 'Edit Beneficiary' : 'Add New Beneficiary'}
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 3, pb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Nickname *"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              fullWidth
              sx={inputSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Account Number or Customer ID *"
              name="accountNumber"
              value={formData.accountNumber || ''}
              onChange={handleChange}
              fullWidth
              disabled={Boolean(initialData)}
              placeholder="Enter recipient account number or customer ID"
              error={!!lookupError}
              helperText={lookupError || (accountVerified ? 'Account verified' : 'Customer details will be filled automatically')}
              InputProps={{ endAdornment: lookupLoading ? <CircularProgress size={18} /> : accountVerified ? <CheckCircle sx={{ color: '#16a34a' }} /> : null }}
              sx={inputSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Customer Name"
              name="beneficiaryName"
              value={formData.beneficiaryName}
              fullWidth
              InputProps={{ readOnly: true }}
              sx={inputSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Customer ID" value={formData.customerId || ''} fullWidth InputProps={{ readOnly: true }} sx={inputSx} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Account Type" value={formData.accountType ? `${formData.accountType.charAt(0).toUpperCase()}${formData.accountType.slice(1)}` : ''} fullWidth InputProps={{ readOnly: true }} sx={inputSx} />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth sx={{
              '--mui-field-label-bg': '#FFFFFF',
              '& .MuiInputLabel-root': {
                color: '#111827',
                backgroundColor: '#FFFFFF',
                px: 0.75,
                zIndex: 2,
                overflow: 'visible',
              },
              '& .MuiInputLabel-root.Mui-focused': { color: '#111827' },
              '& .MuiInputLabel-root.MuiInputLabel-shrink': {
                transform: 'translate(14px, -9px) scale(0.75)',
              },
            }}>
              <InputLabel>Relationship</InputLabel>
              <Select
                name="relationship"
                value={formData.relationship}
                onChange={handleChange}
                label="Relationship"
                sx={{
                  color: '#111827',
                  borderRadius: '8px',
                  bgcolor: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D1D5DB' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9CA3AF' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f59e0b' },
                  '& .MuiSvgIcon-root': { color: '#6B7280' },
                }}
              >
                <MenuItem value="self">Self</MenuItem>
                <MenuItem value="family">Family</MenuItem>
                <MenuItem value="friend">Friend</MenuItem>
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional notes about this beneficiary"
              sx={inputSx}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#FFFFFF', pt: 2, pb: 3, px: 3, gap: 1, borderTop: '1px solid #E5E7EB' }}>
        <Button onClick={onClose} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || lookupLoading || (!initialData && !accountVerified)}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '8px',
          }}
        >
          {loading ? <CircularProgress size={20} /> : initialData ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const TransferDialog = ({ open, onClose, beneficiary, onSubmit, loading = false, userAccounts = [] }) => {
  const [formData, setFormData] = useState({
    fromAccountId: '',
    amount: '',
    description: '',
    category: 'transfer',
  });
  const [validationError, setValidationError] = useState('');
  const [limitsWarning, setLimitsWarning] = useState('');

  useEffect(() => {
    if (open) {
      setFormData({
        fromAccountId: userAccounts[0]?._id || '',
        amount: '',
        description: '',
        category: 'transfer',
      });
      setValidationError('');
      setLimitsWarning('');
    }
  }, [open, userAccounts]);

  const selectedAccount = userAccounts.find(acc => acc._id === formData.fromAccountId);

  useEffect(() => {
    if (!selectedAccount || !formData.amount) {
      setValidationError('');
      setLimitsWarning('');
      return;
    }

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setValidationError('Amount must be greater than 0');
      return;
    }

    setValidationError('');

    const limits = selectedAccount.limits || {};
    // Daily limit check
    if (limits.dailyTransferLimit) {
      const dailyRemaining = limits.dailyTransferLimit - (limits.dailyTransferUsed || 0);
      if (amt > dailyRemaining) {
        setValidationError(`Amount exceeds remaining daily transfer limit of ?${dailyRemaining.toLocaleString('en-IN')} (Limit: ?${limits.dailyTransferLimit.toLocaleString('en-IN')}).`);
        return;
      }
    }

    // Monthly limit check
    if (limits.monthlyTransferLimit) {
      const monthlyRemaining = limits.monthlyTransferLimit - (selectedAccount.monthlyTransferTotal || 0);
      if (amt > monthlyRemaining) {
        setValidationError(`Amount exceeds remaining monthly transfer limit of ?${monthlyRemaining.toLocaleString('en-IN')} (Limit: ?${limits.monthlyTransferLimit.toLocaleString('en-IN')}).`);
        return;
      }
    }

    // Overdraft balance check
    const totalAvailable = selectedAccount.balance + (selectedAccount.overdraftLimit - selectedAccount.overdraftUsed);
    if (amt > selectedAccount.balance) {
      if (amt > totalAvailable) {
        setValidationError(`Insufficient funds. Max available with overdraft: ?${totalAvailable.toLocaleString('en-IN')}`);
        return;
      } else {
        const odNeeded = amt - selectedAccount.balance;
        setLimitsWarning(`This transfer will use ?${odNeeded.toLocaleString('en-IN')} of your overdraft. Remaining OD: ?${(selectedAccount.overdraftLimit - selectedAccount.overdraftUsed - odNeeded).toLocaleString('en-IN')}`);
        return;
      }
    }

    setLimitsWarning('');
  }, [formData.amount, formData.fromAccountId, selectedAccount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.fromAccountId || !formData.amount) {
      alert('Please select a source account and enter an amount.');
      return;
    }
    if (validationError) {
      alert('Please resolve validation errors before submitting.');
      return;
    }
    onSubmit(formData);
  };

  const inputSx = {
    '--mui-field-label-bg': '#FFFFFF',
    '& .MuiOutlinedInput-root': {
      color: '#111827',
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      minHeight: 56,
      overflow: 'visible',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#10b981' },
    },
    '& .MuiInputBase-input': {
      color: '#111827',
      WebkitTextFillColor: '#111827',
      lineHeight: 1.45,
    },
    '& .MuiInputBase-input::placeholder': {
      color: 'rgba(17,24,39,0.55)',
      opacity: 1,
    },
    '& .MuiInputLabel-root': {
      color: '#111827',
      backgroundColor: '#FFFFFF',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#111827' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
  };

  if (!beneficiary) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
        Transfer Funds to {beneficiary.nickname}
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 3, pb: 3 }}>
        <Box sx={{ mb: 2.5, p: 2, mt: 1, background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <Typography sx={{ color: '#6B7280', fontSize: '0.78rem', mb: 0.5 }}>Recipient Information</Typography>
          <Typography sx={{ color: '#111827', fontWeight: 700, fontSize: '1rem' }}>{getDisplayName(beneficiary.beneficiaryName, '')}</Typography>
          <Typography sx={{ color: '#4B5563', fontSize: '0.85rem' }}>Customer ID: {beneficiary.customerId}</Typography>
          {beneficiary.accountNumber && (
            <Typography sx={{ color: '#4B5563', fontSize: '0.85rem' }}>
              Account: {beneficiary.accountNumber} ({beneficiary.accountType || 'Account'})
            </Typography>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth sx={{
              '& .MuiInputLabel-root': { color: '#6B7280' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#10b981' },
            }}>
              <InputLabel>From Account</InputLabel>
              <Select
                name="fromAccountId"
                value={formData.fromAccountId}
                onChange={handleChange}
                label="From Account"
                sx={{
                  color: '#111827',
                  borderRadius: '8px',
                  bgcolor: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D1D5DB' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9CA3AF' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' },
                  '& .MuiSvgIcon-root': { color: '#6B7280' },
                }}
              >
                {userAccounts.map((acc) => (
                  <MenuItem key={acc._id} value={acc._id}>
                    {acc.accountTypeLabel || acc.accountType} ({acc.accountNumber}) � Balance: ?{acc.balance?.toLocaleString('en-IN')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {selectedAccount && (
            <Grid item xs={12}>
              <Box sx={{ p: 2, background: '#F0FDF4', border: '1px dashed #A7F3D0', borderRadius: '10px' }}>
                <Typography sx={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 700, mb: 1 }}>Account Type Limits:</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography sx={{ color: '#4B5563', fontSize: '0.72rem' }}>Daily Limit:</Typography>
                    <Typography sx={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>?{selectedAccount.limits?.dailyTransferLimit?.toLocaleString('en-IN')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography sx={{ color: '#4B5563', fontSize: '0.72rem' }}>Monthly Limit:</Typography>
                    <Typography sx={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>?{selectedAccount.limits?.monthlyTransferLimit?.toLocaleString('en-IN')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography sx={{ color: '#4B5563', fontSize: '0.72rem' }}>Overdraft Limit:</Typography>
                    <Typography sx={{ color: '#111827', fontSize: '0.8rem', fontWeight: 600 }}>?{selectedAccount.overdraftLimit?.toLocaleString('en-IN')}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              label="Amount (?) *"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              fullWidth
              placeholder="Enter transfer amount"
              InputProps={{ sx: { color: '#111827' } }}
              sx={inputSx}
            />
          </Grid>

          {validationError && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ borderRadius: '10px' }}>
                {validationError}
              </Alert>
            </Grid>
          )}

          {limitsWarning && (
            <Grid item xs={12}>
              <Alert severity="warning" sx={{ borderRadius: '10px' }}>
                {limitsWarning}
              </Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControl fullWidth sx={{
              '& .MuiInputLabel-root': { color: '#6B7280' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#10b981' },
            }}>
              <InputLabel>Category</InputLabel>
              <Select
                name="category"
                value={formData.category}
                onChange={handleChange}
                label="Category"
                sx={{
                  color: '#111827',
                  borderRadius: '8px',
                  bgcolor: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D1D5DB' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9CA3AF' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' },
                  '& .MuiSvgIcon-root': { color: '#6B7280' },
                }}
              >
                <MenuItem value="transfer">Transfer</MenuItem>
                <MenuItem value="food">Food/Dining</MenuItem>
                <MenuItem value="shopping">Shopping</MenuItem>
                <MenuItem value="utilities">Utilities</MenuItem>
                <MenuItem value="travel">Travel</MenuItem>
                <MenuItem value="entertainment">Entertainment</MenuItem>
                <MenuItem value="investment">Investment</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Description / Note"
              name="description"
              value={formData.description}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Rent, Gift, Monthly expense"
              InputProps={{ sx: { color: '#111827' } }}
              sx={inputSx}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#FFFFFF', pt: 2, pb: 3, px: 3, gap: 1, borderTop: '1px solid #E5E7EB' }}>
        <Button onClick={onClose} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !!validationError}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '8px',
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Send Funds'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SuccessDialog = ({ open, onClose, data }) => {
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
      <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 4, pb: 4, textAlign: 'center' }}>
        <CheckCircle sx={{ fontSize: '5rem', color: '#10b981', mb: 2 }} />
        <Typography sx={{ color: '#111827', fontSize: '1.4rem', fontWeight: 800, mb: 1 }}>
          Transfer Successful!
        </Typography>
        <Typography sx={{ color: '#4B5563', fontSize: '0.85rem', mb: 3 }}>
          Funds have been sent to {data.beneficiaryNickname} ({getDisplayName(data.beneficiaryName, '')})
        </Typography>

        <Box sx={{ p: 2.5, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', mb: 3, textAlign: 'left' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ color: '#6B7280', fontSize: '0.78rem' }}>Amount Sent:</Typography>
            <Typography sx={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 700 }}>?{data.amount.toLocaleString('en-IN')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ color: '#6B7280', fontSize: '0.78rem' }}>Transaction ID:</Typography>
            <Typography sx={{ color: '#111827', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 600 }}>{data.transactionId}</Typography>
          </Box>
          {data.fromAccountBalance !== undefined && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#6B7280', fontSize: '0.78rem' }}>Updated Balance:</Typography>
              <Typography sx={{ color: '#111827', fontSize: '0.85rem', fontWeight: 600 }}>?{data.fromAccountBalance.toLocaleString('en-IN')}</Typography>
            </Box>
          )}
        </Box>

        <Button
          onClick={onClose}
          variant="contained"
          fullWidth
          sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            py: 1.2,
          }}
        >
          Back to Beneficiaries
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const BeneficiariesPage = () => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const { page, setPage, paginatedRecords: paginatedBeneficiaries } = useTablePagination(beneficiaries, [beneficiaries.length]);
  const [userAccounts, setUserAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);

  // Transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferBeneficiary, setTransferBeneficiary] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    loadBeneficiaries();
    loadUserAccounts();
  }, []);

  const loadUserAccounts = async () => {
    try {
      const res = await accountAPI.getAll();
      setUserAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Failed to load user accounts', err);
    }
  };

  const loadBeneficiaries = async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      if (!silent) setError('');
      const res = await accountAPI.getBeneficiaries();
      setBeneficiaries(res.data.beneficiaries || []);
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingBeneficiary(null);
    setDialogOpen(true);
  };

  const handleEditClick = (ben) => {
    setEditingBeneficiary(ben);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError('');

      if (editingBeneficiary) {
        await accountAPI.updateBeneficiary(editingBeneficiary._id, formData);
        setSuccess('Beneficiary updated successfully');
      } else {
        await accountAPI.addBeneficiary(formData);
        setSuccess('Beneficiary added successfully');
      }

      setDialogOpen(false);
      await loadBeneficiaries();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save beneficiary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferClick = (ben) => {
    setTransferBeneficiary(ben);
    setTransferDialogOpen(true);
  };

  const handleTransferSubmit = async (transferData) => {
    try {
      setTransferLoading(true);
      setError('');
      
      const payload = {
        fromAccountId: transferData.fromAccountId,
        beneficiaryId: transferBeneficiary._id,
        amount: parseFloat(transferData.amount),
        description: transferData.description,
        category: transferData.category,
      };

      const res = await transactionAPI.transferToBeneficiary(payload);
      if (res.data?.success !== true) {
        throw new Error(res.data?.message || 'Transfer failed. Please check limits and balance.');
      }
      
      setTransferDialogOpen(false);
      setSuccessData({
        transactionId: res.data.transactionId || res.data.transaction?.reference || 'N/A',
        amount: payload.amount,
        beneficiaryNickname: transferBeneficiary.nickname,
        beneficiaryName: transferBeneficiary.beneficiaryName,
        fromAccountBalance: res.data.fromAccountBalance,
      });
      setSuccessDialogOpen(true);
      
      // Refresh accounts and beneficiaries
      Promise.allSettled([loadUserAccounts(), loadBeneficiaries({ silent: true })]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Transfer failed. Please check limits and balance.');
      setTransferDialogOpen(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this beneficiary?')) {
      try {
        setError('');
        await accountAPI.deleteBeneficiary(id);
        setSuccess('Beneficiary deleted successfully');
        await loadBeneficiaries();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete beneficiary');
      }
    }
  };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>
        My Beneficiaries
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 3 }}>
        Manage accounts for quick transfers
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, bgcolor: 'rgba(34,197,94,0.1)', color: '#86efac' }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddClick}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#0a0e27',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
          }}
        >
          Add Beneficiary
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#f59e0b' }} />
        </Box>
      ) : beneficiaries.length === 0 ? (
        <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.95rem' }}>
              No beneficiaries yet. Add one to get started with quick transfers.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Nickname</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Name</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Account</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Relationship</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedBeneficiaries.map((ben) => (
                  <TableRow key={ben._id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, background: '#f59e0b', color: '#0a0e27', fontSize: '0.9rem', fontWeight: 700 }}>
                          {ben.nickname.charAt(0).toUpperCase()}
                        </Avatar>
                        {ben.nickname}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{getDisplayName(ben.beneficiaryName, '')}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {ben.accountNumber || ben.customerId}
                      </Typography>
                      {ben.accountType && (
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                          {ben.accountType}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      <Chip
                        label={ben.relationship}
                        size="small"
                        sx={{ textTransform: 'capitalize', bgcolor: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      <Chip
                        label={ben.isVerified ? 'Verified' : 'Unverified'}
                        icon={ben.isVerified ? <Check sx={{ fontSize: '0.8rem !important' }} /> : <Close sx={{ fontSize: '0.8rem !important' }} />}
                        size="small"
                        sx={{
                          bgcolor: ben.isVerified ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: ben.isVerified ? '#22c55e' : '#ef4444',
                          border: ben.isVerified ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleTransferClick(ben)}
                          sx={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: '6px',
                            px: 1.5,
                            mr: 1,
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            }
                          }}
                        >
                          Transfer
                        </Button>
                        <IconButton size="small" onClick={() => handleEditClick(ben)} sx={{ color: '#f59e0b' }}>
                          <Edit sx={{ fontSize: '1rem' }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(ben._id)} sx={{ color: '#ef4444' }}>
                          <Delete sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationControls page={page} totalRecords={beneficiaries.length} onPageChange={setPage} />
        </Card>
      )}

      <BeneficiaryForm
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingBeneficiary}
        loading={submitting}
      />

      <TransferDialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        beneficiary={transferBeneficiary}
        onSubmit={handleTransferSubmit}
        loading={transferLoading}
        userAccounts={userAccounts}
      />

      <SuccessDialog
        open={successDialogOpen}
        onClose={() => setSuccessDialogOpen(false)}
        data={successData}
      />
    </Box>
  );
};

export default BeneficiariesPage;
