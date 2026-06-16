import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton,
  Typography, Avatar, Badge, Divider, IconButton, Tooltip, useMediaQuery,
  useTheme, AppBar, Toolbar,
} from '@mui/material';
import {
  Dashboard, Pending, People, Notifications, Person,
  Logout, Menu as MenuIcon, TrendingUp,
  ReceiptLong,
} from '@mui/icons-material';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../redux/slices/authSlice';
import { notificationAPI } from '../../services/api';
import PayNestLogo from '../../components/common/PayNestLogo';

// Sub-pages
import ManagerHome from './ManagerHome';
import ApprovalQueue from './ApprovalQueue';
import ManagerTransactions from './ManagerTransactions';
import OverdraftManagement from './OverdraftManagement';
import CustomerMonitoring from './CustomerMonitoring';
import ManagerNotifications from './ManagerNotifications';
import ManagerProfile from './ManagerProfile';

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED = SIDEBAR_WIDTH;

const NAV_ITEMS = [
  { label: 'Dashboard',          icon: <Dashboard />,      path: '' },
  { label: 'Pending Approvals',  icon: <Pending />,        path: 'approvals' },
  { label: 'Transactions',       icon: <ReceiptLong />,    path: 'transactions' },
  { label: 'Overdraft Mgmt',     icon: <TrendingUp />,     path: 'overdraft' },
  { label: 'Customers',          icon: <People />,         path: 'customers' },
  { label: 'Notifications',      icon: <Notifications />,  path: 'notifications', badge: true },
  { label: 'Profile',            icon: <Person />,         path: 'profile' },
];

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = false;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await notificationAPI.getAll({ unreadOnly: true, limit: 1 });
        setUnreadCount(res.data?.unreadCount || res.data?.pagination?.total || 0);
      } catch (_) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const getActivePath = () => {
    const parts = location.pathname.split('/');
    return parts[2] || '';
  };

  const activePath = getActivePath();

  const sidebarContent = (
    <Box
      sx={{
        width: collapsed && !isMobile ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0c1030 0%, #111536 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          px: collapsed && !isMobile ? 1 : 2.5,
          py: 2.5,
          minHeight: 72,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {(!collapsed || isMobile) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.6, minWidth: 0 }}>
            <PayNestLogo size="small" />
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Manager Portal</Typography>
          </Box>
        )}
      </Box>

      {/* Manager profile mini */}
      {(!collapsed || isMobile) && (
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Avatar
            sx={{
              width: 38, height: 38, flexShrink: 0,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0a0e27', fontWeight: 800, fontSize: '0.9rem',
            }}
          >
            {user?.name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>{user?.name}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>Manager</Typography>
          </Box>
        </Box>
      )}

      {/* Nav items */}
      <List
        sx={{
          flex: 1,
          pt: 1,
          pb: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.03)' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(148,163,184,0.28)',
            borderRadius: 999,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(245,158,11,0.55)',
          },
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activePath === item.path;
          return (
            <ListItem key={item.label} disablePadding sx={{ px: collapsed && !isMobile ? 0.5 : 1, mb: 0.25 }}>
              <Tooltip title={collapsed && !isMobile ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => {
                    navigate(`/manager-dashboard${item.path ? `/${item.path}` : ''}`);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: '10px',
                    px: collapsed && !isMobile ? 1 : 1.5,
                    py: 1,
                    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                    background: isActive ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))' : 'transparent',
                    border: isActive ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    '&:hover': { background: isActive ? undefined : 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed && !isMobile ? 'unset' : 38,
                      color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.45)',
                      justifyContent: 'center',
                    }}
                  >
                    {item.badge ? (
                      <Badge badgeContent={unreadCount || 0} color="error" max={99}>
                        {item.icon}
                      </Badge>
                    ) : item.icon}
                  </ListItemIcon>
                  {(!collapsed || isMobile) && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.65)',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* Logout */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 2 }} />
      <Box sx={{ p: collapsed && !isMobile ? 1 : 2 }}>
        <Tooltip title={collapsed && !isMobile ? 'Logout' : ''} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: '10px', px: collapsed && !isMobile ? 1 : 1.5, py: 1,
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              color: 'rgba(255,255,255,0.4)',
              '&:hover': { background: 'rgba(239,68,68,0.08)', color: '#ef4444' },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 'unset' : 38, color: 'inherit', justifyContent: 'center' }}>
              <Logout />
            </ListItemIcon>
            {(!collapsed || isMobile) && (
              <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500, color: 'inherit' }} />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const contentWidth = isMobile ? '100%' : `calc(100% - ${collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH}px)`;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e27 0%, #0f1235 50%, #0b1020 100%)' }}>
      {/* Sidebar — desktop */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{
            width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH,
            flexShrink: 0,
            transition: 'width 0.25s ease',
            position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 1200,
          }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* Sidebar — mobile drawer */}
      {isMobile && (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { background: 'transparent', boxShadow: 'none', border: 'none' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          ml: isMobile ? 0 : `${collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH}px`,
          transition: 'margin-left 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Mobile AppBar */}
        {isMobile && (
          <AppBar
            position="sticky"
            sx={{ background: 'rgba(12,16,48,0.95)', backdropFilter: 'blur(12px)', border: 'none', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 2, color: '#f59e0b' }}>
                <MenuIcon />
              </IconButton>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', flex: 1 }}>Manager Dashboard</Typography>
            </Toolbar>
          </AppBar>
        )}

        {/* Page content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<ManagerHome />} />
            <Route path="/approvals" element={<ApprovalQueue />} />
            <Route path="/transactions" element={<ManagerTransactions />} />
            <Route path="/overdraft" element={<OverdraftManagement />} />
            <Route path="/customers" element={<CustomerMonitoring />} />
            <Route path="/notifications" element={<ManagerNotifications />} />
            <Route path="/profile" element={<ManagerProfile />} />
            <Route path="*" element={<Navigate to="/manager-dashboard" replace />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
};

export default ManagerDashboard;
