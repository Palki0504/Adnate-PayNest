import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  AccessTime,
  Business,
  CalendarMonth,
  Notifications,
  People,
  PendingActions,
  Person,
  Refresh,
  Savings,
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

const numberFormat = new Intl.NumberFormat('en-IN');
const currencyFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const cardBaseSx = {
  background: 'linear-gradient(145deg, rgba(17,24,61,0.88), rgba(8,13,36,0.78))',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: '14px',
  boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
  backdropFilter: 'blur(18px)',
  overflow: 'hidden',
};

const kpiStyles = {
  customers: { color: '#38bdf8', glow: 'rgba(56,189,248,0.22)', icon: <People /> },
  accounts: { color: '#2dd4bf', glow: 'rgba(45,212,191,0.2)', icon: <AccountBalance /> },
  approvals: { color: '#f59e0b', glow: 'rgba(245,158,11,0.22)', icon: <PendingActions /> },
  overdraft: { color: '#ec4899', glow: 'rgba(236,72,153,0.2)', icon: <Wallet /> },
  transactions: { color: '#8b5cf6', glow: 'rgba(139,92,246,0.22)', icon: <SwapHoriz /> },
};

const classificationColors = ['#f59e0b', '#8b5cf6', '#3b82f6', '#22c55e', '#06b6d4', '#ec4899', '#a3e635', '#f97316'];

