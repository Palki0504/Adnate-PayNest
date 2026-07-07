import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Button, TextField,
  MenuItem, Tabs, Tab, CircularProgress, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, Paper, InputAdornment, IconButton
} from '@mui/material';
import {
  Search, FilterList, RateReview, Done, Close, Help, Refresh,
  AccountBalance, MonetizationOn, PriorityHigh, History, Warning,
  CalendarMonth, Visibility, VerifiedUser, Assessment
} from '@mui/icons-material';
import { loanAPI } from '../../services/api';
import LoanRequestsPanel from './LoanRequestsPanel';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

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

const selectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#fff',
        color: '#0f172a',
        '& .MuiMenuItem-root': { color: '#0f172a' },
        '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#fef3c7' },
      },
    },
  },
};

const LoanManagement = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Queue Data
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Monitoring Data
  const [monitoringStats, setMonitoringStats] = useState(null);

  // Dialog states
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approve', 'reject', 'info'
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loanAPI.getManagerRequests({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        loanType: typeFilter || undefined
      });
      setRequests(res.data.loans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch loan requests.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitoring = async () => {
    setLoading(true);
    setError('');
    try {
      const [monitoringResponse, loansResponse] = await Promise.all([
        loanAPI.getMonitoringStats(),
        loanAPI.getManagerRequests({ limit: 100 }),
      ]);
      setMonitoringStats(monitoringResponse.data.monitoring || null);
      setRequests(loansResponse.data.loans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch monitoring details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 0) {
      fetchQueue();
    } else {
      fetchMonitoring();
    }
  }, [activeTab, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    const refreshLoans = () => {
      if (activeTab === 0) {
        fetchQueue();
      } else {
        fetchMonitoring();
      }
    };
    window.addEventListener('focus', refreshLoans);
    window.addEventListener('paynest:data-changed', refreshLoans);
    return () => {
      window.removeEventListener('focus', refreshLoans);
      window.removeEventListener('paynest:data-changed', refreshLoans);
    };
  }, [activeTab, searchQuery, statusFilter, typeFilter]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
  };

  const openActionDialog = (loan, type) => {
    setSelectedLoan(loan);
    setActionType(type);
    setNote('');
    setReason('');
    setApprovedAmount(loan.amount);
    setDialogOpen(true);
  };

  const openLoanDetails = (loan) => {
    setSelectedLoan(loan);
    setActionType('view');
    setDialogOpen(true);
  };

  const getMonitoringStatus = (loan) => {
    if (loan.status === 'Closed') return 'Closed';
    if ((loan.missedEMICount || 0) >= 2) return 'Delinquent';
    if ((loan.missedEMICount || 0) > 0) return 'Missed';
    return 'Active';
  };

  const monitoringStatusSx = (status) => {
    const styles = {
      Active: { bgcolor: '#dcfce7', color: '#15803d', border: '#86efac' },
      Closed: { bgcolor: '#e2e8f0', color: '#475569', border: '#cbd5e1' },
      Missed: { bgcolor: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
      Delinquent: { bgcolor: '#991b1b', color: '#fff', border: '#7f1d1d' },
    };
    const value = styles[status] || styles.Active;
    return { bgcolor: value.bgcolor, color: value.color, border: `1px solid ${value.border}`, fontWeight: 800, borderRadius: '8px' };
  };

  const daysUntil = (value) => {
    if (!value) return '-';
    return Math.max(0, Math.ceil((new Date(value).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000));
  };

  // Review status trigger
  const handleReview = async (loanId) => {
    setLoading(true);
    try {
      await loanAPI.reviewLoan(loanId, { note: 'Reviewing application documents.' });
      setSuccess('Loan marked as Under Review.');
      fetchQueue();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status to Under Review.');
    } finally {
      setLoading(false);
    }
  };

  // Approval/Rejection/Info processes
  const handleDialogSubmit = async () => {
    if (!selectedLoan) return;
    setDialogOpen(false);
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (actionType === 'approve') {
        const res = await loanAPI.approveLoan(selectedLoan._id, {
          approvedAmount: Number(approvedAmount),
          note
        });
        setSuccess(res.data.message || 'Loan application approved and disbursed!');
      } else if (actionType === 'reject') {
        const res = await loanAPI.rejectLoan(selectedLoan._id, { reason });
        setSuccess(res.data.message || 'Loan application rejected.');
      } else if (actionType === 'info') {
        const res = await loanAPI.requestInfo(selectedLoan._id, { message: note });
        setSuccess(res.data.message || 'Additional information requested from customer.');
      }
      fetchQueue();
    } catch (err) {
      setError(err.response?.data?.message || 'Processing action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ color: '#fff', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 800 }}>Loan Management Queue</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
            Review pending requests, verify eligibility, disburse funds, and monitor outstanding loans.
          </Typography>
        </Box>
        <Button
          startIcon={<Refresh />}
          onClick={activeTab === 0 ? fetchQueue : fetchMonitoring}
          variant="outlined"
        sx={{ color: '#bfdbfe', borderColor: 'rgba(191,219,254,0.45)', borderRadius: '12px', fontWeight: 800, '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(37,99,235,.14)' } }}
        >
          Refresh Queue
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{
        bgcolor: '#fff',
        color: '#0f172a',
        border: '1px solid #dbe3ef',
        borderRadius: '20px',
        boxShadow: '0 18px 46px rgba(15,23,42,.14)',
        overflow: 'hidden',
        mb: 3,
        p: { xs: 1, md: 1.5 },
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          textColor="inherit"
          variant="standard"
          sx={{
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#fff',
            '& .MuiTabs-indicator': { bgcolor: '#2563eb', height: 3 },
            '& .MuiTab-root': { color: '#475569', py: 2, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.3px' },
            '& .MuiTab-root.Mui-selected': { color: '#1d4ed8' },
          }}
        >
          <Tab icon={<History sx={{ mr: 1 }} />} iconPosition="start" label="Loan Requests" />
          <Tab icon={<AccountBalance sx={{ mr: 1 }} />} iconPosition="start" label="Loan Monitoring" />
        </Tabs>

        {/* Tab 0: Loan Requests */}
        {activeTab === 0 && <LoanRequestsPanel />}
        {false && (
          <Box sx={{ p: 3 }}>
            {/* Filter controls */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                label="Search Loan No / Customer ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. LN1718"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'rgba(255,255,255,0.3)' }} />
                    </InputAdornment>
                  )
                }}
                sx={{ ...whiteFieldSx, minWidth: 240 }}
              />
              <TextField
                select
                size="small"
                label="Status Filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                SelectProps={selectProps}
                sx={{ ...whiteFieldSx, minWidth: 160 }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="Submitted">Submitted</MenuItem>
                <MenuItem value="Under Review">Under Review</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
                <MenuItem value="Disbursed">Disbursed</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Loan Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                SelectProps={selectProps}
                sx={{ ...whiteFieldSx, minWidth: 160 }}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="personal">Personal Loan</MenuItem>
                <MenuItem value="home">Home Loan</MenuItem>
                <MenuItem value="vehicle">Vehicle Loan</MenuItem>
                <MenuItem value="education">Education Loan</MenuItem>
              </TextField>
            </Box>

            {loading ? (
              <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
                <CircularProgress sx={{ color: '#f59e0b' }} />
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
                      {['Customer', 'Classification', 'Loan Info', 'Finance', 'Eligibility Score', 'Status', 'Actions'].map((h) => (
                        <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.45)', py: 1.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((r) => {
                      const custName = r.userId?.name || 'Customer';
                      const custId = r.customerId || '-';
                      const score = r.eligibilityScore || 0;
                      const isSubmitted = r.status === 'Submitted';
                      const isUnderReview = r.status === 'Under Review';

                      return (
                        <TableRow key={r._id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2 } }}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>{custName}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>ID: {custId}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={r.customerClassification} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.loanNumber}</Typography>
                            <Typography sx={{ textTransform: 'capitalize', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{r.loanType} - {r.tenure} Months</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>{formatCurrency(r.amount)}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Income: {formatCurrency(r.monthlyIncome)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                size="small"
                                label={`${score}/100`}
                                color={score >= 50 ? 'success' : 'error'}
                                sx={{ fontWeight: 700 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={r.status} color={r.status === 'Disbursed' ? 'success' : 'default'} sx={{ fontWeight: 700 }} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {isSubmitted && (
                              <Button
                                size="small"
                                startIcon={<RateReview />}
                                onClick={() => handleReview(r._id)}
                                sx={{ mr: 1, color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
                              >
                                Review
                              </Button>
                            )}
                            {(isSubmitted || isUnderReview) && (
                              <>
                                <Button
                                  size="small"
                                  startIcon={<Done />}
                                  onClick={() => openActionDialog(r, 'approve')}
                                  sx={{ mr: 1, color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  startIcon={<Close />}
                                  onClick={() => openActionDialog(r, 'reject')}
                                  sx={{ mr: 1, color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="small"
                                  startIcon={<Help />}
                                  onClick={() => openActionDialog(r, 'info')}
                                  sx={{ color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
                                >
                                  Request Info
                                </Button>
                              </>
                            )}
                            {!isSubmitted && !isUnderReview && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Processed</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'rgba(255,255,255,0.35)' }}>
                          No applications found matching search criteria.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Tab 1: Loan Monitoring */}
        {activeTab === 1 && monitoringStats && (
          <Box sx={{ p: { xs: 1.5, md: 2.5 }, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
            <Paper sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', bgcolor: '#0B1F4D', color: '#fff', border: '1px solid rgba(147,197,253,.22)', borderRadius: '20px', boxShadow: '0 22px 52px rgba(2,12,36,.3)', overflow: 'hidden' }}>
              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                {[
                  { label: 'Active Loans', value: monitoringStats.activeLoans, subtitle: 'Total active loans', color: '#2563eb', bg: '#dbeafe', icon: <AccountBalance /> },
                  { label: 'Total Outstanding Amount', value: formatCurrency(monitoringStats.totalOutstanding), subtitle: 'Total outstanding amount', color: '#16a34a', bg: '#dcfce7', icon: <MonetizationOn /> },
                  { label: 'Missed EMIs', value: monitoringStats.missedEMICount, subtitle: 'Missed EMI payments', color: '#ea580c', bg: '#ffedd5', icon: <Warning /> },
                  { label: 'Delinquent Accounts', value: monitoringStats.delinquentLoans?.length || 0, subtitle: 'Accounts requiring attention', color: '#dc2626', bg: '#fee2e2', icon: <PriorityHigh /> },
                ].map((card) => (
                  <Grid item xs={12} sm={6} xl={3} key={card.label} sx={{ minWidth: 0 }}>
                    <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)', height: '100%', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 16px 34px rgba(2,12,36,.18)' } }}>
                      <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 54, height: 54, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: card.bg, color: card.color, boxShadow: `0 7px 18px ${card.color}22`, '& svg': { fontSize: 28 } }}>{card.icon}</Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#475569', fontSize: '.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.03em' }}>{card.label}</Typography>
                          <Typography sx={{ color: card.color, fontSize: { xs: '1.45rem', md: '1.65rem' }, fontWeight: 900, lineHeight: 1.2, mt: .35 }}>{card.value}</Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '.76rem', mt: .45 }}>{card.subtitle}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12} lg={8} sx={{ minWidth: 0 }}>
                  <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)', height: '100%', overflow: 'hidden' }}>
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
                        <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: '#dbeafe', color: '#2563eb' }}><CalendarMonth /></Box>
                        <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.05rem' }}>Upcoming EMI Deductions (Next 7 Days)</Typography>
                      </Box>
                      <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 720 }}>
                      <TableHead><TableRow sx={{ bgcolor: '#eff6ff' }}>
                            {['Customer Name', 'Loan Number', 'EMI Amount', 'Due Date', 'Days Left', 'Status'].map((heading) => <TableCell key={heading} sx={{ color: '#0B1F4D', fontWeight: 900, borderColor: '#dbeafe', whiteSpace: 'nowrap' }}>{heading}</TableCell>)}
                          </TableRow></TableHead>
                          <TableBody>
                            {monitoringStats.upcomingEMIs?.map((emi, index) => (
                              <TableRow key={emi._id} sx={{ bgcolor: index % 2 ? '#f8fafc' : '#fff', '& td': { color: '#334155', borderColor: '#e2e8f0' } }}>
                                <TableCell sx={{ fontWeight: 700 }}>{emi.userId?.name || 'Customer'}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{emi.loanId?.loanNumber}</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>{formatCurrency(emi.emiAmount)}</TableCell>
                                <TableCell>{formatDate(emi.dueDate)}</TableCell>
                                <TableCell>{daysUntil(emi.dueDate)} days</TableCell>
                                <TableCell><Chip size="small" label="Upcoming" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 800 }} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {(!monitoringStats.upcomingEMIs || monitoringStats.upcomingEMIs.length === 0) && (
                        <Box sx={{ py: 4.5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                          <Box sx={{ position: 'relative', width: 68, height: 68, display: 'grid', placeItems: 'center', borderRadius: '18px', bgcolor: '#eff6ff', color: '#60a5fa', mb: 1.5 }}><CalendarMonth sx={{ fontSize: 38 }} /><Done sx={{ position: 'absolute', right: -3, bottom: -3, bgcolor: '#2563eb', color: '#fff', borderRadius: '50%', p: .35, fontSize: 24 }} /></Box>
                          <Typography sx={{ color: '#334155', fontWeight: 900 }}>No upcoming EMIs.</Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '.85rem', mt: .35 }}>All good! No EMI is due in the next 7 days.</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={4} sx={{ minWidth: 0 }}>
                  <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)', height: '100%' }}>
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
                        <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: '#fee2e2', color: '#dc2626' }}><PriorityHigh /></Box>
                        <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.05rem' }}>Missed / Outstanding Failures</Typography>
                      </Box>
                      {[
                        ['Total Missed EMIs', monitoringStats.missedEMICount || 0, '#dc2626'],
                        ['Total Outstanding Amount', formatCurrency(monitoringStats.totalOutstanding), '#2563eb'],
                        ['Accounts at Risk', monitoringStats.delinquentLoans?.length || 0, '#ea580c'],
                      ].map(([label, value, color]) => (
                        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 2, borderBottom: '1px solid #e2e8f0', '&:last-child': { borderBottom: 0 } }}>
                          <Typography sx={{ color: '#334155', fontWeight: 700, fontSize: '.88rem' }}>{label}</Typography>
                          <Typography sx={{ color, fontWeight: 900, fontSize: '1.08rem', textAlign: 'right' }}>{value}</Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)', overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
                    <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: '#dbeafe', color: '#2563eb' }}><Assessment /></Box>
                    <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: '1.08rem' }}>Loan Overview</Typography>
                  </Box>
                  <TableContainer sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 1320, tableLayout: 'fixed' }}>
                      <TableHead><TableRow sx={{ bgcolor: '#eff6ff' }}>
                        {['Customer Name', 'Customer Email', 'Loan Number', 'Loan Type', 'Loan Amount', 'Outstanding Balance', 'Interest Rate', 'Next EMI Due Date', 'Status', 'Action'].map((heading) => (
                          <TableCell key={heading} sx={{ color: '#0B1F4D', fontWeight: 900, borderColor: '#dbeafe', whiteSpace: 'nowrap', px: 1.4, width: heading === 'Action' ? 130 : undefined }}>{heading}</TableCell>
                        ))}
                      </TableRow></TableHead>
                      <TableBody>
                        {requests.filter((loan) => ['Approved', 'Disbursed', 'Closed'].includes(loan.status)).map((loan, index) => {
                          const status = getMonitoringStatus(loan);
                          return (
                            <TableRow key={loan._id} sx={{ bgcolor: index % 2 ? '#f8fafc' : '#fff', '& td': { color: '#334155', borderColor: '#e2e8f0', px: 1.4, py: 1.35, overflow: 'hidden' }, '&:hover': { bgcolor: '#eff6ff' } }}>
                              <TableCell><Typography noWrap sx={{ fontWeight: 800 }}>{loan.userId?.name || 'Customer'}</Typography></TableCell>
                              <TableCell><Typography noWrap sx={{ fontSize: '.78rem' }}>{loan.userId?.email || '-'}</Typography></TableCell>
                              <TableCell><Typography noWrap sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{loan.loanNumber}</Typography></TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{loan.loanType} Loan</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(loan.approvedAmount || loan.amount)}</TableCell>
                              <TableCell sx={{ color: '#2563eb !important', fontWeight: 900 }}>{formatCurrency(loan.outstandingBalance)}</TableCell>
                              <TableCell>{loan.interestRate}% p.a.</TableCell>
                              <TableCell>{formatDate(loan.nextEMIDueDate)}</TableCell>
                              <TableCell><Chip size="small" label={status} sx={monitoringStatusSx(status)} /></TableCell>
                              <TableCell sx={{ width: 130 }}>
                                <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => openLoanDetails(loan)} sx={{ color: '#0B1F4D', borderColor: '#cbd5e1', borderRadius: '9px', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(15,23,42,.08)', '&:hover': { bgcolor: '#0B1F4D', color: '#fff', borderColor: '#0B1F4D', transform: 'translateY(-1px)' } }}>View Details</Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {requests.filter((loan) => ['Approved', 'Disbursed', 'Closed'].includes(loan.status)).length === 0 && (
                          <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5, color: '#64748b' }}>No active or closed loans are available.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .8, color: 'rgba(255,255,255,.78)', mt: 2.5 }}>
                <VerifiedUser sx={{ fontSize: 19, color: '#bfdbfe' }} />
                <Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>All loan data is updated in real time.</Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </Paper>

      {/* Dialog for approve, reject, info actions */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0c1030', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', width: 440 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {actionType === 'approve' && 'Approve Loan Application'}
          {actionType === 'reject' && 'Reject Loan Application'}
          {actionType === 'info' && 'Request Clarification / Info'}
          {actionType === 'view' && 'Loan Monitoring Details'}
        </DialogTitle>
        <DialogContent>
          {selectedLoan && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '0.8rem' }}>
              <Typography sx={{ fontWeight: 700 }}>Applicant: {selectedLoan.userId?.name}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Requested Amount: {formatCurrency(selectedLoan.amount)}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Eligibility score: {selectedLoan.eligibilityScore} / 100</Typography>
            </Box>
          )}

          {actionType === 'approve' && (
            <>
              <TextField
                fullWidth
                type="number"
                label="Sanctioned Amount (₹)"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                sx={{ ...whiteFieldSx, mb: 2.5 }}
                required
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Manager Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Disbursement details or special conditions..."
                sx={whiteFieldSx}
              />
            </>
          )}

          {actionType === 'reject' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Rejection Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this application rejected? Required."
              sx={whiteFieldSx}
              required
            />
          )}

          {actionType === 'info' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Specific Question / Clarification Requested"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain what documents or income details you need the customer to submit..."
              sx={whiteFieldSx}
              required
            />
          )}

          {actionType === 'view' && selectedLoan && (
            <Grid container spacing={1.5}>
              {[
                ['Loan Number', selectedLoan.loanNumber],
                ['Loan Type', `${selectedLoan.loanType} Loan`],
                ['Approved Amount', formatCurrency(selectedLoan.approvedAmount || selectedLoan.amount)],
                ['Outstanding Balance', formatCurrency(selectedLoan.outstandingBalance)],
                ['Interest Rate', `${selectedLoan.interestRate}% p.a.`],
                ['Monthly EMI', formatCurrency(selectedLoan.monthlyEMI)],
                ['Next EMI Due', formatDate(selectedLoan.nextEMIDueDate)],
                ['Status', getMonitoringStatus(selectedLoan)],
              ].map(([label, value]) => (
                <Grid item xs={12} sm={6} key={label}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '9px' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,.48)', fontSize: '.7rem' }}>{label}</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 700, mt: .35, textTransform: label === 'Loan Type' ? 'capitalize' : 'none' }}>{value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#fff' }}>Cancel</Button>
          {actionType !== 'view' && (
            <Button
              onClick={handleDialogSubmit}
              variant="contained"
              disabled={
                (actionType === 'reject' && !reason) ||
                (actionType === 'info' && !note) ||
                (actionType === 'approve' && !approvedAmount)
              }
              sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 800, borderRadius: '10px' }}
            >
              Submit Action
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanManagement;
