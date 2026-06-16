import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, MenuItem, Select, FormControl,
  FormHelperText, Grid, InputLabel,
} from '@mui/material';
import {
  Person, Email, Phone, Lock, Visibility, VisibilityOff, HourglassBottom,
} from '@mui/icons-material';
import { registerUser, clearError } from '../../redux/slices/authSlice';
import { getDashboardPath } from '../../utils/authRoutes';
import PayNestLogo from '../../components/common/PayNestLogo';
import RequiredLabel from '../../components/common/RequiredLabel';
import PasswordRules, { isPasswordValid } from '../../components/common/PasswordRules';
import { ACCOUNT_TYPES } from '../../constants/accountTypes';
import { EMAIL_VALIDATION_MESSAGE, isValidEmail, normalizeEmail } from '../../utils/emailValidation';
import { calculateAge, guardianRelationshipOptions, isUnder18 } from '../../utils/ageValidation';

const isSignupReady = (form) => (
  form.name.trim().length >= 2 &&
  isValidEmail(form.email) &&
  /^[0-9+\s\-()]{10,15}$/.test(form.phone.trim()) &&
  !!form.dateOfBirth &&
  calculateAge(form.dateOfBirth) !== null &&
  isPasswordValid(form.password) &&
  form.password === form.confirmPassword &&
  ['savings', 'salary', 'current'].includes(form.accountType) &&
  (
    !isUnder18(form.dateOfBirth) ||
    (
      form.guardianDetails.name.trim().length >= 2 &&
      form.guardianDetails.relationship.trim().length >= 2 &&
      /^\+?[\d\s\-()]{7,15}$/.test(form.guardianDetails.phone.trim()) &&
      calculateAge(form.guardianDetails.dateOfBirth) >= 18
    )
  )
);

