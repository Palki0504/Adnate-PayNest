import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Card, Grid
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material';
import { activateUserAccount } from '../../redux/slices/authSlice';
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

const ChangeTempPassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

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
  const hasLowercase = /[a-z]/.test(passwordVal);
  const hasNumber = /\d/.test(passwordVal);
  const hasSpecial = /[@$!%*?&]/.test(passwordVal);

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    try {
      const resultAction = await dispatch(
        activateUserAccount({
          password: data.password,
          confirmPassword: data.confirmPassword,
        })
      );
      if (activateUserAccount.fulfilled.match(resultAction)) {
        navigate('/login', {
          replace: true,
          state: {
            message: 'Account activated successfully. Sign in with your new password.',
          },
        });
      } else {
        setError(resultAction.payload || 'Account activation failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onInvalidSubmit = () => {
    setError('Please complete all password requirements and make sure both passwords match.');
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
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 100%)',
          px: 2,
          py: 4,
        }}
      >
        <Card
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 460,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            p: { xs: 3, sm: 4.5 },
            textAlign: 'center',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <PayNestLogo size="medium" />
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
                color: '#ffffff',
                fontWeight: 800,
                mb: 1.5,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              Account Activated!
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 3.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
              Customer {user?.name || ''} has completed first-time login and account activation.
            </Typography>
            <CircularProgress size={24} sx={{ color: '#f59e0b' }} />
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
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 100%)',
        px: 2,
        py: 4,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          p: { xs: 3, sm: 4.5 },
        }}
      >
        {/* Header Logo */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <PayNestLogo size="medium" />
        </Box>

        {/* Bank Name */}
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.5)',
            fontWeight: 700,
            textAlign: 'center',
            mb: 2.5,
            fontSize: '0.85rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
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
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1.5px solid rgba(245, 158, 11, 0.4)',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <Lock sx={{ color: '#f59e0b', fontSize: 28 }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            color: '#ffffff',
            fontWeight: 800,
            textAlign: 'center',
            mb: 1.5,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '-0.02em',
          }}
        >
          First-time Activation
        </Typography>

        <Typography sx={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', mb: 3.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
          Hello {user?.name || ''}, this is your first login. To secure your account, you must change your temporary password before accessing the dashboard.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              background: 'rgba(239,68,68,0.1)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.25)',
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} noValidate>

          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.85rem', mb: 1, textAlign: 'left' }}>
            New Password
          </Typography>
          <TextField
            {...register('password')}
            placeholder="Enter new password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            sx={darkInputStyle}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.4)' }}>
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
                <CheckCircle sx={{ color: hasMinLength ? '#22c55e' : '#64748b', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasMinLength ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  At least 8 characters
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasLowercase ? '#22c55e' : '#64748b', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasLowercase ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  At least one lowercase letter
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasNumber ? '#22c55e' : '#64748b', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasNumber ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  At least one number
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasUppercase ? '#22c55e' : '#64748b', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasUppercase ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  At least one uppercase letter
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircle sx={{ color: hasSpecial ? '#22c55e' : '#64748b', fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.78rem', color: hasSpecial ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  At least one special char
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.85rem', mb: 1, mt: 2, textAlign: 'left' }}>
            Confirm New Password
          </Typography>
          <TextField
            {...register('confirmPassword')}
            placeholder="Confirm new password"
            type={showConfirmPassword ? 'text' : 'password'}
            fullWidth
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            sx={darkInputStyle}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.4)' }}>
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
              background: '#ffffff',
              color: '#0b3b82',
              borderRadius: '10px',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                background: '#eaf2ff',
                color: '#082f6b',
                boxShadow: 'none',
              },
              '&:disabled': { background: 'rgba(255,255,255,0.55)', color: 'rgba(11,59,130,0.55)' },
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#0b3b82' }} /> : 'Activate Account'}
          </Button>
        </Box>
      </Card>
    </Box>
  );
};

const darkInputStyle = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    color: '#ffffff',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b', borderWidth: '1.5px' },
  },
  '& .MuiInputBase-input': {
    padding: '14px 16px',
    fontSize: '0.95rem',
  },
  '& .MuiFormHelperText-root': { color: '#f87171', marginLeft: 0 },
};

export default ChangeTempPassword;
