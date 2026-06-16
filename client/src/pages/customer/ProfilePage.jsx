import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Grid, Alert, Divider, Avatar, CircularProgress, Chip,
  MenuItem, Select, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import {
  Person, Email, Phone, Lock, Edit, Save, AccountBalance, Badge, CalendarMonth, Add,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { userAPI, accountAPI, accountTypeRequestAPI } from '../../services/api';
import { patchUser } from '../../redux/slices/authSlice';
import RequiredLabel from '../../components/common/RequiredLabel';
import { ACCOUNT_TYPES, getAccountTypeLabel } from '../../constants/accountTypes';
import { CUSTOMER_PROFILE_FIELDS } from '../../constants/profileFields';
import { calculateAge, guardianRelationshipOptions, isUnder18 } from '../../utils/ageValidation';

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const buildProfileSchema = (profile) =>
  yup.object({
    name: profile?.hasAadhaar && profile?.hasPan && profile?.hasDateOfBirth
      ? yup.string()
      : yup.string().min(2).required('Name is required'),
    phone: yup.string().matches(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number').required('Phone is required'),
    aadhaarNumber: !profile?.hasAadhaar
      ? yup.string().matches(/^\d{12}$/, 'Aadhaar must be exactly 12 digits').required('Aadhaar is required')
      : yup.string().transform((value) => value || undefined).matches(/^\d{12}$/, 'Aadhaar must be exactly 12 digits').optional(),
    panNumber: !profile?.hasPan
      ? yup.string().matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN format: ABCDE1234F').required('PAN is required')
      : yup.string().transform((value) => value || undefined).matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN format: ABCDE1234F').optional(),
    dateOfBirth: !profile?.hasDateOfBirth
      ? yup.date().typeError('Valid birth date required').required('Birth date is required').max(new Date(), 'Cannot be in the future')
      : yup.date().transform((value, originalValue) => originalValue ? value : null).typeError('Valid birth date required').optional().nullable(),
    guardianDetails: yup.object({
      name: yup.string().trim().nullable(),
      relationship: yup.string().trim().nullable(),
      phone: yup.string().trim().nullable(),
      dateOfBirth: yup.string().nullable(),
    }),
  }).test('minor-guardian-details', 'Guardian details are required for minor customers', function (value) {
    const effectiveDob = value?.dateOfBirth || profile?.dateOfBirth;
    if (!isUnder18(effectiveDob)) return true;

    const guardian = value.guardianDetails || profile?.guardianDetails || {};
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

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .min(8, 'Minimum 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Must meet password rules')
    .required('New password is required'),
  confirmNewPassword: yup.string().oneOf([yup.ref('newPassword')], 'Passwords do not match').required('Confirm password'),
});

const ProfilePage = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountTypeRequests, setAccountTypeRequests] = useState([]);
  const [maxAccounts, setMaxAccounts] = useState(3);
  const [editMode, setEditMode] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [accountMsg, setAccountMsg] = useState({ type: '', text: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [requestingAccount, setRequestingAccount] = useState(false);
  const [newAccountType, setNewAccountType] = useState('');
  const [accountRequestReason, setAccountRequestReason] = useState('');

  const kycLocked = !!(profile?.hasAadhaar && profile?.hasPan && profile?.hasDateOfBirth);
  const needsKyc = !kycLocked;

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm({
    mode: 'onChange',
    resolver: yupResolver(buildProfileSchema(profile)),
  });

  const { register: regPwd, handleSubmit: subPwd, formState: { errors: pwdErrors }, reset: resetPwd } = useForm({
    resolver: yupResolver(passwordSchema),
  });

  const loadData = async () => {
    try {
      const [profileRes, accRes, requestRes] = await Promise.all([
        userAPI.getProfile(),
        accountAPI.getAll(),
        accountTypeRequestAPI.getMyRequests(),
      ]);
      const u = profileRes.data.user;
      setProfile(u);
      setAccounts(accRes.data.accounts || []);
      setAccountTypeRequests(requestRes.data.requests || []);
      setMaxAccounts(accRes.data.summary?.maxAccounts || 3);
      reset({
        name: u.name,
        phone: u.phone,
        aadhaarNumber: '',
        panNumber: '',
        dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split('T')[0] : '',
        guardianDetails: {
          name: u.guardianDetails?.name || '',
          relationship: u.guardianDetails?.relationship || '',
          phone: u.guardianDetails?.phone || '',
          dateOfBirth: u.guardianDetails?.dateOfBirth ? u.guardianDetails.dateOfBirth.split('T')[0] : '',
        },
      });
      dispatch(patchUser({ name: u.name, phone: u.phone, isKycComplete: u.isKycComplete, classification: u.classification }));
    } catch {
      setProfileMsg({ type: 'error', text: 'Failed to load profile.' });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileSave = async (data) => {
    setLoadingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const payload = { phone: data.phone };
      if (!kycLocked && data.name) payload.name = data.name;
      if (!profile?.hasAadhaar && data.aadhaarNumber) payload.aadhaarNumber = data.aadhaarNumber;
      if (!profile?.hasPan && data.panNumber) payload.panNumber = data.panNumber.trim().toUpperCase();
      if (!profile?.hasDateOfBirth && data.dateOfBirth) payload.dateOfBirth = data.dateOfBirth;
      const effectiveDob = data.dateOfBirth || profile?.dateOfBirth;
      if (isUnder18(effectiveDob)) payload.guardianDetails = data.guardianDetails;

      const res = await userAPI.updateProfile(payload);
      setProfile(res.data.user);
      dispatch(patchUser({ name: res.data.user.name, phone: res.data.user.phone, isKycComplete: res.data.user.isKycComplete, classification: res.data.user.classification }));
      setProfileMsg({ type: 'success', text: res.data.message || 'Profile saved successfully.' });
      setEditMode(false);
      await loadData();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSubmitAccountRequest = async () => {
    if (!newAccountType) {
      setAccountMsg({ type: 'error', text: 'Please select an account type.' });
      return;
    }
    setRequestingAccount(true);
    setAccountMsg({ type: '', text: '' });
    try {
      const res = await accountTypeRequestAPI.submitRequest({
        accountType: newAccountType,
        reason: accountRequestReason,
      });
      setAccountMsg({ type: 'success', text: res.data.message });
      setNewAccountType('');
      setAccountRequestReason('');
      await loadData();
    } catch (err) {
      setAccountMsg({ type: 'error', text: err.response?.data?.message || 'Could not submit account type request.' });
    } finally {
      setRequestingAccount(false);
    }
  };

  const handlePasswordChange = async (data) => {
    setLoadingPwd(true);
    setPwdMsg({ type: '', text: '' });
    try {
      await userAPI.changePassword(data);
      setPwdMsg({ type: 'success', text: 'Password changed successfully!' });
      resetPwd();
      if (user?.isTempPassword) dispatch(patchUser({ isTempPassword: false }));
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setLoadingPwd(false);
    }
  };

  const watchedDateOfBirth = watch('dateOfBirth');
  const showGuardianFields = isUnder18(watchedDateOfBirth || profile?.dateOfBirth);

  const existingTypes = accounts.map((a) => a.accountType);
  const pendingRequestTypes = accountTypeRequests
    .filter((request) => request.status === 'Pending')
    .map((request) => request.requestedAccountType);
  const availableTypes = ACCOUNT_TYPES.filter((t) => !existingTypes.includes(t.value) && !pendingRequestTypes.includes(t.value));
  const canAddAccount = accounts.length < maxAccounts && availableTypes.length > 0;

  const requestStatusSx = (status) => {
    if (status === 'Approved') return { bgcolor: 'rgba(34,197,94,0.12)', color: '#86efac' };
    if (status === 'Rejected') return { bgcolor: 'rgba(239,68,68,0.12)', color: '#fca5a5' };
    return { bgcolor: 'rgba(245,158,11,0.12)', color: '#fbbf24' };
  };

  const fieldSx = (editable) => ({
    '--mui-field-label-bg': '#151933',
    '& .MuiOutlinedInput-root': {
      color: editable ? '#fff' : 'rgba(255,255,255,0.5)',
      borderRadius: '12px',
      background: editable ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
      minHeight: 58,
      alignItems: 'center',
      overflow: 'visible',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
      '&.Mui-disabled fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    },
    '& .MuiInputBase-input': {
      color: editable ? '#fff' : 'rgba(255,255,255,0.58)',
      WebkitTextFillColor: editable ? '#fff' : 'rgba(255,255,255,0.58)',
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
      maxWidth: 'calc(100% - 28px)',
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
    '& .MuiInputLabel-root.Mui-disabled': { color: 'rgba(255,255,255,0.42)' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      minHeight: '1.45em',
      color: '#fff',
    },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.72)' },
    '& input[type="date"]': { colorScheme: 'dark' },
    '& input[type="date"]::-webkit-calendar-picker-indicator': {
      filter: 'invert(1)',
      opacity: 0.75,
    },
    '& .MuiFormHelperText-root': { color: '#f87171' },
  });

  if (!profile && loadingAccounts) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#f59e0b' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>My Profile</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 3 }}>
        Personal information, KYC details, and bank accounts
      </Typography>

      {user?.isTempPassword && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(245,158,11,0.12)', color: '#fcd34d' }}>
          You signed in with a temporary password. Change it below before continuing.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', textAlign: 'center' }}>
            <CardContent sx={{ p: 3 }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '1.8rem', fontWeight: 700 }}>
                {profile?.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>{profile?.name}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', mb: 2 }}>{profile?.email}</Typography>
              <Chip label="CUSTOMER" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }} />
              {profile?.classification && (
                <Chip
                  label={profile.classification}
                  size="small"
                  sx={{ ml: 1, bgcolor: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 700 }}
                />
              )}
              {profile?.classificationRequestStatus === 'Pending' && (
                <Chip
                  label="Classification Pending"
                  size="small"
                  sx={{ ml: 1, bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}
                />
              )}
              {profile?.isKycComplete && (
                <Chip label="KYC VERIFIED" size="small" sx={{ ml: 1, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>Personal Information</Typography>
                {!editMode ? (
                  <Button startIcon={<Edit />} onClick={() => setEditMode(true)} sx={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', textTransform: 'none' }}>
                    Edit
                  </Button>
                ) : (
                  <Button size="small" onClick={() => { setEditMode(false); reset(); }} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</Button>
                )}
              </Box>

              {profileMsg.text && <Alert severity={profileMsg.type} sx={{ mb: 2 }}>{profileMsg.text}</Alert>}

              {kycLocked && (
                <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                  KYC details are locked. Only your phone number can be updated.
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit(handleProfileSave)}>
                <Grid container spacing={2}>
                  {CUSTOMER_PROFILE_FIELDS.filter((f) => f.section === 'personal').map((field) => {
                    const isEditable = field.editable && editMode;
                    const isLocked = field.name === 'name' && kycLocked;
                    const finalDisabled = !isEditable || isLocked;

                    if (field.name === 'email') {
                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
                          <TextField
                            label={field.label}
                            value={profile?.email || ''}
                            fullWidth
                            disabled
                            sx={fieldSx(false)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      );
                    }

                    return (
                      <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
                        <TextField
                          {...register(field.name)}
                          label={field.required ? <RequiredLabel>{field.label}</RequiredLabel> : field.label}
                          fullWidth
                          disabled={finalDisabled}
                          error={!!errors[field.name]}
                          helperText={errors[field.name]?.message}
                          sx={fieldSx(!finalDisabled)}
                          InputLabelProps={{ shrink: true }}
                          type={field.type}
                        />
                      </Grid>
                    );
                  })}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Permanent Role" value="Customer" fullWidth disabled sx={fieldSx(false)} InputLabelProps={{ shrink: true }} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      KYC Details {needsKyc && editMode && <Typography component="span" sx={{ color: '#ef4444' }}>* all required on first save</Typography>}
                    </Typography>
                  </Grid>

                  {CUSTOMER_PROFILE_FIELDS.filter((f) => f.section === 'kyc').map((field) => {
                    const hasValueKey = field.hasKey;
                    const isAlreadySaved = !!profile?.[hasValueKey];

                    if (isAlreadySaved) {
                      let displayValue = profile[field.name];
                      let helper = "Saved permanently";
                      if (field.name === 'aadhaarNumber' && field.mask) {
                        displayValue = field.mask(profile.aadhaarNumber);
                        helper = "Saved permanently — last 4 digits visible";
                      } else if (field.name === 'panNumber' && field.mask) {
                        displayValue = field.mask(profile.panNumber);
                        helper = "Saved permanently — last 4 characters visible";
                      } else if (field.name === 'dateOfBirth') {
                        displayValue = new Date(profile.dateOfBirth).toLocaleDateString('en-IN');
                      }

                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
                          <TextField
                            label={field.label}
                            value={displayValue || ''}
                            fullWidth
                            disabled
                            sx={fieldSx(false)}
                            InputLabelProps={{ shrink: true }}
                            helperText={helper}
                            InputProps={field.name === 'aadhaarNumber' ? { startAdornment: <Badge sx={{ color: 'rgba(255,255,255,0.3)', mr: 1 }} /> } : field.name === 'dateOfBirth' ? { startAdornment: <CalendarMonth sx={{ color: 'rgba(255,255,255,0.3)', mr: 1 }} /> } : undefined}
                          />
                        </Grid>
                      );
                    }

                    if (field.name === 'panNumber') {
                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
                          <Controller
                            name="panNumber"
                            control={control}
                            defaultValue=""
                            render={({ field: controllerField }) => (
                              <TextField
                                {...controllerField}
                                value={controllerField.value || ''}
                                label={field.required ? <RequiredLabel>{field.label}</RequiredLabel> : field.label}
                                fullWidth
                                disabled={!editMode}
                                placeholder={field.placeholder}
                                inputProps={{ maxLength: 10 }}
                                error={!!errors.panNumber}
                                helperText={errors.panNumber?.message}
                                sx={fieldSx(editMode)}
                                InputLabelProps={{ shrink: true }}
                                onChange={(e) => controllerField.onChange(e.target.value.trim().toUpperCase())}
                              />
                            )}
                          />
                        </Grid>
                      );
                    }

                    return (
                      <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
                        <TextField
                          {...register(field.name)}
                          label={field.required ? <RequiredLabel>{field.label}</RequiredLabel> : field.label}
                          type={field.type || 'text'}
                          fullWidth
                          disabled={!editMode}
                          placeholder={field.placeholder}
                          inputProps={field.maxLength ? { maxLength: field.maxLength } : undefined}
                          error={!!errors[field.name]}
                          helperText={errors[field.name]?.message}
                          sx={fieldSx(editMode)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    );
                  })}

                  {showGuardianFields && (
                    <>
                      <Grid size={{ xs: 12 }}>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Guardian Details <Typography component="span" sx={{ color: '#ef4444' }}>* required for minor customers</Typography>
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Alert severity="info" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}>
                          Customer is below 18 years old. Guardian details are mandatory, and the guardian must be 18 or older.
                        </Alert>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          {...register('guardianDetails.name')}
                          label={<RequiredLabel>Guardian Name</RequiredLabel>}
                          fullWidth
                          disabled={!editMode}
                          error={!!errors.guardianDetails?.name}
                          helperText={errors.guardianDetails?.name?.message}
                          sx={fieldSx(editMode)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Controller
                          name="guardianDetails.relationship"
                          control={control}
                          defaultValue=""
                          render={({ field }) => (
                            <TextField
                              {...field}
                              select
                              label={<RequiredLabel>Relationship</RequiredLabel>}
                              fullWidth
                              disabled={!editMode}
                              error={!!errors.guardianDetails?.relationship}
                              helperText={errors.guardianDetails?.relationship?.message}
                              sx={fieldSx(editMode)}
                              InputLabelProps={{ shrink: true }}
                            >
                              <MenuItem value="">Select relationship</MenuItem>
                              {guardianRelationshipOptions.map((option) => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          {...register('guardianDetails.phone')}
                          label={<RequiredLabel>Guardian Phone</RequiredLabel>}
                          fullWidth
                          disabled={!editMode}
                          error={!!errors.guardianDetails?.phone}
                          helperText={errors.guardianDetails?.phone?.message}
                          sx={fieldSx(editMode)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          {...register('guardianDetails.dateOfBirth')}
                          label={<RequiredLabel>Guardian Date of Birth</RequiredLabel>}
                          type="date"
                          fullWidth
                          disabled={!editMode}
                          error={!!errors.guardianDetails?.dateOfBirth}
                          helperText={errors.guardianDetails?.dateOfBirth?.message}
                          sx={fieldSx(editMode)}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ max: new Date().toISOString().split('T')[0] }}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>

                {editMode && (
                  <Button type="submit" variant="contained" disabled={loadingProfile} startIcon={loadingProfile ? <CircularProgress size={16} /> : <Save />} sx={{ mt: 3, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0e27', textTransform: 'none', fontWeight: 700 }}>
                    Save Changes
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccountBalance sx={{ color: '#f59e0b' }} />
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>My Bank Accounts</Typography>
                <Chip label={`${accounts.length} / ${maxAccounts}`} size="small" sx={{ ml: 'auto', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }} />
              </Box>

              {accountMsg.text && <Alert severity={accountMsg.type} sx={{ mb: 2 }}>{accountMsg.text}</Alert>}

              <Grid container spacing={2}>
                {accounts.map((acc) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={acc._id}>
                      <Box sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                          {acc.accountTypeLabel || getAccountTypeLabel(acc.accountType)}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'monospace', mb: 1 }}>
                          {acc.accountNumber}
                        </Typography>
                        <Typography sx={{ color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(acc.balance)}</Typography>
                      </Box>
                    </Grid>
                ))}
              </Grid>

              {canAddAccount && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', mb: 1.5 }}>
                    Request another account type (max {maxAccounts} total, one per type)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <FormControl sx={{ minWidth: 220, ...fieldSx(true) }} size="small">
                      <InputLabel shrink sx={{ color: 'rgba(255,255,255,0.5)' }}><RequiredLabel>Account Type</RequiredLabel></InputLabel>
                      <Select value={newAccountType} label="Account Type" onChange={(e) => setNewAccountType(e.target.value)} sx={{ color: '#fff' }}>
                        {availableTypes.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Reason (optional)"
                      value={accountRequestReason}
                      onChange={(e) => setAccountRequestReason(e.target.value)}
                      size="small"
                      sx={{ minWidth: { xs: '100%', sm: 260 }, ...fieldSx(true) }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ maxLength: 500 }}
                      placeholder="Tell the manager why you need this account type"
                    />
                    <Button variant="outlined" startIcon={<Add />} disabled={requestingAccount} onClick={handleSubmitAccountRequest} sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', textTransform: 'none', minHeight: 40 }}>
                      {requestingAccount ? <CircularProgress size={18} /> : 'Submit Request'}
                    </Button>
                  </Box>
                </Box>
              )}
              {!canAddAccount && accounts.length >= maxAccounts && (
                <Alert severity="info" sx={{ mt: 3, bgcolor: 'rgba(59,130,246,0.1)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.2)' }}>
                  Maximum of {maxAccounts} account types allowed.
                </Alert>
              )}
              {accountTypeRequests.length > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', mb: 1.5 }}>
                    Account Type Requests
                  </Typography>
                  <Grid container spacing={1.5}>
                    {accountTypeRequests.slice(0, 5).map((request) => (
                      <Grid size={{ xs: 12 }} key={request._id}>
                        <Box sx={{ p: 1.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.75 }}>
                            <Typography sx={{ color: '#fff', fontSize: '0.84rem', fontWeight: 600 }}>
                              {request.requestedAccountTypeLabel || getAccountTypeLabel(request.requestedAccountType)}
                            </Typography>
                            <Chip
                              label={request.status}
                              size="small"
                              sx={{ ...requestStatusSx(request.status), fontWeight: 700, height: 22 }}
                            />
                            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', ml: 'auto' }}>
                              {new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Typography>
                          </Box>
                          {request.reason && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>
                              Reason: {request.reason}
                            </Typography>
                          )}
                          {request.managerComment && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.76rem', mt: 0.5 }}>
                              Manager comment: {request.managerComment}
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Lock sx={{ color: '#f59e0b' }} />
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>Change Password</Typography>
              </Box>
              {pwdMsg.text && <Alert severity={pwdMsg.type} sx={{ mb: 2 }}>{pwdMsg.text}</Alert>}
              <Box component="form" onSubmit={subPwd(handlePasswordChange)}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField {...regPwd('currentPassword')} label={<RequiredLabel>Current Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.currentPassword} helperText={pwdErrors.currentPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField {...regPwd('newPassword')} label={<RequiredLabel>New Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.newPassword} helperText={pwdErrors.newPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField {...regPwd('confirmNewPassword')} label={<RequiredLabel>Confirm New Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.confirmNewPassword} helperText={pwdErrors.confirmNewPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
                  </Grid>
                </Grid>
                <Button type="submit" variant="outlined" disabled={loadingPwd} sx={{ mt: 2, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', textTransform: 'none', fontWeight: 600 }}>
                  Update Password
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
