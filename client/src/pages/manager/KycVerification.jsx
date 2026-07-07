import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid, IconButton, InputAdornment,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AccountBalance, Badge, CheckCircle, Close, Description, Download, Email,
  Error, FactCheck, OpenInNew, Person, Search, Shield, Visibility,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { userAPI } from '../../services/api';

const navy = '#071b3a';
const blue = '#1455d9';
const ink = '#0f172a';
const muted = '#64748b';

const lightFieldSx = {
  '& .MuiInputLabel-root': {
    color: '#475569',
    fontWeight: 800,
    bgcolor: '#fff',
    px: 0.5,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: blue,
  },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: ink,
    borderRadius: '8px',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: blue },
    '&.Mui-focused fieldset': { borderColor: blue },
  },
  '& .MuiInputBase-input': {
    color: ink,
    WebkitTextFillColor: ink,
    fontWeight: 700,
  },
  '& .MuiInputBase-input::placeholder': {
    color: muted,
    opacity: 1,
  },
  '& .MuiSelect-select': {
    color: ink,
    WebkitTextFillColor: ink,
    fontWeight: 800,
  },
  '& .MuiSvgIcon-root': {
    color: muted,
  },
};

const statusSx = (status) => {
  if (status === 'Approved') return { bgcolor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
  if (status === 'Rejected') return { bgcolor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
  if (status === 'Pending') return { bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
  return { bgcolor: '#e0f2fe', color: '#075985', border: '1px solid #bae6fd' };
};

const statusIcon = (status) => {
  if (status === 'Approved') return <CheckCircle sx={{ fontSize: 15 }} />;
  if (status === 'Rejected') return <Error sx={{ fontSize: 15 }} />;
  return <FactCheck sx={{ fontSize: 15 }} />;
};

const actionCellSx = {
  position: 'sticky',
  right: 0,
  zIndex: 2,
  bgcolor: '#fff',
  boxShadow: '-10px 0 18px rgba(15,23,42,0.06)',
};

const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    : '-';

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const formatCurrency = (value) =>
  value !== undefined && value !== null && value !== ''
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
    : '-';

const readBlobErrorMessage = async (err, fallback) => {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return JSON.parse(text).message || fallback;
    } catch {
      return fallback;
    }
  }
  return err.response?.data?.message || fallback;
};

const Field = ({ label, value }) => (
  <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 72 }}>
    <Typography sx={{ color: muted, fontSize: '0.72rem', fontWeight: 800 }}>{label}</Typography>
    <Typography sx={{ color: ink, fontWeight: 800, mt: 0.4, wordBreak: 'break-word' }}>{value || '-'}</Typography>
  </Box>
);

const getSubmittedChanges = (customer) => (customer?.kycChangeSummary || []).filter((change) => (
  change?.label || change?.field || change?.oldValue || change?.newValue
));

const ChangesTooltip = ({ changes }) => {
  if (!changes.length) {
    return (
      <Chip
        size="small"
        label="No changes"
        sx={{ bgcolor: '#f1f5f9', color: muted, fontWeight: 850, border: '1px solid #e2e8f0' }}
      />
    );
  }

  return (
    <Tooltip
      arrow
      placement="top"
      title={(
        <Box sx={{ p: 0.5 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, mb: 0.6 }}>Changed Fields</Typography>
          {changes.map((change) => (
            <Typography key={`${change.field}-${change.label}`} sx={{ fontSize: '0.74rem' }}>
              {change.label || change.field}
            </Typography>
          ))}
        </Box>
      )}
    >
      <Chip
        size="small"
        label={`${changes.length} ${changes.length === 1 ? 'Change' : 'Changes'}`}
        sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 950, border: '1px solid #bbf7d0', cursor: 'help' }}
      />
    </Tooltip>
  );
};

