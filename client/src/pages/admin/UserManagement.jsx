import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Button,
  MenuItem,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  Tooltip,
  CircularProgress,
  Divider,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Add,
  Visibility,
  Edit,
  Block,
  CheckCircle,
  Person,
  Groups,
  Shield,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { adminUserAPI } from '../../services/api';
import { CUSTOMER_PROFILE_FIELDS } from '../../constants/profileFields';
import { EMAIL_VALIDATION_MESSAGE, normalizeEmail } from '../../utils/emailValidation';
import { calculateAge, guardianRelationshipOptions, isUnder18 } from '../../utils/ageValidation';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;

const editUserSchema = yup.object({
  role: yup.string().oneOf(['customer', 'manager']).required(),
  name: yup.string().trim().required('Full name is required').min(2, 'Name must be at least 2 characters'),
  email: yup.string().trim().email(EMAIL_VALIDATION_MESSAGE).required('Email address is required'),
  phone: yup.string().trim().required('Phone number is required').matches(phoneRegex, 'Enter a valid phone number'),
  dateOfBirth: yup.string().nullable().when('role', {
    is: 'manager',
    then: (schema) => schema.required('Date of birth is required').test('manager-minimum-age', 'Manager must be at least 18 years old', (value) => {
      const age = calculateAge(value);
      return age !== null && age >= 18;
    }),
  }),
  aadhaarNumber: yup.string().trim().nullable().transform((value) => (value === '' ? null : value)).when('role', {
    is: 'manager',
    then: (schema) => schema.required('Aadhaar Card number is required for managers').matches(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
    otherwise: (schema) => schema.matches(/^\d{12}$/, { message: 'Aadhaar must be exactly 12 digits', excludeEmptyString: true }).notRequired(),
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
  if (!guardian.name?.trim()) return this.createError({ path: 'guardianDetails.name', message: 'Guardian name is required' });
  if (!guardian.relationship?.trim()) return this.createError({ path: 'guardianDetails.relationship', message: 'Guardian relationship is required' });
  if (!/^\+?[\d\s\-()]{7,15}$/.test(guardian.phone || '')) return this.createError({ path: 'guardianDetails.phone', message: 'Enter a valid guardian phone number' });
  const guardianAge = calculateAge(guardian.dateOfBirth);
  if (guardianAge === null || guardianAge < 18) return this.createError({ path: 'guardianDetails.dateOfBirth', message: 'Guardian must be 18 years or older' });
  return true;
});


const textFieldSx = {
  '--mui-field-label-bg': '#151933',
  mb: 2,
  '& .MuiInputBase-input': {
    color: '#fff',
    WebkitTextFillColor: '#fff',
    lineHeight: 1.45,
    paddingTop: '16.5px',
    paddingBottom: '16.5px',
  },
  '& .MuiInputBase-input.Mui-disabled': { color: 'rgba(255,255,255,0.5)', WebkitTextFillColor: 'rgba(255,255,255,0.5)' },
  '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.45)', opacity: 1 },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.65)',
    backgroundColor: 'var(--mui-field-label-bg)',
    px: 0.75,
    zIndex: 2,
    overflow: 'visible',
  },
  '& .MuiInputLabel-root.Mui-disabled': { color: 'rgba(255,255,255,0.4)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
  '& .MuiOutlinedInput-root': {
    minHeight: 58,
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.035)',
    overflow: 'visible',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    '&.Mui-disabled fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
  },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
  '& .MuiSelect-icon': { color: '#fff' },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
};

