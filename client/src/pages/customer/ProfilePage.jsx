import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Add, Close, Description, Download, Edit, Lock, Save, UploadFile,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { userAPI, accountAPI, accountTypeRequestAPI } from '../../services/api';
import { patchUser } from '../../redux/slices/authSlice';
import RequiredLabel from '../../components/common/RequiredLabel';
import { ACCOUNT_TYPES, getAccountTypeLabel } from '../../constants/accountTypes';
import { getDisplayName } from '../../utils/textFormat';

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const kycDocumentLabels = {
  aadhaarFront: 'Aadhaar Card (Front)',
  aadhaarBack: 'Aadhaar Card (Back)',
  panCard: 'PAN Card',
  photograph: 'Passport Size Photograph',
  signature: 'Signature Image',
  salarySlip: 'Salary Proof',
  studentId: 'Student ID Card / College ID',
  guardianIncomeProof: 'Guardian Income Proof',
  businessProof: 'Business Proof',
};

const getRequiredKycDocs = (employmentType = '') => {
  const normalized = String(employmentType || '').toLowerCase();
  const docs = ['aadhaarFront', 'aadhaarBack', 'panCard', 'photograph', 'signature'];
  if (normalized.includes('salaried')) docs.push('salarySlip');
  if (normalized.includes('student')) docs.push('studentId', 'guardianIncomeProof');
  if (normalized.includes('self') || normalized.includes('business')) docs.push('businessProof');
  return docs;
};

const needsAnnualIncome = (employmentType = '') => {
  const normalized = String(employmentType || '').toLowerCase();
  return normalized.includes('salaried') || normalized.includes('self') || normalized.includes('business');
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Old password is required'),
  newPassword: yup
    .string()
    .min(8, 'Minimum 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Must meet password rules')
    .required('New password is required'),
  confirmNewPassword: yup.string().oneOf([yup.ref('newPassword')], 'Passwords do not match').required('Confirm password'),
});

const emptyKycForm = {
  name: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  aadhaarNumber: '',
  panNumber: '',
  occupation: '',
  employmentType: '',
  annualIncome: '',
  nationality: 'Indian',
  address: { houseFlatNumber: '', street: '', area: '', city: '', state: '', pinCode: '', country: 'India' },
  nomineeDetails: { name: '', relationship: '', dateOfBirth: '', contactNumber: '' },
};

