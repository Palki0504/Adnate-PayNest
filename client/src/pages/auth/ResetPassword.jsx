import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Card, Grid
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, ArrowBack, CheckCircle } from '@mui/icons-material';
import { authAPI } from '../../services/api';
import PayNestLogo from '../../components/common/PayNestLogo';

// Validation schema
const schema = yup.object({
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  confirmPassword: yup
    .string()
    .required('Confirm password is required')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  const passwordVal = watch('password') || '';

  const hasMinLength = passwordVal.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordVal);
  const hasNumber = /\d/.test(passwordVal);
  const hasSpecial = /[@$!%*?&]/.test(passwordVal);

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    try {
      await authAPI.resetPassword(token, {
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      setSuccess(true);
      // Redirect to login after 2.5 seconds
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successful. Please login with your new password.' },
          replace: true,
        });
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f6fa',
          px: 2,
          py: 4,
        }}
      >
        <Card
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 460,
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            p: { xs: 3, sm: 4.5 },
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <PayNestLogo size="medium" color="transparent" />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
            <Box
              sx={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'rgba(34,197,94,0.1)',
                border: '2px solid rgba(34,197,94,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <CheckCircle sx={{ color: '#22c55e', fontSize: 38 }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                color: '#0f172a',
                fontWeight: 800,
                textAlign: 'center',
                mb: 1.5,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              Password Reset Successful!
            </Typography>
            <Typography sx={{ color: '#64748b', textAlign: 'center', mb: 3.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
              Your password has been updated successfully. Redirecting you to the Sign In page...
            </Typography>
            <CircularProgress size={24} sx={{ color: '#0f47a1' }} />
          </Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f6fa',
        px: 2,
        py: 4,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
          p: { xs: 3, sm: 4.5 },
        }}
      >
        {/* Header Logo */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <PayNestLogo size="medium" color="transparent" />
        </Box>

        {/* Bank Name */}
        <Typography
          sx={{
            color: '#0f172a',
            fontWeight: 700,
            textAlign: 'center',
            mb: 2.5,
            fontSize: '0.85rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#64748b',
          }}
        >
          Adnate PayNest Bank
        </Typography>

        {/* Lock Icon */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 58,
            height: 58,
            borderRadius: '50%',
            backgroundColor: '#e3f2fd',
            border: '1.5px solid #90caf9',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <Lock sx={{ color: '#1976d2', fontSize: 28 }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            color: '#0f172a',
            fontWeight: 800,
            textAlign: 'center',
            mb: 1.5,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '-0.02em',
          }}
        >
          Reset Your Password
        </Typography>

        <Typography sx={{ color: '#64748b', textAlign: 'center', mb: 3.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
          Please enter your new password below. Ensure it is strong and unique to keep your account secure.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              background: 'rgba(239,68,68,0.08)',
              color: '#b91c1c',
              border: '1px solid rgba(239,68,68,0.2)',
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>

          <Typography sx={{ color: '#1e293b', fontWeight: 600, fontSize: '0.85rem', mb: 1, textAlign: 'left' }}>
            New Password
          </Typography>
          <TextField
            {...register('password')}
            placeholder="Enter new password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            sx={lightInputStyle}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#94a3b8' }}>
                    {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Password Validation Checklist */}
          <Grid container spacing={1} sx={{ mt: 1.5, mb: 2.5, px: 0.5 }}>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasMinLength ? '#22c55e' : '#cbd5e1', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasMinLength ? '#1e293b' : '#64748b', fontWeight: 500 }}>
                  At least 8 characters
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasNumber ? '#22c55e' : '#cbd5e1', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasNumber ? '#1e293b' : '#64748b', fontWeight: 500 }}>
                  At least one number
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasUppercase ? '#22c55e' : '#cbd5e1', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasUppercase ? '#1e293b' : '#64748b', fontWeight: 500 }}>
                  At least one uppercase letter
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasSpecial ? '#22c55e' : '#cbd5e1', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasSpecial ? '#1e293b' : '#64748b', fontWeight: 500 }}>
                  At least one special character
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography sx={{ color: '#1e293b', fontWeight: 600, fontSize: '0.85rem', mb: 1, mt: 2, textAlign: 'left' }}>
            Confirm New Password
          </Typography>
          <TextField
            {...register('confirmPassword')}
            placeholder="Confirm new password"
            type={showConfirmPassword ? 'text' : 'password'}
            fullWidth
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            sx={lightInputStyle}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: '#94a3b8' }}>
                    {showConfirmPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                  </IconButton>
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
              mt: 3.5,
              py: 1.6,
              fontSize: '0.95rem',
              fontWeight: 700,
              background: '#0a2e5c',
              color: '#ffffff',
              borderRadius: '10px',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                background: '#071f40',
                boxShadow: 'none',
              },
              '&:disabled': { background: '#94a3b8', color: '#cbd5e1' },
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'Reset Password'}
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <Button
            type="button"
            onClick={() => navigate('/login')}
            startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
            sx={{
              color: '#1e88e5',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9rem',
              '&:hover': { background: 'transparent', textDecoration: 'underline' },
            }}
          >
            Back to Login
          </Button>
        </Box>
      </Card>
    </Box>
  );
};

const lightInputStyle = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    color: '#0f172a',
    borderRadius: '10px',
    background: '#ffffff',
    '& fieldset': { borderColor: '#e2e8f0' },
    '&:hover fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: '#0f47a1', borderWidth: '1.5px' },
  },
  '& .MuiInputBase-input': {
    padding: '14px 16px',
    fontSize: '0.95rem',
  },
  '& .MuiFormHelperText-root': { color: '#ef4444', marginLeft: 0 },
};

export default ResetPassword;
