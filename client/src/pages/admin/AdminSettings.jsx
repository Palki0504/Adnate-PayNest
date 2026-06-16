import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Button, TextField,
  Switch, Alert, CircularProgress, Divider, Chip,
} from '@mui/material';
import { Settings, Save, RestoreFromTrash } from '@mui/icons-material';
import { adminAPI } from '../../services/api';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff', borderRadius: '12px', background: 'rgba(255,255,255,0.05)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(56,189,248,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#38bdf8' },
  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' },
};

const ToggleSetting = ({ label, desc, value, onChange }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
    <Box sx={{ flex: 1, mr: 2 }}>
      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{label}</Typography>
      {desc && <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', mt: 0.3 }}>{desc}</Typography>}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip label={value ? 'ON' : 'OFF'} size="small" sx={{ bgcolor: value ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: value ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.68rem', minWidth: 44 }} />
      <Switch
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#22c55e' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#22c55e' } }}
      />
    </Box>
  </Box>
);

const AdminSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSettings();
      setSettings(res.data.settings);
    } catch (err) {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await adminAPI.updateSettings(settings);
      setSettings(res.data.settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress sx={{ color: '#38bdf8' }} /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: { md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings sx={{ color: '#38bdf8', fontSize: '1.5rem' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700 }}>System Settings</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Configure global system behaviour and policies</Typography>
          </Box>
        </Box>
        <Button
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff', '&:disabled': { opacity: 0.6 } }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* General */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', height: '100%' }}>
            <CardContent sx={{ p: 3.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 3 }}>General</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Bank / App Name" value={settings?.bankName || ''} onChange={(e) => handleChange('bankName', e.target.value)} sx={inputSx} InputLabelProps={{ shrink: true }} helperText="Displayed across the application" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Support Email" type="email" value={settings?.supportEmail || ''} onChange={(e) => handleChange('supportEmail', e.target.value)} sx={inputSx} InputLabelProps={{ shrink: true }} helperText="Used in customer notifications" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Session Timeout (Minutes)" type="number" value={settings?.sessionTimeoutMinutes ?? 60} onChange={(e) => handleChange('sessionTimeoutMinutes', parseInt(e.target.value))} sx={inputSx} InputLabelProps={{ shrink: true }} inputProps={{ min: 5, max: 1440 }} helperText="Auto-logout after inactivity" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Transfer Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', height: '100%' }}>
            <CardContent sx={{ p: 3.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 3 }}>Transfer & Approval</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Manager Approval Threshold (₹)" type="number" value={settings?.maxTransferApprovalThreshold ?? 50000} onChange={(e) => handleChange('maxTransferApprovalThreshold', parseFloat(e.target.value))} sx={inputSx} InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: 1000 }} helperText="Transfers above this require manager approval" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Toggles */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 3 }}>Feature Toggles</Typography>
              <ToggleSetting label="Maintenance Mode" desc="When ON, only admins can access the system" value={settings?.maintenanceMode} onChange={(v) => handleChange('maintenanceMode', v)} />
              <ToggleSetting label="Overdraft Feature" desc="Allow customers to use overdraft on their accounts" value={settings?.overdraftEnabled} onChange={(v) => handleChange('overdraftEnabled', v)} />
              <ToggleSetting label="KYC Required for Transfer" desc="Require KYC completion before allowing fund transfers" value={settings?.requireKycForTransfer} onChange={(v) => handleChange('requireKycForTransfer', v)} />
              <ToggleSetting label="Allow Self Registration" desc="Allow new customers to register without admin invite" value={settings?.allowSelfRegistration} onChange={(v) => handleChange('allowSelfRegistration', v)} />
            </CardContent>
          </Card>
        </Grid>

        {/* OD Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 3 }}>Overdraft Policy</Typography>
              <TextField fullWidth label="Max Overdraft Uses Per Month" type="number" value={settings?.maxODPerMonth ?? 3} onChange={(e) => handleChange('maxODPerMonth', parseInt(e.target.value))} sx={{ ...inputSx, mb: 2 }} InputLabelProps={{ shrink: true }} inputProps={{ min: 0, max: 30 }} helperText="After this many overdraft uses per month, further overdrafts are blocked" />
              <Box sx={{ p: 2.5, borderRadius: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Typography sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem', mb: 1.5 }}>Current OD Limits by Classification</Typography>
                {[{ tier: 'Silver', limit: '₹25,000', color: '#94a3b8' }, { tier: 'Gold', limit: '₹75,000', color: '#f59e0b' }, { tier: 'Platinum', limit: '₹1,00,000', color: '#a855f7' }].map((t) => (
                  <Box key={t.tier} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{t.tier}</Typography>
                    <Typography sx={{ color: t.color, fontWeight: 700, fontSize: '0.82rem' }}>{t.limit}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Footer */}
      <Box sx={{ mt: 4, p: 3, borderRadius: '16px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>Save your changes</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Changes take effect immediately after saving</Typography>
        </Box>
        <Button
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 4, py: 1.2, background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default AdminSettings;