const statusUi = (status) => {
  if (status === 'Approved') return { label: 'KYC Verified', bg: '#dcfce7', color: '#166534' };
  if (status === 'Rejected') return { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' };
  if (status === 'Pending') return { label: 'Pending Verification', bg: '#fef3c7', color: '#92400e' };
  return { label: 'Not Started', bg: '#e0f2fe', color: '#075985' };
};

const SectionCard = ({ title, children, action }) => (
  <Card sx={{ bgcolor: '#fff', border: '1px solid #dbeafe', borderRadius: '12px', mb: 3, boxShadow: '0 18px 42px rgba(2,8,23,0.16)' }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography sx={{ color: '#071b3a', fontWeight: 900, fontSize: '1.05rem' }}>{title}</Typography>
        {action}
      </Box>
      {children}
    </CardContent>
  </Card>
);

const scrollToMessage = (node) => {
  if (!node) return;
  window.requestAnimationFrame(() => {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.focus?.({ preventScroll: true });
  });
};

const ProfilePage = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(null);
  const [kycForm, setKycForm] = useState(emptyKycForm);
  const [kycDocuments, setKycDocuments] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [accountTypeRequests, setAccountTypeRequests] = useState([]);
  const [maxAccounts, setMaxAccounts] = useState(3);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [accountMsg, setAccountMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [requestingAccount, setRequestingAccount] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  const [newAccountType, setNewAccountType] = useState('');
  const [accountRequestReason, setAccountRequestReason] = useState('');
  const profileMsgRef = useRef(null);
  const documentMsgRef = useRef(null);
  const accountMsgRef = useRef(null);
  const passwordMsgRef = useRef(null);

  const { register: regPwd, handleSubmit: subPwd, formState: { errors: pwdErrors }, reset: resetPwd } = useForm({
    resolver: yupResolver(passwordSchema),
  });

  const profileDisplayName = getDisplayName(profile?.name || user?.name, '');
  const canEditKyc = profile?.kycStatus !== 'Pending' && profile?.kycStatus !== 'Approved';
  const canEditApprovedFields = profile?.kycStatus === 'Approved' && editProfileMode;
  const canSubmitKycChanges = canEditKyc || canEditApprovedFields;
  const ui = statusUi(profile?.kycStatus);

  const fieldSx = (editable = true) => ({
    '& .MuiOutlinedInput-root': {
      color: '#0f172a',
      borderRadius: '10px',
      bgcolor: editable ? '#ffffff' : '#f8fafc',
      '& fieldset': { borderColor: '#cbd5e1' },
      '&:hover fieldset': { borderColor: editable ? '#2563eb' : '#cbd5e1' },
      '&.Mui-focused fieldset': { borderColor: '#2563eb' },
      '&.Mui-disabled fieldset': { borderColor: '#dbeafe' },
    },
    '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#64748b' },
    '& .MuiSelect-select': { color: '#0f172a', bgcolor: 'transparent' },
    '& .MuiSelect-select.Mui-disabled': { WebkitTextFillColor: '#64748b', color: '#64748b', bgcolor: 'transparent' },
    '& .MuiInputBase-root.Mui-disabled': { color: '#64748b', bgcolor: '#f8fafc' },
    '& .MuiInputLabel-root': { color: '#475569', fontWeight: 700, bgcolor: '#fff', px: 0.5 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
    '& input[type="date"]': { colorScheme: 'light' },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, accRes, requestRes] = await Promise.allSettled([
        userAPI.getProfile(),
        accountAPI.getAll(),
        accountTypeRequestAPI.getMyRequests(),
      ]);
      if (profileRes.status !== 'fulfilled') throw new Error('profile');
      const u = profileRes.value.data.user;
      setProfile(u);
      setKycForm({
        ...emptyKycForm,
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split('T')[0] : '',
        gender: u.gender || '',
        maritalStatus: u.maritalStatus || '',
        aadhaarNumber: '',
        panNumber: '',
        occupation: u.occupation || '',
        employmentType: u.employmentType || '',
        annualIncome: u.annualIncome || '',
        nationality: u.nationality || 'Indian',
        address: {
          houseFlatNumber: u.address?.houseFlatNumber || '',
          street: u.address?.street || '',
          area: u.address?.area || '',
          city: u.address?.city || '',
          state: u.address?.state || '',
          pinCode: u.address?.pinCode || '',
          country: u.address?.country || 'India',
        },
        nomineeDetails: {
          name: u.nomineeDetails?.name || '',
          relationship: u.nomineeDetails?.relationship || '',
          dateOfBirth: u.nomineeDetails?.dateOfBirth ? u.nomineeDetails.dateOfBirth.split('T')[0] : '',
          contactNumber: u.nomineeDetails?.contactNumber || '',
        },
      });
      setAccounts(accRes.status === 'fulfilled' ? accRes.value.data.accounts || [] : []);
      setAccountTypeRequests(requestRes.status === 'fulfilled' ? requestRes.value.data.requests || [] : []);
      setMaxAccounts(accRes.status === 'fulfilled' ? accRes.value.data.summary?.maxAccounts || 3 : 3);
      dispatch(patchUser({
        name: u.name,
        phone: u.phone,
        isKycComplete: u.isKycComplete,
        profileCompleted: u.profileCompleted,
        kycStatus: u.kycStatus,
        bankingAccess: u.bankingAccess,
        classification: u.classification,
      }));
    } catch {
      setProfileMsg({ type: 'error', text: 'Failed to load profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (profileMsg.text) scrollToMessage(profileMsgRef.current);
  }, [profileMsg.text]);

  useEffect(() => {
    if (fieldErrors.documents || fieldErrors.submit) scrollToMessage(documentMsgRef.current);
  }, [fieldErrors.documents, fieldErrors.submit]);

  useEffect(() => {
    if (accountMsg.text) scrollToMessage(accountMsgRef.current);
  }, [accountMsg.text]);

  useEffect(() => {
    if (pwdMsg.text) scrollToMessage(passwordMsgRef.current);
  }, [pwdMsg.text]);

  const clearFieldError = (name) => setFieldErrors((prev) => {
    if (!prev[name] && !prev.submit) return prev;
    const next = { ...prev };
    delete next[name];
    delete next.submit;
    return next;
  });

  const updateField = (name, value) => {
    setKycForm((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };
  const updateNested = (section, name, value) => {
    setKycForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [name]: value },
    }));
    clearFieldError(`${section}.${name}`);
  };

  const handleKycDocument = async (type, file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, [type]: 'Only JPG, JPEG, PNG, and PDF files are allowed.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, [type]: 'Document size must be 5 MB or less.' }));
      return;
    }
    const data = await fileToDataUrl(file);
    setKycDocuments((prev) => ({ ...prev, [type]: { type, name: file.name, size: file.size, mimeType: file.type, data } }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const openSavedDocument = async (doc, download = false) => {
    try {
      const res = await userAPI.getMyKycDocument(doc._id, download);
      const blob = new Blob([res.data], { type: res.headers['content-type'] || doc.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.originalName || 'kyc-document';
        link.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, documents: err.response?.data?.message || 'Unable to open document.' }));
    }
  };

  const validateKycForm = () => {
    const required = [
      ['name', 'Full name'],
      ['phone', 'Phone number'],
      ['dateOfBirth', 'Date of birth'],
      ['gender', 'Gender'],
      ['maritalStatus', 'Marital status'],
      ['occupation', 'Occupation'],
      ['employmentType', 'Employment type'],
      ['nationality', 'Nationality'],
      ['address.houseFlatNumber', 'House/Flat number'],
      ['address.street', 'Street'],
      ['address.city', 'City'],
      ['address.state', 'State'],
      ['address.pinCode', 'PIN code'],
      ['address.country', 'Country'],
      ['nomineeDetails.name', 'Nominee name'],
      ['nomineeDetails.relationship', 'Nominee relationship'],
      ['nomineeDetails.dateOfBirth', 'Nominee date of birth'],
      ['nomineeDetails.contactNumber', 'Nominee contact number'],
    ];
    const get = (path) => path.split('.').reduce((acc, key) => acc?.[key], kycForm);
    const nextErrors = {};

    required.forEach(([path, label]) => {
      if (!String(get(path) ?? '').trim()) nextErrors[path] = `${label} is required.`;
    });
    if (needsAnnualIncome(kycForm.employmentType) && !String(kycForm.annualIncome ?? '').trim()) {
      nextErrors.annualIncome = 'Annual income is required for this employment type.';
    }
    if (!profile?.hasAadhaar && !/^\d{12}$/.test(kycForm.aadhaarNumber)) nextErrors.aadhaarNumber = 'Aadhaar number must be exactly 12 digits.';
    if (!profile?.hasPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kycForm.panNumber)) nextErrors.panNumber = 'PAN must be in format ABCDE1234F.';
    if (kycForm.address.pinCode && !/^\d{6}$/.test(kycForm.address.pinCode)) nextErrors['address.pinCode'] = 'PIN Code must be 6 digits.';

    getRequiredKycDocs(kycForm.employmentType).forEach((type) => {
      const saved = profile?.documents?.find((doc) => doc.type === type);
      if (!saved && !kycDocuments[type]) nextErrors[type] = `${kycDocumentLabels[type]} is required.`;
    });

    setFieldErrors(nextErrors);
    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      setProfileMsg({ type: 'error', text: firstError });
      return false;
    }
    return true;
  };

  const handleSubmitKyc = async () => {
    if (!validateKycForm()) return;
    setSubmittingKyc(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const documents = Object.values(kycDocuments);
      const res = await userAPI.submitKyc({ ...kycForm, documents });
      setProfileMsg({ type: 'success', text: res.data.message });
      setKycDocuments({});
      setEditProfileMode(false);
      dispatch(patchUser({
        profileCompleted: res.data.user.profileCompleted,
        kycStatus: res.data.user.kycStatus,
        isKycComplete: res.data.user.isKycComplete,
        bankingAccess: !!res.data.user.bankingAccess,
      }));
      await loadData();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit KYC.';
      setFieldErrors((prev) => ({ ...prev, submit: message }));
      setProfileMsg({ type: 'error', text: message });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setEditProfileMode(false);
    setKycDocuments({});
    setFieldErrors({});
    loadData();
  };

  const handleSubmitAccountRequest = async () => {
    if (!newAccountType) {
      setAccountMsg({ type: 'error', text: 'Please select an account type.' });
      return;
    }
    setRequestingAccount(true);
    setAccountMsg({ type: '', text: '' });
    try {
      const res = await accountTypeRequestAPI.submitRequest({ accountType: newAccountType, reason: accountRequestReason });
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

  const existingTypes = accounts.map((a) => a.accountType);
  const pendingRequestTypes = accountTypeRequests.filter((request) => request.status === 'Pending').map((request) => request.requestedAccountType);
  const availableTypes = ACCOUNT_TYPES.filter((t) => !existingTypes.includes(t.value) && !pendingRequestTypes.includes(t.value));
  const canAddAccount = accounts.length < maxAccounts && availableTypes.length > 0;

  const requestStatusSx = (status) => {
    if (status === 'Approved') return { bgcolor: '#dcfce7', color: '#166534' };
    if (status === 'Rejected') return { bgcolor: '#fee2e2', color: '#991b1b' };
    return { bgcolor: '#fef3c7', color: '#92400e' };
  };

  if (loading && !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#f59e0b' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#2563eb', width: 48, height: 48, fontWeight: 900 }}>{profileDisplayName.charAt(0)}</Avatar>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800 }}>My Profile</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>Profile completion, KYC documents, bank accounts, and password</Typography>
          </Box>
        </Box>
        <Chip label={ui.label} sx={{ bgcolor: ui.bg, color: ui.color, fontWeight: 900, fontSize: '0.82rem' }} />
      </Box>

      {profileMsg.text && (
        <Alert ref={profileMsgRef} tabIndex={-1} severity={profileMsg.type} sx={{ mb: 2, outline: 'none' }}>
          {profileMsg.text}
        </Alert>
      )}
      {profile?.kycStatus !== 'Approved' && (
        <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.25)' }}>
          Welcome to Adnate PayNest! Complete this profile and submit KYC documents for manager verification.
        </Alert>
      )}
      {profile?.kycStatus === 'Rejected' && profile?.kycRejectedReason && (
        <Alert severity="error" sx={{ mb: 2 }}>Rejected: {profile.kycRejectedReason}</Alert>
      )}

      <SectionCard
        title="Personal Information"
        action={profile?.kycStatus === 'Approved' && (
          editProfileMode ? (
            <Button
              variant="outlined"
              startIcon={<Close />}
              onClick={handleCancelProfileEdit}
              sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 900 }}
            >
              Cancel Edit
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => {
                setEditProfileMode(true);
                setProfileMsg({ type: '', text: '' });
              }}
              sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 900 }}
            >
              Edit Details
            </Button>
          )
        )}
      >
        <Grid container spacing={2}>
          {[
            ['name', 'Full Name'],
            ['email', 'Email', 'email', true],
            ['phone', 'Phone Number'],
            ['dateOfBirth', 'Date of Birth', 'date'],
            ['maritalStatus', 'Marital Status'],
            ['occupation', 'Occupation'],
            ['annualIncome', 'Annual Income', 'number'],
            ['nationality', 'Nationality'],
          ].map(([name, label, type = 'text', readOnly = false]) => {
            const editable = !readOnly && (canEditKyc || (canEditApprovedFields && ['phone', 'occupation', 'annualIncome'].includes(name)));
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={name}>
                <TextField
                  label={label}
                  type={type}
                  value={kycForm[name] || ''}
                  onChange={(e) => updateField(name, e.target.value)}
                  fullWidth
                  disabled={!editable}
                  error={!!fieldErrors[name]}
                  helperText={fieldErrors[name] || (name === 'annualIncome' && !needsAnnualIncome(kycForm.employmentType) ? 'Optional' : '')}
                  sx={fieldSx(editable)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            );
          })}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Permanent Role" value="Customer" fullWidth disabled sx={fieldSx(false)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select label="Gender" value={kycForm.gender || ''} onChange={(e) => updateField('gender', e.target.value)} fullWidth disabled={!canEditKyc} error={!!fieldErrors.gender} helperText={fieldErrors.gender} sx={fieldSx(canEditKyc)} InputLabelProps={{ shrink: true }}>
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select label="Employment Type" value={kycForm.employmentType || ''} onChange={(e) => updateField('employmentType', e.target.value)} fullWidth disabled={!(canEditKyc || canEditApprovedFields)} error={!!fieldErrors.employmentType} helperText={fieldErrors.employmentType} sx={fieldSx(canEditKyc || canEditApprovedFields)} InputLabelProps={{ shrink: true }}>
              {['Salaried', 'Self-Employed', 'Business', 'Student', 'Other'].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="Aadhaar Number"
              value={profile?.hasAadhaar ? profile.aadhaarNumber || '' : kycForm.aadhaarNumber}
              onChange={(e) => updateField('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
              fullWidth
              disabled={!canEditKyc || profile?.hasAadhaar}
              error={!!fieldErrors.aadhaarNumber}
              helperText={fieldErrors.aadhaarNumber || (profile?.hasAadhaar ? 'Saved securely - last 4 digits visible' : 'Enter exactly 12 digits')}
              sx={fieldSx(canEditKyc && !profile?.hasAadhaar)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="PAN Number"
              value={profile?.hasPan ? profile.panNumber || '' : kycForm.panNumber}
              onChange={(e) => updateField('panNumber', e.target.value.trim().toUpperCase().slice(0, 10))}
              fullWidth
              disabled={!canEditKyc || profile?.hasPan}
              error={!!fieldErrors.panNumber}
              helperText={fieldErrors.panNumber || (profile?.hasPan ? 'Saved securely - last 4 characters visible' : 'Format: ABCDE1234F')}
              sx={fieldSx(canEditKyc && !profile?.hasPan)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard title="Address Information">
        <Grid container spacing={2}>
          {[
            ['houseFlatNumber', 'House/Flat Number'],
            ['street', 'Street'],
            ['area', 'Area'],
            ['city', 'City'],
            ['state', 'State'],
            ['pinCode', 'PIN Code'],
            ['country', 'Country'],
          ].map(([name, label]) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={name}>
              <TextField
                label={label}
                value={kycForm.address[name] || ''}
                onChange={(e) => updateNested('address', name, e.target.value)}
                fullWidth
                disabled={!canEditKyc}
                error={!!fieldErrors[`address.${name}`]}
                helperText={fieldErrors[`address.${name}`] || (name === 'area' ? 'Optional' : '')}
                sx={fieldSx(canEditKyc)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <SectionCard title="Nominee Details">
        <Grid container spacing={2}>
          {[
            ['name', 'Nominee Name'],
            ['relationship', 'Relationship'],
            ['dateOfBirth', 'Date of Birth', 'date'],
            ['contactNumber', 'Contact Number'],
          ].map(([name, label, type = 'text']) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={name}>
              <TextField
                label={label}
                type={type}
                value={kycForm.nomineeDetails[name] || ''}
                onChange={(e) => updateNested('nomineeDetails', name, e.target.value)}
                fullWidth
                disabled={!canEditKyc}
                error={!!fieldErrors[`nomineeDetails.${name}`]}
                helperText={fieldErrors[`nomineeDetails.${name}`]}
                sx={fieldSx(canEditKyc)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <SectionCard
        title="Documents Upload / KYC Documents"
        action={canSubmitKycChanges && (
          <Button variant="contained" startIcon={<Save />} disabled={submittingKyc} onClick={handleSubmitKyc} sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 900 }}>
            {submittingKyc ? 'Submitting...' : editProfileMode ? 'Submit Changes for Verification' : profile?.kycStatus === 'Rejected' ? 'Resubmit KYC' : 'Submit KYC'}
          </Button>
        )}
      >
        {editProfileMode && (
          <Alert severity="info" sx={{ mb: 2 }}>
            After editing phone, occupation, or employment type, submit the changes for manager verification. Upload any newly required employment proof below.
          </Alert>
        )}
        <Grid container spacing={2}>
          {getRequiredKycDocs(kycForm.employmentType).map((type) => {
            const uploaded = kycDocuments[type];
            const saved = profile?.documents?.find((doc) => doc.type === type);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={type}>
                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #dbeafe', minHeight: 168 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Description sx={{ color: '#2563eb' }} />
                    <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{kycDocumentLabels[type]}</Typography>
                  </Box>
                  <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mb: 1, wordBreak: 'break-word' }}>
                    {uploaded?.name || saved?.originalName || 'No file selected'}
                  </Typography>
                  <Chip
                    size="small"
                    label={uploaded ? 'Ready to submit' : saved ? saved.status || 'Uploaded' : 'Required'}
                    sx={{ mb: 1, bgcolor: uploaded || saved ? '#dcfce7' : '#fef3c7', color: uploaded || saved ? '#166534' : '#92400e', fontWeight: 800 }}
                  />
                  {fieldErrors[type] && (
                    <Typography sx={{ color: '#dc2626', fontSize: '0.76rem', fontWeight: 700, mb: 1 }}>
                      {fieldErrors[type]}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button component="label" startIcon={<UploadFile />} variant="outlined" disabled={!canSubmitKycChanges} sx={{ textTransform: 'none', borderColor: '#2563eb', color: '#2563eb', fontWeight: 800 }}>
                      {uploaded || saved ? 'Replace' : 'Upload'}
                      <input hidden type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => handleKycDocument(type, e.target.files?.[0])} />
                    </Button>
                    {saved && (
                      <Button startIcon={<Download />} onClick={() => openSavedDocument(saved, true)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                        Download
                      </Button>
                    )}
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
        {(fieldErrors.documents || fieldErrors.submit) && (
          <Box ref={documentMsgRef} tabIndex={-1} sx={{ outline: 'none' }}>
            {fieldErrors.documents && <Alert severity="error" sx={{ mt: 2 }}>{fieldErrors.documents}</Alert>}
            {fieldErrors.submit && <Alert severity="error" sx={{ mt: 2 }}>{fieldErrors.submit}</Alert>}
          </Box>
        )}
      </SectionCard>

      <SectionCard title="Bank Accounts">
        {accountMsg.text && (
          <Alert ref={accountMsgRef} tabIndex={-1} severity={accountMsg.type} sx={{ mb: 2, outline: 'none' }}>
            {accountMsg.text}
          </Alert>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccountBalance sx={{ color: '#2563eb' }} />
          <Typography sx={{ color: '#071b3a', fontWeight: 800 }}>My Bank Accounts</Typography>
          <Chip label={`${accounts.length} / ${maxAccounts}`} size="small" sx={{ ml: 'auto', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 800 }} />
        </Box>
        <Grid container spacing={2}>
          {accounts.map((acc) => (
            <Grid size={{ xs: 12, sm: 6 }} key={acc._id}>
              <Box sx={{ p: 2, borderRadius: '12px', border: '1px solid #dbeafe', bgcolor: '#f8fafc' }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{acc.accountTypeLabel || getAccountTypeLabel(acc.accountType)}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace', mb: 1 }}>{acc.accountNumber}</Typography>
                <Typography sx={{ color: '#0f766e', fontWeight: 900 }}>{formatCurrency(acc.balance)}</Typography>
              </Box>
            </Grid>
          ))}
          {accounts.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">Bank account details will be available after KYC approval.</Alert>
            </Grid>
          )}
        </Grid>
        {canAddAccount && (
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <TextField select label="Account Type" value={newAccountType} onChange={(e) => setNewAccountType(e.target.value)} size="small" sx={{ minWidth: 220, ...fieldSx(true) }} InputLabelProps={{ shrink: true }}>
              {availableTypes.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField label="Reason (optional)" value={accountRequestReason} onChange={(e) => setAccountRequestReason(e.target.value)} size="small" sx={{ minWidth: { xs: '100%', sm: 260 }, ...fieldSx(true) }} InputLabelProps={{ shrink: true }} inputProps={{ maxLength: 500 }} />
            <Button variant="outlined" startIcon={<Add />} disabled={requestingAccount} onClick={handleSubmitAccountRequest} sx={{ color: '#2563eb', borderColor: '#2563eb', textTransform: 'none', minHeight: 40, fontWeight: 800 }}>
              {requestingAccount ? <CircularProgress size={18} /> : 'Submit Request'}
            </Button>
          </Box>
        )}
        {accountTypeRequests.length > 0 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0' }}>
            <Typography sx={{ color: '#071b3a', fontWeight: 800, fontSize: '0.9rem', mb: 1.5 }}>Account Type Requests</Typography>
            <Grid container spacing={1.5}>
              {accountTypeRequests.slice(0, 5).map((request) => (
                <Grid size={{ xs: 12 }} key={request._id}>
                  <Box sx={{ p: 1.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.75 }}>
                      <Typography sx={{ color: '#0f172a', fontSize: '0.84rem', fontWeight: 800 }}>{request.requestedAccountTypeLabel || getAccountTypeLabel(request.requestedAccountType)}</Typography>
                      <Chip label={request.status} size="small" sx={{ ...requestStatusSx(request.status), fontWeight: 800, height: 22 }} />
                      <Typography sx={{ color: '#64748b', fontSize: '0.72rem', ml: 'auto' }}>{new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                    </Box>
                    {request.reason && <Typography sx={{ color: '#64748b', fontSize: '0.76rem' }}>Reason: {request.reason}</Typography>}
                    {request.managerComment && <Typography sx={{ color: '#334155', fontSize: '0.76rem', mt: 0.5 }}>Manager comment: {request.managerComment}</Typography>}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </SectionCard>

      <SectionCard title="Change Password">
        {pwdMsg.text && (
          <Alert ref={passwordMsgRef} tabIndex={-1} severity={pwdMsg.type} sx={{ mb: 2, outline: 'none' }}>
            {pwdMsg.text}
          </Alert>
        )}
        <Box component="form" onSubmit={subPwd(handlePasswordChange)}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField {...regPwd('currentPassword')} label={<RequiredLabel>Old Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.currentPassword} helperText={pwdErrors.currentPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...regPwd('newPassword')} label={<RequiredLabel>New Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.newPassword} helperText={pwdErrors.newPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...regPwd('confirmNewPassword')} label={<RequiredLabel>Confirm New Password</RequiredLabel>} type="password" fullWidth error={!!pwdErrors.confirmNewPassword} helperText={pwdErrors.confirmNewPassword?.message} sx={fieldSx(true)} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          <Button type="submit" variant="outlined" disabled={loadingPwd} startIcon={<Lock />} sx={{ mt: 2, color: '#2563eb', borderColor: '#2563eb', textTransform: 'none', fontWeight: 800 }}>
            {loadingPwd ? 'Updating...' : 'Update Password'}
          </Button>
        </Box>
      </SectionCard>
    </Box>
  );
};

export default ProfilePage;
