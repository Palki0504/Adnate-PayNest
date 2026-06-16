import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, Chip, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, LinearProgress, Avatar,
} from '@mui/material';
import {
  AccountBalance, TrendingUp, TrendingDown, Savings,
  NotificationsActive, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { accountAPI, transactionAPI, notificationAPI } from '../../services/api';
import { setNotifications } from '../../redux/slices/notificationSlice';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const StatCard = ({ title, value, subtitle, icon, color, loading }) => (
  <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', height: '100%', position: 'relative', overflow: 'hidden' }}>
    <Box sx={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderRadius: '50%', background: `${color}15`, transform: 'translate(30px, -30px)' }} />
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
        <Avatar sx={{ width: 40, height: 40, background: `${color}20`, border: `1px solid ${color}30` }}>
          {React.cloneElement(icon, { sx: { color, fontSize: '1.2rem' } })}
        </Avatar>
      </Box>
      {loading ? (
        <Skeleton variant="text" width="70%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
      ) : (
        <Typography sx={{ color: '#fff', fontSize: '1.7rem', fontWeight: 700, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
          {value}
        </Typography>
      )}
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', mt: 1 }}>
        {subtitle}
      </Typography>
    </CardContent>
  </Card>
);

const DashboardHome = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [accounts, setAccounts] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifs] = useState([]);
  const {
    page: transactionsPage,
    setPage: setTransactionsPage,
    paginatedRecords: paginatedTransactions,
  } = useTablePagination(transactions, [transactions.length]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [accRes, txRes, notifRes] = await Promise.all([
          accountAPI.getAll(),
          transactionAPI.getAll({ limit: 5, sortOrder: 'desc' }),
          notificationAPI.getAll({ limit: 5 }),
        ]);

        // Normalize account response shape. Some callers expect an object
        // with `accounts` array and `summary`, while others may receive
        // just an array. Ensure `accounts` is always an object with those
        // properties so UI cards compute balances correctly.
        let accountsPayload = accRes.data;
        if (!accountsPayload) {
          accountsPayload = { accounts: [], summary: { totalBalance: 0, totalOverdraftUsed: 0, totalOverdraftLimit: 0, accountCount: 0 } };
        } else if (Array.isArray(accountsPayload)) {
          const arr = accountsPayload;
          accountsPayload = {
            accounts: arr,
            summary: {
              totalBalance: arr.reduce((s, a) => s + (Number(a.balance) || 0), 0),
              totalOverdraftUsed: arr.reduce((s, a) => s + (Number(a.overdraftUsed) || 0), 0),
              totalOverdraftLimit: arr.reduce((s, a) => s + (Number(a.overdraftLimit) || 0), 0),
              accountCount: arr.length,
            },
          };
        }

        setAccounts(accountsPayload);
        setTransactions(txRes.data.transactions);
        setNotifs(notifRes.data.notifications);

        dispatch(setNotifications({
          notifications: notifRes.data.notifications,
          unreadCount: notifRes.data.unreadCount,
        }));
      } catch (err) {
        setError('Failed to load dashboard data. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dispatch]);

  const summary = accounts?.summary;
  const activeAccounts = accounts?.accounts?.filter((account) => account.status === 'active') || [];
  const accountIconMap = {
    savings: <Savings />,
    current: <AccountBalance />,
    salary: <TrendingUp />,
  };
  const accountColorMap = {
    savings: '#22c55e',
    current: '#3b82f6',
    salary: '#6366f1',
  };
  const accountLabelMap = {
    savings: 'Savings Account',
    current: 'Current Account',
    salary: 'Salary Account',
  };

  const classificationRank = (classification) => {
    if (classification === 'PLATINUM') return 3;
    if (classification === 'GOLD') return 2;
    if (classification === 'SILVER') return 1;
    return 0;
  };

  const topClassification = activeAccounts.reduce((best, acc) => {
    if (!best) return acc.classification;
    return classificationRank(acc.classification) > classificationRank(best) ? acc.classification : best;
  }, null);

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
          Good Morning, {user?.name?.split(' ')[0]} 👋
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', mt: 0.5, fontWeight: 500 }}>
          Customer ID: {user?.customerId || 'Not assigned yet'}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', mt: 1 }}>
          Here's your financial overview for today
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Cash Balance" value={summary ? formatCurrency(summary.totalBalance) : formatCurrency(0)} subtitle={`Available with OD: ${summary ? formatCurrency(summary.totalAvailableBalance ?? summary.totalBalance) : formatCurrency(0)}`} icon={<AccountBalance />} color="#f59e0b" loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Overdraft Used" value={summary ? formatCurrency(summary.totalOverdraftUsed) : formatCurrency(0)} subtitle={`Limit: ${summary ? formatCurrency(summary.totalOverdraftLimit) : formatCurrency(0)}`} icon={<TrendingDown />} color="#ef4444" loading={loading} />
        </Grid>
        {activeAccounts.map((account) => (
          <Grid item xs={12} sm={6} lg={3} key={account._id}>
            <StatCard
              title={accountLabelMap[account.accountType] || `${account.accountType} Account`}
              value={formatCurrency(account.balance)}
              subtitle={`Cash ${formatCurrency(account.balance)} | OD used ${formatCurrency(account.overdraftUsed || 0)}`}
              icon={accountIconMap[account.accountType] || <AccountBalance />}
              color={accountColorMap[account.accountType] || "#60a5fa"}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>

      {/* Overdraft Bar */}
      {summary && summary.totalOverdraftLimit > 0 && (
        <Card sx={{ mb: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>Overdraft Usage</Typography>
              <Typography sx={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>
                {formatCurrency(summary.totalOverdraftUsed)} / {formatCurrency(summary.totalOverdraftLimit)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min((summary.totalOverdraftUsed / summary.totalOverdraftLimit) * 100, 100)}
              sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(239,68,68,0.2)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: 4 } }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', mt: 1 }}>
              Available OD: {formatCurrency(summary.totalOverdraftLimit - summary.totalOverdraftUsed)}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Recent Transactions */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem', mb: 2.5 }}>
                Recent Transactions
              </Typography>
              {loading ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} height={52} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, mb: 1 }} />)
              ) : transactions.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', py: 4 }}>No transactions yet</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Description', 'Type', 'Amount', 'Date'].map((h) => (
                          <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', border: 'none', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', pb: 1 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTransactions.map((tx) => (
                        <TableRow key={tx._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.8)', border: 'none', fontSize: '0.82rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', py: 1.5 }}>
                            {tx.description || 'Transaction'}
                          </TableCell>
                          <TableCell sx={{ border: 'none', py: 1.5 }}>
                            <Chip
                              label={tx.type}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                                bgcolor: tx.type === 'credit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                color: tx.type === 'credit' ? '#22c55e' : '#ef4444',
                                border: `1px solid ${tx.type === 'credit' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ border: 'none', py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {tx.type === 'credit'
                                ? <ArrowDownward sx={{ color: '#22c55e', fontSize: '0.9rem' }} />
                                : <ArrowUpward sx={{ color: '#ef4444', fontSize: '0.9rem' }} />}
                              <Typography sx={{ color: tx.type === 'credit' ? '#22c55e' : '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                                {formatCurrency(tx.amount)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: '0.75rem', py: 1.5 }}>
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePaginationControls page={transactionsPage} totalRecords={transactions.length} onPageChange={setTransactionsPage} />
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Notifications */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Notifications</Typography>
                <NotificationsActive sx={{ color: '#f59e0b', fontSize: '1.2rem' }} />
              </Box>
              {loading ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} height={64} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, mb: 1 }} />)
              ) : notifications.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', py: 4 }}>No notifications</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {notifications.map((n) => (
                    <Box
                      key={n._id}
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        background: n.isRead ? 'rgba(255,255,255,0.03)' : 'rgba(245,158,11,0.08)',
                        border: n.isRead ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(245,158,11,0.2)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: n.isRead ? 400 : 600, mb: 0.3 }}>
                        {n.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {n.message.substring(0, 80)}{n.message.length > 80 ? '...' : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHome;
