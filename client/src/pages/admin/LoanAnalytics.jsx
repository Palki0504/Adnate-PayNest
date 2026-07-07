import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Button, TextField,
  MenuItem, Tabs, Tab, CircularProgress, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Divider
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import {
  TrendingUp, Settings, Warning, ShowChart, DoneAll, MoneyOff,
  Gavel, CheckCircle, HighlightOff, Refresh
} from '@mui/icons-material';
import { loanAPI } from '../../services/api';

const COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#f472b6'];

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
    '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
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
  '& .MuiInputLabel-root.Mui-focused': { color: '#38bdf8' },
  '& .MuiSelect-icon': { color: '#475569' },
};

const selectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#fff',
        color: '#0f172a',
        '& .MuiMenuItem-root': { color: '#0f172a' },
        '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#e0f2fe' },
      },
    },
  },
};

const LoanAnalytics = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Analytics & Charts
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);

  // Configurations
  const [configs, setConfigs] = useState([]);
  const [editingConfigType, setEditingConfigType] = useState('');
  const [configForm, setConfigForm] = useState(null);

  // Delinquent List
  const [delinquentReport, setDelinquentReport] = useState([]);

  const fetchAnalyticsAndCharts = async () => {
    setLoading(true);
    setError('');
    try {
      const anaRes = await loanAPI.getAdminAnalytics();
      setAnalytics(anaRes.data.analytics);

      const chartRes = await loanAPI.getAdminCharts();
      setChartData(chartRes.data.charts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loanAPI.getConfigs();
      setConfigs(res.data.configs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch loan configuration settings.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDelinquent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loanAPI.getDelinquentReport();
      setDelinquentReport(res.data.delinquentLoans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch delinquent reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 0) {
      fetchAnalyticsAndCharts();
    } else if (activeTab === 1) {
      fetchDelinquent();
    } else if (activeTab === 2) {
      fetchConfigs();
    }
  }, [activeTab]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
    setEditingConfigType('');
  };

  // Edit config handler
  const startEditConfig = (config) => {
    setEditingConfigType(config.loanType);
    setConfigForm({
      loanType: config.loanType,
      interestRate: config.interestRate,
      minTenure: config.minTenure,
      maxTenure: config.maxTenure,
      penaltyRate: config.penaltyRate,
      foreclosureChargePercent: config.foreclosureChargePercent,
      maxAmount: {
        SILVER: config.maxAmount?.SILVER || 500000,
        GOLD: config.maxAmount?.GOLD || 2000000,
        PLATINUM: config.maxAmount?.PLATINUM || 5000000
      },
      eligibilityRules: {
        minMonthlyIncome: config.eligibilityRules?.minMonthlyIncome || 15000,
        minEligibilityScore: config.eligibilityRules?.minEligibilityScore || 50
      }
    });
  };

  const handleConfigFormChange = (section, field, value) => {
    setConfigForm(prev => {
      if (section) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: Number(value)
          }
        };
      } else {
        return {
          ...prev,
          [field]: Number(value)
        };
      }
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await loanAPI.updateConfig(configForm);
      setSuccess(res.data.message || 'Loan parameters updated successfully.');
      setEditingConfigType('');
      fetchConfigs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update loan configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Process data for Recharts Pie
  const pieData = React.useMemo(() => {
    if (!chartData?.distribution) return [];
    return chartData.distribution.map(d => ({
      name: d._id.toUpperCase(),
      value: d.count
    }));
  }, [chartData]);

  return (
    <Box sx={{ color: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.65rem', fontWeight: 800 }}>Loan Analytics & Configuration</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
            System-wide credit analytics, portfolio health matrices, and loan rules configuration.
          </Typography>
        </Box>
        <Button
          startIcon={<Refresh />}
          onClick={() => {
            if (activeTab === 0) fetchAnalyticsAndCharts();
            else if (activeTab === 1) fetchDelinquent();
            else fetchConfigs();
          }}
          variant="outlined"
          sx={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#0ea5e9' } }}
        >
          Refresh Console
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          textColor="inherit"
          variant="standard"
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '& .MuiTabs-indicator': { bgcolor: '#38bdf8', height: 3 },
            '& .MuiTab-root': { py: 2, fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.5px' }
          }}
        >
          <Tab icon={<ShowChart sx={{ mr: 1 }} />} iconPosition="start" label="Analytics Dashboard" />
          <Tab icon={<Warning sx={{ mr: 1 }} />} iconPosition="start" label="Delinquent List" />
          <Tab icon={<Settings sx={{ mr: 1 }} />} iconPosition="start" label="Configurations" />
        </Tabs>

        {/* Tab 0: Analytics Dashboard */}
        {activeTab === 0 && analytics && (
          <Box sx={{ p: 3 }}>
            {/* Portfolios Stat Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {[
                { label: 'Total Applications', value: analytics.totalApplications, color: '#bae6fd', icon: <TrendingUp /> },
                { label: 'Disbursed Principal', value: formatCurrency(analytics.totalDisbursed), color: '#34d399', icon: <CheckCircle /> },
                { label: 'Outstanding Balance', value: formatCurrency(analytics.totalOutstanding), color: '#f87171', icon: <Warning /> },
                { label: 'EMI Collections', value: formatCurrency(analytics.totalEmiCollected), color: '#fb923c', icon: <DoneAll /> },
                { label: 'Missed accounts', value: analytics.totalMissedAccounts, color: '#f472b6', icon: <MoneyOff /> },
                { label: 'Penalties Collected', value: formatCurrency(analytics.totalPenaltiesCollected), color: '#a78bfa', icon: <Gavel /> }
              ].map((card) => (
                <Grid item xs={12} sm={6} md={4} lg={2} key={card.label}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{card.label}</Typography>
                        <Typography sx={{ color: card.color, fontSize: '1.4rem', fontWeight: 800, mt: 0.5 }}>{card.value}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Charts section */}
            {chartData && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography sx={{ fontWeight: 800, mb: 3 }}>Portfolio Distribution</Typography>
                      {pieData.length === 0 ? (
                        <Typography sx={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 8 }}>No portfolio data</Typography>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                                {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                              </Pie>
                              <ReTooltip contentStyle={{ backgroundColor: 'rgba(10,14,39,0.95)', border: '1px solid rgba(255,255,255,0.12)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {pieData.map((d, i) => (
                              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1.5, py: 0.6, borderRadius: '8px', background: `${COLORS[i % COLORS.length]}15`, border: `1px solid ${COLORS[i % COLORS.length]}30` }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>{d.name}: {d.value}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={7}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography sx={{ fontWeight: 800, mb: 3 }}>Collection & Missed EMI Volumes</Typography>
                      {chartData.collectionTrends && chartData.collectionTrends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={chartData.collectionTrends} barSize={16}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" />
                            <YAxis stroke="rgba(255,255,255,0.4)" />
                            <ReTooltip contentStyle={{ backgroundColor: 'rgba(10,14,39,0.95)', border: '1px solid rgba(255,255,255,0.12)' }} />
                            <Bar dataKey="collected" name="EMI Paid" fill="#34d399" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="missed" name="EMI Missed" fill="#f87171" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Typography sx={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 8 }}>No trend data available</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* Tab 1: Delinquent list */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 2 }}>System Delinquency Desk (1+ Missed Payments)</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
                    {['Customer Name', 'CustomerId', 'Loan Number', 'Type', 'EMI Amount', 'Outstanding', 'Missed Cycles', 'Accumulated Penalty'].map((h) => (
                      <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.45)', py: 1.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delinquentReport.map((item) => (
                    <TableRow key={item._id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2 } }}>
                      <TableCell sx={{ fontWeight: 700 }}>{item.userId?.name || 'Customer'}</TableCell>
                      <TableCell>{item.userId?.customerId || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.loanNumber}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{item.loanType}</TableCell>
                      <TableCell>{formatCurrency(item.monthlyEMI)}</TableCell>
                      <TableCell sx={{ color: '#f87171', fontWeight: 700 }}>{formatCurrency(item.outstandingBalance)}</TableCell>
                      <TableCell sx={{ color: '#ef4444', fontWeight: 800 }}>{item.missedEMICount}</TableCell>
                      <TableCell sx={{ color: '#fb923c', fontWeight: 700 }}>{formatCurrency(item.penaltyAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {delinquentReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'rgba(255,255,255,0.35)' }}>
                        All loan accounts are currently clear.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 2: Configurations */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 3 }}>Loan Parameters & Rules</Typography>
            <Grid container spacing={3}>
              {configs.map((config) => {
                const isEditing = editingConfigType === config.loanType;
                return (
                  <Grid item xs={12} md={6} key={config.loanType}>
                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography sx={{ fontWeight: 800, textTransform: 'capitalize', color: '#38bdf8' }}>{config.displayName}</Typography>
                          {!isEditing && (
                            <Button size="small" variant="outlined" onClick={() => startEditConfig(config)} sx={{ color: '#38bdf8', borderColor: '#38bdf8' }}>
                              Edit Rules
                            </Button>
                          )}
                        </Box>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

                        {isEditing ? (
                          <form onSubmit={handleSaveConfig}>
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  inputProps={{ step: 0.1 }}
                                  label="Interest Rate (% p.a.)"
                                  value={configForm.interestRate}
                                  onChange={(e) => handleConfigFormChange(null, 'interestRate', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Late Payment Penalty (% of EMI)"
                                  value={configForm.penaltyRate}
                                  onChange={(e) => handleConfigFormChange(null, 'penaltyRate', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Foreclosure Charge (%)"
                                  value={configForm.foreclosureChargePercent}
                                  onChange={(e) => handleConfigFormChange(null, 'foreclosureChargePercent', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Min Tenure (Months)"
                                  value={configForm.minTenure}
                                  onChange={(e) => handleConfigFormChange(null, 'minTenure', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Max Tenure (Months)"
                                  value={configForm.maxTenure}
                                  onChange={(e) => handleConfigFormChange(null, 'maxTenure', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Min Net Monthly Income (₹)"
                                  value={configForm.eligibilityRules.minMonthlyIncome}
                                  onChange={(e) => handleConfigFormChange('eligibilityRules', 'minMonthlyIncome', e.target.value)}
                                  sx={whiteFieldSx}
                                  required
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', mb: 1 }}>Maximum Loan Limits per Classification</Typography>
                                <Grid container spacing={1}>
                                  {['SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
                                    <Grid item xs={4} key={tier}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        type="number"
                                        label={`${tier} Limit`}
                                        value={configForm.maxAmount[tier]}
                                        onChange={(e) => handleConfigFormChange('maxAmount', tier, e.target.value)}
                                        sx={whiteFieldSx}
                                        required
                                      />
                                    </Grid>
                                  ))}
                                </Grid>
                              </Grid>
                              <Grid item xs={12} sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                                <Button type="submit" size="small" variant="contained" sx={{ bgcolor: '#38bdf8', color: '#000', fontWeight: 700 }}>
                                  Save Configuration
                                </Button>
                                <Button size="small" onClick={() => setEditingConfigType('')} sx={{ color: '#fff' }}>
                                  Cancel
                                </Button>
                              </Grid>
                            </Grid>
                          </form>
                        ) : (
                          <Grid container spacing={2}>
                            {[
                              { label: 'Interest Rate', val: `${config.interestRate}% p.a.` },
                              { label: 'Late Penalty Rule', val: `${config.penaltyRate}% of EMI` },
                              { label: 'Foreclosure Fee', val: `${config.foreclosureChargePercent}% of Principal` },
                              { label: 'Tenure Range', val: `${config.minTenure} - ${config.maxTenure} Months` },
                              { label: 'Min Income Required', val: formatCurrency(config.eligibilityRules?.minMonthlyIncome) },
                              { label: 'Min Eligibility Score', val: `${config.eligibilityRules?.minEligibilityScore || 50}/100` },
                            ].map((item) => (
                              <Grid item xs={6} key={item.label}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{item.label}</Typography>
                                <Typography sx={{ fontWeight: 700 }}>{item.val}</Typography>
                              </Grid>
                            ))}
                            <Grid item xs={12}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', mb: 0.5 }}>Sanction Limits</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {['SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
                                  <Chip
                                    key={tier}
                                    size="small"
                                    label={`${tier}: ${formatCurrency(config.maxAmount?.[tier] || 0)}`}
                                    variant="outlined"
                                    sx={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', fontWeight: 700, fontSize: '0.68rem' }}
                                  />
                                ))}
                              </Box>
                            </Grid>
                          </Grid>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LoanAnalytics;