const modalTextFieldSx = {
  '--mui-field-label-bg': '#ffffff',
  mb: 2,
  '& .MuiInputBase-input': {
    color: '#111111',
    WebkitTextFillColor: '#111111',
    lineHeight: 1.45,
    paddingTop: '16.5px',
    paddingBottom: '16.5px',
  },
  '& .MuiInputBase-input.Mui-disabled': { color: 'rgba(0,0,0,0.5)', WebkitTextFillColor: 'rgba(0,0,0,0.5)' },
  '& .MuiInputBase-input::placeholder': { color: 'rgba(17,24,39,0.58)', opacity: 1 },
  '& .MuiInputLabel-root': {
    color: 'rgba(17,24,39,0.72)',
    backgroundColor: 'var(--mui-field-label-bg)',
    px: 0.75,
    zIndex: 2,
    overflow: 'visible',
  },
  '& .MuiInputLabel-root.Mui-disabled': { color: 'rgba(0,0,0,0.4)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
  '& .MuiOutlinedInput-root': {
    minHeight: 58,
    borderRadius: '12px',
    background: '#ffffff',
    overflow: 'visible',
    '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    '&.Mui-disabled fieldset': { borderColor: 'rgba(0,0,0,0.1)' },
  },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em' },
  '& .MuiSelect-icon': { color: '#111111' },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
};

const selectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        backgroundColor: '#1e293b',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.08)',
        '& .MuiMenuItem-root': {
          color: '#fff',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: '#f59e0b',
            color: '#000',
            '&:hover': {
              backgroundColor: '#d97706',
            },
          },
        },
      },
    },
  },
};

const modalSelectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        backgroundColor: '#ffffff',
        color: '#111111',
        border: '1px solid rgba(0,0,0,0.15)',
        '& .MuiMenuItem-root': {
          color: '#111111',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.05)',
          },
          '&.Mui-selected': {
            backgroundColor: '#f59e0b',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#d97706',
            },
          },
        },
      },
    },
  },
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [managersCount, setManagersCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [currentTab, setCurrentTab] = useState(0); // 0 = All Users, 1 = Pending Approval
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const {
    page: usersPage,
    setPage: setUsersPage,
    paginatedRecords: paginatedUsers,
  } = useTablePagination(users, [currentTab, search, roleFilter, statusFilter, users.length]);
  const {
    page: pendingPage,
    setPage: setPendingPage,
    paginatedRecords: paginatedPendingRegistrations,
  } = useTablePagination(pendingRegistrations, [currentTab, pendingRegistrations.length]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectUserId, setRejectUserId] = useState(null);

  const editForm = useForm({ mode: 'onChange', resolver: yupResolver(editUserSchema) });
  const editDateOfBirth = editForm.watch('dateOfBirth');
  const showEditGuardianFields = selectedUser?.role === 'customer' && isUnder18(editDateOfBirth);

  const getUserRecordId = (user) => user?._id || user?.id;

  const filters = useMemo(() => {
    const params = {};
    if (roleFilter !== 'all') params.role = roleFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [roleFilter, statusFilter, search]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminUserAPI.getUsers(filters);
      setUsers(response.data.users || []);
      setCustomersCount(response.data.customersCount || 0);
      setManagersCount(response.data.managersCount || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRegistrations = async () => {
    setPendingLoading(true);
    setError('');
    try {
      const response = await adminUserAPI.getPendingRegistrations();
      setPendingRegistrations(response.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending registrations.');
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApproveRegistration = async (id) => {
    setSubmitting(true);
    setActionMessage({ type: '', text: '' });
    try {
      await adminUserAPI.approveRegistration(id);
      setActionMessage({ type: 'success', text: 'Registration approved successfully.' });
      fetchPendingRegistrations();
      fetchUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to approve registration.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRejectDialog = (id) => {
    setRejectUserId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectRegistration = async () => {
    if (!rejectUserId) return;
    setSubmitting(true);
    setActionMessage({ type: '', text: '' });
    try {
      await adminUserAPI.rejectRegistration(rejectUserId, { reason: rejectReason });
      setActionMessage({ type: 'success', text: 'Registration rejected.' });
      setRejectDialogOpen(false);
      fetchPendingRegistrations();
      fetchUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reject registration.' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(pendingSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [pendingSearch]);

  useEffect(() => {
    fetchPendingRegistrations();
  }, []);

  useEffect(() => {
    if (currentTab === 1) {
      fetchPendingRegistrations();
    } else {
      fetchUsers();
    }
  }, [currentTab, filters]);

  const openAddPage = () => {
    navigate('/admin-dashboard/user-management/add');
  };

  const openViewDialog = async (user) => {
    setLoading(true);
    setActionMessage({ type: '', text: '' });
    try {
      const response = await adminUserAPI.getUser(getUserRecordId(user));
      setSelectedUser(response.data.user);
      setOpenView(true);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to fetch user details.' });
    } finally {
      setLoading(false);
    }
  };

  const closeViewDialog = () => {
    setOpenView(false);
    setSelectedUser(null);
  };

  const openEditDialog = async (user) => {
    setLoading(true);
    setActionMessage({ type: '', text: '' });
    try {
      const response = await adminUserAPI.getUser(getUserRecordId(user));
      const fullUser = response.data.user;
      setSelectedUser(fullUser);
      editForm.reset({
        role: fullUser.role,
        name: fullUser.name || '',
        email: fullUser.email || '',
        phone: fullUser.phone || '',
        dateOfBirth: fullUser.dateOfBirth ? fullUser.dateOfBirth.split('T')[0] : '',
        aadhaarNumber: fullUser.aadhaarNumber || '',
        guardianDetails: {
          name: fullUser.guardianDetails?.name || '',
          relationship: fullUser.guardianDetails?.relationship || '',
          phone: fullUser.guardianDetails?.phone || '',
          dateOfBirth: fullUser.guardianDetails?.dateOfBirth ? fullUser.guardianDetails.dateOfBirth.split('T')[0] : '',
        },
      });
      await editForm.trigger();
      setOpenEdit(true);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to fetch user details.' });
    } finally {
      setLoading(false);
    }
  };

  const closeEditDialog = () => {
    setOpenEdit(false);
    setSelectedUser(null);
  };

  const handleEditUser = async (values) => {
    const userId = getUserRecordId(selectedUser);
    if (!userId) {
      setActionMessage({ type: 'error', text: 'Unable to update user: missing user ID.' });
      return;
    }
    setSubmitting(true);
    setActionMessage({ type: '', text: '' });
    try {
      await adminUserAPI.updateUser(userId, {
        name: values.name,
        email: normalizeEmail(values.email),
        phone: values.phone,
        dateOfBirth: values.dateOfBirth || null,
        aadhaarNumber: values.aadhaarNumber || null,
        guardianDetails: values.guardianDetails,
      });
      setActionMessage({ type: 'success', text: 'User updated successfully.' });
      closeEditDialog();
      fetchUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update user.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const userId = getUserRecordId(user);
    if (!userId) {
      setActionMessage({ type: 'error', text: 'Unable to update status: missing user ID.' });
      return;
    }
    setSubmitting(true);
    try {
      await adminUserAPI.updateUserStatus(userId, { isActive: !user.isActive });
      setActionMessage({ type: 'success', text: `User has been ${user.isActive ? 'deactivated' : 'activated'}.` });
      fetchUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update status.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700 }}>User Management</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>Manage customers and managers across Adnate PayNest.</Typography>
        </Box>
        <Button startIcon={<Add />} variant="contained" onClick={openAddPage} sx={{ backgroundColor: '#2563eb', textTransform: 'none' }}>
          Add User
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Shield sx={{ color: '#38bdf8', fontSize: '2rem' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Total Customers</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.5rem', fontWeight: 700 }}>{customersCount}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Groups sx={{ color: '#f97316', fontSize: '2rem' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Total Managers</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.5rem', fontWeight: 700 }}>{managersCount}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs
        value={currentTab}
        onChange={(e, newVal) => setCurrentTab(newVal)}
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { backgroundColor: '#f59e0b' },
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' },
          '& .MuiTab-root.Mui-selected': { color: '#f59e0b' },
        }}
      >
        <Tab label="All Users" />
        <Tab label={`Pending Approval (${pendingRegistrations.length})`} />
      </Tabs>

      {currentTab === 0 && (
        <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  placeholder="Search by name, email, phone, or user ID"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,0.55)' }} /></InputAdornment> }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={textFieldSx}
                  SelectProps={selectProps}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={textFieldSx}
                  SelectProps={selectProps}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {actionMessage.text && (
        <Alert severity={actionMessage.type} sx={{ mb: 3 }}>{actionMessage.text}</Alert>
      )}

      <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', mb: 3 }}>
        <CardContent>
          {currentTab === 0 ? (
            loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#f59e0b' }} /></Box>
            ) : (
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {['User ID', 'Name', 'Email', 'Role', 'Phone', 'Status', 'Joined', 'Actions'].map((label) => (
                        <TableCell key={label} sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ color: 'rgba(255,255,255,0.55)', py: 6, textAlign: 'center' }}>
                          No users found. Adjust your search or filters.
                        </TableCell>
                      </TableRow>
                    ) : paginatedUsers.map((user) => (
                      <TableRow key={user._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.05)' } }}>
                        <TableCell sx={{ color: '#fff' }}>{user.adminId || user.customerId || user._id}</TableCell>
                        <TableCell sx={{ color: '#fff' }}>{user.name}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{user.email}</TableCell>
                        <TableCell>
                          <Chip label={user.role} size="small" sx={{ backgroundColor: user.role === 'manager' ? 'rgba(249,115,22,0.15)' : 'rgba(56,189,248,0.15)', color: '#fff', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{user.phone}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.isActive ? 'Active' : user.role === 'manager' ? 'Deactivated' : 'Inactive'}
                            size="small"
                            sx={{
                              backgroundColor: user.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                              color: '#fff',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {user.approvalStatus === 'pending' ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleApproveRegistration(user._id)}
                                  disabled={submitting}
                                  sx={{ textTransform: 'none', borderRadius: '8px', px: 1.5, py: 0.5, minWidth: '70px', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={() => handleOpenRejectDialog(user._id)}
                                  disabled={submitting}
                                  sx={{ textTransform: 'none', borderRadius: '8px', px: 1.5, py: 0.5, minWidth: '70px', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  Reject
                                </Button>
                                <Tooltip title="View user">
                                  <IconButton size="small" onClick={() => openViewDialog(user)} sx={{ color: '#38bdf8' }}>
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip title="View user">
                                  <IconButton size="small" onClick={() => openViewDialog(user)} sx={{ color: '#38bdf8' }}>
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit user">
                                  <IconButton size="small" onClick={() => openEditDialog(user)} sx={{ color: '#f59e0b' }}>
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={user.isActive ? 'Deactivate account' : 'Activate account'}>
                                  <IconButton size="small" onClick={() => handleToggleStatus(user)} sx={{ color: user.isActive ? '#ef4444' : '#22c55e' }}>
                                    {user.isActive ? <Block /> : <CheckCircle />}
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls page={usersPage} totalRecords={users.length} onPageChange={setUsersPage} />
              </TableContainer>
            )
          ) : (
            pendingLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#f59e0b' }} /></Box>
            ) : (
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {['Name', 'Email', 'Role', 'Phone', 'Applied Date', 'Actions'].map((label) => (
                        <TableCell key={label} sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingRegistrations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ color: 'rgba(255,255,255,0.55)', py: 6, textAlign: 'center' }}>
                          No pending registration requests found.
                        </TableCell>
                      </TableRow>
                    ) : paginatedPendingRegistrations.map((user) => (
                      <TableRow key={user._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.05)' } }}>
                        <TableCell sx={{ color: '#fff' }}>{user.name}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{user.email}</TableCell>
                        <TableCell>
                          <Chip label={user.role} size="small" sx={{ backgroundColor: user.role === 'manager' ? 'rgba(249,115,22,0.15)' : 'rgba(56,189,248,0.15)', color: '#fff', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{user.phone}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.75)' }}>{new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleApproveRegistration(user._id)}
                              disabled={submitting}
                              sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => handleOpenRejectDialog(user._id)}
                              disabled={submitting}
                              sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                              Reject
                            </Button>
                            <Tooltip title="Edit user">
                              <IconButton size="small" onClick={() => openEditDialog(user)} sx={{ color: '#f59e0b' }}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View user">
                              <IconButton size="small" onClick={() => openViewDialog(user)} sx={{ color: '#38bdf8' }}>
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls page={pendingPage} totalRecords={pendingRegistrations.length} onPageChange={setPendingPage} />
              </TableContainer>
            )
          )}
        </CardContent>
      </Card>

      {/* ── Edit User Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={openEdit}
        onClose={closeEditDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            color: '#111111',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111111', fontWeight: 700, fontSize: '1.2rem', pb: 0 }}>Edit User Profile</DialogTitle>
        <DialogContent sx={{ color: '#111111' }}>
          {selectedUser ? (
            <Box component="form" sx={{ mt: 1 }}>
              {/* ── Avatar + Summary Header ── */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, borderRadius: '16px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#0a0e27', flexShrink: 0 }}>
                  {selectedUser.name?.charAt(0)?.toUpperCase()}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#111111', fontWeight: 700, fontSize: '1.1rem' }}>{selectedUser.name}</Typography>
                  <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem' }}>{selectedUser.email}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip label={selectedUser.role?.toUpperCase()} size="small" sx={{ bgcolor: selectedUser.role === 'customer' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.15)', color: selectedUser.role === 'customer' ? '#15803d' : '#c2410c', fontWeight: 700 }} />
                    <Chip label={selectedUser.isActive ? 'Active' : selectedUser.role === 'manager' ? 'Deactivated' : 'Inactive'} size="small" sx={{ bgcolor: selectedUser.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: selectedUser.isActive ? '#15803d' : '#b91c1c', fontWeight: 700 }} />
                    {selectedUser.role === 'customer' && (
                      <Chip label={selectedUser.classification || 'SILVER'} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#1d4ed8', fontWeight: 700 }} />
                    )}
                    {selectedUser.isKycComplete && (
                      <Chip label="KYC VERIFIED" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#b45309', fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
              </Box>

              {/* ── Personal Information Section ── */}
              <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                Personal Information
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>User ID</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.customerId || selectedUser.adminId || getUserRecordId(selectedUser)}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    InputLabelProps={{ shrink: true }}
                    {...editForm.register('name')}
                    error={!!editForm.formState.errors.name}
                    helperText={editForm.formState.errors.name?.message}
                    sx={{ ...modalTextFieldSx, mb: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    InputLabelProps={{ shrink: true }}
                    {...editForm.register('email')}
                    error={!!editForm.formState.errors.email}
                    helperText={editForm.formState.errors.email?.message}
                    sx={{ ...modalTextFieldSx, mb: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    InputLabelProps={{ shrink: true }}
                    {...editForm.register('phone')}
                    error={!!editForm.formState.errors.phone}
                    helperText={editForm.formState.errors.phone?.message}
                    sx={{ ...modalTextFieldSx, mb: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    {...editForm.register('dateOfBirth')}
                    error={!!editForm.formState.errors.dateOfBirth}
                    helperText={editForm.formState.errors.dateOfBirth?.message || (selectedUser.role === 'manager' ? 'Manager must be at least 18 years old' : 'Required before customer approval')}
                    sx={{ ...modalTextFieldSx, mb: 0 }}
                    inputProps={{ max: new Date().toISOString().split('T')[0] }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={selectedUser.role === 'manager' ? 'Aadhaar Card Number *' : 'Aadhaar Number'}
                    InputLabelProps={{ shrink: true }}
                    {...editForm.register('aadhaarNumber')}
                    error={!!editForm.formState.errors.aadhaarNumber}
                    helperText={editForm.formState.errors.aadhaarNumber?.message || 'Enter exactly 12 digits'}
                    sx={{ ...modalTextFieldSx, mb: 0 }}
                    inputProps={{ maxLength: 12, inputMode: 'numeric', pattern: '[0-9]*' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', textTransform: 'capitalize' }}>{selectedUser.role}</Typography>
                  </Box>
                </Grid>
                {showEditGuardianFields && (
                  <>
                    <Grid item xs={12}>
                      <Alert severity="info">
                        Customer is below 18 years old. Guardian details are mandatory, and the guardian must be 18 or older.
                      </Alert>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Guardian Name"
                        InputLabelProps={{ shrink: true }}
                        {...editForm.register('guardianDetails.name')}
                        error={!!editForm.formState.errors.guardianDetails?.name}
                        helperText={editForm.formState.errors.guardianDetails?.name?.message}
                        sx={{ ...modalTextFieldSx, mb: 0 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Relationship"
                        InputLabelProps={{ shrink: true }}
                        {...editForm.register('guardianDetails.relationship')}
                        error={!!editForm.formState.errors.guardianDetails?.relationship}
                        helperText={editForm.formState.errors.guardianDetails?.relationship?.message}
                        sx={{ ...modalTextFieldSx, mb: 0 }}
                      >
                        <MenuItem value="">Select relationship</MenuItem>
                        {guardianRelationshipOptions.map((option) => (
                          <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Guardian Phone"
                        InputLabelProps={{ shrink: true }}
                        {...editForm.register('guardianDetails.phone')}
                        error={!!editForm.formState.errors.guardianDetails?.phone}
                        helperText={editForm.formState.errors.guardianDetails?.phone?.message}
                        sx={{ ...modalTextFieldSx, mb: 0 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Guardian Date of Birth"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        {...editForm.register('guardianDetails.dateOfBirth')}
                        error={!!editForm.formState.errors.guardianDetails?.dateOfBirth}
                        helperText={editForm.formState.errors.guardianDetails?.dateOfBirth?.message}
                        sx={{ ...modalTextFieldSx, mb: 0 }}
                        inputProps={{ max: new Date().toISOString().split('T')[0] }}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Designation</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.designation || 'Not Provided'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gender</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.gender || 'Not Provided'}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* ── KYC Details Section (Customers only) ── */}
              {selectedUser.role === 'customer' && (
                <>
                  <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                    KYC Details
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aadhaar Number</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: selectedUser.aadhaarNumber ? '#111111' : 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '0.95rem', fontFamily: selectedUser.aadhaarNumber ? 'monospace' : 'inherit' }}>
                            {selectedUser.aadhaarNumber ? `XXXX XXXX ${selectedUser.aadhaarNumber.slice(-4)}` : 'Not Provided'}
                          </Typography>
                          {selectedUser.aadhaarNumber && <Chip label="Verified" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(34,197,94,0.12)', color: '#15803d' }} />}
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PAN Number</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: selectedUser.panNumber ? '#111111' : 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '0.95rem', fontFamily: selectedUser.panNumber ? 'monospace' : 'inherit' }}>
                            {selectedUser.panNumber ? `XXXXX${selectedUser.panNumber.slice(-4)}` : 'Not Provided'}
                          </Typography>
                          {selectedUser.panNumber && <Chip label="Verified" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(34,197,94,0.12)', color: '#15803d' }} />}
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date of Birth</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: selectedUser.dateOfBirth ? '#111111' : 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '0.95rem' }}>
                            {selectedUser.dateOfBirth ? new Date(selectedUser.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Provided'}
                          </Typography>
                          {selectedUser.dateOfBirth && <Chip label="Verified" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(34,197,94,0.12)', color: '#15803d' }} />}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </>
              )}

              {/* ── Account & System Info ── */}
              <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)', mb: 2 }} />
              <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                Account Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joined</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                  </Box>
                </Grid>
                {selectedUser.lastLogin && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                      <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last Login</Typography>
                      <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{new Date(selectedUser.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                    </Box>
                  </Grid>
                )}
                {selectedUser.role === 'customer' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Classification</Typography>
                        <Typography sx={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.95rem' }}>{selectedUser.classification || 'SILVER'}</Typography>
                      </Box>
                    </Grid>
                    {selectedUser.accountNumber && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                          <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Number</Typography>
                          <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', fontFamily: 'monospace' }}>{selectedUser.accountNumber}</Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedUser.accountType && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                          <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Type</Typography>
                          <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', textTransform: 'uppercase' }}>{selectedUser.accountType}</Typography>
                        </Box>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={closeEditDialog}
            sx={{ textTransform: 'none', color: '#666666', '&:hover': { color: '#111111', backgroundColor: 'rgba(0,0,0,0.05)' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={editForm.handleSubmit(handleEditUser)}
            disabled={submitting || !editForm.formState.isValid}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: '#f59e0b',
              color: '#000000',
              '&:hover': { backgroundColor: '#d97706' },
              borderRadius: '10px',
              px: 3,
              py: 1,
              fontWeight: 600,
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View User Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={openView}
        onClose={closeViewDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            color: '#111111',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111111', fontWeight: 700, fontSize: '1.2rem', pb: 0 }}>User Profile</DialogTitle>
        <DialogContent sx={{ color: '#111111' }}>
          {selectedUser ? (
            <Box sx={{ mt: 1 }}>
              {/* ── Avatar + Summary Header ── */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, borderRadius: '16px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#0a0e27', flexShrink: 0 }}>
                  {selectedUser.name?.charAt(0)?.toUpperCase()}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#111111', fontWeight: 700, fontSize: '1.1rem' }}>{selectedUser.name}</Typography>
                  <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem' }}>{selectedUser.email}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip label={selectedUser.role?.toUpperCase()} size="small" sx={{ bgcolor: selectedUser.role === 'customer' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.15)', color: selectedUser.role === 'customer' ? '#15803d' : '#c2410c', fontWeight: 700 }} />
                    <Chip label={selectedUser.isActive ? 'Active' : selectedUser.role === 'manager' ? 'Deactivated' : 'Inactive'} size="small" sx={{ bgcolor: selectedUser.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: selectedUser.isActive ? '#15803d' : '#b91c1c', fontWeight: 700 }} />
                    {selectedUser.role === 'customer' && (
                      <Chip label={selectedUser.classification || 'SILVER'} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#1d4ed8', fontWeight: 700 }} />
                    )}
                    {selectedUser.isKycComplete && (
                      <Chip label="KYC VERIFIED" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#b45309', fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
              </Box>

              {/* ── Personal Information Section ── */}
              <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                Personal Information
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>User ID</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.customerId || selectedUser.adminId || getUserRecordId(selectedUser)}</Typography>
                  </Box>
                </Grid>
                {CUSTOMER_PROFILE_FIELDS.filter((f) => f.section === 'personal').map((field) => {
                  const value = selectedUser[field.name];
                  return (
                    <Grid item xs={12} sm={6} key={field.name}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</Typography>
                        <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{value || 'Not Provided'}</Typography>
                      </Box>
                    </Grid>
                  );
                })}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', textTransform: 'capitalize' }}>{selectedUser.role}</Typography>
                  </Box>
                </Grid>
                {selectedUser.designation && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                      <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Designation</Typography>
                      <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.designation}</Typography>
                    </Box>
                  </Grid>
                )}
                {selectedUser.gender && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                      <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gender</Typography>
                      <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{selectedUser.gender}</Typography>
                    </Box>
                  </Grid>
                )}
                {selectedUser.role === 'manager' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date of Birth</Typography>
                        <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>
                          {selectedUser.dateOfBirth ? new Date(selectedUser.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Provided'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aadhaar Card Number</Typography>
                        <Typography sx={{ color: selectedUser.aadhaarNumber ? '#111111' : 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '0.95rem', fontFamily: selectedUser.aadhaarNumber ? 'monospace' : 'inherit' }}>
                          {selectedUser.aadhaarNumber ? `XXXX XXXX ${selectedUser.aadhaarNumber.slice(-4)}` : 'Not Provided'}
                        </Typography>
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>

              {/* ── KYC Details Section (Customers only) ── */}
              {selectedUser.role === 'customer' && (
                <>
                  <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                    KYC Details
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {CUSTOMER_PROFILE_FIELDS.filter((f) => f.section === 'kyc').map((field) => {
                      let displayValue = selectedUser[field.name];
                      let statusText = null;

                      if (field.mask && displayValue) {
                        displayValue = field.mask(displayValue);
                        statusText = 'Verified';
                      } else if (field.name === 'dateOfBirth' && displayValue) {
                        displayValue = new Date(displayValue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        statusText = 'Verified';
                      }

                      return (
                        <Grid item xs={12} sm={6} key={field.name}>
                          <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                            <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ color: displayValue ? '#111111' : 'rgba(0,0,0,0.4)', fontWeight: 600, fontSize: '0.95rem', fontFamily: displayValue ? 'monospace' : 'inherit' }}>
                                {displayValue || 'Not Provided'}
                              </Typography>
                              {statusText && (
                                <Chip label={statusText} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(34,197,94,0.12)', color: '#15803d' }} />
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {isUnder18(selectedUser.dateOfBirth) && (
                    <>
                      <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                        Guardian Details
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                          ['Guardian Name', selectedUser.guardianDetails?.name],
                          ['Relationship', selectedUser.guardianDetails?.relationship],
                          ['Guardian Phone', selectedUser.guardianDetails?.phone],
                          [
                            'Guardian Date of Birth',
                            selectedUser.guardianDetails?.dateOfBirth
                              ? new Date(selectedUser.guardianDetails.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '',
                          ],
                        ].map(([label, value]) => (
                          <Grid item xs={12} sm={6} key={label}>
                            <Box sx={{ p: 1.5, borderRadius: '10px', background: value ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${value ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)'}` }}>
                              <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                              <Typography sx={{ color: value ? '#111111' : '#b91c1c', fontWeight: 600, fontSize: '0.95rem' }}>
                                {value || 'Required before approval'}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </>
              )}

              {/* ── Account & System Info ── */}
              <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)', mb: 2 }} />
              <Typography sx={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                Account Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joined</Typography>
                    <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                  </Box>
                </Grid>
                {selectedUser.lastLogin && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                      <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last Login</Typography>
                      <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem' }}>{new Date(selectedUser.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                    </Box>
                  </Grid>
                )}
                {selectedUser.role === 'customer' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Classification</Typography>
                        <Typography sx={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.95rem' }}>{selectedUser.classification || 'SILVER'}</Typography>
                      </Box>
                    </Grid>
                    {selectedUser.accountNumber && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                          <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Number</Typography>
                          <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', fontFamily: 'monospace' }}>{selectedUser.accountNumber}</Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedUser.accountType && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                          <Typography sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Type</Typography>
                          <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.95rem', textTransform: 'uppercase' }}>{selectedUser.accountType}</Typography>
                        </Box>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={closeViewDialog}
            sx={{
              textTransform: 'none',
              color: '#d97706',
              '&:hover': { backgroundColor: 'rgba(217,119,6,0.08)' },
              borderRadius: '10px',
              px: 3,
              fontWeight: 600,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reject Registration Dialog ────────────────────────────────────────── */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            color: '#111111',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111111', fontWeight: 700 }}>Reject Registration</DialogTitle>
        <DialogContent sx={{ color: '#111111' }}>
          <Typography sx={{ color: 'rgba(0,0,0,0.7)', mb: 2 }}>
            Please provide a reason for rejecting this registration request. An email notification will be sent to the user.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{
              ...modalTextFieldSx,
              mb: 0,
              '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#ef4444' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#ef4444' },
            }}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setRejectDialogOpen(false)}
            sx={{ color: '#666666', '&:hover': { color: '#111111', backgroundColor: 'rgba(0,0,0,0.05)' }, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRejectRegistration}
            disabled={submitting}
            variant="contained"
            color="error"
            sx={{ borderRadius: '10px', textTransform: 'none', px: 3, color: '#ffffff' }}
          >
            {submitting ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;
