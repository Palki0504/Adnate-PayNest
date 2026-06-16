import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import {
  Group,
  ReceiptLong,
  AccessTime,
  Shield,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { adminAPI, adminUserAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const CLASSIFICATION_COLORS = {
  PENDING: '#fbbf24',
  SILVER: '#60a5fa',
  GOLD: '#f59e0b',
  PLATINUM: '#a855f7',
};

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);

const AdminHome = () => {
  const [dashboard, setDashboard] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartInterval, setChartInterval] = useState('daily');
  const recentTransactions = dashboard?.recentTransactions || [];
  const recentLogins = dashboard?.recentLogins || [];
  const {
    page: transactionsPage,
    setPage: setTransactionsPage,
    paginatedRecords: paginatedRecentTransactions,
  } = useTablePagination(recentTransactions, [recentTransactions.length]);
  const {
    page: loginsPage,
    setPage: setLoginsPage,
    paginatedRecords: paginatedRecentLogins,
  } = useTablePagination(recentLogins, [recentLogins.length]);
  const navigate = useNavigate();

  const fetchDashboardData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [dashboardRes, pendingRes] = await Promise.all([
        adminAPI.getDashboardStats({ _ts: Date.now() }),
        adminUserAPI.getPendingRegistrations({ _ts: Date.now() }),
      ]);

      if (!dashboardRes.data?.success) {
        throw new Error('Failed to fetch dashboard data.');
      }

      setDashboard(dashboardRes.data.data || null);
      setPendingCount(pendingRes.data.count || 0);
      setError('');
    } catch (err) {
      console.error('AdminHome fetch error:', err);
      setDashboard(null);
      setPendingCount(0);
      setError(err.response?.data?.message || err.message || 'Unable to load dashboard statistics.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 5000);
    const refreshOnFocus = () => fetchDashboardData(false);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  const activeChartData = useMemo(() => dashboard?.charts?.[chartInterval] || [], [dashboard, chartInterval]);

  const classificationChartData = useMemo(() => {
    if (!dashboard?.classifications) return [];
    return Object.entries(dashboard.classifications)
      .map(([tier, count]) => ({
        name: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase(),
        value: count,
        color: CLASSIFICATION_COLORS[tier] || '#fff',
      }))
      .filter((item) => item.value > 0);
  }, [dashboard]);

  const overdraftPieData = useMemo(() => {
    if (!dashboard?.overdraft) return [];
    const { totalOverdraftUsed, availableOverdraft } = dashboard.overdraft;
    if (!totalOverdraftUsed && !availableOverdraft) return [];
    return [
      { name: 'Used', value: totalOverdraftUsed, color: '#ef4444' },
      { name: 'Available', value: availableOverdraft, color: '#22c55e' },
    ];
  }, [dashboard]);

  const summaryCards = [
    {
      title: 'Total Customers',
      value: dashboard?.summary?.totalCustomers,
      icon: <Group sx={{ fontSize: '1.35rem' }} />,
      color: '#38bdf8',
      bg: 'rgba(56,189,248,0.08)',
      border: 'rgba(56,189,248,0.18)',
      action: {
        label: 'View users',
        onClick: () => navigate('/admin-dashboard/user-management'),
      },
    },
    {
      title: 'Manager',
      value: 1,
      icon: <Shield sx={{ fontSize: '1.35rem' }} />,
      color: '#818cf8',
      bg: 'rgba(129,140,248,0.08)',
      border: 'rgba(129,140,248,0.18)',
      action: {
        label: 'View managers',
        onClick: () => navigate('/admin-dashboard/user-management'),
      },
    },
    {
      title: 'Pending Approvals',
      value: pendingCount,
      icon: <AccessTime sx={{ fontSize: '1.35rem' }} />,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.18)',
      action: {
        label: 'Approve signups',
        onClick: () => navigate('/admin-dashboard/user-management'),
      },
    },
    {
      title: 'Total Transactions',
      value: dashboard?.summary?.totalTransactions,
      icon: <ReceiptLong sx={{ fontSize: '1.35rem' }} />,
      color: '#4ade80',
      bg: 'rgba(74,222,128,0.08)',
      border: 'rgba(74,222,128,0.18)',
      action: {
        label: 'View transactions',
        onClick: () => navigate('/admin-dashboard/transactions'),
      },
    },
  ];

  const dashboardGrid = {
    display: 'grid',
    gap: 1.25,
    alignItems: 'stretch',
  };

  const panelCardSx = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    boxShadow: '0 18px 45px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.04) inset',
    height: '100%',
    minHeight: 0,
  };

  const tableSurfaceSx = {
    background: 'rgba(4,10,24,0.32)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
    boxShadow: '0 14px 30px rgba(0,0,0,0.18) inset, 0 10px 24px rgba(0,0,0,0.16)',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: { xs: 1, sm: 1.5 }, minHeight: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1, justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Central Control & Security System
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.85rem', mt: 0.65, maxWidth: 620 }}>
            Banking console connected directly to MongoDB - Live Updates
          </Typography>
        </Box>
      </Box>

      {error && (
        <Chip
          label={error}
          size="small"
          color="error"
          variant="outlined"
          sx={{ borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', width: 'fit-content' }}
        />
      )}

      <Box sx={{ ...dashboardGrid, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        {summaryCards.map((card) => (
          <Box key={card.title} sx={{ minWidth: 0 }}>
            <Card
              onClick={card.action?.onClick}
              sx={{
                background: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: '14px',
                height: 124,
                cursor: card.action?.onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                boxShadow: `0 18px 38px rgba(0,0,0,0.24), 0 0 0 1px ${card.border}, 0 12px 28px ${card.bg}`,
                '&:hover': {
                  transform: 'translateY(-1px)',
                  borderColor: card.color,
                  boxShadow: `0 22px 48px rgba(0,0,0,0.32), 0 0 0 1px ${card.color}, 0 14px 32px ${card.bg}`,
                }
              }}
            >
              <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.8 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {card.title}
                  </Typography>
                  <Box sx={{ color: card.color }}>{card.icon}</Box>
                </Box>
                {loading ? (
                  <Skeleton variant="text" width={64} height={24} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                ) : (
                  <Typography sx={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.05 }}>
                    {card.value ?? '0'}
                  </Typography>
                )}
                {card.subtitle && (
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.4 }}>{card.subtitle}</Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      <Box sx={{ ...dashboardGrid, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ ...panelCardSx, height: 248 }}>
            <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25, gap: 1 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Transaction Activity</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.5 }}>Ledger volume & count</Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => navigate('/admin-dashboard/transactions')}
                  sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.72)' }}
                >
                  Open Transactions
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }}>
                {['daily', 'weekly', 'monthly'].map((interval) => (
                  <Button
                    key={interval}
                    size="small"
                    onClick={() => setChartInterval(interval)}
                    sx={{
                      textTransform: 'capitalize',
                      fontSize: '0.68rem',
                      minWidth: 72,
                      fontWeight: chartInterval === interval ? 700 : 500,
                      color: chartInterval === interval ? '#0b0f26' : 'rgba(255,255,255,0.68)',
                      bgcolor: chartInterval === interval ? '#fff' : 'rgba(255,255,255,0.06)',
                      borderRadius: 2,
                    }}
                  >
                    {interval}
                  </Button>
                ))}
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={160} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, flex: 1 }} />
              ) : activeChartData.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.78rem' }}>No Records Found</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminHomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${val}`} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <Box sx={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, p: 1 }}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>{data.label}</Typography>
                              <Typography sx={{ color: '#4ade80', fontWeight: 700, fontSize: '0.85rem' }}>Amount: {formatCurrency(data.amount)}</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem' }}>Transactions: {data.count}</Typography>
                            </Box>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#4ade80" strokeWidth={2} fill="url(#adminHomeGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ ...panelCardSx, height: 248 }}>
            <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 1.25 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Customer Classification</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.5 }}>Tier distribution (excl. regular)</Typography>
              </Box>

              {loading ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={22} sx={{ color: '#60a5fa' }} />
                </Box>
              ) : classificationChartData.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.78rem' }}>No Records Found</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={classificationChartData} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={48} paddingAngle={4}>
                        {classificationChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mt: 1 }}>
                    {classificationChartData.map((entry) => (
                      <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.72rem' }}>
                          {entry.name}: {entry.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <Button
                onClick={() => navigate('/admin-dashboard/customer-classifications')}
                size="small"
                sx={{ mt: 'auto', textTransform: 'none', color: 'rgba(255,255,255,0.72)' }}
              >
                Open classifications
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ ...panelCardSx, height: 248 }}>
            <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 1.25 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Overdraft Utilization</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.5 }}>Limit pool drawdown</Typography>
              </Box>

              {loading ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={22} sx={{ color: '#ef4444' }} />
                </Box>
              ) : overdraftPieData.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.78rem' }}>No Records Found</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ width: 88, height: 88 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overdraftPieData} cx="50%" cy="50%" innerRadius={26} outerRadius={38} dataKey="value">
                            {overdraftPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>

                    <Box sx={{ textAlign: 'right', minWidth: 140 }}>
                      <Typography sx={{ color: '#fff', fontSize: '0.92rem', fontWeight: 700 }}>
                        {dashboard?.overdraft?.totalOverdraftAccounts ?? 0} Accounts
                      </Typography>
                      <Typography sx={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, mt: 0.5 }}>
                        Used: {formatCurrency(dashboard?.overdraft?.totalOverdraftUsed)}
                      </Typography>
                      <Typography sx={{ color: '#22c55e', fontSize: '0.74rem', mt: 0.5 }}>
                        Available: {formatCurrency(dashboard?.overdraft?.availableOverdraft)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 1.5, p: 1.25, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>Total limit pool:</Typography>
                    <Typography sx={{ color: '#fb923c', fontSize: '0.85rem', fontWeight: 700, mt: 0.35 }}>
                      {formatCurrency(dashboard?.overdraft?.totalOverdraftLimit)}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Button
                onClick={() => navigate('/admin-dashboard/overdraft-management')}
                size="small"
                sx={{ mt: 'auto', textTransform: 'none', color: 'rgba(255,255,255,0.72)' }}
              >
                Open overdraft management
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ ...dashboardGrid, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ ...panelCardSx, height: 292 }}>
            <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Top 5 Recent Transactions</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.5 }}>Live transaction ledger transfers</Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => navigate('/admin-dashboard/transactions')}
                  sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.72)' }}
                >
                  View all
                </Button>
              </Box>

              <TableContainer component={Paper} sx={tableSurfaceSx}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Sender', 'Receiver', 'Amount', 'Date', 'Status'].map((heading) => (
                        <TableCell
                          key={heading}
                          sx={{
                            color: 'rgba(255,255,255,0.5)',
                            py: 0.85,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            px: 0.8,
                          }}
                        >
                          {heading}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      [...Array(5)].map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={5} sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 0.8 }}>
                            <Skeleton variant="text" width="100%" height={18} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : !recentTransactions.length ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: 'rgba(255,255,255,0.32)', fontSize: '0.78rem' }}>
                          No Records Found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRecentTransactions.map((tx) => (
                        <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {tx.senderName || tx.userName || 'Unknown'}
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: '0.75rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {tx.receiverName || 'Unknown'}
                          </TableCell>
                          <TableCell sx={{ color: tx.type === 'debit' || tx.type === 'transfer' ? '#f87171' : '#22c55e', fontWeight: 700, fontSize: '0.75rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.73rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                            {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography sx={{ color: tx.status === 'completed' ? '#4ade80' : tx.status === 'failed' ? '#f87171' : '#fb923c', fontWeight: 700, fontSize: '0.72rem', textTransform: 'capitalize' }}>
                              {tx.status}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePaginationControls page={transactionsPage} totalRecords={recentTransactions.length} onPageChange={setTransactionsPage} />
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Card sx={{ ...panelCardSx, height: 292 }}>
            <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Top 5 System Logins</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.5 }}>Recent platform authentication activities.</Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => navigate('/admin-dashboard/logs-security')}
                  sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.72)' }}
                >
                  View logs
                </Button>
              </Box>

              <TableContainer component={Paper} sx={tableSurfaceSx}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['User Name', 'User ID', 'Role', 'Login Date', 'Login Time'].map((heading, index) => (
                        <TableCell
                          key={heading}
                          align={index === 4 ? 'right' : 'left'}
                          sx={{
                            color: 'rgba(255,255,255,0.5)',
                            py: 0.85,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            px: 0.8,
                          }}
                        >
                          {heading}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      [...Array(5)].map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={5} sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 0.8 }}>
                            <Skeleton variant="text" width="100%" height={18} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : !recentLogins.length ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: 'rgba(255,255,255,0.32)', fontSize: '0.78rem' }}>
                          No Records Found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRecentLogins.map((log) => (
                        <TableRow key={log._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {log.userName}
                          </TableCell>
                          <TableCell sx={{ color: '#fb923c', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {log.userId}
                          </TableCell>
                          <TableCell sx={{ color: log.role?.toLowerCase() === 'manager' ? '#818cf8' : '#38bdf8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {log.role}
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.73rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.73rem', py: 0.75, px: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePaginationControls page={loginsPage} totalRecords={recentLogins.length} onPageChange={setLoginsPage} />
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminHome;
