import React, { useState, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, IconButton, Avatar,
  Badge, Tooltip, Divider, useMediaQuery, useTheme, Menu, MenuItem, Alert,
} from '@mui/material';
import {
  Dashboard, AccountBalance, Receipt, Analytics, Notifications,
  Person, Menu as MenuIcon, ChevronLeft, Logout, KeyboardArrowDown,
  Send, CreditScore,
} from '@mui/icons-material';
import { logout } from '../../redux/slices/authSlice';
import PayNestLogo from '../../components/common/PayNestLogo';

// Lazy-loaded sub-pages
import DashboardHome from './DashboardHome';
import AccountSummary from './AccountSummary';
import BeneficiariesPage from './BeneficiariesPage';
import TransactionHistory from './TransactionHistory';
import AnalyticsPage from './AnalyticsPage';
import NotificationsPage from './NotificationsPage';
import ProfilePage from './ProfilePage';
import TransferFundsPage from './TransferFundsPage';
import CustomerOverdraft from './CustomerOverdraft';

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '' },
  { label: 'Account Summary', icon: <AccountBalance />, path: 'accounts' },
  { label: 'Beneficiary Transfer', icon: <Person />, path: 'beneficiaries' },
  { label: 'Transfer Funds', icon: <Send />, path: 'transfer-funds' },
  { label: 'Transactions', icon: <Receipt />, path: 'transactions' },
  { label: 'Overdraft', icon: <CreditScore />, path: 'overdraft' },
  { label: 'Analytics', icon: <Analytics />, path: 'analytics' },
  { label: 'Notifications', icon: <Notifications />, path: 'notifications' },
  { label: 'Profile', icon: <Person />, path: 'profile' },
];

const CustomerDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const currentPath = location.pathname.split('/customer-dashboard/')[1] || '';

  const DrawerContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f4b 100%)' }}>
      {/* Logo */}
      <Box sx={{ p: 3, pb: 2.5 }}>
        <PayNestLogo size="small" />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User card */}
      <Box sx={{ mx: 2, my: 2, p: 2, background: 'rgba(245,158,11,0.1)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.85rem', fontWeight: 700 }}>
            {user?.customerId?.slice(-1)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ color: '#fff', fontSize: '0.85rem' }}>
              Customer ID: {user?.customerId || user?.id}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1.5, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(`/customer-dashboard${item.path ? `/${item.path}` : ''}`);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '10px',
                  py: 1.2,
                  background: isActive ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))' : 'transparent',
                  border: isActive ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.06)' },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>
                  {item.label === 'Notifications' ? (
                    <Badge badgeContent={unreadCount} color="error" max={9}>
                      {item.icon}
                    </Badge>
                  ) : item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                  }}
                />
                {isActive && (
                  <Box sx={{ width: 3, height: 20, borderRadius: 2, background: '#f59e0b' }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Logout */}
      <Box sx={{ p: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: '10px',
            py: 1.2,
            '&:hover': { background: 'rgba(239,68,68,0.1)' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'rgba(239,68,68,0.7)' }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Sign Out"
            primaryTypographyProps={{ fontSize: '0.88rem', color: 'rgba(239,68,68,0.7)', fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#0b0f26' }}>
      {/* Sidebar Drawer */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' } }}
        >
          <DrawerContent />
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none', boxShadow: '4px 0 20px rgba(0,0,0,0.5)' } }}
          open
        >
          <DrawerContent />
        </Drawer>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: 'rgba(11,15,38,0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isMobile && (
                <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#fff' }}>
                  <MenuIcon />
                </IconButton>
              )}
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.2 }}>
                  {navItems.find((n) => n.path === currentPath)?.label || 'Dashboard'}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                  <Box sx={{ color: '#fff', fontSize: '0.85rem' }}>Customer ID: {user?.customerId || user?.id}</Box>
                  Welcome back, {user?.name?.split(' ')[0]}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Tooltip title="Notifications">
                <IconButton
                  onClick={() => navigate('/customer-dashboard/notifications')}
                  sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#f59e0b' } }}
                >
                  <Badge badgeContent={unreadCount} color="error" max={9}>
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', p: 1, borderRadius: '10px', '&:hover': { background: 'rgba(255,255,255,0.06)' } }} onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.85rem', fontWeight: 700 }}>
                  {user?.customerId?.slice(-1)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box sx={{ display: 'flex', flexDirection: 'column', display: { xs: 'none', sm: 'flex' } }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.85rem' }}>{user?.name}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Customer ID: {user?.customerId || user?.id}</Typography>
                </Box>
                <KeyboardArrowDown sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }} />
              </Box>

              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { navigate('/customer-dashboard/profile'); setAnchorEl(null); }}>
                  <Person sx={{ mr: 1, fontSize: '1.1rem' }} /> Profile
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <Logout sx={{ mr: 1, fontSize: '1.1rem' }} /> Sign Out
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>
          {user?.isTempPassword && (
            <Alert
              severity="warning"
              onClick={() => navigate('/customer-dashboard/profile')}
              sx={{
                mb: 2,
                cursor: 'pointer',
                background: 'rgba(245,158,11,0.12)',
                color: '#fcd34d',
                border: '1px solid rgba(245,158,11,0.35)',
                '& .MuiAlert-icon': { color: '#f59e0b' },
              }}
            >
              Temporary password active — open Profile to set a new password.
            </Alert>
          )}
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="accounts" element={<AccountSummary />} />
            <Route path="transfer-funds" element={<TransferFundsPage />} />
            <Route path="beneficiaries" element={<BeneficiariesPage />} />
            <Route path="transactions" element={<TransactionHistory />} />
            <Route path="overdraft" element={<CustomerOverdraft />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
};

export default CustomerDashboard;