const Signup = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    accountType: 'savings',
    dateOfBirth: '',
    guardianDetails: {
      name: '',
      relationship: '',
      phone: '',
      dateOfBirth: '',
    },
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const setField = (key) => (e) => {
    const value = key === 'email' ? normalizeEmail(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const setGuardianField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      guardianDetails: { ...prev.guardianDetails, [key]: value },
    }));
    setFieldErrors((prev) => ({ ...prev, [`guardianDetails.${key}`]: '' }));
  };

  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const liveEmailError =
    fieldErrors.email ||
    (form.email.trim() && !isValidEmail(form.email) ? EMAIL_VALIDATION_MESSAGE : '');

  const validate = () => {
    const errs = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Full name is required (min 2 characters)';
    }
    if (!form.email.trim()) {
      errs.email = 'Email is required';
    } else if (!isValidEmail(form.email)) {
      errs.email = EMAIL_VALIDATION_MESSAGE;
    }
    if (!form.phone.trim() || !/^[0-9+\s\-()]{10,15}$/.test(form.phone.trim())) {
      errs.phone = 'Enter a valid 10–15 digit phone number';
    }
    if (!form.password) {
      errs.password = 'Password is required';
    } else if (!isPasswordValid(form.password)) {
      errs.password = 'Password does not meet all requirements above';
    }
    if (!form.confirmPassword) {
      errs.confirmPassword = 'Please type your password again to confirm';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match — they must be exactly the same';
    }
    if (!['savings', 'salary', 'current'].includes(form.accountType)) {
      errs.accountType = 'Please select an account type';
    }
    if (!form.dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required';
    } else if (calculateAge(form.dateOfBirth) === null) {
      errs.dateOfBirth = 'Enter a valid date of birth';
    }
    if (isUnder18(form.dateOfBirth)) {
      if (!form.guardianDetails.name.trim()) errs['guardianDetails.name'] = 'Guardian name is required';
      if (!form.guardianDetails.relationship.trim()) errs['guardianDetails.relationship'] = 'Guardian relationship is required';
      if (!/^\+?[\d\s\-()]{7,15}$/.test(form.guardianDetails.phone.trim())) errs['guardianDetails.phone'] = 'Enter a valid guardian phone number';
      const guardianAge = calculateAge(form.guardianDetails.dateOfBirth);
      if (guardianAge === null) {
        errs['guardianDetails.dateOfBirth'] = 'Guardian date of birth is required';
      } else if (guardianAge < 18) {
        errs['guardianDetails.dateOfBirth'] = 'Guardian must be 18 years or older';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearError());

    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      email: normalizeEmail(form.email),
      phone: form.phone.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      accountType: form.accountType,
      dateOfBirth: form.dateOfBirth,
      guardianDetails: form.guardianDetails,
    };

    try {
      const result = await dispatch(registerUser(payload)).unwrap();
      if (result?.requiresApproval) {
        setIsSubmitted(true);
      } else {
        navigate(getDashboardPath(result.user?.role || 'customer'), { replace: true });
      }
    } catch {
      // API error shown in Alert
    }
  };

  if (isSubmitted) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1333 100%)',
          py: { xs: 2, sm: 3 },
          px: 2,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 500,
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(24px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            p: { xs: 3, sm: 5 },
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <PayNestLogo size="medium" />
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.1)',
              border: '2px solid #f59e0b',
              color: '#f59e0b',
              mb: 3,
            }}
          >
            <HourglassBottom sx={{ fontSize: 40 }} />
          </Box>

          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
            Awaiting Admin Approval
          </Typography>

          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, lineHeight: 1.6, fontSize: '0.95rem' }}>
            Your registration was submitted successfully. Since Adnate PayNest values security, all new customer and manager accounts must be reviewed and approved by an administrator before logging in.
            <br />
            <br />
            You will receive a confirmation email once your account has been approved.
          </Typography>

          <Button
            component={Link}
            to="/login"
            fullWidth
            sx={{
              py: 1.6,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#0a0e27',
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              }
            }}
          >
            Back to Sign In
          </Button>
        </Box>
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
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1333 100%)',
        py: { xs: 2, sm: 3 },
        px: 2,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 720,
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          p: { xs: 2.5, sm: 4 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <PayNestLogo size="medium" />
        </Box>

        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
          Create Account
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', mb: 3, fontSize: '0.88rem' }}>
          Join Adnate PayNest — secure digital banking
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="off">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label={<RequiredLabel>Full Name</RequiredLabel>}
                value={form.name}
                onChange={setField('name')}
                fullWidth
                error={!!fieldErrors.name}
                helperText={fieldErrors.name}
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={<RequiredLabel>Email Address</RequiredLabel>}
                type="email"
                value={form.email}
                onChange={setField('email')}
                fullWidth
                error={!!liveEmailError}
                helperText={liveEmailError}
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={<RequiredLabel>Phone Number</RequiredLabel>}
                value={form.phone}
                onChange={setField('phone')}
                fullWidth
                error={!!fieldErrors.phone}
                helperText={fieldErrors.phone}
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={<RequiredLabel>Date of Birth</RequiredLabel>}
                type="date"
                value={form.dateOfBirth}
                onChange={setField('dateOfBirth')}
                fullWidth
                error={!!fieldErrors.dateOfBirth}
                helperText={fieldErrors.dateOfBirth}
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label={<RequiredLabel>Password</RequiredLabel>}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={setField('password')}
                fullWidth
                error={!!fieldErrors.password}
                helperText={fieldErrors.password}
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                inputProps={{ autoComplete: 'new-password' }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="button" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <PasswordRules password={form.password} compact />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label={<RequiredLabel>Confirm Password</RequiredLabel>}
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                fullWidth
                error={!!fieldErrors.confirmPassword}
                helperText={
                  fieldErrors.confirmPassword ||
                  (passwordsMatch ? '✓ Passwords match — you can create your account' : 'Type the same password again')
                }
                sx={inputStyle}
                InputLabelProps={{ shrink: true }}
                inputProps={{ autoComplete: 'new-password' }}
                FormHelperTextProps={{
                  sx: {
                    color: passwordsMatch && !fieldErrors.confirmPassword ? '#86efac !important' : undefined,
                  },
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="button" onClick={() => setShowConfirm(!showConfirm)}>
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth error={!!fieldErrors.accountType} sx={selectStyle}>
                <InputLabel shrink sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <RequiredLabel>Account Type</RequiredLabel>
                </InputLabel>
                <Select
                  value={form.accountType}
                  onChange={setField('accountType')}
                  label="Account Type"
                  sx={{ color: '#fff' }}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.accountType && <FormHelperText>{fieldErrors.accountType}</FormHelperText>}
              </FormControl>
            </Grid>

            {isUnder18(form.dateOfBirth) && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}>
                    You are below 18 years old. Guardian details are mandatory, and the guardian must be 18 or older.
                  </Alert>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={<RequiredLabel>Guardian Name</RequiredLabel>}
                    value={form.guardianDetails.name}
                    onChange={setGuardianField('name')}
                    fullWidth
                    error={!!fieldErrors['guardianDetails.name']}
                    helperText={fieldErrors['guardianDetails.name']}
                    sx={inputStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth error={!!fieldErrors['guardianDetails.relationship']} sx={selectStyle}>
                    <InputLabel shrink sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      <RequiredLabel>Relationship</RequiredLabel>
                    </InputLabel>
                    <Select
                      value={form.guardianDetails.relationship}
                      onChange={setGuardianField('relationship')}
                      label="Relationship"
                      sx={{ color: '#fff' }}
                    >
                      <MenuItem value="">Select relationship</MenuItem>
                      {guardianRelationshipOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                    {fieldErrors['guardianDetails.relationship'] && <FormHelperText>{fieldErrors['guardianDetails.relationship']}</FormHelperText>}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={<RequiredLabel>Guardian Phone</RequiredLabel>}
                    value={form.guardianDetails.phone}
                    onChange={setGuardianField('phone')}
                    fullWidth
                    error={!!fieldErrors['guardianDetails.phone']}
                    helperText={fieldErrors['guardianDetails.phone']}
                    sx={inputStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={<RequiredLabel>Guardian Date of Birth</RequiredLabel>}
                    type="date"
                    value={form.guardianDetails.dateOfBirth}
                    onChange={setGuardianField('dateOfBirth')}
                    fullWidth
                    error={!!fieldErrors['guardianDetails.dateOfBirth']}
                    helperText={fieldErrors['guardianDetails.dateOfBirth']}
                    sx={inputStyle}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ max: new Date().toISOString().split('T')[0] }}
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Button
            type="submit"
            fullWidth
            disabled={loading || !isSignupReady(form)}
            sx={{
              mt: 3,
              py: 1.6,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#0a0e27',
              borderRadius: '12px',
              textTransform: 'none',
            }}
          >
            {loading ? <CircularProgress size={22} /> : 'Create Account'}
          </Button>

          <Typography sx={{ mt: 2.5, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const inputStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '12px',
    minHeight: 56,
    background: 'rgba(255,255,255,0.06)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiFormHelperText-root': { color: '#f87171' },
};

const selectStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '12px',
    minHeight: 56,
    background: 'rgba(255,255,255,0.06)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
  },
};

export default Signup;
