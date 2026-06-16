import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Avatar,
  CircularProgress,
  MenuItem,
  Divider,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { userAPI } from '../../services/api';
import { patchUser } from '../../redux/slices/authSlice';
import PasswordRules, { getPasswordRuleStatus } from '../../components/common/PasswordRules';

const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;

const profileSchema = yup.object({
  name: yup.string().trim().optional(),
  phone: yup.string().matches(phoneRegex, 'Invalid phone number').required('Phone number is required'),
  designation: yup.string().trim().max(100, 'Designation must be 100 characters or less').optional(),
  dateOfBirth: yup
    .string()
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional(),
  gender: yup.string().oneOf(['Male', 'Female', 'Other', 'Prefer not to say', ''], 'Invalid gender').optional(),
  aadhaarNumber: yup
    .string()
    .trim()
    .matches(/^\d{12}$/, 'Aadhaar must be exactly 12 digits')
    .optional()
    .nullable(),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .min(8, 'Minimum 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Password must include uppercase, lowercase, number, and special character')
    .required('New password is required'),
  confirmNewPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords do not match')
    .required('Confirm password is required'),
});

const profileFieldSx = {
  '--mui-field-label-bg': '#151933',
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.035)',
    minHeight: 58,
    overflow: 'visible',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    '&.Mui-disabled fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
  },
  '& .MuiInputBase-input': {
    color: '#ffffff',
    WebkitTextFillColor: '#ffffff',
    lineHeight: 1.45,
    paddingTop: '16.5px',
    paddingBottom: '16.5px',
  },
  '& .MuiInputBase-input.Mui-disabled': {
    color: 'rgba(255,255,255,0.58)',
    WebkitTextFillColor: 'rgba(255,255,255,0.58)',
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
  '& .MuiInputLabel-root.Mui-disabled': { color: 'rgba(255,255,255,0.42)' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    color: '#fff',
    minHeight: '1.45em',
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.72)' },
  '& input[type="date"]': { colorScheme: 'dark' },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
    filter: 'invert(1)',
    opacity: 0.75,
  },
  '& .MuiFormHelperText-root': { color: '#f87171' },
};

