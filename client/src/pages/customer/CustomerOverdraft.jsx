import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AccountBalance, Payments, Refresh, TrendingDown, Wallet } from '@mui/icons-material';
import { overdraftAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatDate = (date) => date
  ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '-';

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const accountTypeLabel = (type) => ({
  savings: 'Savings',
  current: 'Current',
  salary: 'Salary',
}[type] || type || '-');

const receiverAccountTypes = ['savings', 'current', 'salary'];
const looksLikeAccountNumber = (value) => /^(SAV|CUR|SAL)[A-Z0-9]+$/i.test(String(value || '').trim());
const looksLikeCustomerId = (value) => /^CUSTID[A-Z0-9]+$/i.test(String(value || '').trim());

const whiteFieldSx = {
  bgcolor: '#fff',
  borderRadius: '8px',
  '& .MuiOutlinedInput-root': {
    color: '#0f172a',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': { borderColor: '#2563eb' },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    color: '#0f172a',
    WebkitTextFillColor: '#0f172a',
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#64748b',
    opacity: 1,
  },
  '& .MuiInputLabel-root': { color: '#475569' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
  '& .MuiSelect-icon': { color: '#475569' },
};

const receiverFieldSx = {
  ...whiteFieldSx,
  width: '100%',
  minWidth: 0,
  '& .MuiOutlinedInput-root': {
    ...whiteFieldSx['& .MuiOutlinedInput-root'],
    height: 44,
    borderRadius: '8px',
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    ...whiteFieldSx['& .MuiInputBase-input, & .MuiSelect-select'],
    boxSizing: 'border-box',
    height: 44,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
  },
};

const accountSelectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#fff',
        color: '#0f172a',
        '& .MuiMenuItem-root': { color: '#0f172a' },
        '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#dbeafe' },
      },
    },
  },
};

