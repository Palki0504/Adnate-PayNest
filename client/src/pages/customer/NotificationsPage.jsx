import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Skeleton, IconButton,
  Chip, Button, Divider, Badge,
} from '@mui/material';
import {
  Notifications, NotificationsActive, CheckCircle, DoneAll,
  Payment, Info, Warning, Security,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { notificationAPI } from '../../services/api';
import { setNotifications, markOneRead, markAllRead } from '../../redux/slices/notificationSlice';
import TablePaginationControls from '../../components/common/TablePaginationControls';
import useTablePagination from '../../hooks/useTablePagination';

const typeIcons = {
  transaction: <Payment sx={{ fontSize: '1.1rem' }} />,
  info: <Info sx={{ fontSize: '1.1rem' }} />,
  alert: <Warning sx={{ fontSize: '1.1rem' }} />,
  system: <Security sx={{ fontSize: '1.1rem' }} />,
  approval: <CheckCircle sx={{ fontSize: '1.1rem' }} />,
  rejection: <Warning sx={{ fontSize: '1.1rem' }} />,
};

const typeColors = {
  transaction: '#22c55e',
  info: '#3b82f6',
  alert: '#f59e0b',
  system: '#6366f1',
  approval: '#22c55e',
  rejection: '#ef4444',
};

const priorityBadge = {
  high: { label: 'High Priority', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  low: { label: 'Info', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
};

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const { items: storeNotifs, unreadCount } = useSelector((state) => state.notifications);
  const [localNotifs, setLocalNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { page, setPage, paginatedRecords: paginatedLocalNotifs } = useTablePagination(localNotifs, [localNotifs.length]);

  useEffect(() => {
    notificationAPI.getAll({ limit: 50 })
      .then((res) => {
        setLocalNotifs(res.data.notifications);
        dispatch(setNotifications({ notifications: res.data.notifications, unreadCount: res.data.unreadCount }));
      })
      .catch(() => setError('Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, [dispatch]);

  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      dispatch(markOneRead(id));
      setLocalNotifs((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      dispatch(markAllRead());
      setLocalNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* silent */ }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
            Notifications
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error" sx={{ ml: 2, '& .MuiBadge-badge': { fontSize: '0.75rem', fontWeight: 700 } }} />
            )}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', mt: 0.5 }}>
            Stay updated with your account activity
          </Typography>
        </Box>
        {unreadCount > 0 && (
          <Button
            onClick={handleMarkAllRead}
            startIcon={<DoneAll />}
            sx={{ color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600, border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', px: 2, '&:hover': { background: 'rgba(245,158,11,0.08)' } }}
          >
            Mark All Read
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
          [...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={88} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '14px' }} />
          ))
        ) : localNotifs.length === 0 ? (
          <Card sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <CardContent sx={{ py: 8, textAlign: 'center' }}>
              <Notifications sx={{ color: 'rgba(255,255,255,0.15)', fontSize: '3rem', mb: 2 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.3)' }}>No notifications yet</Typography>
            </CardContent>
          </Card>
        ) : (
          <>
          {paginatedLocalNotifs.map((n) => {
            const color = typeColors[n.type] || '#6366f1';
            const icon = typeIcons[n.type] || <Info />;
            const pBadge = priorityBadge[n.priority] || priorityBadge.low;

            return (
              <Card
                key={n._id}
                sx={{
                  background: n.isRead
                    ? 'rgba(255,255,255,0.03)'
                    : `linear-gradient(135deg, ${color}10 0%, rgba(255,255,255,0.03) 100%)`,
                  border: n.isRead
                    ? '1px solid rgba(255,255,255,0.07)'
                    : `1px solid ${color}25`,
                  borderRadius: '14px',
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'translateX(4px)', borderColor: `${color}40` },
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {!n.isRead && (
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(180deg, ${color}, ${color}80)` }} />
                )}
                <CardContent sx={{ pl: n.isRead ? 3 : 4, pr: 3, py: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flex: 1 }}>
                      <Box sx={{ p: 1, borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}25`, flexShrink: 0 }}>
                        {React.cloneElement(icon, { sx: { color, fontSize: '1.1rem' } })}
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ color: '#fff', fontWeight: n.isRead ? 500 : 700, fontSize: '0.9rem' }}>
                            {n.title}
                          </Typography>
                          <Chip
                            label={pBadge.label}
                            size="small"
                            sx={{ bgcolor: pBadge.bg, color: pBadge.color, border: `1px solid ${pBadge.border}`, fontSize: '0.65rem', fontWeight: 700, height: 18 }}
                          />
                          {!n.isRead && (
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                          )}
                        </Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          {n.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                          {['admin', 'manager'].includes(n.senderRole) && (
                            <Chip
                              label={`Sender: ${n.senderRole === 'admin' ? 'Admin' : 'Manager'}${n.senderName ? ` (${n.senderName})` : ''}`}
                              size="small"
                              sx={{ bgcolor: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)', fontSize: '0.66rem', fontWeight: 700, height: 20 }}
                            />
                          )}
                          <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.73rem' }}>
                            {new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    {!n.isRead && (
                      <IconButton
                        onClick={() => handleMarkRead(n._id)}
                        size="small"
                        sx={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, '&:hover': { color: '#22c55e', background: 'rgba(34,197,94,0.08)' } }}
                        title="Mark as read"
                      >
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          <TablePaginationControls page={page} totalRecords={localNotifs.length} onPageChange={setPage} />
          </>
        )}
      </Box>
    </Box>
  );
};

export default NotificationsPage;
