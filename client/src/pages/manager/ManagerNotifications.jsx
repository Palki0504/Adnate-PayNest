import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Skeleton, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert,
  CircularProgress, FormControl, Select, Grid,
} from '@mui/material';
import { CheckCircle, Error, Info, Notifications, Send } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { managerAPI, notificationAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const typeConfig = {
  approval: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircle /> },
  rejection: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <Error /> },
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: <Info /> },
  system: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: <Notifications /> },
};

const ManagerNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [sending, setSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState({ type: '', text: '' });
  const { page, setPage, paginatedRecords: paginatedNotifications } = useTablePagination(notifications, [notifications.length]);
  const [form, setForm] = useState({
    targetCustomerId: 'all_customers',
    priority: 'medium',
    title: '',
    message: '',
  });

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll({ limit: 50 });
      setNotifications(res.data?.notifications || res.data?.data || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await managerAPI.getMessageCustomers();
      setCustomers(res.data.customers || []);
    } catch (err) {
      setMessageStatus({
        type: 'error',
        text: err.response?.data?.message || 'Unable to load customers. Please make sure you are logged in as a manager.',
      });
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      fetchNotifications();
    } catch (_) {}
  };

  const markRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch (_) {}
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) await markRead(notification._id);
    if (notification.link) navigate(notification.link);
  };

  const openCompose = () => {
    setComposeOpen(true);
    setMessageStatus({ type: '', text: '' });
    if (customers.length === 0) fetchCustomers();
  };

  const handleSendMessage = async () => {
    if (!form.targetCustomerId) {
      setMessageStatus({ type: 'error', text: 'Please select a customer or customer group.' });
      return;
    }
    if (!form.title.trim() || !form.message.trim()) {
      setMessageStatus({ type: 'error', text: 'Title and message are required.' });
      return;
    }

    setSending(true);
    setMessageStatus({ type: '', text: '' });
    try {
      const res = await managerAPI.sendCustomerMessage({
        ...form,
        title: form.title.trim(),
        message: form.message.trim(),
      });
      setMessageStatus({ type: 'success', text: res.data.message || 'Message sent successfully.' });
      setForm({ targetCustomerId: 'all_customers', priority: 'medium', title: '', message: '' });
      setTimeout(() => setComposeOpen(false), 700);
    } catch (err) {
      const missingRoute =
        err.response?.status === 404 &&
        typeof err.response?.data?.message === 'string' &&
        err.response.data.message.includes('Route POST /api/manager/notifications/send-message');

      setMessageStatus({
        type: 'error',
        text: missingRoute
          ? 'Message route is not available yet. Restart the backend server and try again.'
          : err.response?.data?.message || 'Failed to send message.',
      });
    } finally {
      setSending(false);
    }
  };

  const inputSx = {
    '--mui-field-label-bg': '#ffffff',
    '& .MuiOutlinedInput-root': {
      color: '#111827',
      borderRadius: '12px',
      background: '#FFFFFF',
      minHeight: 56,
      overflow: 'visible',
      '& fieldset': { borderColor: '#D1D5DB' },
      '&:hover fieldset': { borderColor: '#9CA3AF' },
      '&.Mui-focused fieldset': { borderColor: '#818cf8' },
    },
    '& .MuiInputBase-input': {
      color: '#111827',
      WebkitTextFillColor: '#111827',
      lineHeight: 1.45,
    },
    '& .MuiInputBase-input::placeholder': { color: 'rgba(17,24,39,0.58)', opacity: 1 },
    '& .MuiInputLabel-root': {
      color: '#4B5563',
      backgroundColor: 'var(--mui-field-label-bg)',
      px: 0.75,
      zIndex: 2,
      overflow: 'visible',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
    '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '1.45em', color: '#111827' },
    '& .MuiSelect-icon': { color: '#4B5563' },
    '& textarea': { color: '#111827' },
    '& input': { color: '#111827' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Notifications</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>All system notifications and customer messages</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            onClick={openCompose}
            startIcon={<Send />}
            variant="contained"
            sx={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 2.2 }}
          >
            Send Message
          </Button>
          <Button onClick={markAllRead} sx={{ color: '#f59e0b', textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' }}>Mark All Read</Button>
        </Box>
      </Box>

      {loading ? (
        [...Array(6)].map((_, i) => <Skeleton key={i} height={80} sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '12px', mb: 1.5 }} />)
      ) : notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <CheckCircle sx={{ fontSize: '3rem', color: '#22c55e', mb: 2, display: 'block', mx: 'auto' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No notifications yet.</Typography>
        </Box>
      ) : (
        <>
        {paginatedNotifications.map((n) => {
        const cfg = typeConfig[n.type] || typeConfig.info;
        return (
          <Card
            key={n._id}
            onClick={() => handleNotificationClick(n)}
            sx={{
              mb: 1.5, cursor: n.link || !n.isRead ? 'pointer' : 'default',
              background: n.isRead ? 'rgba(255,255,255,0.02)' : cfg.bg,
              border: `1px solid ${n.isRead ? 'rgba(255,255,255,0.06)' : cfg.bg.replace('0.12', '0.3')}`,
              borderRadius: '14px',
              '&:hover': { background: 'rgba(255,255,255,0.04)' },
            }}
          >
            <CardContent sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ color: cfg.color, mt: 0.3 }}>{cfg.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography sx={{ color: '#fff', fontWeight: n.isRead ? 500 : 700, fontSize: '0.9rem' }}>{n.title}</Typography>
                  {!n.isRead && <Chip label="New" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, height: 20 }} />}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', mt: 0.5, lineHeight: 1.6 }}>{n.message}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', mt: 1 }}>
                  {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        );
        })}
        <TablePaginationControls page={page} totalRecords={notifications.length} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={composeOpen}
        onClose={() => !sending && setComposeOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            background: '#FFFFFF',
            color: '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            width: 'min(1120px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 32px)',
          },
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>
          <Typography sx={{ color: '#111827', fontSize: '1.35rem', fontWeight: 800 }}>Compose Message</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: '0.88rem', mt: 0.5 }}>
            Send notifications to customers only
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {messageStatus.text && (
            <Alert
              severity={messageStatus.type}
              sx={{
                mb: 2,
                bgcolor: messageStatus.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: messageStatus.type === 'success' ? '#86efac' : '#fca5a5',
                border: `1px solid ${messageStatus.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {messageStatus.text}
            </Alert>
          )}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography sx={{ color: '#374151', fontWeight: 700, fontSize: '0.86rem', mb: 0.75 }}>
                Target Customer / Customer Group
              </Typography>
              <FormControl fullWidth sx={inputSx}>
                <Select
                  value={form.targetCustomerId}
                  sx={{ minHeight: 56 }}
                  onChange={(e) => setForm({ ...form, targetCustomerId: e.target.value })}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                >
                  <MenuItem value="all_customers">All Active Customers</MenuItem>
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.name} ({customer.customerId || customer.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 5, md: 3 }}>
              <Typography sx={{ color: '#374151', fontWeight: 700, fontSize: '0.86rem', mb: 0.75 }}>
                Priority
              </Typography>
              <FormControl fullWidth sx={inputSx}>
                <Select
                  value={form.priority}
                  sx={{ minHeight: 56 }}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 7, md: 4 }}>
              <Typography sx={{ color: '#374151', fontWeight: 700, fontSize: '0.86rem', mb: 0.75 }}>
                Notification Title *
              </Typography>
              <TextField
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                sx={inputSx}
                fullWidth
                inputProps={{ maxLength: 120 }}
                placeholder="Enter notification title"
              />
            </Grid>
          </Grid>
          <Typography sx={{ color: '#374151', fontWeight: 700, fontSize: '0.86rem', mb: 0.75 }}>
            Message *
          </Typography>
          <TextField
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            sx={inputSx}
            fullWidth
            multiline
            rows={6}
            inputProps={{ maxLength: 1000 }}
            placeholder="Write your message"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
          <Button onClick={() => setComposeOpen(false)} disabled={sending} sx={{ color: '#4B5563', textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={sending}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Send />}
            variant="contained"
            sx={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', borderRadius: '10px', textTransform: 'none', fontWeight: 800, px: 3 }}
          >
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerNotifications;