const ChangesComparisonTable = ({ changes }) => {
  if (!changes.length) return null;

  return (
    <Box sx={{ mb: 2.4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4 }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
          <FactCheck fontSize="small" />
        </Avatar>
        <Typography sx={{ color: navy, fontWeight: 900 }}>Submitted Profile Changes</Typography>
        <Chip size="small" label={`${changes.length} ${changes.length === 1 ? 'Change' : 'Changes'}`} sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 900 }} />
      </Box>
      <TableContainer component={Paper} sx={{ borderRadius: '8px', border: '1px solid #dbeafe', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#eff6ff' }}>
            <TableRow>
              {['Field Name', 'Old Value', 'New Value'].map((head) => (
                <TableCell key={head} sx={{ color: navy, fontWeight: 950 }}>{head}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {changes.map((change) => (
              <TableRow key={`${change.field}-${change.label}`}>
                <TableCell sx={{ color: '#0f2a5f', fontWeight: 900 }}>{change.label || change.field || '-'}</TableCell>
                <TableCell sx={{ color: '#64748b', fontWeight: 800, bgcolor: '#f8fafc' }}>{change.oldValue || '-'}</TableCell>
                <TableCell sx={{ color: '#166534', fontWeight: 950, bgcolor: '#f0fdf4' }}>{change.newValue || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const WorkflowSwitchCard = ({ activeWorkflow, setActiveWorkflow }) => (
  <Card sx={{ bgcolor: '#fff', borderRadius: '8px', mb: 2.5, boxShadow: '0 12px 28px rgba(2,8,23,0.12)', border: '1px solid #dbeafe' }}>
    <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', p: 2, '&:last-child': { pb: 2 } }}>
    <Button
      startIcon={<Shield />}
      variant={activeWorkflow === 'kyc' ? 'contained' : 'outlined'}
      onClick={() => setActiveWorkflow('kyc')}
      sx={{
        bgcolor: activeWorkflow === 'kyc' ? blue : '#fff',
        color: activeWorkflow === 'kyc' ? '#fff' : blue,
        borderColor: '#bfdbfe',
        textTransform: 'none',
        fontWeight: 900,
        borderRadius: '8px',
        px: 2.2,
        '&:hover': { bgcolor: activeWorkflow === 'kyc' ? '#0f45b8' : '#eff6ff' },
      }}
    >
      KYC Verification
    </Button>
    <Button
      startIcon={<FactCheck />}
      variant={activeWorkflow === 'changes' ? 'contained' : 'outlined'}
      onClick={() => setActiveWorkflow('changes')}
      sx={{
        bgcolor: activeWorkflow === 'changes' ? blue : '#fff',
        color: activeWorkflow === 'changes' ? '#fff' : blue,
        borderColor: '#bfdbfe',
        textTransform: 'none',
        fontWeight: 900,
        borderRadius: '8px',
        px: 2.2,
        '&:hover': { bgcolor: activeWorkflow === 'changes' ? '#0f45b8' : '#eff6ff' },
      }}
    >
      Profile Changes
    </Button>
    </CardContent>
  </Card>
);

const Section = ({ icon, title, children }) => (
  <Box sx={{ mb: 2.4 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4 }}>
      <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(20,85,217,0.1)', color: blue }}>{icon}</Avatar>
      <Typography sx={{ color: navy, fontWeight: 900 }}>{title}</Typography>
    </Box>
    {children}
  </Box>
);

const DocumentCards = ({ customer, onPreview, onDownload, readonly = false }) => (
  <Grid container spacing={1.5}>
    {(customer?.documents || []).map((doc) => (
      <Grid item xs={12} sm={6} md={4} key={doc._id}>
        <Box sx={{ p: 1.6, borderRadius: '8px', bgcolor: '#fff', border: '1px solid #dbeafe', boxShadow: '0 8px 20px rgba(15,23,42,0.06)', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description sx={{ color: blue }} />
            <Typography sx={{ color: ink, fontWeight: 900 }}>{doc.label || doc.type}</Typography>
          </Box>
          <Typography sx={{ color: muted, fontSize: '0.78rem', mt: 0.6, wordBreak: 'break-word' }}>{doc.originalName || 'Uploaded document'}</Typography>
          <Chip size="small" label={doc.status || customer.kycStatus || 'Uploaded'} sx={{ mt: 1, ...statusSx(doc.status === 'Pending Review' ? 'Pending' : doc.status), fontWeight: 800 }} />
          <Box sx={{ display: 'flex', gap: 1, mt: 1.4, flexWrap: 'wrap' }}>
            <Button size="small" startIcon={<OpenInNew />} onClick={() => onPreview(customer, doc)} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Preview
            </Button>
            {readonly && (
              <Button size="small" startIcon={<Download />} onClick={() => onDownload(customer, doc)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                Download
              </Button>
            )}
          </Box>
        </Box>
      </Grid>
    ))}
    {(customer?.documents || []).length === 0 && (
      <Grid item xs={12}>
        <Alert severity="info">No uploaded KYC documents are available for this customer.</Alert>
      </Grid>
    )}
  </Grid>
);

const KycVerification = () => {
  const location = useLocation();
  const [activeWorkflow, setActiveWorkflow] = useState('kyc');
  const [status, setStatus] = useState('Pending');
  const [profileChangeStatus, setProfileChangeStatus] = useState('Pending');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [profileRequests, setProfileRequests] = useState([]);
  const [profileStats, setProfileStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [reviewCustomer, setReviewCustomer] = useState(null);
  const [detailsCustomer, setDetailsCustomer] = useState(null);
  const [changeRequest, setChangeRequest] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [changeRemarks, setChangeRemarks] = useState('');
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [changeDialogError, setChangeDialogError] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [changeRejectMode, setChangeRejectMode] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [changeReviewing, setChangeReviewing] = useState(false);
  const [viewer, setViewer] = useState({ open: false, title: '', url: '', mimeType: '', loading: false, error: '' });

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userAPI.getKycRequests({ status });
      const loadedCustomers = res.data.customers || [];
      const fallbackStats = {
        pending: status === 'Pending' || status === 'All' ? loadedCustomers.filter((customer) => customer.kycStatus === 'Pending').length : 0,
        approved: status === 'Approved' || status === 'All' ? loadedCustomers.filter((customer) => customer.kycStatus === 'Approved').length : 0,
        rejected: status === 'Rejected' || status === 'All' ? loadedCustomers.filter((customer) => customer.kycStatus === 'Rejected').length : 0,
        total: loadedCustomers.length,
      };
      setCustomers(loadedCustomers);
      setStats(res.data.stats || fallbackStats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load KYC requests.');
    } finally {
      setLoading(false);
    }
  };

  const loadProfileChangeRequests = async () => {
    setProfileLoading(true);
    try {
      const res = await userAPI.getProfileChangeRequests({ status: profileChangeStatus });
      setProfileRequests(res.data.requests || []);
      setProfileStats(res.data.stats || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile change requests.');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [status]);

  useEffect(() => {
    loadProfileChangeRequests();
  }, [profileChangeStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadRequests();
      loadProfileChangeRequests();
    }, 30000);
    return () => clearInterval(interval);
  }, [status, profileChangeStatus]);

  useEffect(() => {
    const targetId = new URLSearchParams(location.search).get('profileRequest');
    if (!targetId || profileRequests.length === 0) return;
    const request = profileRequests.find((item) => String(item._id) === String(targetId));
    if (request) {
      setActiveWorkflow('changes');
      setChangeRequest(request);
      setChangeDialogError('');
      setChangeRemarks('');
      setChangeRejectMode(false);
    }
  }, [location.search, profileRequests]);

  useEffect(() => () => {
    if (viewer.url) URL.revokeObjectURL(viewer.url);
  }, [viewer.url]);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) => [
      customer.customerId,
      customer.name,
      customer.email,
      customer.phone,
      customer.classification,
      customer.kycStatus,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [customers, search]);

  const openDocument = async (customer, doc, download = false) => {
    if (!download) {
      if (viewer.url) URL.revokeObjectURL(viewer.url);
      setViewer({ open: true, title: doc.label || doc.type || 'KYC Document', url: '', mimeType: doc.mimeType || '', loading: true, error: '' });
    }
    try {
      const res = await userAPI.getKycDocument(customer._id, doc._id, download);
      const blob = new Blob([res.data], { type: res.headers['content-type'] || doc.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        const disposition = res.headers['content-disposition'] || '';
        link.download = disposition.match(/filename="?([^"]+)"?/)?.[1] || doc.originalName || 'kyc-document';
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      setViewer({ open: true, title: doc.label || doc.type || 'KYC Document', url, mimeType: blob.type, loading: false, error: '' });
    } catch (err) {
      const message = await readBlobErrorMessage(err, 'Unable to open document.');
      if (download) {
        setDialogError(message);
      } else {
        setViewer((prev) => ({ ...prev, loading: false, error: message }));
      }
    }
  };

  const closeViewer = () => {
    if (viewer.url) URL.revokeObjectURL(viewer.url);
    setViewer({ open: false, title: '', url: '', mimeType: '', loading: false, error: '' });
  };

  const openReview = (customer) => {
    setReviewCustomer(customer);
    setDetailsCustomer(null);
    setDialogError('');
    setRemarks('');
    setRejectMode(false);
  };

  const openDetails = (customer) => {
    setDetailsCustomer(customer);
    setReviewCustomer(null);
    setDialogError('');
    setRemarks('');
    setRejectMode(false);
  };

  const review = async (nextStatus) => {
    if (!reviewCustomer) return;
    setError('');
    setDialogError('');
    setSuccess('');
    if (nextStatus === 'Rejected' && !remarks.trim()) {
      setDialogError('Rejection remarks are required before rejecting KYC.');
      setRejectMode(true);
      return;
    }
    try {
      setReviewing(true);
      await userAPI.reviewKyc(reviewCustomer._id, { status: nextStatus, remarks });
      setSuccess(`KYC ${nextStatus.toLowerCase()} successfully.`);
      setReviewCustomer(null);
      setRemarks('');
      setRejectMode(false);
      loadRequests();
    } catch (err) {
      setDialogError(err.response?.data?.message || 'Unable to review KYC.');
    } finally {
      setReviewing(false);
    }
  };

  const reviewProfileChanges = async (nextStatus) => {
    if (!changeRequest) return;
    setChangeDialogError('');
    setSuccess('');
    if (nextStatus === 'Rejected' && !changeRemarks.trim()) {
      setChangeDialogError('Rejection remarks are required before rejecting profile changes.');
      setChangeRejectMode(true);
      return;
    }
    try {
      setChangeReviewing(true);
      await userAPI.reviewProfileChangeRequest(changeRequest._id, { status: nextStatus, remarks: changeRemarks });
      setSuccess(`Profile changes ${nextStatus.toLowerCase()} successfully.`);
      setChangeRequest(null);
      setChangeRemarks('');
      setChangeRejectMode(false);
      loadProfileChangeRequests();
    } catch (err) {
      setChangeDialogError(err.response?.data?.message || 'Unable to review profile changes.');
    } finally {
      setChangeReviewing(false);
    }
  };

  const profileFields = (customer) => ({
    customer: [
      ['Customer Name', customer.name],
      ['Customer ID', customer.customerId],
      ['Email', customer.email],
      ['Phone', customer.phone],
      ['Classification', customer.classification || 'PENDING'],
      ['KYC Status', customer.kycStatus],
    ],
    personal: [
      ['DOB', formatDate(customer.dateOfBirth)],
      ['Gender', customer.gender],
      ['Marital Status', customer.maritalStatus],
      ['Occupation', customer.occupation || customer.employmentType],
      ['Annual Income', formatCurrency(customer.annualIncome)],
      ['Nationality', customer.nationality || 'Indian'],
    ],
    address: [
      ['House No.', customer.address?.houseFlatNumber],
      ['Street', customer.address?.street],
      ['Area', customer.address?.area],
      ['City', customer.address?.city],
      ['State', customer.address?.state],
      ['PIN Code', customer.address?.pinCode],
      ['Country', customer.address?.country],
    ],
    nominee: [
      ['Nominee Name', customer.nomineeDetails?.name],
      ['Relationship', customer.nomineeDetails?.relationship],
      ['Contact Number', customer.nomineeDetails?.contactNumber],
      ['DOB', formatDate(customer.nomineeDetails?.dateOfBirth)],
    ],
  });

  const renderFieldGrid = (items) => (
    <Grid container spacing={1.4}>
      {items.map(([label, value]) => (
        <Grid item xs={12} sm={6} md={4} key={label}>
          <Field label={label} value={value} />
        </Grid>
      ))}
    </Grid>
  );

  const renderAccounts = (customer) => {
    const accounts = customer.accounts?.length ? customer.accounts : [customer.account1, customer.account2, customer.account3].filter(Boolean);
    return (
      <Grid container spacing={1.5}>
        {accounts.map((account, index) => (
          <Grid item xs={12} sm={6} md={4} key={account.accountId || account.accountNumber || index}>
            <Box sx={{ p: 1.6, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #dbeafe' }}>
              <Typography sx={{ color: ink, fontWeight: 900, textTransform: 'capitalize' }}>{account.accountType || 'Account'}</Typography>
              <Typography sx={{ color: muted, fontSize: '0.76rem', fontFamily: 'monospace' }}>{account.accountNumber || '-'}</Typography>
              <Typography sx={{ color: '#0f766e', fontWeight: 900, mt: 0.8 }}>{formatCurrency(account.balance)}</Typography>
              <Chip size="small" label={account.accountStatus || account.status || 'active'} sx={{ mt: 1, bgcolor: '#e0f2fe', color: '#075985', fontWeight: 800, textTransform: 'capitalize' }} />
            </Box>
          </Grid>
        ))}
        {accounts.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">No linked bank accounts found for this customer.</Alert>
          </Grid>
        )}
      </Grid>
    );
  };

  const renderCustomerSections = (customer, readonly = false) => {
    const fields = profileFields(customer);
    return (
      <>
        {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
        <Section icon={<Person fontSize="small" />} title={readonly ? 'Customer Information' : 'Personal Information'}>
          {renderFieldGrid(readonly ? fields.customer : [...fields.customer, ...fields.personal])}
        </Section>
        {readonly && (
          <Section icon={<Badge fontSize="small" />} title="Personal Information">
            {renderFieldGrid(fields.personal)}
          </Section>
        )}
        <Section icon={<Shield fontSize="small" />} title="Address Information">
          {renderFieldGrid(fields.address)}
        </Section>
        <Section icon={<Person fontSize="small" />} title="Nominee Details">
          {renderFieldGrid(fields.nominee)}
        </Section>
        <Section icon={<AccountBalance fontSize="small" />} title="Bank Accounts">
          {renderAccounts(customer)}
        </Section>
        <Section icon={<Description fontSize="small" />} title="Uploaded Documents">
          <DocumentCards customer={customer} onPreview={openDocument} onDownload={(c, d) => openDocument(c, d, true)} readonly={readonly} />
        </Section>
        {readonly && customer.kycStatus === 'Approved' && (
          <Section icon={<CheckCircle fontSize="small" />} title="Approval Details">
            {renderFieldGrid([
              ['Approved By', customer.kycApprovedBy || 'Manager'],
              ['Approval Date', formatDate(customer.kycApprovedAt)],
              ['Approval Time', customer.kycApprovedAt ? new Date(customer.kycApprovedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'],
            ])}
          </Section>
        )}
        {readonly && customer.kycStatus === 'Rejected' && (
          <Section icon={<Error fontSize="small" />} title="Rejection Details">
            {renderFieldGrid([
              ['Rejected By', customer.kycRejectedBy || 'Manager'],
              ['Rejection Date', formatDateTime(customer.kycRejectedAt)],
              ['Rejection Remarks', customer.kycRejectedReason],
            ])}
          </Section>
        )}
      </>
    );
  };

  return (
    <Box>
      <Box sx={{ color: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 900 }}>KYC Verification</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.68)', mt: 0.6 }}>Review KYC documents separately from customer profile change approvals.</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={1.8} sx={{ mb: 2.5 }}>
        {[
          ['Pending Verification', stats.pending, '#f59e0b', <FactCheck />],
          ['Approved', stats.approved, '#16a34a', <CheckCircle />],
          ['Rejected', stats.rejected, '#dc2626', <Error />],
          ['Pending Profile Changes', profileStats.pending, '#0ea5e9', <Badge />],
          ['Total Customers', stats.total, blue, <Person />],
        ].map(([label, value, color, icon]) => (
          <Grid item xs={12} sm={6} md={2.4} key={label}>
            <Card sx={{ bgcolor: '#fff', borderRadius: '8px', boxShadow: '0 14px 32px rgba(2,8,23,0.14)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.6 }}>
                <Avatar sx={{ bgcolor: `${color}18`, color }}>{icon}</Avatar>
                <Box>
                  <Typography sx={{ color: muted, fontSize: '0.78rem', fontWeight: 800 }}>{label}</Typography>
                  <Typography sx={{ color: navy, fontWeight: 900, fontSize: '1.45rem' }}>{value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {activeWorkflow === 'kyc' && (
        <>
          <Card sx={{ bgcolor: '#fff', borderRadius: '8px', mb: 2.5, boxShadow: '0 16px 38px rgba(2,8,23,0.14)' }}>
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Search Customer"
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 300 }, ...lightFieldSx }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: muted }} /></InputAdornment> }}
              />
              <TextField select label="KYC Status" size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 190, ...lightFieldSx }}>
                {['Pending', 'Approved', 'Rejected', 'Not Started', 'All'].map((item) => (
                  <MenuItem key={item} value={item} sx={{ color: ink, fontWeight: 700 }}>
                    {item === 'All' ? 'All Status' : item}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={loadRequests} disabled={loading} sx={{ bgcolor: blue, textTransform: 'none', fontWeight: 900 }}>
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Refresh'}
              </Button>
            </CardContent>
          </Card>

          <WorkflowSwitchCard activeWorkflow={activeWorkflow} setActiveWorkflow={setActiveWorkflow} />

          <TableContainer component={Paper} sx={{ borderRadius: '8px', overflowX: 'auto', bgcolor: '#fff', border: '1px solid #dbeafe', boxShadow: '0 18px 42px rgba(2,8,23,0.16)' }}>
            <Table sx={{ minWidth: 1280, bgcolor: '#fff' }}>
              <TableHead sx={{ bgcolor: '#07306f' }}>
                <TableRow>
                  {['Customer ID', 'Customer Name', 'Email', 'Classification', 'KYC Status', 'Submitted Date & Time', 'Approved Date & Time', 'Action'].map((head) => (
                    <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', py: 2, ...(head === 'Action' ? { ...actionCellSx, bgcolor: '#07306f', zIndex: 4, boxShadow: '-10px 0 18px rgba(2,8,23,0.18)' } : {}) }}>
                      {head}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={{ bgcolor: '#fff' }}>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer._id} hover sx={{ bgcolor: '#fff', '&:nth-of-type(even)': { bgcolor: '#f8fbff' }, '&:hover': { bgcolor: '#eef6ff' }, '&:hover td': { bgcolor: '#eef6ff' }, '& td': { bgcolor: 'inherit', borderColor: '#e2e8f0', py: 2 } }}>
                    <TableCell sx={{ color: '#0f2a5f', fontWeight: 950, letterSpacing: 0.2 }}>{customer.customerId || '-'}</TableCell>
                    <TableCell sx={{ minWidth: 210 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#e0f2fe', color: blue, fontWeight: 900 }}>{(customer.name || 'C').charAt(0)}</Avatar>
                        <Box>
                          <Typography sx={{ color: navy, fontWeight: 950, lineHeight: 1.2 }}>{customer.name}</Typography>
                          <Typography sx={{ color: muted, fontSize: '0.75rem', fontWeight: 700 }}>Customer profile</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#2563eb', fontWeight: 800, minWidth: 260 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Email sx={{ color: '#2563eb', fontSize: 18 }} />
                        {customer.email}
                      </Box>
                    </TableCell>
                    <TableCell><Chip size="small" label={customer.classification || 'PENDING'} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 900 }} /></TableCell>
                    <TableCell><Chip size="small" icon={statusIcon(customer.kycStatus)} label={customer.kycStatus} sx={{ ...statusSx(customer.kycStatus), fontWeight: 900 }} /></TableCell>
                    <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap', fontWeight: 800 }}>{formatDateTime(customer.kycSubmittedAt)}</TableCell>
                    <TableCell sx={{ color: customer.kycStatus === 'Approved' ? '#166534' : '#64748b', whiteSpace: 'nowrap', fontWeight: 850 }}>{customer.kycStatus === 'Approved' ? formatDateTime(customer.kycApprovedAt) : '-'}</TableCell>
                    <TableCell sx={actionCellSx}>
                      {customer.kycStatus === 'Pending' ? (
                        <Button startIcon={<Shield />} variant="contained" onClick={() => openReview(customer)} sx={{ bgcolor: blue, textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(20,85,217,0.24)' }}>
                          Review KYC
                        </Button>
                      ) : (
                        <Button startIcon={<Visibility />} variant="outlined" onClick={() => openDetails(customer)} sx={{ color: blue, borderColor: '#bfdbfe', textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          View Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredCustomers.length === 0 && (
                  <TableRow sx={{ bgcolor: '#fff' }}>
                    <TableCell colSpan={8} sx={{ bgcolor: '#fff' }}>
                      <Typography sx={{ color: muted, textAlign: 'center', py: 3 }}>No KYC records found.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {activeWorkflow === 'changes' && (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 900 }}>Customer Profile Change Requests</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.62)', mt: 0.5 }}>Approve or reject customer-submitted profile edits independently from KYC verification.</Typography>
          </Box>

          <Card sx={{ bgcolor: '#fff', borderRadius: '8px', mb: 2.5, boxShadow: '0 16px 38px rgba(2,8,23,0.14)' }}>
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField select label="Request Status" size="small" value={profileChangeStatus} onChange={(e) => setProfileChangeStatus(e.target.value)} sx={{ minWidth: 210, ...lightFieldSx }}>
                {['Pending', 'Approved', 'Rejected', 'All'].map((item) => (
                  <MenuItem key={item} value={item} sx={{ color: ink, fontWeight: 700 }}>{item === 'All' ? 'All Status' : item}</MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={loadProfileChangeRequests} disabled={profileLoading} sx={{ bgcolor: blue, textTransform: 'none', fontWeight: 900 }}>
                {profileLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Refresh Requests'}
              </Button>
            </CardContent>
          </Card>

          <WorkflowSwitchCard activeWorkflow={activeWorkflow} setActiveWorkflow={setActiveWorkflow} />

          <TableContainer component={Paper} sx={{ borderRadius: '8px', overflowX: 'auto', bgcolor: '#fff', border: '1px solid #dbeafe', boxShadow: '0 18px 42px rgba(2,8,23,0.16)' }}>
            <Table sx={{ minWidth: 1120, bgcolor: '#fff' }}>
              <TableHead sx={{ bgcolor: '#07306f' }}>
                <TableRow>
                  {['Customer Name', 'Customer ID', 'Classification', 'Submitted Date & Time', 'Number of Changes', 'Status', 'Action'].map((head) => (
                    <TableCell key={head} sx={{ color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', py: 2 }}>{head}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {profileRequests.map((item) => {
                  const changes = item.request?.changes || [];
                  return (
                    <TableRow key={item._id} hover sx={{ bgcolor: '#fff', '&:nth-of-type(even)': { bgcolor: '#f8fbff' }, '& td': { borderColor: '#e2e8f0', py: 2 } }}>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Typography sx={{ color: navy, fontWeight: 950 }}>{item.name}</Typography>
                        <Typography sx={{ color: muted, fontSize: '0.75rem', fontWeight: 700 }}>{item.email}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#0f2a5f', fontWeight: 950 }}>{item.customerId || '-'}</TableCell>
                      <TableCell><Chip size="small" label={item.classification || 'PENDING'} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 900 }} /></TableCell>
                      <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap', fontWeight: 800 }}>{formatDateTime(item.request?.submittedAt)}</TableCell>
                      <TableCell><ChangesTooltip changes={changes} /></TableCell>
                      <TableCell><Chip size="small" label={item.request?.status || 'Pending'} sx={{ ...statusSx(item.request?.status || 'Pending'), fontWeight: 900 }} /></TableCell>
                      <TableCell>
                        <Button startIcon={<Visibility />} variant="contained" onClick={() => { setChangeRequest(item); setChangeDialogError(''); setChangeRemarks(''); setChangeRejectMode(false); }} sx={{ bgcolor: blue, textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          View Changes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!profileLoading && profileRequests.length === 0 && (
                  <TableRow><TableCell colSpan={7}><Typography sx={{ color: muted, textAlign: 'center', py: 3 }}>No profile change requests found.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Dialog open={!!reviewCustomer} onClose={() => setReviewCustomer(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: navy, fontWeight: 900 }}>
          Review Customer Filled KYC Details - {reviewCustomer?.name}
          <IconButton onClick={() => setReviewCustomer(null)} sx={{ position: 'absolute', right: 12, top: 10 }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fff', maxHeight: '75vh' }}>
          {reviewCustomer && renderCustomerSections(reviewCustomer)}
          {rejectMode && (
            <Box sx={{ p: 2, borderRadius: '8px', bgcolor: '#fef2f2', border: '1px solid #fecaca', mt: 1 }}>
              <Typography sx={{ color: '#991b1b', fontWeight: 900, mb: 1 }}>Rejection Remarks</Typography>
              <TextField
                placeholder="Enter reason for rejection..."
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (dialogError) setDialogError('');
                }}
                fullWidth
                multiline
                minRows={4}
                required
                error={!!dialogError && !remarks.trim()}
                helperText="Examples: PAN card image is unclear. Aadhaar details do not match. Signature mismatch. Please upload salary proof."
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReviewCustomer(null)} sx={{ textTransform: 'none', fontWeight: 800 }}>Close</Button>
          {rejectMode && <Button onClick={() => { setRejectMode(false); setDialogError(''); setRemarks(''); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancel Reject</Button>}
          <Button
            color="error"
            variant={rejectMode ? 'contained' : 'outlined'}
            disabled={reviewing}
            onClick={() => {
              if (!rejectMode) {
                setRejectMode(true);
                setDialogError('');
                return;
              }
              review('Rejected');
            }}
            sx={{ textTransform: 'none', fontWeight: 900 }}
          >
            {rejectMode ? 'Submit Rejection' : 'Reject KYC'}
          </Button>
          <Button startIcon={<CheckCircle />} variant="contained" disabled={reviewing} onClick={() => { setRejectMode(false); review('Approved'); }} sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 900 }}>
            Approve KYC
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!detailsCustomer} onClose={() => setDetailsCustomer(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: navy, fontWeight: 900 }}>
          KYC Details - {detailsCustomer?.name}
          <IconButton onClick={() => setDetailsCustomer(null)} sx={{ position: 'absolute', right: 12, top: 10 }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fff', maxHeight: '75vh' }}>
          {detailsCustomer && renderCustomerSections(detailsCustomer, true)}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={() => setDetailsCustomer(null)} sx={{ bgcolor: '#e2e8f0', color: ink, textTransform: 'none', fontWeight: 900, '&:hover': { bgcolor: '#cbd5e1' } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!changeRequest} onClose={() => setChangeRequest(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: navy, fontWeight: 900 }}>
          Profile Change Request - {changeRequest?.name}
          <IconButton onClick={() => setChangeRequest(null)} sx={{ position: 'absolute', right: 12, top: 10 }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fff' }}>
          {changeDialogError && <Alert severity="error" sx={{ mb: 2 }}>{changeDialogError}</Alert>}
          {changeRequest && (
            <>
              <Grid container spacing={1.4} sx={{ mb: 2.4 }}>
                {[
                  ['Customer Name', changeRequest.name],
                  ['Customer ID', changeRequest.customerId],
                  ['Email', changeRequest.email],
                  ['Classification', changeRequest.classification],
                  ['Status', changeRequest.request?.status],
                  ['Submitted On', formatDateTime(changeRequest.request?.submittedAt)],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={label}><Field label={label} value={value} /></Grid>
                ))}
              </Grid>
              <ChangesComparisonTable changes={changeRequest.request?.changes || []} />
              {changeRequest.request?.status === 'Rejected' && changeRequest.request?.remarks && (
                <Alert severity="error" sx={{ mb: 2 }}>Rejected: {changeRequest.request.remarks}</Alert>
              )}
              {changeRejectMode && (
                <Box sx={{ p: 2, borderRadius: '8px', bgcolor: '#fef2f2', border: '1px solid #fecaca', mt: 1 }}>
                  <Typography sx={{ color: '#991b1b', fontWeight: 900, mb: 1 }}>Rejection Remarks</Typography>
                  <TextField
                    placeholder="Enter reason for rejecting profile changes..."
                    value={changeRemarks}
                    onChange={(e) => {
                      setChangeRemarks(e.target.value);
                      if (changeDialogError) setChangeDialogError('');
                    }}
                    fullWidth
                    multiline
                    minRows={3}
                    required
                    error={!!changeDialogError && !changeRemarks.trim()}
                    autoFocus
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangeRequest(null)} sx={{ textTransform: 'none', fontWeight: 800 }}>Close</Button>
          {changeRequest?.request?.status === 'Pending' && (
            <>
              {changeRejectMode && <Button onClick={() => { setChangeRejectMode(false); setChangeDialogError(''); setChangeRemarks(''); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancel Reject</Button>}
              <Button
                color="error"
                variant={changeRejectMode ? 'contained' : 'outlined'}
                disabled={changeReviewing}
                onClick={() => {
                  if (!changeRejectMode) {
                    setChangeRejectMode(true);
                    setChangeDialogError('');
                    return;
                  }
                  reviewProfileChanges('Rejected');
                }}
                sx={{ textTransform: 'none', fontWeight: 900 }}
              >
                {changeRejectMode ? 'Submit Rejection' : 'Reject Changes'}
              </Button>
              <Button startIcon={<CheckCircle />} variant="contained" disabled={changeReviewing} onClick={() => { setChangeRejectMode(false); reviewProfileChanges('Approved'); }} sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 900 }}>
                Approve Changes
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={viewer.open} onClose={closeViewer} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ color: navy, fontWeight: 900 }}>
          {viewer.title}
          <Tooltip title="Close viewer"><IconButton onClick={closeViewer} sx={{ position: 'absolute', right: 12, top: 10 }}><Close /></IconButton></Tooltip>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 420, bgcolor: '#f8fafc' }}>
          {viewer.loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>}
          {viewer.error && <Alert severity="error">{viewer.error}</Alert>}
          {!viewer.loading && !viewer.error && viewer.url && (
            viewer.mimeType?.startsWith('image/') ? (
              <Box component="img" src={viewer.url} alt={viewer.title} sx={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', mx: 'auto', borderRadius: '8px', bgcolor: '#fff' }} />
            ) : (
              <Box component="iframe" title={viewer.title} src={viewer.url} sx={{ width: '100%', height: '70vh', border: 0, borderRadius: '8px', bgcolor: '#fff' }} />
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeViewer} sx={{ textTransform: 'none', fontWeight: 800 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KycVerification;