const priorityMeta = {
  high: { color: '#fb7185', bg: 'rgba(244,63,94,0.14)', label: 'High Priority' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', label: 'Medium Priority' },
  low: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Low Priority' },
};

const formatNumber = (value) => numberFormat.format(Number(value || 0));

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

const GlassPanel = ({ children, sx = {} }) => (
  <Card sx={{ ...cardBaseSx, ...sx }}>
    <CardContent sx={{ p: { xs: 1.5, md: 1.8 } }}>{children}</CardContent>
  </Card>
);

const KpiCard = ({ title, value, icon, color, glow, loading, data }) => (
  <Card
    sx={{
      ...cardBaseSx,
      height: '100%',
      position: 'relative',
      transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: color,
        boxShadow: `0 18px 38px ${glow}`,
      },
      '&:before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at top right, ${glow}, transparent 45%)`,
        pointerEvents: 'none',
      },
    }}
  >
    <CardContent sx={{ p: 1.5, position: 'relative', zIndex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.1 }}>
        <Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.25 }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton width={76} height={34} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mt: 0.5 }} />
          ) : (
            <Typography sx={{ color: '#fff', fontSize: { xs: '1.45rem', lg: '1.55rem' }, fontWeight: 800, mt: 1, lineHeight: 1 }}>
              {formatNumber(value)}
            </Typography>
          )}
        </Box>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: glow,
            color,
            border: `1px solid ${color}55`,
          }}
        >
          {React.cloneElement(icon, { fontSize: 'small' })}
        </Avatar>
      </Box>
      <Box sx={{ height: 32, mt: 0.8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`spark-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="count" stroke={color} fill={`url(#spark-${title.replace(/\s+/g, '-')})`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </CardContent>
  </Card>
);

const ChartTooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const current = payload[0]?.payload || {};
  return (
    <Box sx={{ bgcolor: '#0f172a', color: '#fff', border: '1px solid rgba(148,163,184,0.22)', borderRadius: '10px', p: 1.4, boxShadow: '0 14px 35px rgba(0,0,0,0.32)' }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ color: '#c4b5fd', fontSize: '0.76rem', mt: 0.4 }}>
        {formatNumber(current.count)} transactions
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem' }}>
        {currencyFormat.format(current.amount || 0)}
      </Typography>
    </Box>
  );
};

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
    const refreshInterval = setInterval(() => fetchDashboard({ silent: true }), 45000);
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
  const sparkData = trendData.length ? trendData : Array.from({ length: 12 }, (_, index) => ({ label: index + 1, count: 0, amount: 0 }));
  const kpis = dashboard?.kpis || {};
  const quickStats = dashboard?.quickStatistics || {};
  const classifications = dashboard?.classificationDistribution || [];
  const notifications = (dashboard?.notifications || []).slice(0, 5);
  const hasMoreNotifications = Boolean(dashboard?.hasMoreNotifications);

  const totalClassifiedCustomers = useMemo(
    () => classifications.reduce((sum, item) => sum + (item.count || 0), 0),
    [classifications]
  );

  const kpiCards = [
    { key: 'customers', title: 'Total Customers', value: kpis.totalCustomers, ...kpiStyles.customers },
    { key: 'accounts', title: 'Total Active Accounts', value: kpis.totalActiveAccounts, ...kpiStyles.accounts },
    { key: 'approvals', title: 'Pending Approvals', value: kpis.pendingApprovals, ...kpiStyles.approvals },
    { key: 'overdraft', title: 'Active Overdraft Accounts', value: kpis.activeOverdraftAccounts, ...kpiStyles.overdraft },
    { key: 'transactions', title: 'Total Transactions', value: kpis.totalTransactions, ...kpiStyles.transactions },
  ];

  const quickStatCards = [
    { label: 'Total Savings Accounts', value: quickStats.totalSavingsAccounts, color: '#f472b6', icon: <Savings /> },
    { label: 'Total Current Accounts', value: quickStats.totalCurrentAccounts, color: '#22d3ee', icon: <Business /> },
    { label: 'Total Salary Accounts', value: quickStats.totalSalaryAccounts, color: '#d8b4fe', icon: <Person /> },
  ];

  const timeText = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateText = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' });

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.4,
          mb: 1.8,
        }}
      >
        <Box>
          <Typography sx={{ color: '#fff', fontSize: { xs: '1.35rem', md: '1.55rem' }, fontWeight: 800, lineHeight: 1.15 }}>
            Welcome back, {user?.name || 'Manager'}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.84rem', mt: 0.35 }}>
            Live banking operations overview from Adnate PayNest.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, color: 'rgba(255,255,255,0.74)', px: 1.2, py: 0.7, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.04)' }}>
            <AccessTime sx={{ color: '#93c5fd', fontSize: '1rem' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{timeText}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, color: 'rgba(255,255,255,0.74)', px: 1.2, py: 0.7, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.04)' }}>
            <CalendarMonth sx={{ color: '#c4b5fd', fontSize: '1rem' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{dateText}</Typography>
          </Box>
          <Button
            onClick={() => fetchDashboard({ silent: true })}
            disabled={refreshing}
            startIcon={<Refresh />}
            sx={{
              color: '#fff',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.78rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.05)',
              px: 1.2,
              py: 0.65,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.4, bgcolor: 'rgba(127,29,29,0.82)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.22)' }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={1.35} sx={{ mb: 1.5 }}>
        {kpiCards.map((item) => (
          <Grid item xs={12} sm={6} lg={2.4} key={item.key}>
            <KpiCard {...item} loading={loading} data={sparkData} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={1.35} sx={{ mb: 1.5 }}>
        {quickStatCards.map((item) => (
          <Grid item xs={12} md={4} key={item.label}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '14px',
                minHeight: 94,
                background: `linear-gradient(135deg, ${item.color}24, rgba(15,23,42,0.52))`,
                border: `1px solid ${item.color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                boxShadow: '0 14px 28px rgba(0,0,0,0.18)',
              }}
            >
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.82rem', fontWeight: 700 }}>{item.label}</Typography>
                {loading ? (
                  <Skeleton width={70} height={30} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                ) : (
                  <Typography sx={{ color: '#fff', fontSize: '1.45rem', fontWeight: 900, mt: 0.35 }}>{formatNumber(item.value)}</Typography>
                )}
              </Box>
              <Box sx={{ color: item.color, display: 'flex', flexShrink: 0 }}>{React.cloneElement(item.icon, { sx: { fontSize: 32 } })}</Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={1.35} sx={{ mb: 1.5 }}>
        <Grid item xs={12} lg={7}>
          <GlassPanel sx={{ height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.2, mb: 1.2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', width: 30, height: 30 }}>
                  <TrendingUp fontSize="small" />
                </Avatar>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.94rem' }}>Monthly Transactions Trend</Typography>
              </Box>
              <Chip label="Last 12 Months" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.74)', fontWeight: 700, height: 24, fontSize: '0.68rem' }} />
            </Box>
            <Box sx={{ height: { xs: 230, md: 255 } }}>
              {loading ? (
                <Skeleton variant="rounded" height="100%" sx={{ bgcolor: 'rgba(255,255,255,0.07)', borderRadius: '14px' }} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="managerTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipBox />} />
                    <Area type="monotone" dataKey="count" fill="url(#managerTrend)" stroke="#a78bfa" strokeWidth={3} />
                    <Line type="monotone" dataKey="count" stroke="#f8fafc" strokeWidth={1.5} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 6, fill: '#a78bfa' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </GlassPanel>
        </Grid>

        <Grid item xs={12} lg={5}>
              <GlassPanel sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
                  <Avatar sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#38bdf8', width: 30, height: 30 }}>
                    <People fontSize="small" />
                  </Avatar>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.94rem' }}>Customer Classification Distribution</Typography>
                </Box>
                {loading ? (
                  <Skeleton variant="rounded" height={220} sx={{ bgcolor: 'rgba(255,255,255,0.07)', borderRadius: '14px' }} />
                ) : classifications.length === 0 ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.52)', py: 4, textAlign: 'center' }}>No classification data found.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '145px 1fr' }, alignItems: 'center', gap: 1.6 }}>
                    <Box sx={{ width: 132, height: 132, mx: 'auto', position: 'relative', overflow: 'visible' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                          <Pie data={classifications} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3}>
                            {classifications.map((entry, index) => (
                              <Cell key={entry.name} fill={classificationColors[index % classificationColors.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip formatter={(value, name, item) => [`${formatNumber(value)} (${item.payload.percentage}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '0.9rem' }}>{formatNumber(totalClassifiedCustomers)}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.54)', fontSize: '0.6rem' }}>Customers</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.65}>
                      {classifications.map((item, index) => (
                        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: classificationColors[index % classificationColors.length] }} />
                            <Typography sx={{ color: '#e5e7eb', fontSize: '0.76rem', fontWeight: 700 }}>{item.name}</Typography>
                          </Box>
                          <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem' }}>
                            {formatNumber(item.count)} ({item.percentage}%)
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </GlassPanel>
        </Grid>
      </Grid>

      <Grid container spacing={1.35}>
        <Grid item xs={12}>
          <GlassPanel sx={{ height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.2, mb: 1.2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'rgba(96,165,250,0.16)', color: '#93c5fd', width: 30, height: 30 }}>
                  <Notifications fontSize="small" />
                </Avatar>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.94rem' }}>Notifications</Typography>
              </Box>
              {hasMoreNotifications && (
                <Button onClick={() => navigate('/manager-dashboard/notifications')} sx={{ color: '#a78bfa', textTransform: 'none', fontWeight: 800, fontSize: '0.78rem', py: 0.3 }}>
                  View All
                </Button>
              )}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} variant="rounded" height={92} sx={{ bgcolor: 'rgba(255,255,255,0.07)', borderRadius: '12px' }} />
                ))
              ) : notifications.length === 0 ? (
                <Box sx={{ py: 2.5, textAlign: 'center', color: 'rgba(255,255,255,0.52)', gridColumn: '1 / -1' }}>
                  <Notifications sx={{ fontSize: 30, mb: 0.6, color: 'rgba(255,255,255,0.28)' }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>No notifications found.</Typography>
                </Box>
              ) : (
                notifications.map((item) => {
                  const meta = priorityMeta[item.priority] || priorityMeta.low;
                  return (
                    <Box
                      key={item._id}
                      sx={{
                        p: 1.1,
                        borderRadius: '12px',
                        bgcolor: item.isRead ? 'rgba(255,255,255,0.045)' : meta.bg,
                        border: `1px solid ${item.isRead ? 'rgba(255,255,255,0.08)' : `${meta.color}33`}`,
                        minHeight: 92,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: meta.color, fontWeight: 800, fontSize: '0.68rem' }}>{meta.label}</Typography>
                          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.78rem', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.7rem', mt: 0.3, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.message}
                          </Typography>
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.55} sx={{ flexShrink: 0 }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.48)', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>{formatRelativeTime(item.createdAt)}</Typography>
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: item.isRead ? 'rgba(148,163,184,0.45)' : meta.color }} />
                        </Stack>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </GlassPanel>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ManagerHome;
