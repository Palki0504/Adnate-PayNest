import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Avatar,
} from '@mui/material';
import { Add, Delete, Person, AccountBalance, Phone, Email } from '@mui/icons-material';
import { beneficiaryAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const BeneficiaryManagement = () => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { page, setPage, paginatedRecords: paginatedBeneficiaries } = useTablePagination(beneficiaries, [beneficiaries.length]);

  // Add form state
  const [form, setForm] = useState({ beneficiaryName: '', accountNumber: '', nickname: '', bankName: 'Adnate PayNest', ifscCode: '' });
  const [formErrors, setFormErrors] = useState({});

  const fetchBeneficiaries = async () => {
    try {
      const res = await beneficiaryAPI.getAll();
      setBeneficiaries(res.data.beneficiaries || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load beneficiaries.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBeneficiaries(); }, []);

  const validateForm = () => {
    const errors = {};
    if (!form.beneficiaryName.trim()) errors.beneficiaryName = 'Beneficiary name is required';
    if (!form.accountNumber.trim()) errors.accountNumber = 'Account number is required';
    if (!form.nickname.trim()) errors.nickname = 'Nickname is required';
    return errors;
  };

  const handleAdd = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await beneficiaryAPI.add(form);
      setMessage({ type: 'success', text: 'Beneficiary added successfully!' });
      setAddOpen(false);
      setForm({ beneficiaryName: '', accountNumber: '', nickname: '', bankName: 'Adnate PayNest', ifscCode: '' });
      setFormErrors({});
      fetchBeneficiaries();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add beneficiary.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await beneficiaryAPI.remove(deleteId);
      setMessage({ type: 'success', text: 'Beneficiary removed.' });
      setDeleteId(null);
      fetchBeneficiaries();
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove beneficiary.' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputSx = {
    '--mui-field-label-bg': '#FFFFFF',
    '& .MuiOutlinedInput-root': {
      color: '#111827', borderRadius: '8px',
      background: '#FFFFFF',
      minHeight: 56,
      overflow: 'visible',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
    },
    '& .MuiInputBase-input': {
      color: '#111827',
      WebkitTextFillColor: '#111827',
      lineHeight: 1.45,
    },
    '& .MuiInputBase-input::placeholder': {
      color: 'rgba(17,24,39,0.55)',
      opacity: 1,
    },
    '& .MuiInputLabel-root': {
      color: '#111827',
      backgroundColor: '#FFFFFF',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#111827' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
    '& .MuiFormHelperText-root': { color: '#ef4444' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5, fontFamily: "'Inter', sans-serif" }}>
            Beneficiary Management
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Manage your saved beneficiaries for quick fund transfers
          </Typography>
        </Box>
        <Button
          onClick={() => { setAddOpen(true); setMessage({ type: '', text: '' }); }}
          variant="contained"
          startIcon={<Add />}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#0a0e27', fontWeight: 700, borderRadius: '12px', textTransform: 'none',
            '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
          }}
        >
          Add Beneficiary
        </Button>
      </Box>

      {message.text && (
        <Alert
          severity={message.type}
          sx={{
            mb: 3, borderRadius: '12px',
            bgcolor: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'success' ? '#86efac' : '#fca5a5',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          ) : beneficiaries.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Person sx={{ fontSize: '4rem', color: 'rgba(255,255,255,0.15)', mb: 2 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', mb: 1 }}>No beneficiaries added yet</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', mb: 3 }}>
                Add your first beneficiary to enable quick transfers
              </Typography>
              <Button
                onClick={() => setAddOpen(true)}
                startIcon={<Add />}
                sx={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
              >
                Add Beneficiary
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {['Beneficiary', 'Account Number', 'Bank', 'IFSC', 'Added On', 'Actions'].map((h) => (
                      <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedBeneficiaries.map((ben) => (
                    <TableRow key={ben._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.85rem', fontWeight: 700, color: '#818cf8' }}>
                            {ben.beneficiaryName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{ben.beneficiaryName}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{ben.nickname}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#f59e0b', borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                        {ben.accountNumber}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                        {ben.bankName}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {ben.ifscCode || '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
                        {new Date(ben.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Tooltip title="Remove Beneficiary">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteId(ben._id)}
                            sx={{ color: 'rgba(239,68,68,0.7)', '&:hover': { color: '#ef4444', background: 'rgba(239,68,68,0.1)' } }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {!loading && beneficiaries.length > 0 && (
            <TablePaginationControls page={page} totalRecords={beneficiaries.length} onPageChange={setPage} />
          )}
        </CardContent>
      </Card>

      {/* Add Beneficiary Dialog */}
      <Dialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormErrors({}); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>Add New Beneficiary</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full Name *"
                value={form.beneficiaryName}
                onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                fullWidth
                sx={inputSx}
                error={!!formErrors.beneficiaryName}
                helperText={formErrors.beneficiaryName}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nickname *"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                fullWidth
                sx={inputSx}
                error={!!formErrors.nickname}
                helperText={formErrors.nickname}
                
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Account Number *"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                fullWidth
                sx={inputSx}
                error={!!formErrors.accountNumber}
                helperText={formErrors.accountNumber}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Name"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                fullWidth
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="IFSC Code"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                fullWidth
                sx={inputSx}
                placeholder="e.g. SBIN0001234"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => { setAddOpen(false); setFormErrors({}); }} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={submitting}
            variant="contained"
            sx={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 700, borderRadius: '10px', textTransform: 'none' }}
          >
            {submitting ? <CircularProgress size={18} /> : 'Add Beneficiary'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>Remove Beneficiary</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          <Typography sx={{ color: '#4B5563' }}>
            Are you sure you want to remove this beneficiary? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={handleDelete}
            disabled={submitting}
            variant="contained"
            sx={{ background: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: '10px', textTransform: 'none' }}
          >
            {submitting ? <CircularProgress size={18} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BeneficiaryManagement;
