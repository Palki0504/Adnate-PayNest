import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { PersonAdd, ArrowBack } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { adminUserAPI } from '../../services/api';
import { EMAIL_VALIDATION_MESSAGE, normalizeEmail } from '../../utils/emailValidation';
import { calculateAge, guardianRelationshipOptions, isUnder18 } from '../../utils/ageValidation';

const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;

const addUserSchema = yup.object({
  name: yup.string().trim().required('Full name is required').min(2, 'Full name must be at least 2 characters'),
  email: yup.string().trim().required('Email is required').email(EMAIL_VALIDATION_MESSAGE),
  phone: yup.string().trim().required('Phone number is required').matches(phoneRegex, 'Enter a valid phone number'),
  role: yup.string().oneOf(['customer', 'manager']).required('User role is required'),
  designation: yup.string().trim().when('role', {
    is: 'manager',
    then: (s) => s.required('Designation is required for managers').min(2),
    otherwise: (s) => s.optional(),
  }),
  gender: yup.string().oneOf(['Male', 'Female', 'Other', 'Prefer not to say', ''], 'Invalid gender').optional(),
  dateOfBirth: yup
    .string()
    .required('Date of birth is required')
    .test('valid-date-of-birth', 'Enter a valid date of birth', (value) => calculateAge(value) !== null)
    .when('role', {
      is: 'manager',
      then: (schema) => schema.test('manager-minimum-age', 'Manager must be at least 18 years old', (value) => {
        const age = calculateAge(value);
        return age !== null && age >= 18;
      }),
    }),
  aadhaarNumber: yup
    .string()
    .trim()
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .matches(/^\d{12}$/, { message: 'Aadhaar must be exactly 12 digits', excludeEmptyString: true })
    .when('role', {
      is: 'manager',
      then: (schema) => schema.required('Aadhaar Card number is required for managers'),
      otherwise: (schema) => schema.notRequired(),
    }),
  accountType: yup.string().when('role', {
    is: 'customer',
    then: (s) => s.required('Account type is required for customers').oneOf(['savings', 'current', 'salary']),
    otherwise: (s) => s.optional(),
  }),
  guardianDetails: yup.object({
    name: yup.string().trim().nullable(),
    relationship: yup.string().trim().nullable(),
    phone: yup.string().trim().nullable(),
    dateOfBirth: yup.string().nullable(),
  }),
}).test('minor-guardian-details', 'Guardian details are required for minor customers', function (value) {
  if (value?.role !== 'customer' || !isUnder18(value?.dateOfBirth)) return true;
  const guardian = value.guardianDetails || {};
  if (!guardian.name?.trim()) {
    return this.createError({ path: 'guardianDetails.name', message: 'Guardian name is required' });
  }
  if (!guardian.relationship?.trim()) {
    return this.createError({ path: 'guardianDetails.relationship', message: 'Guardian relationship is required' });
  }
  if (!/^\+?[\d\s\-()]{7,15}$/.test(guardian.phone || '')) {
    return this.createError({ path: 'guardianDetails.phone', message: 'Enter a valid guardian phone number' });
  }
  if (!guardian.dateOfBirth) {
    return this.createError({ path: 'guardianDetails.dateOfBirth', message: 'Guardian date of birth is required' });
  }
  const guardianAge = calculateAge(guardian.dateOfBirth);
  if (guardianAge === null || guardianAge < 18) {
    return this.createError({ path: 'guardianDetails.dateOfBirth', message: 'Guardian must be 18 years or older' });
  }
  return true;
});

const inputSx = {
  '--mui-field-label-bg': '#151933',
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
    minHeight: 58,
    overflow: 'visible',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(56,189,248,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
  },
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
  '& .MuiInputLabel-root.Mui-focused': { color: '#38bdf8' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
  '& .MuiFormHelperText-root': { color: '#f87171' },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  '& input[type="date"]': { colorScheme: 'dark' },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
    filter: 'invert(1)',
    opacity: 0.75,
  },
};

const AddUserPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [managerReplacement, setManagerReplacement] = useState(null);

  const form = useForm({
    mode: 'onChange',
    resolver: yupResolver(addUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'customer',
      designation: '',
      gender: '',
      dateOfBirth: '',
      aadhaarNumber: '',
      accountType: 'savings',
      guardianDetails: {
        name: '',
        relationship: '',
        phone: '',
        dateOfBirth: '',
      },
    },
  });

  const watchRole = form.watch('role');
  const watchDateOfBirth = form.watch('dateOfBirth');
  const showGuardianFields = watchRole === 'customer' && isUnder18(watchDateOfBirth);

  const createUser = async (values, replaceActiveManager = false) => {
    setSubmitting(true);
    setActionMessage({ type: '', text: '' });
    try {
      const response = await adminUserAPI.createUser({
        ...values,
        email: normalizeEmail(values.email),
        replaceActiveManager,
      });
      const message = response?.data?.message || 'User created successfully.';
      setActionMessage({ type: 'success', text: message });
      setManagerReplacement(null);
      setTimeout(() => navigate('/admin-dashboard/user-management'), 1500);
    } catch (error) {
      if (error.response?.data?.requiresManagerReplacement) {
        setManagerReplacement({ values, message: error.response.data.message });
      } else {
        setActionMessage({
          type: 'error',
          text: error.response?.data?.message || error.message || 'Failed to create user.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values) => createUser(values, false);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonAdd sx={{ color: '#38bdf8', fontSize: '1.5rem' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2 }}>Add New User</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Create a new customer or manager account</Typography>
          </Box>
        </Box>
        <Button
          startIcon={<ArrowBack />}
          variant="outlined"
          onClick={() => navigate('/admin-dashboard/user-management')}
          sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '12px', '&:hover': { borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' } }}
        >
          Back to User List
        </Button>
      </Box>

      {actionMessage.text && (
        <Alert
          severity={actionMessage.type}
          sx={{ mb: 3, borderRadius: '12px', bgcolor: actionMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${actionMessage.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}
        >
          {actionMessage.text}
        </Alert>
      )}

      <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={form.handleSubmit(handleSubmit)}>
            {/* Auto-password info banner */}
            <Alert
              severity="info"
              sx={{
                mb: 3,
                borderRadius: '12px',
                bgcolor: 'rgba(56,189,248,0.08)',
                border: '1px solid rgba(56,189,248,0.25)',
                color: '#bae6fd',
                '& .MuiAlert-icon': { color: '#38bdf8' },
              }}
            >
              <strong>Auto Password Generation:</strong> A temporary password will be automatically generated from the customer's email prefix (e.g. <em>palki@example.com</em> → <strong>Palki@123</strong>) and emailed to them on account creation.
            </Alert>

            {/* Basic Information */}
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Basic Information
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name *"
                  sx={inputSx}
                  InputLabelProps={{ shrink: true }}
                  {...form.register('name')}
                  error={!!form.formState.errors.name}
                  helperText={form.formState.errors.name?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address *"
                  type="email"
                  sx={inputSx}
                  InputLabelProps={{ shrink: true }}
                  {...form.register('email')}
                  error={!!form.formState.errors.email}
                  helperText={form.formState.errors.email?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number *"
                  sx={inputSx}
                  InputLabelProps={{ shrink: true }}
                  {...form.register('phone')}
                  error={!!form.formState.errors.phone}
                  helperText={form.formState.errors.phone?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="role"
                  control={form.control}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="User Role *"
                      sx={inputSx}
                      InputLabelProps={{ shrink: true }}
                      {...field}
                      error={!!form.formState.errors.role}
                      helperText={form.formState.errors.role?.message}
                    >
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="manager">Manager</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>

              {/* Customer-specific: Account Type */}
              {watchRole === 'customer' && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="accountType"
                    control={form.control}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        label="Account Type *"
                        sx={inputSx}
                        InputLabelProps={{ shrink: true }}
                        {...field}
                        error={!!form.formState.errors.accountType}
                        helperText={form.formState.errors.accountType?.message}
                      >
                        <MenuItem value="savings">Savings</MenuItem>
                        <MenuItem value="current">Current</MenuItem>
                        <MenuItem value="salary">Salary</MenuItem>
                      </TextField>
                    )}
                  />
                </Grid>
              )}

              {/* Manager-specific: Designation */}
              {watchRole === 'manager' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Designation *"
                    sx={inputSx}
                    InputLabelProps={{ shrink: true }}
                    {...form.register('designation')}
                    error={!!form.formState.errors.designation}
                    helperText={form.formState.errors.designation?.message}
                    placeholder="e.g. Branch Manager"
                  />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

            {/* Personal Details */}
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Personal Details
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth *"
                  type="date"
                  sx={inputSx}
                  InputLabelProps={{ shrink: true }}
                  {...form.register('dateOfBirth')}
                  error={!!form.formState.errors.dateOfBirth}
                  helperText={form.formState.errors.dateOfBirth?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="gender"
                  control={form.control}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Gender"
                      sx={inputSx}
                      InputLabelProps={{ shrink: true }}
                      {...field}
                      error={!!form.formState.errors.gender}
                      helperText={form.formState.errors.gender?.message}
                    >
                      <MenuItem value="">Select gender</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                      <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={watchRole === 'manager' ? 'Aadhaar Card Number *' : 'Aadhaar Number'}
                  sx={inputSx}
                  InputLabelProps={{ shrink: true }}
                  {...form.register('aadhaarNumber')}
                  error={!!form.formState.errors.aadhaarNumber}
                  helperText={form.formState.errors.aadhaarNumber?.message || (watchRole === 'manager' ? 'Enter exactly 12 digits' : '12-digit Aadhaar number (optional)')}
                  inputProps={{ maxLength: 12, inputMode: 'numeric', pattern: '[0-9]*' }}
                />
              </Grid>
            </Grid>

            {showGuardianFields && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
                  Guardian Details
                </Typography>
                <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(56,189,248,0.1)', color: '#bae6fd' }}>
                  Customer is below 18 years old. Guardian details are mandatory, and the guardian must be 18 or older.
                </Alert>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Guardian Name *"
                      sx={inputSx}
                      InputLabelProps={{ shrink: true }}
                      {...form.register('guardianDetails.name')}
                      error={!!form.formState.errors.guardianDetails?.name}
                      helperText={form.formState.errors.guardianDetails?.name?.message}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="guardianDetails.relationship"
                      control={form.control}
                      render={({ field }) => (
                        <TextField
                          select
                          fullWidth
                          label="Relationship *"
                          sx={inputSx}
                          InputLabelProps={{ shrink: true }}
                          {...field}
                          error={!!form.formState.errors.guardianDetails?.relationship}
                          helperText={form.formState.errors.guardianDetails?.relationship?.message}
                        >
                          <MenuItem value="">Select relationship</MenuItem>
                          {guardianRelationshipOptions.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Guardian Phone *"
                      sx={inputSx}
                      InputLabelProps={{ shrink: true }}
                      {...form.register('guardianDetails.phone')}
                      error={!!form.formState.errors.guardianDetails?.phone}
                      helperText={form.formState.errors.guardianDetails?.phone?.message}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Guardian Date of Birth *"
                      type="date"
                      sx={inputSx}
                      InputLabelProps={{ shrink: true }}
                      {...form.register('guardianDetails.dateOfBirth')}
                      error={!!form.formState.errors.guardianDetails?.dateOfBirth}
                      helperText={form.formState.errors.guardianDetails?.dateOfBirth?.message}
                    />
                  </Grid>
                </Grid>
              </>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
              <Button
                onClick={() => navigate('/admin-dashboard/user-management')}
                sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !form.formState.isValid}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 4,
                  py: 1.2,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                  color: '#fff',
                  '&:hover': { background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)' },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save User'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
      <Dialog open={!!managerReplacement} onClose={() => setManagerReplacement(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Replace Active Manager?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            {managerReplacement?.message || 'One active manager already exists. Creating a new manager will deactivate the previous manager. Are you sure you want to continue?'}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setManagerReplacement(null)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={submitting}
            onClick={() => createUser(managerReplacement.values, true)}
          >
            {submitting ? <CircularProgress size={20} /> : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AddUserPage;
