import React, { useEffect } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Alert, Box, Button, CircularProgress, Divider, IconButton, InputAdornment,
  TextField, Typography,
} from '@mui/material';
import {
  Bolt, Email, Insights, Lock, Security, SupportAgent, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { loginUser, clearError } from '../../redux/slices/authSlice';
import { getDashboardPath } from '../../utils/authRoutes';
import PayNestLogo from '../../components/common/PayNestLogo';

const inputStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#0f172a',
    borderRadius: '15px',
    background: '#fff',
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
    transition: 'box-shadow .22s ease, transform .22s ease',
    '& fieldset': { borderColor: '#d7dfec', borderWidth: 1.5 },
    '&:hover fieldset': { borderColor: '#8bb5ff' },
    '&.Mui-focused': {
      boxShadow: '0 0 0 4px rgba(37,99,235,0.12), 0 14px 30px rgba(15,23,42,0.08)',
    },
    '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 2 },
  },
  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 700 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
  '& .MuiFormHelperText-root': { color: '#dc2626', fontWeight: 600, ml: 0.5 },
  '& .MuiInputBase-input': { fontWeight: 700 },
};

const featureCards = [
  { title: 'Bank-grade Security', icon: <Security />, color: '#2563eb', bg: 'rgba(37,99,235,0.18)' },
  { title: 'Instant Transfers', icon: <Bolt />, color: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
  { title: 'Smart Analytics', icon: <Insights />, color: '#a855f7', bg: 'rgba(168,85,247,0.18)' },
  { title: '24/7 Access', icon: <SupportAgent />, color: '#ec4899', bg: 'rgba(236,72,153,0.18)' },
];

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
        background: 'linear-gradient(135deg, #041126 0%, #071d42 46%, #0b2a5f 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(120deg, rgba(37,99,235,0.16), transparent 34%, rgba(14,165,233,0.12))',
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { md: 6, lg: 9 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 540,
            p: { md: 4, lg: 5 },
            borderRadius: '24px',
            background: 'linear-gradient(145deg, rgba(15,35,76,0.66), rgba(8,22,49,0.42))',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 28px 80px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <PayNestLogo size="large" />
          </Box>
          <Typography
            sx={{
              mt: 4,
              color: '#f8fafc',
              fontSize: { md: '1.55rem', lg: '1.85rem' },
              fontWeight: 900,
              letterSpacing: 0,
              textAlign: 'center',
              lineHeight: 1.18,
            }}
          >
            Secure digital banking, designed for clarity.
          </Typography>
          <Typography
            sx={{
              mt: 1.6,
              color: 'rgba(226,232,240,0.78)',
              fontSize: '1rem',
              textAlign: 'center',
              maxWidth: 430,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Secure digital banking at your fingertips. Manage accounts, track transactions, and transfer funds with enterprise-grade security.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.4, mt: 4 }}>
            {featureCards.map((feature) => (
              <Box
                key={feature.title}
                sx={{
                  p: 1.6,
                  borderRadius: '18px',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  transition: 'transform .22s ease, background .22s ease, border-color .22s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderColor: 'rgba(255,255,255,0.22)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    bgcolor: feature.bg,
                    color: feature.color,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {React.cloneElement(feature.icon, { fontSize: 'small' })}
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 850, fontSize: '.88rem', lineHeight: 1.25 }}>
                  {feature.title}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ width: '1px', background: 'rgba(255,255,255,0.12)', display: { xs: 'none', md: 'block' }, zIndex: 1 }} />

      <Box
        sx={{
          flex: { xs: 1, md: '0 0 520px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
          py: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 430 }}>
          <Box sx={{ display: { md: 'none' }, mb: 3, textAlign: 'center' }}>
            <PayNestLogo size="medium" />
          </Box>

          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.94)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: '24px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
              backdropFilter: 'blur(18px)',
              p: { xs: 2.4, sm: 3.4 },
            }}
          >
            <Typography
              variant="h4"
              sx={{
                color: '#071735',
                fontWeight: 900,
                mb: 1,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 0,
              }}
            >
              Welcome back
            </Typography>
            <Typography sx={{ color: '#64748b', mb: 3.2, fontSize: '0.95rem', fontWeight: 600 }}>
              Sign in to your Adnate PayNest account
            </Typography>

            {successMsg && (
              <Alert
                severity="success"
                sx={{
                  mb: 2.5,
                  borderRadius: '14px',
                  background: '#ecfdf5',
                  color: '#166534',
                  border: '1px solid #bbf7d0',
                  '& .MuiAlert-icon': { color: '#16a34a' },
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
                  mb: 2.5,
                  borderRadius: '14px',
                  background: '#fff1f2',
                  color: '#be123c',
                  border: '1px solid #fecdd3',
                  '& .MuiAlert-icon': { color: '#f43f5e' },
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
                      <Email sx={{ color: '#2563eb' }} />
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
                sx={{ ...inputStyle, mt: 2.4 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: '#2563eb' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: '#64748b', '&:focus-visible': { outline: '3px solid rgba(37,99,235,0.35)' } }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.55 }}>
                <Button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  sx={{
                    color: '#2563eb',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    position: 'relative',
                    '&:after': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: -2,
                      height: 2,
                      bgcolor: '#2563eb',
                      transform: 'scaleX(0)',
                      transformOrigin: 'right',
                      transition: 'transform .22s ease',
                    },
                    '&:hover': { background: 'transparent' },
                    '&:hover:after': { transform: 'scaleX(1)', transformOrigin: 'left' },
                    '&:focus-visible': { outline: '3px solid rgba(37,99,235,0.3)', borderRadius: '6px' },
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
                startIcon={!loading ? <Lock fontSize="small" /> : null}
                sx={{
                  mt: 2.2,
                  py: 1.65,
                  fontSize: '1rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #10b981 0%, #166534 100%)',
                  color: '#fff',
                  borderRadius: '15px',
                  textTransform: 'none',
                  boxShadow: '0 14px 34px rgba(22,101,52,0.28)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #34d399 0%, #15803d 100%)',
                    boxShadow: '0 18px 44px rgba(22,101,52,0.38)',
                    transform: 'translateY(-2px)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(22,101,52,0.55))',
                    color: 'rgba(255,255,255,0.78)',
                  },
                  '&:focus-visible': { outline: '3px solid rgba(16,185,129,0.36)', outlineOffset: 3 },
                  transition: 'all .22s ease',
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Sign In'}
              </Button>

              <Divider sx={{ my: 3, borderColor: '#e2e8f0', '&::before,&::after': { borderColor: '#e2e8f0' } }}>
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', px: 1, fontWeight: 700 }}>
                  New to Adnate PayNest?
                </Typography>
              </Divider>

              <Button
                component={RouterLink}
                to="/signup"
                fullWidth
                variant="contained"
                sx={{
                  py: 1.5,
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #fb7185 0%, #f97373 100%)',
                  borderRadius: '15px',
                  textTransform: 'none',
                  boxShadow: '0 12px 30px rgba(251,113,133,0.26)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #fda4af 0%, #fb7185 100%)',
                    boxShadow: '0 16px 38px rgba(251,113,133,0.34)',
                    transform: 'translateY(-2px)',
                  },
                  '&:focus-visible': { outline: '3px solid rgba(251,113,133,0.34)', outlineOffset: 3 },
                  transition: 'all .22s ease',
                }}
              >
                Create an Account
              </Button>
            </Box>
          </Box>

          <Typography sx={{ mt: 3, color: 'rgba(226,232,240,0.62)', fontSize: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
            Protected by 256-bit SSL encryption · Adnate PayNest © 2025
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
