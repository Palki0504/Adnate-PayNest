import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Chip, Divider,
  CircularProgress, TextField, Button, InputAdornment, IconButton, Alert,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, CheckCircle, Cancel } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { userAPI } from '../../services/api';

// ─── Password text field styling (dark theme) ─────────────────────────────────
const passwordFieldSx = {
  '--mui-field-label-bg': '#121731',
  '& .MuiInputBase-input': {
    color: '#fff',
    WebkitTextFillColor: '#fff',
    lineHeight: 1.45,
    paddingTop: '16.5px',
    paddingBottom: '16.5px',
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'rgba(255,255,255,0.42)',
    opacity: 1,
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.62)',
    backgroundColor: 'var(--mui-field-label-bg)',
    px: 0.75,
    zIndex: 2,
    overflow: 'visible',
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
  '& .MuiOutlinedInput-root': {
    minHeight: 58,
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.035)',
    overflow: 'visible',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
};

// ─── Validation rules ──────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { key: 'minLength', label: 'Minimum 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'uppercase', label: 'At least one uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lowercase', label: 'At least one lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'At least one numeric digit', test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'At least one special character', test: (pw) => /[@$!%*?&^#()_+\-=[\]{}|;:'",.<>?/\\`~]/.test(pw) },
];

const ManagerProfile = () => {
  const { user } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Change Password state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwMessage, setChangePwMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await userAPI.getProfile();
        setProfile(res.data?.user || res.data);
      } catch (_) {
        setProfile(user);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  // ─── Real-time validation ──────────────────────────────────────────────────
  const validationResults = useMemo(() => {
    const results = {};
    PASSWORD_RULES.forEach((rule) => {
      results[rule.key] = newPassword.length > 0 ? rule.test(newPassword) : null;
    });
    results.match = confirmPassword.length > 0 ? newPassword === confirmPassword : null;
    return results;
  }, [newPassword, confirmPassword]);

  const allValid = useMemo(() => {
    return (
      PASSWORD_RULES.every((rule) => validationResults[rule.key] === true) &&
      validationResults.match === true &&
      currentPassword.length > 0
    );
  }, [validationResults, currentPassword]);

  // ─── Submit handler ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!allValid) return;
    setChangePwLoading(true);
    setChangePwMessage({ type: '', text: '' });
    try {
      await userAPI.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      });
      setChangePwMessage({ type: 'success', text: 'Password changed successfully! Your new password will be used for future logins.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setChangePwMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to change password. Please try again.',
      });
    } finally {
      setChangePwLoading(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: '#f59e0b' }} /></Box>;

  const data = profile || user;
  const fields = [
    { label: 'Manager ID', value: data?.adminId || data?.managerId || '—' },
    { label: 'Full Name', value: data?.name || '—' },
    { label: 'Email', value: data?.email || '—' },
    { label: 'Phone', value: data?.phone || '—' },
    { label: 'Designation', value: data?.designation || '—' },
    { label: 'Role', value: 'Manager' },
    { label: 'Status', value: data?.isActive ? 'Active' : 'Inactive' },
    { label: 'Joined', value: data?.createdAt ? new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
  ];

  // ─── Render validation indicator ───────────────────────────────────────────
  const ValidationItem = ({ passed, label }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      {passed === null ? (
        <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }} />
      ) : passed ? (
        <CheckCircle sx={{ fontSize: 18, color: '#22c55e' }} />
      ) : (
        <Cancel sx={{ fontSize: 18, color: '#ef4444' }} />
      )}
      <Typography
        sx={{
          fontSize: '0.8rem',
          color: passed === null ? 'rgba(255,255,255,0.4)' : passed ? '#22c55e' : '#ef4444',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>My Profile</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>Your manager account information</Typography>

      {/* ── Profile Information Card ──────────────────────────────────────────── */}
      <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4, p: 3, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Avatar sx={{ width: 72, height: 72, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0e27', fontWeight: 800, fontSize: '1.8rem' }}>
              {data?.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>{data?.name}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>{data?.email}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label="MANAGER" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem' }} />
                <Chip label={data?.isActive ? 'ACTIVE' : 'INACTIVE'} size="small" sx={{ bgcolor: data?.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: data?.isActive ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.7rem' }} />
              </Box>
            </Box>
          </Box>

          <Grid container spacing={2}>
            {fields.map((f) => (
              <Grid item xs={12} sm={6} key={f.label}>
                <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{f.label}</Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>{f.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* ── Change Password Card ─────────────────────────────────────────────── */}
      <Card
        sx={{
          mt: 4,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Section Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))',
                border: '1px solid rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Lock sx={{ color: '#f59e0b', fontSize: '1.3rem' }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Change Password</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Update your login credentials securely</Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3 }} />

          {/* Alert Messages */}
          {changePwMessage.text && (
            <Alert
              severity={changePwMessage.type}
              onClose={() => setChangePwMessage({ type: '', text: '' })}
              sx={{
                mb: 3,
                borderRadius: '12px',
                backgroundColor: changePwMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: changePwMessage.type === 'success' ? '#22c55e' : '#ef4444',
                border: `1px solid ${changePwMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                '& .MuiAlert-icon': { color: changePwMessage.type === 'success' ? '#22c55e' : '#ef4444' },
                '& .MuiAlert-action .MuiIconButton-root': { color: 'rgba(255,255,255,0.5)' },
              }}
            >
              {changePwMessage.text}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Left column — form fields */}
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Current Password */}
                <TextField
                  id="manager-current-password"
                  fullWidth
                  label="Current Password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  sx={passwordFieldSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrent(!showCurrent)}
                          edge="end"
                          sx={{ color: 'rgba(255,255,255,0.4)' }}
                        >
                          {showCurrent ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* New Password */}
                <TextField
                  id="manager-new-password"
                  fullWidth
                  label="New Password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  sx={passwordFieldSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNew(!showNew)}
                          edge="end"
                          sx={{ color: 'rgba(255,255,255,0.4)' }}
                        >
                          {showNew ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Confirm New Password */}
                <TextField
                  id="manager-confirm-password"
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={passwordFieldSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirm(!showConfirm)}
                          edge="end"
                          sx={{ color: 'rgba(255,255,255,0.4)' }}
                        >
                          {showConfirm ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Submit Button */}
                <Button
                  id="manager-change-password-btn"
                  variant="contained"
                  onClick={handleChangePassword}
                  disabled={!allValid || changePwLoading}
                  sx={{
                    mt: 1,
                    py: 1.5,
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    background: allValid
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'rgba(255,255,255,0.08)',
                    color: allValid ? '#0a0e27' : 'rgba(255,255,255,0.3)',
                    boxShadow: allValid ? '0 4px 16px rgba(245,158,11,0.3)' : 'none',
                    '&:hover': {
                      background: allValid
                        ? 'linear-gradient(135deg, #d97706, #b45309)'
                        : 'rgba(255,255,255,0.08)',
                    },
                    '&.Mui-disabled': {
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.25)',
                    },
                  }}
                >
                  {changePwLoading ? (
                    <CircularProgress size={22} sx={{ color: '#0a0e27' }} />
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </Box>
            </Grid>

            {/* Right column — validation checklist */}
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  height: '100%',
                }}
              >
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    mb: 2,
                  }}
                >
                  Password Requirements
                </Typography>

                {PASSWORD_RULES.map((rule) => (
                  <ValidationItem
                    key={rule.key}
                    passed={validationResults[rule.key]}
                    label={rule.label}
                  />
                ))}

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />

                <ValidationItem
                  passed={validationResults.match}
                  label="Passwords match"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ManagerProfile;
