import React, { useEffect } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Divider,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { loginUser, clearError } from '../../redux/slices/authSlice';
import { getDashboardPath } from '../../utils/authRoutes';
import PayNestLogo from '../../components/common/PayNestLogo';

// Custom styling for MUI TextField components used in the login form
const inputStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(10px)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  '& .MuiFormHelperText-root': { color: '#f87171' },
};

const schema = yup.object({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
  password: yup.string().required('Password is required'),
});

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const location = useLocation();
  const [successMsg, setSuccessMsg] = React.useState(location.state?.message || '');
  const [showPassword, setShowPassword] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    dispatch(clearError());
    if (location.state?.message) {
      window.history.replaceState({}, document.title);
    }
    const token = localStorage.getItem('paynest_token');
    const stored = localStorage.getItem('paynest_user');
    if (token && stored) {
      try {
        const u = JSON.parse(stored);
        navigate(getDashboardPath(u.role || 'customer'), { replace: true });
      } catch {
        /* ignore invalid stored user */
      }
    }
  }, [dispatch, navigate, location]);

  const onSubmit = async (data) => {
    try {
      const result = await dispatch(loginUser(data)).unwrap();
      if (result.user?.isTempPassword) {
        navigate('/change-temp-password', { replace: true });
      } else {
        navigate(getDashboardPath(result.user?.role || 'customer'), { replace: true });
      }
    } catch {
      // error shown via redux
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1333 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <Box sx={{
        position: 'absolute', top: '-20%', left: '-10%', zIndex: 0, pointerEvents: 'none',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <Box sx={{
        position: 'absolute', bottom: '-20%', right: '-10%', zIndex: 0, pointerEvents: 'none',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        animation: 'float 10s ease-in-out infinite reverse',
      }} />

      {/* Left panel - branding */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: 8,
          position: 'relative',
        }}
      >
        <PayNestLogo size="large" />
        <Typography
          sx={{
            mt: 4, color: 'rgba(255,255,255,0.7)', fontSize: '1.15rem',
            textAlign: 'center', maxWidth: 380, lineHeight: 1.8,
          }}
        >
          Secure digital banking at your fingertips. Manage accounts, track transactions, and transfer funds with enterprise-grade security.
        </Typography>

        {/* Feature chips */}
        {['🔒 Bank-grade Security', '⚡ Instant Transfers', '📊 Smart Analytics', '🌐 24/7 Access'].map((f) => (
          <Box
            key={f}
            sx={{
              mt: 2,
              px: 3, py: 1,
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50px',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.9rem',
            }}
          >
            {f}
          </Box>
        ))}
      </Box>

      {/* Divider */}
      <Box sx={{ width: '1px', background: 'rgba(255,255,255,0.08)', display: { xs: 'none', md: 'block' } }} />

      {/* Right panel - login form */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
          py: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { md: 'none' }, mb: 4, textAlign: 'center' }}>
            <PayNestLogo size="medium" />
          </Box>

          <Typography
            variant="h4"
            sx={{
              color: '#fff',
              fontWeight: 700,
              mb: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Welcome back
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, fontSize: '0.95rem' }}>
            Sign in to your Adnate PayNest account
          </Typography>

          {successMsg && (
            <Alert
              severity="success"
              sx={{
                mb: 3,
                background: 'rgba(34,197,94,0.15)',
                color: '#86efac',
                border: '1px solid rgba(34,197,94,0.35)',
                '& .MuiAlert-icon': { color: '#4ade80' },
              }}
              onClose={() => setSuccessMsg('')}
            >
              {successMsg}
            </Alert>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                background: 'rgba(239,68,68,0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.3)',
                '& .MuiAlert-icon': { color: '#f87171' },
              }}
              onClose={() => dispatch(clearError())}
            >
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

            <TextField
              {...register('password')}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{ ...inputStyle, mt: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'rgba(255,255,255,0.4)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
              <Button
                type="button"
                onClick={() => navigate('/forgot-password')}
                sx={{
                  color: '#f59e0b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  p: 0,
                  minWidth: 'auto',
                  '&:hover': { background: 'transparent', textDecoration: 'underline' },
                }}
              >
                Forgot password?
              </Button>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 2,
                py: 1.8,
                fontSize: '1rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#0a0e27',
                borderRadius: '12px',
                textTransform: 'none',
                boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  boxShadow: '0 12px 40px rgba(245,158,11,0.5)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': { background: 'rgba(245,158,11,0.4)', color: 'rgba(0,0,0,0.5)' },
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#0a0e27' }} /> : 'Sign In'}
            </Button>

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.12)', '&::before,&::after': { borderColor: 'rgba(255,255,255,0.12)' } }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', px: 1 }}>
                New to Adnate PayNest?
              </Typography>
            </Divider>

            <Button
              component={RouterLink}
              to="/signup"
              fullWidth
              variant="outlined"
              sx={{
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#f59e0b',
                borderColor: 'rgba(245,158,11,0.4)',
                borderRadius: '12px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#f59e0b',
                  background: 'rgba(245,158,11,0.08)',
                },
              }}
            >
              Create an Account
            </Button>
          </Box>

          <Typography sx={{ mt: 4, color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', textAlign: 'center' }}>
            🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
          </Typography>
        </Box>
      </Box>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
      `}</style>
    </Box>
  );
};



export default Login;
