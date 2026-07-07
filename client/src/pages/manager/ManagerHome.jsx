import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  AccessTime,
  Apartment,
  Business,
  CalendarMonth,
  CheckCircle,
  DonutLarge,
  EventRepeat,
  Error,
  Groups,
  InfoOutlined,
  LocalAtm,
  Notifications,
  PendingActions,
  Person,
  Refresh,
  Savings,
  ShowChart,
  SwapHoriz,
  TrendingUp,
  Wallet,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { managerAPI } from '../../services/api';

const navy = '#061a3a';
const royalBlue = '#2563eb';
const textPrimary = '#071735';
const textMuted = '#64748b';

const numberFormat = new Intl.NumberFormat('en-IN');
const currencyFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatNumber = (value) => numberFormat.format(Number(value || 0));
const formatCurrency = (value) => currencyFormat.format(Number(value || 0));

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return 'Just now';
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const panelSx = {
  bgcolor: '#fff',
  border: '1px solid rgba(37,99,235,0.12)',
  borderRadius: '18px',
  boxShadow: '0 18px 45px rgba(2, 8, 23, 0.16)',
  overflow: 'hidden',
};

const classificationColors = ['#2563eb', '#22c55e', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

const notificationMeta = {
  approval: { icon: <CheckCircle />, color: '#16a34a', bg: '#dcfce7' },
  rejection: { icon: <Error />, color: '#dc2626', bg: '#fee2e2' },
  warning: { icon: <PendingActions />, color: '#d97706', bg: '#fef3c7' },
  info: { icon: <InfoOutlined />, color: '#0891b2', bg: '#cffafe' },
  low: { icon: <InfoOutlined />, color: '#0891b2', bg: '#cffafe' },
};

const TimeCard = ({ icon, label, value }) => (
  <Box
    sx={{
      bgcolor: '#fff',
      border: '1px solid rgba(37,99,235,0.24)',
      borderRadius: '14px',
      px: 1.5,
      py: 1,
      minWidth: { xs: '100%', sm: 150 },
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
      transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: royalBlue,
        boxShadow: '0 16px 34px rgba(37,99,235,0.18)',
      },
    }}
  >
    <Avatar sx={{ width: 32, height: 32, bgcolor: '#eff6ff', color: royalBlue }}>
      {React.cloneElement(icon, { fontSize: 'small' })}
    </Avatar>
    <Box>
      <Typography sx={{ color: textMuted, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ color: textPrimary, fontSize: '.82rem', fontWeight: 900, whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  </Box>
);

const ChartTooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const current = payload[0]?.payload || {};
  return (
    <Box sx={{ bgcolor: '#fff', color: textPrimary, border: '1px solid #dbeafe', borderRadius: '12px', p: 1.4, boxShadow: '0 14px 35px rgba(15,23,42,0.18)' }}>
      <Typography sx={{ fontSize: '.78rem', fontWeight: 900 }}>{label}</Typography>
      <Typography sx={{ color: royalBlue, fontSize: '.76rem', mt: .35 }}>{formatNumber(current.count)} transactions</Typography>
      <Typography sx={{ color: textMuted, fontSize: '.72rem' }}>{formatCurrency(current.amount || 0)}</Typography>
    </Box>
  );
};

const KpiCard = ({ title, value, icon, color, accent, loading, growth }) => {
  return (
    <Card
      sx={{
        ...panelSx,
        height: '100%',
        position: 'relative',
        transition: 'transform .22s ease, box-shadow .22s ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: `0 22px 52px ${accent}`,
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 5,
          background: `linear-gradient(180deg, ${color}, ${royalBlue})`,
        },
      }}
    >
      <CardContent sx={{ p: 1.65 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: textMuted, fontSize: '.76rem', fontWeight: 900, lineHeight: 1.2 }}>{title}</Typography>
            {loading ? (
              <Skeleton width={74} height={30} sx={{ mt: .35 }} />
            ) : (
              <Typography sx={{ color: textPrimary, fontSize: { xs: '1.42rem', lg: '1.55rem' }, fontWeight: 950, mt: .45, lineHeight: 1 }}>
                {formatNumber(value)}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ width: 40, height: 40, bgcolor: `${color}18`, color, border: `1px solid ${color}38` }}>
            {React.cloneElement(icon, { fontSize: 'small' })}
          </Avatar>
        </Box>
        {Number.isFinite(growth) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: .55, mt: .85 }}>
            <TrendingUp sx={{ fontSize: 14, color: growth >= 0 ? '#16a34a' : '#dc2626' }} />
            <Typography sx={{ color: growth >= 0 ? '#16a34a' : '#dc2626', fontSize: '.68rem', fontWeight: 900 }}>
              {`${growth >= 0 ? '+' : ''}${growth}% this month`}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const SectionCard = ({ title, icon, color, action, children, sx = {} }) => (
  <Card sx={{ ...panelSx, height: '100%', ...sx }}>
    <CardContent sx={{ p: { xs: 2, md: 2.35 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.2, mb: 1.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: `${color}16`, color }}>{React.cloneElement(icon, { fontSize: 'small' })}</Avatar>
          <Typography sx={{ color: textPrimary, fontWeight: 950, fontSize: '1rem' }}>{title}</Typography>
        </Box>
        {action}
      </Box>
      {children}
    </CardContent>
  </Card>
);

const ManagerHome = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      const res = await managerAPI.getDashboard();
      setDashboard(res.data?.data || {});
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load manager dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const refreshInterval = setInterval(() => fetchDashboard({ silent: true }), 15000);
    const handleFocus = () => fetchDashboard({ silent: true });
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const trendData = dashboard?.monthlyTransactions || [];
  const sparkData = trendData.length ? trendData : Array.from({ length: 12 }, (_, index) => ({ label: String(index + 1), count: 0, amount: 0 }));
  const classifications = dashboard?.classificationDistribution || [];
  const notifications = (dashboard?.notifications || []).slice(0, 5);
  const kpis = dashboard?.kpis || {};

  const transactionGrowth = useMemo(() => {
    if (trendData.length < 2) return null;
    const current = Number(trendData[trendData.length - 1]?.count || 0);
    const previous = Number(trendData[trendData.length - 2]?.count || 0);
    if (!previous) return current ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }, [trendData]);

  const totalClassifiedCustomers = useMemo(
    () => classifications.reduce((sum, item) => sum + Number(item.count || 0), 0),
    [classifications]
  );

  const kpiCards = [
    { title: 'Total Customers', value: kpis.totalCustomers, icon: <Groups />, color: '#2563eb', accent: 'rgba(37,99,235,.22)' },
    { title: 'Total Active Accounts', value: kpis.totalActiveAccounts, icon: <AccountBalance />, color: '#06b6d4', accent: 'rgba(6,182,212,.22)' },
    { title: 'Pending Approvals', value: kpis.pendingApprovals, icon: <PendingActions />, color: '#f59e0b', accent: 'rgba(245,158,11,.24)' },
    { title: 'Active Overdraft Accounts', value: kpis.activeOverdraftAccounts, icon: <Wallet />, color: '#ef4444', accent: 'rgba(239,68,68,.18)' },
    { title: 'Total Active Loan Accounts', value: kpis.totalActiveLoanAccounts, icon: <LocalAtm />, color: '#22c55e', accent: 'rgba(34,197,94,.2)' },
    { title: 'Total Active RD Accounts', value: kpis.totalActiveRDAccounts, icon: <EventRepeat />, color: '#8b5cf6', accent: 'rgba(139,92,246,.2)' },
    { title: 'Total Active FD Accounts', value: kpis.totalActiveFDAccounts, icon: <Savings />, color: '#14b8a6', accent: 'rgba(20,184,166,.2)' },
    { title: 'Total Transactions', value: kpis.totalTransactions, icon: <SwapHoriz />, color: '#0ea5e9', accent: 'rgba(14,165,233,.2)', growth: transactionGrowth },
    { title: 'Total Savings Accounts', value: kpis.totalSavingsAccounts, icon: <Savings />, color: '#16a34a', accent: 'rgba(22,163,74,.2)' },
    { title: 'Total Current Accounts', value: kpis.totalCurrentAccounts, icon: <Business />, color: '#f97316', accent: 'rgba(249,115,22,.2)' },
    { title: 'Total Salary Accounts', value: kpis.totalSalaryAccounts, icon: <Person />, color: '#ec4899', accent: 'rgba(236,72,153,.18)' },
    { title: 'Total Managers', value: kpis.totalManagers, icon: <Apartment />, color: '#7c3aed', accent: 'rgba(124,58,237,.2)' },
  ];

  const timeText = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateText = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });

  return (
    <Box sx={{ bgcolor: navy, minHeight: '100%', color: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', lg: 'center' }, flexDirection: { xs: 'column', lg: 'row' }, gap: 2.2, mb: 2.4 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: { xs: '1.55rem', md: '2rem' }, fontWeight: 950, lineHeight: 1.12 }}>
            Welcome back, {user?.name || 'Manager'} 👋
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,.72)', fontSize: { xs: '.9rem', md: '1rem' }, mt: .55 }}>
            Here's today's banking operations overview.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} sx={{ width: { xs: '100%', lg: 'auto' } }}>
          <TimeCard icon={<AccessTime />} label="Live Time" value={timeText} />
          <TimeCard icon={<CalendarMonth />} label="Current Date" value={dateText} />
          <Button
            onClick={() => fetchDashboard({ silent: true })}
            disabled={refreshing}
            startIcon={<Refresh />}
            sx={{
              bgcolor: '#fff',
              color: royalBlue,
              border: '1px solid rgba(37,99,235,0.24)',
              borderRadius: '14px',
              px: 2,
              fontWeight: 950,
              textTransform: 'none',
              boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
              '&:hover': { bgcolor: '#eff6ff', transform: 'translateY(-2px)', boxShadow: '0 16px 34px rgba(37,99,235,0.18)' },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '14px' }}>{error}</Alert>}

      <Grid container spacing={1.6} sx={{ mb: 2 }}>
        {kpiCards.map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.title}>
            <KpiCard {...item} loading={loading} growth={item.growth} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={1.6}>
        <Grid item xs={12} lg={5}>
          <SectionCard title="Monthly Transactions Trend" icon={<ShowChart />} color={royalBlue}>
            <Box sx={{ height: 240 }}>
              {loading ? (
                <Skeleton variant="rounded" height="100%" sx={{ borderRadius: '16px' }} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="monthlyTransactions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={royalBlue} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={royalBlue} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: textMuted, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: textMuted, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipBox />} />
                    <Area type="monotone" dataKey="count" fill="url(#monthlyTransactions)" stroke={royalBlue} strokeWidth={3} />
                    <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#fff', stroke: royalBlue }} activeDot={{ r: 6, fill: royalBlue }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={3}>
          <SectionCard title="Customer Classification Distribution" icon={<DonutLarge />} color="#06b6d4">
            {loading ? (
              <Skeleton variant="rounded" height={240} sx={{ borderRadius: '16px' }} />
            ) : classifications.length === 0 ? (
              <Typography sx={{ color: textMuted, py: 7, textAlign: 'center' }}>No classification data found.</Typography>
            ) : (
              <Box>
                <Box sx={{ height: 142, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={classifications} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={34} outerRadius={56} paddingAngle={3}>
                        {classifications.map((entry, index) => (
                          <Cell key={entry.name} fill={classificationColors[index % classificationColors.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value, name, item) => [`${formatNumber(value)} (${item.payload.percentage}%)`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: textPrimary, fontWeight: 950, fontSize: '1.15rem' }}>{formatNumber(totalClassifiedCustomers)}</Typography>
                      <Typography sx={{ color: textMuted, fontWeight: 800, fontSize: '.68rem' }}>Customers</Typography>
                    </Box>
                  </Box>
                </Box>
                <Stack spacing={.5} sx={{ mt: .7 }}>
                  {classifications.map((item, index) => (
                    <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: .8 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: classificationColors[index % classificationColors.length] }} />
                        <Typography sx={{ color: textPrimary, fontSize: '.75rem', fontWeight: 900 }}>{item.name}</Typography>
                      </Box>
                      <Typography sx={{ color: textMuted, fontSize: '.72rem', fontWeight: 800 }}>{formatNumber(item.count)} ({item.percentage}%)</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionCard
            title="Recent Notifications"
            icon={<Notifications />}
            color="#f59e0b"
            action={<Button onClick={() => navigate('/manager-dashboard/notifications')} sx={{ color: royalBlue, fontWeight: 950, textTransform: 'none' }}>View All</Button>}
          >
            <Stack spacing={1.05}>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => <Skeleton key={index} variant="rounded" height={46} sx={{ borderRadius: '14px' }} />)
              ) : notifications.length === 0 ? (
                <Typography sx={{ color: textMuted, textAlign: 'center', py: 5 }}>No notifications found.</Typography>
              ) : (
                notifications.map((item) => {
                  const meta = notificationMeta[item.type] || notificationMeta[item.priority] || notificationMeta.info;
                  return (
                    <Box key={item._id} sx={{ display: 'flex', gap: 1.05, p: .9, borderRadius: '14px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Avatar sx={{ width: 30, height: 30, bgcolor: meta.bg, color: meta.color }}>{React.cloneElement(meta.icon, { fontSize: 'small' })}</Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ color: textPrimary, fontWeight: 950, fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</Typography>
                          <Typography sx={{ color: textMuted, fontWeight: 800, fontSize: '.65rem', whiteSpace: 'nowrap' }}>{formatRelativeTime(item.createdAt)}</Typography>
                        </Box>
                        <Typography sx={{ color: textMuted, fontSize: '.71rem', lineHeight: 1.35, mt: .25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.message}</Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ManagerHome;