const CustomerOverdraft = () => {
  const currentMonth = getMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState({ accounts: [], liveAccounts: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [useAccountId, setUseAccountId] = useState('');
  const [repayAccountId, setRepayAccountId] = useState('');
  const [useAmount, setUseAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [useError, setUseError] = useState('');
  const [repayError, setRepayError] = useState('');
  const [usingOverdraft, setUsingOverdraft] = useState(false);
  const [repayingOverdraft, setRepayingOverdraft] = useState(false);
  const [message, setMessage] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverCustomerId, setReceiverCustomerId] = useState('');
  const [receiverAccountType, setReceiverAccountType] = useState('');
  const [receiverAccountNumber, setReceiverAccountNumber] = useState('');
  const [receiverAccounts, setReceiverAccounts] = useState([]);
  const [receiverVerified, setReceiverVerified] = useState(false);
  const [receiverLookupMode, setReceiverLookupMode] = useState('');
  const [verifyingReceiver, setVerifyingReceiver] = useState(false);
  const [receiverLookupError, setReceiverLookupError] = useState('');

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await overdraftAPI.getMyDetails({ month: selectedMonth });
      setData({
        accounts: response.data.accounts || [],
        liveAccounts: response.data.liveAccounts || response.data.accounts || [],
        summary: response.data.summary || {},
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load overdraft accounts.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    const lookupValue = receiverLookupMode === 'customerId' ? receiverCustomerId.trim() : receiverAccountNumber.trim();
    if (!receiverLookupMode || lookupValue.length < 5) return undefined;

    const timer = setTimeout(async () => {
      setVerifyingReceiver(true);
      setReceiverLookupError('');
      try {
        const params = looksLikeAccountNumber(lookupValue)
          ? { accountNumber: lookupValue }
          : looksLikeCustomerId(lookupValue)
            ? { customerId: lookupValue }
            : receiverLookupMode === 'customerId'
              ? { customerId: lookupValue }
              : { accountNumber: lookupValue };
        const response = await overdraftAPI.resolveReceiver(params);
        const receiver = response.data.receiver;
        const options = receiver.accounts || [];
        setReceiverName(receiver.name || '');
        setReceiverCustomerId(receiver.customerId || '');
        setReceiverAccounts(options);
        const matchingAccount = receiver.selectedAccount
          || options.find((option) => option.accountType === receiverAccountType)
          || (options.length === 1 ? options[0] : null);
        if (matchingAccount) {
          setReceiverAccountType(matchingAccount.accountType);
          setReceiverAccountNumber(matchingAccount.accountNumber);
          setReceiverVerified(true);
        } else {
          setReceiverAccountType('');
          setReceiverAccountNumber('');
          setReceiverVerified(false);
        }
        setReceiverLookupMode('');
      } catch (requestError) {
        setReceiverName('');
        setReceiverAccounts([]);
        setReceiverVerified(false);
        const apiMessage = requestError.response?.data?.message || '';
        const routeUnavailable = apiMessage.includes('Route GET /api/overdrafts/receiver');
        setReceiverLookupError(routeUnavailable
          ? 'Receiver lookup is unavailable. Restart the backend server and try again.'
          : apiMessage || 'Unable to verify receiver details.');
      } finally {
        setVerifyingReceiver(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [receiverLookupMode, receiverCustomerId, receiverAccountNumber]);

  const accounts = useMemo(
    () => data.accounts.map((account) => ({
      ...account,
      monthlyUsageCount: Number(account.monthlyUsageCount) || 0,
      penaltyAmount: Number(account.penaltyAmount) || 0,
      dailyPenaltyAmount: Number(account.dailyPenaltyAmount) || 0,
      totalAmountDue: Number(account.totalAmountDue) || 0,
      availableOD: Math.max(0, Number(account.overdraftLimit || 0) - Number(account.overdraftUsed || 0)),
      overdraftStatus: Number(account.monthlyUsageCount || 0) >= 3 ? 'DEACTIVATED' : 'ACTIVE',
    })),
    [data.accounts]
  );

  const liveAccounts = useMemo(
    () => data.liveAccounts.map((account) => ({
      ...account,
      monthlyUsageCount: Number(account.monthlyUsageCount) || 0,
      availableOD: Math.max(0, Number(account.overdraftLimit || 0) - Number(account.overdraftUsed || 0)),
      totalAmountDue: Number(account.totalAmountDue) || 0,
      overdraftStatus: Number(account.monthlyUsageCount || 0) >= 3 ? 'DEACTIVATED' : 'ACTIVE',
    })),
    [data.liveAccounts]
  );

  const {
    page: accountsPage,
    setPage: setAccountsPage,
    paginatedRecords: paginatedAccounts,
  } = useTablePagination(accounts, [selectedMonth, accounts.length]);

  const selectedUseAccount = liveAccounts.find((account) => account._id === useAccountId);
  const selectedRepayAccount = liveAccounts.find((account) => account._id === repayAccountId);

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    return {
      value: getMonthKey(date),
      label: index === 0 ? 'Current Month' : index === 1 ? 'Last Month' : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }), []);

  const handleUseOverdraft = async () => {
    if (!selectedUseAccount) {
      setUseError('Select an account before using overdraft.');
      return;
    }
    const parsedAmount = Number(useAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setUseError('Enter a valid amount greater than 0.');
      return;
    }
    if (parsedAmount > selectedUseAccount.availableOD) {
      setUseError(`Amount exceeds the available overdraft of ${formatCurrency(selectedUseAccount.availableOD)}.`);
      return;
    }
    if (!receiverVerified || !receiverName || !receiverCustomerId || !receiverAccountType || !receiverAccountNumber) {
      setUseError('Enter and verify the receiver details before using overdraft.');
      return;
    }
    setUsingOverdraft(true);
    setUseError('');
    try {
      const response = await overdraftAPI.use({
        accountId: selectedUseAccount._id,
        amount: parsedAmount,
        receiverName,
        receiverCustomerId,
        receiverAccountType,
        receiverAccountNumber,
      });
      setMessage(response.data.message || 'Overdraft used successfully.');
      setUseAmount('');
      setReceiverName('');
      setReceiverCustomerId('');
      setReceiverAccountType('');
      setReceiverAccountNumber('');
      setReceiverAccounts([]);
      setReceiverVerified(false);
      setReceiverLookupMode('');
      await fetchDetails();
      window.dispatchEvent(new CustomEvent('paynest:data-changed', { detail: { source: 'overdraft-transfer' } }));
    } catch (requestError) {
      setUseError(requestError.response?.data?.message || 'Unable to use overdraft.');
    } finally {
      setUsingOverdraft(false);
    }
  };

  const handleRepayOverdraft = async () => {
    if (!selectedRepayAccount) {
      setRepayError('Select an account before repaying overdraft.');
      return;
    }
    const parsedAmount = Number(repayAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRepayError('Enter a valid amount greater than 0.');
      return;
    }
    setRepayingOverdraft(true);
    setRepayError('');
    try {
      const response = await overdraftAPI.repay({ accountId: selectedRepayAccount._id, amount: parsedAmount });
      setMessage(response.data.message || 'Overdraft repaid successfully.');
      setRepayAmount('');
      await fetchDetails();
    } catch (requestError) {
      setRepayError(requestError.response?.data?.message || 'Unable to repay overdraft.');
    } finally {
      setRepayingOverdraft(false);
    }
  };

  const summaryCards = [
    { label: 'Total OD Limit', value: data.summary.totalOverdraftLimit, color: '#60a5fa', icon: <AccountBalance /> },
    { label: 'Used OD Amount', value: data.summary.totalOverdraftUsed, color: '#f87171', icon: <TrendingDown /> },
    { label: 'Available OD', value: data.summary.totalAvailableOverdraft, color: '#4ade80', icon: <Wallet /> },
    { label: 'Current Penalty', value: data.summary.totalPenaltyAmount, color: '#fb923c', icon: <TrendingDown /> },
    { label: 'Total Due', value: data.summary.totalAmountDue, color: '#fbbf24', icon: <Payments /> },
    { label: 'Active OD Accounts', value: data.summary.activeAccounts || 0, color: '#a78bfa', icon: <AccountBalance />, count: true },
  ];

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 420 }}><CircularProgress sx={{ color: '#f59e0b' }} /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 800 }}>Overdraft Accounts</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
            Each account type has its own limit, usage counter, available overdraft, and status.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={fetchDetails} variant="outlined" sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.5)' }}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 3 }}>{message}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={2} key={card.label}>
            <Card sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{card.label}</Typography>
                  <Typography sx={{ color: card.color, fontSize: '1.45rem', fontWeight: 800 }}>
                    {card.count ? card.value : formatCurrency(card.value)}
                  </Typography>
                </Box>
                <Box sx={{ color: card.color }}>{card.icon}</Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: '20px', mb: 2.5, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ height: 'auto', bgcolor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ color: '#93c5fd', fontSize: '1.15rem', fontWeight: 800, mb: 0.5 }}>Use Overdraft</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', mb: 1.5 }}>
                Select the exact account whose overdraft facility should be used.
              </Typography>
              {useError && <Alert severity="error" sx={{ mb: 2 }}>{useError}</Alert>}
              <TextField
                select
                fullWidth
                label="Account Type / Account Number"
                value={useAccountId}
                onChange={(event) => { setUseAccountId(event.target.value); setUseError(''); }}
                SelectProps={accountSelectProps}
                sx={{ ...whiteFieldSx, mb: 1.5 }}
              >
                {liveAccounts.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {accountTypeLabel(account.accountType)} - {account.accountNumber}
                  </MenuItem>
                ))}
              </TextField>
              {selectedUseAccount && (
                <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.8rem' }}>Available OD: {formatCurrency(selectedUseAccount.availableOD)}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
                    Monthly usage: {selectedUseAccount.monthlyUsageCount}/3 | Status: {selectedUseAccount.overdraftStatus === 'ACTIVE' ? 'Active' : 'Deactivated'}
                  </Typography>
                </Box>
              )}
              <TextField
                fullWidth
                type="number"
                label="OD Amount"
                value={useAmount}
                onChange={(event) => { setUseAmount(event.target.value); setUseError(''); }}
                inputProps={{ min: 1 }}
                placeholder="Enter overdraft amount"
                sx={{ ...whiteFieldSx, mb: 1.5 }}
              />
              <Box
                component="fieldset"
                sx={{
                  m: 0,
                  mb: 1.5,
                  p: 1.5,
                  borderRadius: '12px',
                  border: '1px solid rgba(96,165,250,0.35)',
                }}
              >
                <Typography component="legend" sx={{ color: '#60a5fa', px: 1, fontWeight: 800, fontSize: '0.9rem' }}>
                  Receiver Details
                </Typography>
                {receiverLookupError && <Alert severity="error" sx={{ mb: 1.5 }}>{receiverLookupError}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gridAutoRows: '44px', gap: 1.25, alignItems: 'stretch' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Receiver Name"
                    value={receiverName}
                    onChange={(event) => {
                      setReceiverName(event.target.value);
                      setUseError('');
                    }}
                    placeholder="Fetched from customer records"
                    sx={receiverFieldSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Receiver Customer ID"
                    value={receiverCustomerId}
                    onChange={(event) => {
                      setReceiverCustomerId(event.target.value.toUpperCase());
                      setReceiverLookupMode('customerId');
                      setReceiverName('');
                      setReceiverAccountType('');
                      setReceiverAccountNumber('');
                      setReceiverAccounts([]);
                      setReceiverVerified(false);
                      setReceiverLookupError('');
                      setUseError('');
                    }}
                    placeholder="Enter receiver customer ID"
                    sx={receiverFieldSx}
                  />
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Receiver Account Type"
                    value={receiverAccountType}
                    onChange={(event) => {
                      const selected = receiverAccounts.find((option) => option.accountType === event.target.value);
                      setReceiverAccountType(event.target.value);
                      setReceiverAccountNumber(selected?.accountNumber || '');
                      setReceiverVerified(Boolean(selected));
                      setReceiverLookupMode('');
                      setReceiverLookupError('');
                      setUseError('');
                    }}
                    SelectProps={accountSelectProps}
                    sx={receiverFieldSx}
                  >
                    {receiverAccountTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {accountTypeLabel(type)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    size="small"
                    label="Receiver Account Number"
                    value={receiverAccountNumber}
                    onChange={(event) => {
                      setReceiverAccountNumber(event.target.value.toUpperCase());
                      setReceiverLookupMode('accountNumber');
                      setReceiverName('');
                      setReceiverCustomerId('');
                      setReceiverAccountType('');
                      setReceiverAccounts([]);
                      setReceiverVerified(false);
                      setReceiverLookupError('');
                      setUseError('');
                    }}
                    placeholder="Enter receiver account number"
                    sx={receiverFieldSx}
                  />
                </Box>
              </Box>
              <Button
                fullWidth
                variant="contained"
                onClick={handleUseOverdraft}
                disabled={usingOverdraft || verifyingReceiver || !receiverVerified || !selectedUseAccount || selectedUseAccount.overdraftStatus !== 'ACTIVE' || selectedUseAccount.availableOD <= 0}
                sx={{ '&.Mui-disabled': { color: '#475569', bgcolor: '#cbd5e1' } }}
              >
                {usingOverdraft ? 'Processing...' : 'Use OD'}
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ height: 'auto', bgcolor: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ color: '#86efac', fontSize: '1.15rem', fontWeight: 800, mb: 0.5 }}>Repay Overdraft</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', mb: 1.5 }}>
                Select the account whose outstanding overdraft should be repaid.
              </Typography>
              {repayError && <Alert severity="error" sx={{ mb: 2 }}>{repayError}</Alert>}
              <TextField
                select
                fullWidth
                label="Account Type / Account Number"
                value={repayAccountId}
                onChange={(event) => { setRepayAccountId(event.target.value); setRepayError(''); }}
                SelectProps={accountSelectProps}
                sx={{ ...whiteFieldSx, mb: 1.5 }}
              >
                {liveAccounts.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {accountTypeLabel(account.accountType)} - {account.accountNumber}
                  </MenuItem>
                ))}
              </TextField>
              {selectedRepayAccount && (
                <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.8rem' }}>Outstanding OD: {formatCurrency(selectedRepayAccount.outstandingAmount)}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
                    Penalty per day: {formatCurrency(selectedRepayAccount.dailyPenaltyAmount)} | Due date: {formatDate(selectedRepayAccount.overdraftDueDate)}
                  </Typography>
                  <Typography sx={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 700 }}>
                    Current penalty: {formatCurrency(selectedRepayAccount.penaltyAmount)} | Total due: {formatCurrency(selectedRepayAccount.totalAmountDue)}
                  </Typography>
                </Box>
              )}
              <Alert severity="info" sx={{ mb: 1.5, py: 0.25, fontSize: '0.78rem' }}>
                Penalty is charged per day after the due date if overdraft remains unpaid.
              </Alert>
              <TextField
                fullWidth
                type="number"
                label="Repayment Amount"
                value={repayAmount}
                onChange={(event) => { setRepayAmount(event.target.value); setRepayError(''); }}
                inputProps={{ min: 1 }}
                placeholder="Enter repayment amount"
                sx={{ ...whiteFieldSx, mb: 1.5 }}
              />
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={handleRepayOverdraft}
                disabled={repayingOverdraft || !selectedRepayAccount || selectedRepayAccount.totalAmountDue <= 0}
                sx={{ '&.Mui-disabled': { color: '#475569', bgcolor: '#cbd5e1' } }}
              >
                {repayingOverdraft ? 'Processing...' : 'Repay Overdraft'}
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 1.5 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800 }}>Account-wise Overdraft Records</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>
            Showing {monthOptions.find((option) => option.value === selectedMonth)?.label || selectedMonth}
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Filter by Month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          SelectProps={accountSelectProps}
          sx={{ ...whiteFieldSx, minWidth: { xs: '100%', sm: 220 } }}
        >
          {monthOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
      </Box>

      <TableContainer sx={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1250 }}>
          <TableHead>
            <TableRow>
              {['Account Type', 'Account Number', 'Classification', 'OD Limit', 'Used OD Amount', 'Available OD', 'Monthly Usage', 'Outstanding Amount', 'Penalty Per Day', 'Due Date', 'Current Penalty', 'Total Due', 'Status'].map((heading) => (
                <TableCell key={heading} sx={{ bgcolor: '#121a35', color: '#fff', fontWeight: 800, whiteSpace: 'nowrap' }}>{heading}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedAccounts.map((account) => {
              const isActive = account.overdraftStatus === 'ACTIVE';
              return (
                <TableRow key={account._id} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.07)' } }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>{accountTypeLabel(account.accountType)}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace' }}>{account.accountNumber}</TableCell>
                  <TableCell><Chip size="small" label={account.classification || 'PENDING'} sx={{ color: '#fbbf24', bgcolor: 'rgba(251,191,36,0.12)', fontWeight: 700 }} /></TableCell>
                  <TableCell sx={{ color: '#93c5fd', fontWeight: 700 }}>{formatCurrency(account.overdraftLimit)}</TableCell>
                  <TableCell sx={{ color: account.overdraftUsed > 0 ? '#f87171' : 'rgba(255,255,255,0.65)', fontWeight: 700 }}>{formatCurrency(account.overdraftUsed)}</TableCell>
                  <TableCell sx={{ color: '#4ade80', fontWeight: 700 }}>{formatCurrency(account.availableOD)}</TableCell>
                  <TableCell sx={{ color: account.monthlyUsageCount >= 3 ? '#f87171' : '#fff', fontWeight: 800 }}>{account.monthlyUsageCount}/3</TableCell>
                  <TableCell sx={{ color: '#fca5a5', fontWeight: 700 }}>{formatCurrency(account.outstandingAmount)}</TableCell>
                  <TableCell sx={{ color: '#fdba74', fontWeight: 700 }}>{formatCurrency(account.dailyPenaltyAmount)}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>{formatDate(account.overdraftDueDate)}</TableCell>
                  <TableCell sx={{ color: account.penaltyAmount > 0 ? '#fb923c' : 'rgba(255,255,255,0.65)', fontWeight: 700 }}>{formatCurrency(account.penaltyAmount)}</TableCell>
                  <TableCell sx={{ color: '#fbbf24', fontWeight: 800 }}>{formatCurrency(account.totalAmountDue)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={isActive ? 'Active' : 'Deactivated'}
                      sx={{ color: isActive ? '#4ade80' : '#f87171', bgcolor: isActive ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', fontWeight: 800 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {accounts.length === 0 && (
              <TableRow><TableCell colSpan={13} align="center" sx={{ color: 'rgba(255,255,255,0.55)', py: 6 }}>No active accounts found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePaginationControls page={accountsPage} totalRecords={accounts.length} onPageChange={setAccountsPage} />
      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', mt: 1.5 }}>
        Penalty is charged per day after the due date if overdraft remains unpaid. The rate is based on each account owner's classification.
      </Typography>

    </Box>
  );
};

export default CustomerOverdraft;