const AdminProfile = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    resolver: yupResolver(profileSchema),
  });

  const {
    register: registerPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors },
  } = useForm({
    mode: 'onBlur',
    resolver: yupResolver(passwordSchema),
  });

  const watchedNewPassword = watchPwd('newPassword', '');
  const watchedConfirmPassword = watchPwd('confirmNewPassword', '');
  const passwordStatuses = getPasswordRuleStatus(watchedNewPassword);
  const fulfilledRulesCount = passwordStatuses.filter((rule) => rule.met).length;
  const isPasswordRulesComplete = fulfilledRulesCount === passwordStatuses.length;
  const isConfirmMatch = watchedConfirmPassword && watchedConfirmPassword === watchedNewPassword;
  const isSavePasswordEnabled = isPasswordRulesComplete && isConfirmMatch;

  const resetProfileForm = (profileData) => {
    reset({
      name: profileData.name || '',
      phone: profileData.phone || '',
      designation: profileData.designation || '',
      dateOfBirth: profileData.dateOfBirth ? profileData.dateOfBirth.split('T')[0] : '',
      gender: profileData.gender || '',
      aadhaarNumber: '',
    });
  };

  const fetchProfile = async () => {
    setLoadingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const response = await userAPI.getProfile();
      const profileData = response.data.user;
      setProfile(profileData);
      resetProfileForm(profileData);
    } catch (error) {
      setProfileMsg({ type: 'error', text: 'Unable to load profile details.' });
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const phoneEditable = editMode;
  const showAadhaarInput = !profile?.hasAadhaar;
  const aadhaarEditable = editMode && !profile?.hasAadhaar;

  const handleProfileSave = async (data) => {
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const payload = {};
      if (data.phone && data.phone !== profile?.phone) payload.phone = data.phone;
      if (showAadhaarInput && data.aadhaarNumber) payload.aadhaarNumber = data.aadhaarNumber;

      if (Object.keys(payload).length === 0) {
        setProfileMsg({ type: 'info', text: 'No changes detected to save.' });
        return;
      }

      const response = await userAPI.updateProfile(payload);
      setProfile(response.data.user);
      dispatch(patchUser({ phone: response.data.user.phone, name: response.data.user.name }));
      setProfileMsg({ type: 'success', text: response.data.message || 'Profile updated successfully' });
      resetProfileForm(response.data.user);
      setEditMode(false);
    } catch (error) {
      setProfileMsg({ type: 'error', text: error.response?.data?.message || 'Failed to save profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (data) => {
    setLoadingPassword(true);
    setPasswordMsg({ type: '', text: '' });

    try {
      await userAPI.changePassword(data);
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
      resetPwd();
    } catch (error) {
      setPasswordMsg({ type: 'error', text: error.response?.data?.message || 'Unable to change password.' });
    } finally {
      setLoadingPassword(false);
    }
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((item) => item[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD';

  if (loadingProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#f59e0b' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>My Profile</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem', mb: 3 }}>
        Manage your admin profile and security settings.
      </Typography>

      {profileMsg.text && (
        <Alert severity={profileMsg.type} sx={{ mb: 3 }}>
          {profileMsg.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ pt: 4, pb: 3, px: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 96, height: 96, mx: 'auto', mb: 2, background: 'linear-gradient(135deg, #4f46e5, #2563eb)', fontSize: '2.2rem', fontWeight: 700 }}>
                {initials}
              </Avatar>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>{profile?.name || 'Admin'}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.92rem', mb: 1 }}>
                Administrator
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>{profile?.email}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>Personal Information</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
                  {editMode ? 'Editing phone number and initial Aadhaar entry only' : 'Only phone number can be updated after profile save'}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 3 }} />

              <Box component="form" onSubmit={handleSubmit(handleProfileSave)}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem' }}>
                      Update your contact details. Only phone number can be edited after profile setup.
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                    {!editMode ? (
                      <Button
                        variant="contained"
                        onClick={() => setEditMode(true)}
                        sx={{ backgroundColor: '#2563eb', textTransform: 'none', px: 3, py: 1 }}
                      >
                        Edit Profile
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditMode(false);
                          resetProfileForm(profile);
                          setProfileMsg({ type: '', text: '' });
                        }}
                        sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', px: 3, py: 1 }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Full Name"
                      fullWidth
                      value={profile?.name || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email ID"
                      fullWidth
                      value={profile?.email || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Admin ID"
                      fullWidth
                      value={profile?.adminId || profile?.customerId || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email Address"
                      fullWidth
                      value={profile?.email || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Phone Number"
                      fullWidth
                      defaultValue={profile?.phone || ''}
                      {...register('phone')}
                      disabled={!phoneEditable}
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Designation"
                      fullWidth
                      value={profile?.designation || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Date of Birth"
                      type="date"
                      fullWidth
                      value={profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="Gender"
                      fullWidth
                      value={profile?.gender || ''}
                      disabled
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    >
                      <MenuItem value="">Select gender</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                      <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {profile?.hasAadhaar ? (
                      <TextField
                        label="Aadhaar Number"
                        fullWidth
                        value={profile?.aadhaarNumber || ''}
                        disabled
                        sx={profileFieldSx}
                        InputLabelProps={{ shrink: true }}
                      />
                    ) : (
                      <TextField
                        label="Aadhaar Number"
                        fullWidth
                        defaultValue=""
                        {...register('aadhaarNumber')}
                        disabled={!aadhaarEditable}
                        placeholder="Enter 12-digit Aadhaar number"
                        error={!!errors.aadhaarNumber}
                        helperText={errors.aadhaarNumber?.message}
                        sx={profileFieldSx}
                        InputLabelProps={{ shrink: true }}
                      />
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!editMode || savingProfile}
                    sx={{ backgroundColor: '#2563eb', textTransform: 'none', px: 4, py: 1.25 }}
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>Security</Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 3 }} />

              {passwordMsg.text && (
                <Alert severity={passwordMsg.type} sx={{ mb: 3 }}>
                  {passwordMsg.text}
                </Alert>
              )}

              <Box component="form" onSubmit={handlePwdSubmit(handlePasswordChange)}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Current Password"
                      type="password"
                      fullWidth
                      {...registerPwd('currentPassword')}
                      error={!!pwdErrors.currentPassword}
                      helperText={pwdErrors.currentPassword?.message}
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Change Password"
                      type="password"
                      fullWidth
                      {...registerPwd('newPassword')}
                      error={!!pwdErrors.newPassword}
                      helperText={pwdErrors.newPassword?.message}
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Confirm Password"
                      type="password"
                      fullWidth
                      {...registerPwd('confirmNewPassword')}
                      error={!!pwdErrors.confirmNewPassword}
                      helperText={pwdErrors.confirmNewPassword?.message}
                      sx={profileFieldSx}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <PasswordRules password={watchedNewPassword} />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loadingPassword || !isSavePasswordEnabled}
                    sx={{ backgroundColor: '#2563eb', textTransform: 'none', px: 4, py: 1.25 }}
                  >
                    {loadingPassword ? 'Updating...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminProfile;
