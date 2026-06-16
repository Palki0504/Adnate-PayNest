import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Skeleton } from '@mui/material';
import { adminAPI } from '../../services/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

// Simple bar chart component (no external lib needed)
const BarChart = ({ data, label, color, maxVal }) => {
  if (!data || data.length === 0) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
      <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No data available</Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 160, position: 'relative' }}>
      {/* Y-axis grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <Box key={f} sx={{ position: 'absolute', left: 0, right: 0, bottom: `${f * 100}%`, borderTop: '1px dashed rgba(255,255,255,0.06)', zIndex: 0 }} />
      ))}
      {data.map((d, i) => {
        const height = maxVal > 0 ? (d.value / maxVal) * 140 : 0;
        return (
          <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, zIndex: 1 }}>
            <Box
              title={`${d.label}: ${formatCurrency(d.value)}`}
              sx={{
                width: '100%', maxWidth: 32, height: Math.max(height, 4), minHeight: 4,
                background: `linear-gradient(180deg, ${color}, ${color}80)`,
                borderRadius: '4px 4px 0 0', cursor: 'default',
                transition: 'all 0.3s', '&:hover': { opacity: 0.85, transform: 'scaleY(1.05)', transformOrigin: 'bottom' },
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>{d.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

// Simple donut-style stat cards for categorical data
const PieAlt = ({ data, colors }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Box>
      {data.map((d, i) => (
        <Box key={d.label} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{d.label}</Typography>
            <Typography sx={{ color: colors[i] || '#f59e0b', fontWeight: 700, fontSize: '0.8rem' }}>{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</Typography>
          </Box>
          <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)' }}>
            <Box sx={{ height: '100%', width: `${total > 0 ? (d.value / total) * 100 : 0}%`, bgcolor: colors[i] || '#f59e0b', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', mt: 0.3 }}>{d.value.toLocaleString()} transactions</Typography>
        </Box>
      ))}
    </Box>
  );
};

const SystemAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getAnalytics()
      .then((res) => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Process monthly transaction data
  const processMonthlyData = () => {
    if (!analytics?.monthlyTransactions) return { credits: [], debits: [] };
    const monthlyMap = {};
    analytics.monthlyTransactions.forEach((d) => {
      const key = `${MONTHS[d._id.month - 1]} ${d._id.year}`;
      if (!monthlyMap[key]) monthlyMap[key] = { credit: 0, debit: 0, transfer: 0, count: 0 };
      monthlyMap[key][d._id.type] = (monthlyMap[key][d._id.type] || 0) + d.total;
      monthlyMap[key].count += d.count;
    });
    const labels = Object.keys(monthlyMap).slice(-6);
    return {
      credits: labels.map((l) => ({ label: l.split(' ')[0], value: monthlyMap[l]?.credit || 0 })),
      debits: labels.map((l) => ({ label: l.split(' ')[0], value: (monthlyMap[l]?.debit || 0) + (monthlyMap[l]?.transfer || 0) })),
      counts: labels.map((l) => ({ label: l.split(' ')[0], value: monthlyMap[l]?.count || 0 })),
    };
  };

  const { credits, debits, counts } = processMonthlyData();
  const maxCredit = Math.max(...(credits.map((c) => c.value)), 1);
  const maxDebit = Math.max(...(debits.map((d) => d.value)), 1);
  const maxCount = Math.max(...(counts.map((c) => c.value)), 1);

  // Approval stats
  const approvalData = (analytics?.approvalStats || []).map((s) => ({
    label: s._id.charAt(0).toUpperCase() + s._id.slice(1),
    value: s.count,
  }));
  const approvalColors = { Pending: '#f59e0b', Approved: '#22c55e', Rejected: '#ef4444' };

  // Account type stats
  const accountData = (analytics?.accountTypeStats || []).map((s) => ({
    label: s._id.charAt(0).toUpperCase() + s._id.slice(1),
    value: s.count,
    balance: s.totalBalance,
  }));
  const accountColors = { Savings: '#22c55e', Current: '#3b82f6', Salary: '#a855f7' };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>System Analytics</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>Transaction trends, approval stats, and account distribution</Typography>

      <Grid container spacing={3}>
        {/* Monthly Credits */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Monthly Credit Volume</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>Last 6 months</Typography>
              {loading ? <Skeleton height={160} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /> : <BarChart data={credits} color="#22c55e" maxVal={maxCredit} />}
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Debits */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Monthly Debit/Transfer Volume</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>Last 6 months</Typography>
              {loading ? <Skeleton height={160} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /> : <BarChart data={debits} color="#ef4444" maxVal={maxDebit} />}
            </CardContent>
          </Card>
        </Grid>

        {/* Transaction Count */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Transaction Count Trend</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>Number of transactions per month</Typography>
              {loading ? <Skeleton height={160} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /> : <BarChart data={counts} color="#6366f1" maxVal={maxCount} />}
            </CardContent>
          </Card>
        </Grid>

        {/* Approval Stats */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Approval Request Stats</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>Status breakdown</Typography>
              {loading ? (
                <Skeleton height={120} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
              ) : approvalData.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No approval data yet</Typography>
              ) : (
                <PieAlt data={approvalData} colors={approvalData.map((d) => approvalColors[d.label] || '#f59e0b')} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Account Distribution */}
        <Grid item xs={12}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 3 }}>Account Type Distribution</Typography>
              {loading ? (
                <Skeleton height={80} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
              ) : (
                <Grid container spacing={3}>
                  {accountData.map((acc) => {
                    const color = accountColors[acc.label] || '#f59e0b';
                    return (
                      <Grid item xs={12} sm={4} key={acc.label}>
                        <Box sx={{ p: 2.5, borderRadius: '12px', background: `${color}10`, border: `1px solid ${color}25`, textAlign: 'center' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', mb: 0.5 }}>{acc.label} Accounts</Typography>
                          <Typography sx={{ color, fontSize: '2rem', fontWeight: 800 }}>{acc.value}</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', mt: 0.5 }}>
                            Total Balance: {formatCurrency(acc.balance)}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemAnalytics;
