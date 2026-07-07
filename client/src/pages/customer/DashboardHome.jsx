import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Grid, Skeleton,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import {
  AccountBalance, AccountBalanceWallet, ArrowDownward, ArrowUpward,
  CreditScore, EventAvailable, NotificationsActive, Payments,
  ReceiptLong, Savings, TrendingUp, WarningAmber, VerifiedUser,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { customerDashboardAPI, loanAPI } from '../../services/api';
import { setNotifications } from '../../redux/slices/notificationSlice';
import { getDisplayName } from '../../utils/textFormat';

const navy = '#071b3a';
const ink = '#0f172a';
const muted = '#64748b';

const formatCurrency = (amount = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

const titleCase = (value = '') =>
  String(value).replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const getKycStatusUi = (status) => {
  if (status === 'Approved') return { label: '🟢 Approved', color: '#16a34a', bg: '#dcfce7', message: 'Your KYC is verified. Banking services are unlocked.' };
  if (status === 'Rejected') return { label: '🔴 Rejected', color: '#dc2626', bg: '#fee2e2', message: 'Your KYC was rejected. Please update your profile and resubmit.' };
  if (status === 'Pending') return { label: '🟡 Pending Verification', color: '#d97706', bg: '#fef3c7', message: 'Your KYC is submitted and awaiting manager approval.' };
  return { label: 'Not Started', color: '#d97706', bg: '#fef3c7', message: 'Complete your profile and submit KYC documents to unlock banking services.' };
};

const cardGradients = [
  'linear-gradient(135deg, #ffffff 0%, #eaf7ff 100%)',
  'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
  'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
  'linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)',
  'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
  'linear-gradient(135deg, #ffffff 0%, #ecfeff 100%)',
  'linear-gradient(135deg, #ffffff 0%, #fefce8 100%)',
];

const iconPalette = ['#0ea5e9', '#16a34a', '#f97316', '#6366f1', '#db2777', '#0891b2', '#ca8a04'];

const KpiCard = ({ title, value, subtitle, icon, index, loading }) => (
  <Card
    sx={{
      height: '100%',
      borderRadius: '18px',
      background: cardGradients[index % cardGradients.length],
      border: '1px solid rgba(226,232,240,0.9)',
      boxShadow: '0 18px 38px rgba(15,23,42,0.12)',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 22px 46px rgba(15,23,42,0.18)' },
    }}
  >
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography sx={{ color: muted, fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase' }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton height={42} width={140} />
          ) : (
            <Typography sx={{ color: ink, fontWeight: 800, fontSize: { xs: '1.45rem', md: '1.62rem' }, mt: 1 }}>
              {value}
            </Typography>
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${iconPalette[index % iconPalette.length]}18`, color: iconPalette[index % iconPalette.length], width: 46, height: 46 }}>
          {icon}
        </Avatar>
      </Box>
      <Typography sx={{ color: muted, fontSize: '0.82rem', mt: 1.4 }}>{subtitle}</Typography>
    </CardContent>
  </Card>
);

const SectionCard = ({ title, icon, children, action }) => (
  <Card sx={{ height: '100%', borderRadius: '18px', background: '#fff', boxShadow: '0 18px 40px rgba(2,8,23,0.14)', border: '1px solid rgba(226,232,240,0.9)' }}>
    <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.4, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(14,165,233,0.12)', color: '#0284c7' }}>{icon}</Avatar>
          <Typography sx={{ color: navy, fontWeight: 800, fontSize: '1.02rem' }}>{title}</Typography>
        </Box>
        {action}
      </Box>
      {children}
    </CardContent>
  </Card>
);

const DashboardHome = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await customerDashboardAPI.getMain();
      setDashboard(res.data);
      dispatch(setNotifications({
        notifications: res.data.notifications || [],
        unreadCount: res.data.unreadCount || 0,
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const customer = dashboard?.customer || {};
  const customerDisplayName = getDisplayName(customer.name || user?.name);
  const kpis = dashboard?.kpis || {};
  const emiReminder = dashboard?.emiReminder || {};
  const accounts = dashboard?.accounts || [];
  const transactions = dashboard?.transactions || [];
  const notifications = dashboard?.notifications || [];
  const investmentSummary = dashboard?.investmentSummary || {};
  const loanSummary = dashboard?.loanSummary || {};
  const kycUi = getKycStatusUi(user?.kycStatus);

  const kpiCards = useMemo(() => [
    { title: 'Cash Balance', value: formatCurrency(kpis.cashBalance), subtitle: 'Across active bank accounts', icon: <AccountBalance /> },
    { title: 'Overdraft Used', value: formatCurrency(kpis.overdraftUsed), subtitle: `Total OD limit ${formatCurrency(kpis.overdraftLimit)}`, icon: <CreditScore /> },
    { title: 'Available OD Limit', value: formatCurrency(kpis.availableODLimit), subtitle: 'Remaining overdraft facility', icon: <Payments /> },
    { title: 'Active Loans', value: Number(kpis.activeLoans || 0), subtitle: `${formatCurrency(loanSummary.outstandingBalance)} outstanding`, icon: <AccountBalanceWallet /> },
    { title: 'FD Investment', value: formatCurrency(kpis.fdInvestment), subtitle: `${investmentSummary.fdCount || 0} active fixed deposits`, icon: <Savings /> },
    { title: 'RD Investment', value: formatCurrency(kpis.rdInvestment), subtitle: `${investmentSummary.rdCount || 0} active recurring deposits`, icon: <TrendingUp /> },
    { title: 'Total Balance', value: formatCurrency(kpis.totalBalance), subtitle: 'Cash plus active FD/RD value', icon: <ReceiptLong /> },
  ], [kpis, investmentSummary, loanSummary]);

  const handlePayEMI = async () => {
    if (!emiReminder.loanId || !emiReminder.emiId) return;
    const accountId = emiReminder.accountId || accounts[0]?._id;
    if (!accountId) {
      setError('No linked account is available to pay this EMI.');
      return;
    }

    try {
      setPaying(true);
      setError('');
      setSuccess('');
      await loanAPI.payEMI(emiReminder.loanId, emiReminder.emiId, accountId);
      setSuccess('EMI payment completed successfully.');
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to pay EMI right now.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box
        sx={{
          p: { xs: 2.4, md: 3.2 },
          mb: 3,
          borderRadius: '22px',
          background: 'linear-gradient(135deg, #ffffff 0%, #dff4ff 55%, #f5fbff 100%)',
          boxShadow: '0 20px 44px rgba(2,8,23,0.16)',
          border: '1px solid rgba(255,255,255,0.8)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography sx={{ color: navy, fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 900 }}>
            Welcome back, {customerDisplayName}
          </Typography>
          <Typography sx={{ color: muted, mt: 0.7, fontWeight: 600 }}>
            Customer ID: {customer.customerId || user?.customerId || user?.id || '-'}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '12px' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2.5, borderRadius: '12px' }}>{success}</Alert>}

      <Card sx={{ mb: 3, borderRadius: '18px', bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 18px 38px rgba(15,23,42,0.12)' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: kycUi.bg, color: kycUi.color }}>
              <VerifiedUser />
            </Avatar>
            <Box>
              <Typography sx={{ color: navy, fontWeight: 900 }}>KYC Status</Typography>
              <Typography sx={{ color: muted, fontSize: '0.88rem' }}>{kycUi.message}</Typography>
            </Box>
          </Box>
          <Chip label={kycUi.label} sx={{ bgcolor: kycUi.bg, color: kycUi.color, fontWeight: 900 }} />
        </CardContent>
      </Card>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpiCards.map((card, index) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <KpiCard {...card} index={index} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={5}>
          <SectionCard title="EMI Reminder" icon={<EventAvailable fontSize="small" />}>
            {loading ? (
              <Skeleton height={128} sx={{ borderRadius: '14px' }} />
            ) : emiReminder.status === 'due' ? (
              <Box sx={{ p: 2.4, borderRadius: '16px', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa' }}>
                <Stack spacing={1.1}>
                  <Chip icon={<WarningAmber />} label="EMI due this month" sx={{ alignSelf: 'flex-start', bgcolor: '#f97316', color: '#fff', fontWeight: 800, '& .MuiChip-icon': { color: '#fff' } }} />
                  <Typography sx={{ color: navy, fontWeight: 800, fontSize: '1.15rem' }}>{emiReminder.loanNumber || 'Loan EMI'}</Typography>
                  <Typography sx={{ color: muted }}>{titleCase(emiReminder.loanType)} loan</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ color: ink, fontWeight: 800 }}>EMI: {formatCurrency(emiReminder.emiAmount)}</Typography>
                    <Typography sx={{ color: ink, fontWeight: 800 }}>Due: {formatDate(emiReminder.dueDate)}</Typography>
                  </Box>
                  <Button variant="contained" onClick={handlePayEMI} disabled={paying} sx={{ alignSelf: 'flex-start', mt: 0.8, bgcolor: '#1687ff', borderRadius: '12px', fontWeight: 800, px: 2.4, '&:hover': { bgcolor: '#0f6fd6' } }}>
                    {paying ? 'Paying...' : 'Pay EMI Now'}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 2.4, borderRadius: '16px', background: emiReminder.status === 'paid' ? '#ecfdf5' : '#eff6ff', border: `1px solid ${emiReminder.status === 'paid' ? '#bbf7d0' : '#bfdbfe'}` }}>
                <Chip label={emiReminder.status === 'paid' ? 'Paid' : 'No current due'} sx={{ mb: 1.5, bgcolor: emiReminder.status === 'paid' ? '#22c55e' : '#3b82f6', color: '#fff', fontWeight: 800 }} />
                <Typography sx={{ color: navy, fontWeight: 800, fontSize: '1.05rem' }}>
                  {emiReminder.message || 'No EMI is due for this month.'}
                </Typography>
              </Box>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <SectionCard title="Recent Transactions" icon={<ReceiptLong fontSize="small" />}>
            {loading ? (
              [...Array(5)].map((_, index) => <Skeleton key={index} height={48} sx={{ mb: 1, borderRadius: '10px' }} />)
            ) : transactions.length === 0 ? (
              <Typography sx={{ color: muted, textAlign: 'center', py: 4 }}>No recent transactions found.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Activity', 'Type', 'Amount', 'Date'].map((heading) => (
                        <TableCell key={heading} sx={{ color: navy, fontWeight: 900, borderColor: '#e2e8f0' }}>{heading}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((tx) => {
                      const isCredit = tx.type === 'credit';
                      const isDebit = tx.type === 'debit';
                      return (
                        <TableRow key={tx._id} hover>
                          <TableCell sx={{ color: ink, borderColor: '#eef2f7', maxWidth: 250 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }} noWrap>{tx.description || 'Transaction'}</Typography>
                            <Typography sx={{ color: muted, fontSize: '0.76rem' }} noWrap>{tx.reference || tx.metadata?.transactionType || '-'}</Typography>
                          </TableCell>
                          <TableCell sx={{ borderColor: '#eef2f7' }}>
                            <Chip
                              size="small"
                              label={titleCase(tx.type)}
                              sx={{
                                bgcolor: isCredit ? '#dcfce7' : isDebit ? '#fee2e2' : '#dbeafe',
                                color: isCredit ? '#166534' : isDebit ? '#991b1b' : '#1d4ed8',
                                fontWeight: 800,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderColor: '#eef2f7' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {isCredit ? <ArrowDownward sx={{ color: '#16a34a', fontSize: 18 }} /> : <ArrowUpward sx={{ color: isDebit ? '#dc2626' : '#2563eb', fontSize: 18 }} />}
                              <Typography sx={{ color: isCredit ? '#15803d' : isDebit ? '#dc2626' : '#2563eb', fontWeight: 900 }}>
                                {formatCurrency(tx.amount)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: muted, borderColor: '#eef2f7', fontWeight: 600 }}>{formatDate(tx.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <SectionCard title="Notifications" icon={<NotificationsActive fontSize="small" />}>
            {loading ? (
              [...Array(4)].map((_, index) => <Skeleton key={index} height={62} sx={{ mb: 1.2, borderRadius: '12px' }} />)
            ) : notifications.length === 0 ? (
              <Typography sx={{ color: muted, textAlign: 'center', py: 4 }}>No notifications yet.</Typography>
            ) : (
              <Stack spacing={1.4}>
                {notifications.map((item) => (
                  <Box key={item._id} sx={{ p: 1.6, borderRadius: '14px', bgcolor: item.isRead ? '#f8fafc' : '#eff6ff', border: `1px solid ${item.isRead ? '#e2e8f0' : '#bfdbfe'}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ color: navy, fontWeight: 800, fontSize: '0.88rem' }}>{item.title}</Typography>
                      <Chip size="small" label={titleCase(item.priority || item.type)} sx={{ bgcolor: item.priority === 'high' ? '#ffedd5' : '#dcfce7', color: item.priority === 'high' ? '#9a3412' : '#166534', fontWeight: 800 }} />
                    </Box>
                    <Typography sx={{ color: muted, fontSize: '0.8rem', lineHeight: 1.45 }}>{item.message}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SectionCard title="Investment Summary" icon={<Savings fontSize="small" />}>
            <Stack spacing={1.6}>
              {[
                ['Active FD Value', formatCurrency(investmentSummary.fdInvestment), `${investmentSummary.fdCount || 0} active FDs`],
                ['Active RD Value', formatCurrency(investmentSummary.rdInvestment), `${investmentSummary.rdCount || 0} active RDs`],
                ['Next FD Maturity', formatDate(investmentSummary.nextFDMaturity?.maturityDate), investmentSummary.nextFDMaturity?.fdId || '-'],
                ['Next RD Maturity', formatDate(investmentSummary.nextRDMaturity?.maturityDate), investmentSummary.nextRDMaturity?.rdId || '-'],
              ].map(([label, value, detail]) => (
                <Box key={label} sx={{ p: 1.7, borderRadius: '14px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ color: muted, fontSize: '0.78rem', fontWeight: 700 }}>{label}</Typography>
                  <Typography sx={{ color: navy, fontSize: '1.05rem', fontWeight: 900 }}>{loading ? <Skeleton width={120} /> : value}</Typography>
                  <Typography sx={{ color: muted, fontSize: '0.78rem' }}>{detail}</Typography>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SectionCard title="Loan & EMI Summary" icon={<AccountBalanceWallet fontSize="small" />}>
            <Stack spacing={1.6}>
              {[
                ['Active Loans', Number(kpis.activeLoans || 0), 'Approved or disbursed loans'],
                ['Monthly EMI', formatCurrency(loanSummary.monthlyEMI), 'Combined active loan EMI'],
                ['Outstanding Balance', formatCurrency(loanSummary.outstandingBalance), 'Remaining principal balance'],
                ['This Month EMI Status', `${loanSummary.paidThisMonth || 0} paid / ${loanSummary.pendingThisMonth || 0} pending`, 'Current month payment count'],
              ].map(([label, value, detail]) => (
                <Box key={label} sx={{ p: 1.7, borderRadius: '14px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ color: muted, fontSize: '0.78rem', fontWeight: 700 }}>{label}</Typography>
                  <Typography sx={{ color: navy, fontSize: '1.05rem', fontWeight: 900 }}>{loading ? <Skeleton width={120} /> : value}</Typography>
                  <Typography sx={{ color: muted, fontSize: '0.78rem' }}>{detail}</Typography>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHome;
