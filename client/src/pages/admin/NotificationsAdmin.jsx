import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Chip, Divider, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import { Send, NotificationsActive, Check, DoneAll, History } from '@mui/icons-material';
import { adminAPI, notificationAPI } from '../../services/api';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const NotificationsAdmin = () => {
  const [form, setForm] = useState({ title: '', message: '', targetRole: 'all', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  // Received Notifications State
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const { page, setPage, paginatedRecords: paginatedNotifications } = useTablePagination(notifications, [notifications.length]);

  const fetchReceivedNotifications = async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 50 });
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  useEffect(() => {
    setNotifLoading(true);
    fetchReceivedNotifications().finally(() => setNotifLoading(false));

    // Poll notifications every 5 seconds
    const interval = setInterval(fetchReceivedNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif => notif._id === id ? { ...notif, isRead: true } : notif)
      );
    } catch (err) {
      console.error('Failed to mark read:', err.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (err) {
      console.error('Failed to mark all read:', err.message);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.message.trim()) e.message = 'Message is required';
    return e;
  };

  const handleSend = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        title: form.title,
        message: form.message,
        priority: form.priority,
        ...(form.targetRole !== 'all' && { targetRole: form.targetRole }),
      };
      const res = await adminAPI.sendNotification(payload);
      setResult({ type: 'success', text: res.data.message });
      setForm({ title: '', message: '', targetRole: 'all', priority: 'medium' });
      fetchReceivedNotifications();
    } catch (err) {
      setResult({ type: 'error', text: err.response?.data?.message || 'Failed to send notification.' });
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': { color: '#fff', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#818cf8' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
    '& .MuiFormHelperText-root': { color: '#f87171' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  const priorityColors = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

  return (
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Notifications Portal</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mb: 4 }}>
        Broadcast system alerts and monitor incoming system notification logs in real time
      </Typography>

      <Grid container spacing={3}>
        {/* Left column: Compose + Logs */}
        <Grid item xs={12} lg={8}>
          {/* Compose notification card */}
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <NotificationsActive sx={{ color: '#818cf8' }} />
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>Compose System Broadcast</Typography>
              </Box>

              {result && (
                <Alert
                  severity={result.type}
                  sx={{
                    mb: 3, borderRadius: '12px',
                    bgcolor: result.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: result.type === 'success' ? '#86efac' : '#fca5a5',
                    border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}
                  onClose={() => setResult(null)}
                >
                  {result.text}
                </Alert>
              )}

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={inputSx}>
                    <InputLabel>Target Audience</InputLabel>
                    <Select value={form.targetRole} label="Target Audience" onChange={(e) => setForm({ ...form, targetRole: e.target.value })} sx={{ color: '#fff' }}>
                      <MenuItem value="all">All Users (Customers + Managers)</MenuItem>
                      <MenuItem value="customer">Customers Only</MenuItem>
                      <MenuItem value="manager">Managers Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={inputSx}>
                    <InputLabel>Priority</InputLabel>
                    <Select value={form.priority} label="Priority" onChange={(e) => setForm({ ...form, priority: e.target.value })} sx={{ color: '#fff' }}>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Notification Title *"
                    value={form.title}
                    onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors({ ...errors, title: '' }); }}
                    fullWidth
                    sx={inputSx}
                    error={!!errors.title}
                    helperText={errors.title}
                    placeholder="e.g. System Maintenance Notice"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Message *"
                    value={form.message}
                    onChange={(e) => { setForm({ ...form, message: e.target.value }); setErrors({ ...errors, message: '' }); }}
                    fullWidth
                    multiline
                    rows={4}
                    sx={inputSx}
                    error={!!errors.message}
                    helperText={errors.message}
                    placeholder="Write your notification message here..."
                  />
                </Grid>
              </Grid>

              <Button
                onClick={handleSend}
                disabled={loading}
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Send />}
                sx={{
                  mt: 3, py: 1.4, px: 4, fontWeight: 700, fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', borderRadius: '12px', textTransform: 'none',
                  '&:hover': { background: 'linear-gradient(135deg, #818cf8, #6366f1)' },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {loading ? 'Sending...' : 'Send Notification'}
              </Button>
            </CardContent>
          </Card>

          {/* Received System Notifications Log */}
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <History sx={{ color: '#f59e0b' }} />
                  </Box>
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>System Notifications Log</Typography>
                </Box>
                {notifications.some(n => !n.isRead) && (
                  <Button
                    onClick={handleMarkAllAsRead}
                    size="small"
                    startIcon={<DoneAll />}
                    sx={{ color: '#38bdf8', textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Mark all read
                  </Button>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

              {notifLoading && notifications.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#f59e0b' }} />
                </Box>
              ) : notifications.length === 0 ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 4, fontSize: '0.9rem' }}>
                  No system notifications received.
                </Typography>
              ) : (
                <>
                <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
                  {paginatedNotifications.map((notif) => {
                    const hasHighPriority = notif.priority === 'high';
                    const isSystemActivation = notif.title === 'Customer Account Activated Successfully' || notif.title?.includes('Activated');
                    
                    return (
                      <ListItem
                        key={notif._id}
                        sx={{
                          mb: 1.5,
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          bgcolor: notif.isRead ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)',
                          borderLeft: `4px solid ${hasHighPriority ? '#ef4444' : isSystemActivation ? '#22c55e' : '#38bdf8'}`,
                          transition: 'all 0.2s ease',
                          p: 2,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                              <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.92rem' }}>
                                {notif.title}
                              </Typography>
                              <Chip
                                label={notif.priority || 'medium'}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  bgcolor: `${priorityColors[notif.priority || 'medium']}20`,
                                  color: priorityColors[notif.priority || 'medium'],
                                  textTransform: 'capitalize',
                                }}
                              />
                              {!notif.isRead && (
                                <Chip
                                  label="New"
                                  size="small"
                                  color="error"
                                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography
                                sx={{
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '0.85rem',
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-line',
                                  fontFamily: isSystemActivation ? 'monospace' : 'inherit',
                                  mt: 0.5,
                                  bgcolor: isSystemActivation ? 'rgba(0,0,0,0.2)' : 'transparent',
                                  p: isSystemActivation ? 1.5 : 0,
                                  borderRadius: '8px',
                                  border: isSystemActivation ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                }}
                              >
                                {notif.message}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', mt: 1 }}>
                                Received: {new Date(notif.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </Typography>
                            </Box>
                          }
                        />
                        {!notif.isRead && (
                          <ListItemSecondaryAction sx={{ top: '30px' }}>
                            <IconButton
                              onClick={() => handleMarkAsRead(notif._id)}
                              sx={{
                                color: '#22c55e',
                                bgcolor: 'rgba(34,197,94,0.1)',
                                '&:hover': { bgcolor: 'rgba(34,197,94,0.2)' }
                              }}
                              size="small"
                              title="Mark as Read"
                            >
                              <Check fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    );
                  })}
                </List>
                <TablePaginationControls page={page} totalRecords={notifications.length} onPageChange={setPage} />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Preview & Info */}
        <Grid item xs={12} lg={4}>
          {/* Preview */}
          <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2 }}>Preview Broadcast</Typography>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', flex: 1 }}>{form.title || 'Notification Title'}</Typography>
                  <Chip
                    label={form.priority}
                    size="small"
                    sx={{ ml: 1, height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: `${priorityColors[form.priority]}20`, color: priorityColors[form.priority], textTransform: 'capitalize' }}
                  />
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', lineHeight: 1.5 }}>{form.message || 'Your message will appear here...'}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', mt: 1.5 }}>
                  To: {form.targetRole === 'all' ? 'All Users' : form.targetRole === 'customer' ? 'Customers' : 'Managers'} • Just now
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card sx={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '20px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: '#818cf8', fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>💡 Tips</Typography>
              {[
                'Use High priority for urgent system alerts.',
                'The System Notifications Log updates in real time when customers activate their accounts.',
                'Green borders mark account activation events. Red indicates high-priority messages.',
              ].map((tip) => (
                <Typography key={tip} sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', mb: 1.2, display: 'flex', gap: 1 }}>
                  <span style={{ color: '#818cf8' }}>•</span> {tip}
                </Typography>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NotificationsAdmin;
