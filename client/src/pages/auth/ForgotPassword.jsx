import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Email, ArrowBack, MarkEmailRead } from '@mui/icons-material';
import { authAPI } from '../../services/api';
import PayNestLogo from '../../components/common/PayNestLogo';

const schema = yup.object({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
});

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    setEmailSent(false);

    try {
      await authAPI.forgotPassword(data);
      setSentToEmail(data.email);
      setEmailSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1333 100%)',
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <PayNestLogo size="medium" />
        </Box>

        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
          Reset password
        </Typography>

        {emailSent ? (
          <>
            <Alert
              icon={<MarkEmailRead fontSize="inherit" />}
              severity="success"
              sx={{
                mb: 3,
                background: 'rgba(34,197,94,0.15)',
                color: '#86efac',
                border: '1px solid rgba(34,197,94,0.35)',
                '& .MuiAlert-icon': { color: '#4ade80' },
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Email has been sent</Typography>
              <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                We sent a secure password reset link to <strong>{maskEmail(sentToEmail)}</strong>.
                Check your inbox and spam folder, then click the link to reset your password.
              </Typography>
            </Alert>

            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                py: 1.8,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#0a0e27',
                borderRadius: '12px',
                textTransform: 'none',
              }}
            >
              Go to Sign In
            </Button>
            <Button
              type="button"
              onClick={() => navigate('/login')}
              startIcon={<ArrowBack />}
              sx={{ mt: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}
            >
              Back to Sign In
            </Button>
          </>
        ) : (
          <>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, fontSize: '0.95rem' }}>
              Enter your registered email. We will email you a secure link to reset your password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                {...register('email')}
                label="Email Address"
                type="email"
                fullWidth
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={inputStyle}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: 'rgba(255,255,255,0.4)' }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  py: 1.8,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0a0e27',
                  borderRadius: '12px',
                  textTransform: 'none',
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#0a0e27' }} /> : 'Send Email'}
              </Button>
            </Box>

            <Button
              type="button"
              onClick={() => navigate('/login')}
              startIcon={<ArrowBack />}
              sx={{ mt: 3, color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}
            >
              Back to Sign In
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

const inputStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  '& .MuiFormHelperText-root': { color: '#f87171' },
};

export default ForgotPassword;
