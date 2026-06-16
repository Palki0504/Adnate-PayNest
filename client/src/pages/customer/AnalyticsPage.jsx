import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Skeleton, Select,
  MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import { transactionAPI } from '../../services/api';

const COLORS = ['#f59e0b', '#6366f1', '#22c55e', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: 'rgba(10,14,39,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', p: 2, backdropFilter: 'blur(10px)' }}>
      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>{label}</Typography>
      {payload.map((p, i) => (
        <Typography key={i} sx={{ color: p.color, fontSize: '0.8rem' }}>
          {p.name}: {formatCurrency(p.value)}
        </Typography>
      ))}
    </Box>
  );
};

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    transactionAPI.getAnalytics()
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  // Process monthly data for bar chart
  const monthlyChartData = React.useMemo(() => {
    if (!data?.monthlyTrend) return [];
    const map = {};
    data.monthlyTrend.forEach(({ _id, total }) => {
      const key = `${MONTH_NAMES[_id.month - 1]} ${_id.year}`;
      if (!map[key]) map[key] = { name: key, credit: 0, debit: 0 };
      if (_id.type === 'credit') map[key].credit = total;
      else map[key].debit = total;
    });
    return Object.values(map).slice(-6);
  }, [data]);

  // Spending by category pie data
  const pieData = React.useMemo(() => {
    if (!data?.categoryBreakdown) return [];
    return data.categoryBreakdown.map((c) => ({
      name: c._id.charAt(0).toUpperCase() + c._id.slice(1),
      value: c.total,
      count: c.count,
    }));
  }, [data]);

  const totalSpend = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5, fontFamily: "'Inter', sans-serif" }}>
        Analytics
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Visual insights into your spending patterns and monthly trends
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Pie Chart - Spending by Category */}
        <Grid item xs={12} md={5}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Spending by Category</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>
                Last 6 months · Total: {formatCurrency(totalSpend)}
              </Typography>

              {loading ? (
                <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto', bgcolor: 'rgba(255,255,255,0.06)' }} />
              ) : pieData.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 8 }}>No spending data</Typography>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <ReTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <Box sx={{ background: 'rgba(10,14,39,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', p: 2 }}>
                              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>{d.name}</Typography>
                              <Typography sx={{ color: '#f59e0b', fontSize: '0.8rem' }}>{formatCurrency(d.value)}</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{d.count} transactions</Typography>
                            </Box>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {pieData.slice(0, 6).map((d, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1.5, py: 0.6, borderRadius: '8px', background: `${COLORS[i % COLORS.length]}15`, border: `1px solid ${COLORS[i % COLORS.length]}30` }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>{d.name}</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Bar Chart - Monthly Trend */}
        <Grid item xs={12} md={7}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>Monthly Income vs Expenses</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', mb: 3 }}>
                6-month trend comparison
              </Typography>

              {loading ? (
                <Skeleton variant="rectangular" height={240} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '8px' }} />
              ) : monthlyChartData.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 8 }}>No trend data</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyChartData} barSize={16} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }} />
                    <Bar dataKey="credit" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="debit" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Category breakdown table */}
        <Grid item xs={12}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 3 }}>Category Breakdown</Typography>
              {loading ? (
                <Skeleton height={150} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
              ) : (
                <Grid container spacing={2}>
                  {pieData.map((d, i) => (
                    <Grid item xs={6} sm={4} md={3} key={i}>
                      <Box sx={{ p: 2, borderRadius: '12px', background: `${COLORS[i % COLORS.length]}10`, border: `1px solid ${COLORS[i % COLORS.length]}20` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', textTransform: 'capitalize' }}>{d.name}</Typography>
                        </Box>
                        <Typography sx={{ color: COLORS[i % COLORS.length], fontSize: '1.05rem', fontWeight: 700 }}>
                          {formatCurrency(d.value)}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
                          {d.count} transactions
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
