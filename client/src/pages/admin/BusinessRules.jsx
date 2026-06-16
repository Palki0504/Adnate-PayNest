import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, FormControlLabel, IconButton, Tooltip,
} from '@mui/material';
import { Rule, Add, Edit, Delete, CheckCircle, Cancel } from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const CATEGORY_COLORS = {
  transfer: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  overdraft: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  kyc: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  security: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  general: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#111827', borderRadius: '8px', background: '#FFFFFF',
    '& fieldset': { borderColor: '#D1D5DB' },
    '&:hover fieldset': { borderColor: 'rgba(168,85,247,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#a855f7' },
  },
  '& .MuiInputLabel-root': { color: '#6B7280' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#a855f7' },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
  '& .MuiSelect-icon': { color: '#6B7280' },
};

const BusinessRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [form, setForm] = useState({ name: '', key: '', value: '', valueType: 'number', description: '', category: 'general' });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBusinessRules();
      setRules(res.data.rules || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load business rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const openAdd = () => {
    setEditRule(null);
    setForm({ name: '', key: '', value: '', valueType: 'number', description: '', category: 'general' });
    setOpenDialog(true);
  };

  const openEdit = (rule) => {
    setEditRule(rule);
    setForm({ name: rule.name, key: rule.key, value: String(rule.value), valueType: rule.valueType || 'number', description: rule.description || '', category: rule.category || 'general' });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        value: form.valueType === 'boolean' ? form.value === 'true' || form.value === true : form.valueType === 'number' ? parseFloat(form.value) : form.value,
      };
      if (editRule) {
        await adminAPI.updateBusinessRule(editRule._id, payload);
        setSuccess('Rule updated successfully.');
      } else {
        await adminAPI.createBusinessRule(payload);
        setSuccess('Rule created successfully.');
      }
      setOpenDialog(false);
      fetchRules();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save rule.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await adminAPI.updateBusinessRule(rule._id, { isEnabled: !rule.isEnabled });
      setRules((prev) => prev.map((r) => r._id === rule._id ? { ...r, isEnabled: !r.isEnabled } : r));
    } catch {
      setError('Failed to toggle rule.');
    }
  };

  const handleDelete = async () => {
    try {
      await adminAPI.deleteBusinessRule(deleteTarget._id);
      setDeleteTarget(null);
      setSuccess('Rule deleted.');
      fetchRules();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete rule.');
      setDeleteTarget(null);
    }
  };

  const filtered = rules.filter((r) => categoryFilter === 'all' || r.category === categoryFilter);
  const {
    page,
    setPage,
    paginatedRecords: paginatedRules,
  } = useTablePagination(filtered, [categoryFilter, rules.length]);
  const byCategory = {};
  filtered.forEach((r) => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  });

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: { md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Rule sx={{ color: '#a855f7', fontSize: '1.5rem' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700 }}>Business Rules</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Configure system-wide policies and operational limits</Typography>
          </Box>
        </Box>
        <Button
          startIcon={<Add />}
          variant="contained"
          onClick={openAdd}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', '&:hover': { background: 'linear-gradient(135deg, #c084fc, #a855f7)' } }}
        >
          Add Rule
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{success}</Alert>}

      {/* Category Filter */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {['all', 'transfer', 'overdraft', 'kyc', 'security', 'general'].map((cat) => (
          <Button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            size="small"
            sx={{
              textTransform: 'capitalize',
              borderRadius: '999px',
              px: 2,
              fontWeight: 600,
              background: categoryFilter === cat ? CATEGORY_COLORS[cat]?.bg || 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
              color: categoryFilter === cat ? CATEGORY_COLORS[cat]?.color || '#a855f7' : 'rgba(255,255,255,0.55)',
              border: `1px solid ${categoryFilter === cat ? CATEGORY_COLORS[cat]?.color || '#a855f7' : 'rgba(255,255,255,0.08)'}`,
              '&:hover': { background: 'rgba(255,255,255,0.08)' },
            }}
          >
            {cat === 'all' ? 'All Rules' : cat}
          </Button>
        ))}
      </Box>

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress sx={{ color: '#a855f7' }} /></Box>
      ) : (
        <TableContainer component={Card} sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px' }}>
          <Table>
            <TableHead>
              <TableRow>
                {['Rule Name', 'Key', 'Category', 'Value', 'Description', 'Enabled', 'Actions'].map((h) => (
                  <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderColor: 'rgba(255,255,255,0.06)', py: 2, px: 2.5, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.35)', border: 'none' }}>No rules found</TableCell></TableRow>
              ) : paginatedRules.map((rule) => {
                const catStyle = CATEGORY_COLORS[rule.category] || CATEGORY_COLORS.general;
                const displayValue = rule.valueType === 'boolean' ? String(rule.value) : rule.valueType === 'number' && rule.value >= 1000 ? `₹${Number(rule.value).toLocaleString('en-IN')}` : String(rule.value);
                return (
                  <TableRow key={rule._id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.025)' }, opacity: rule.isEnabled ? 1 : 0.5 }}>
                    <TableCell sx={{ color: '#fff', fontWeight: 600, borderColor: 'rgba(255,255,255,0.05)', px: 2.5, fontSize: '0.85rem' }}>{rule.name}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{rule.key}</TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <Chip label={rule.category} size="small" sx={{ bgcolor: catStyle.bg, color: catStyle.color, fontWeight: 700, fontSize: '0.72rem', textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <Typography sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>{displayValue}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.description || '—'}</TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <Switch checked={rule.isEnabled} onChange={() => handleToggle(rule)} size="small"
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#22c55e' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#22c55e' } }} />
                    </TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {rule.isEditable && (
                          <>
                            <Tooltip title="Edit rule">
                              <IconButton size="small" onClick={() => openEdit(rule)} sx={{ color: '#f59e0b', '&:hover': { background: 'rgba(245,158,11,0.1)' } }}><Edit fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title="Delete rule">
                              <IconButton size="small" onClick={() => setDeleteTarget(rule)} sx={{ color: '#ef4444', '&:hover': { background: 'rgba(239,68,68,0.1)' } }}><Delete fontSize="small" /></IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePaginationControls page={page} totalRecords={filtered.length} onPageChange={setPage} />
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ color: '#111827', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>{editRule ? 'Edit Business Rule' : 'Add New Rule'}</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Rule Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} InputProps={{ sx: { color: '#111827' } }} sx={inputSx} InputLabelProps={{ shrink: true }} /></Grid>
            {!editRule && <Grid item xs={12}><TextField fullWidth label="Key (unique identifier)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })} InputProps={{ sx: { color: '#111827' } }} sx={inputSx} InputLabelProps={{ shrink: true }} helperText="e.g. max_transfer_amount" /></Grid>}
            <Grid item xs={6}>
              <TextField select fullWidth label="Value Type" value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })} sx={inputSx} InputLabelProps={{ shrink: true }}>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="boolean">Boolean</MenuItem>
                <MenuItem value="string">Text</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              {form.valueType === 'boolean' ? (
                <TextField select fullWidth label="Value *" value={String(form.value)} onChange={(e) => setForm({ ...form, value: e.target.value })} sx={inputSx} InputLabelProps={{ shrink: true }}>
                  <MenuItem value="true">True</MenuItem>
                  <MenuItem value="false">False</MenuItem>
                </TextField>
              ) : (
                <TextField fullWidth label="Value *" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} InputProps={{ sx: { color: '#111827' } }} sx={inputSx} InputLabelProps={{ shrink: true }} type={form.valueType === 'number' ? 'number' : 'text'} />
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} sx={inputSx} InputLabelProps={{ shrink: true }}>
                {['transfer', 'overdraft', 'kyc', 'security', 'general'].map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} InputProps={{ sx: { color: '#111827' } }} sx={inputSx} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 3, background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editRule ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ef4444', fontWeight: 700, pb: 1.5, borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>Delete Business Rule?</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#FFFFFF', pt: 3, pb: 3 }}>
          <Typography sx={{ color: '#4B5563' }}>Are you sure you want to delete <strong style={{ color: '#111827' }}>{deleteTarget?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1, borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, background: '#ef4444', '&:hover': { background: '#dc2626' } }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BusinessRules;
