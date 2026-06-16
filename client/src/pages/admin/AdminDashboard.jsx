import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Home,
  Group,
  ReceiptLong,
  Category,
  AccountBalance,
  Notifications,
  Security,
  Rule,
  Logout,
  Menu as MenuIcon,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { logout } from '../../redux/slices/authSlice';
import { notificationAPI } from '../../services/api';
import PayNestLogo from '../../components/common/PayNestLogo';
import AdminHome from './AdminHome';
import UserManagement from './UserManagement';
import AddUserPage from './AddUserPage';
import AdminProfile from './AdminProfile';
import CustomerClassifications from './CustomerClassifications';
import TransactionsPage from './Transactions';
import NotificationsAdmin from './NotificationsAdmin';
import OverdraftManagement from './OverdraftManagement';
import LogsAndSecurity from './LogsAndSecurity';
import BusinessRules from './BusinessRules';
import AdminSettings from './AdminSettings';

const DRAWER_WIDTH = 280;

const navItems = [
  { label: 'Dashboard', icon: <Home />, path: '' },
  { label: 'User Management', icon: <Group />, path: 'user-management' },
  { label: 'Transactions', icon: <ReceiptLong />, path: 'transactions' },
  { label: 'Customer Classifications', icon: <Category />, path: 'customer-classifications' },
  { label: 'Overdraft Management', icon: <AccountBalance />, path: 'overdraft-management' },
  { label: 'Notifications', icon: <Notifications />, path: 'notifications' },
  { label: 'Logs & Security', icon: <Security />, path: 'logs-security' },
  { label: 'Business Rules', icon: <Rule />, path: 'business-rules' },
];

const ComingSoonPage = ({ label }) => (
  <Box sx={{ p: 3 }}>
    <Typography sx={{ color: '#fff', fontSize: '1.6rem', fontWeight: 700, mb: 1 }}>{label}</Typography>
    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>
      This admin section is under development and will be available soon.
    </Typography>
  </Box>
);

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useSelector((state) => state.auth);

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const activePath = location.pathname.split('/admin-dashboard/')[1]?.split('/')[0] || '';
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((segment) => segment[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD';

  const loadNotifications = async () => {
    try {
      const result = await notificationAPI.getAll({ limit: 20 });
      setUnreadCount(result.data.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const DrawerContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f4b 100%)' }}>
      <Box sx={{ p: 3, pb: 2.5 }}>
        <PayNestLogo size="small" />
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2, mb: 2 }} />

      <List sx={{ px: 1.5, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activePath === item.path;
          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(`/admin-dashboard${item.path ? `/${item.path}` : ''}`);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '10px',
                  py: 1.2,
                  background: isActive ? 'rgba(56,189,248,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(56,189,248,0.24)' : '1px solid transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: isActive ? '#38bdf8' : 'rgba(255,255,255,0.6)' }}>
                  {item.label === 'Notifications' ? (
                    <Badge badgeContent={unreadCount} color="error" max={9}>
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.92rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: '10px', py: 1.2, '&:hover': { background: 'rgba(239,68,68,0.12)' } }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'rgba(239,68,68,0.8)' }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  const Placeholder = () => {
    const sectionName = activePath.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return <ComingSoonPage label={sectionName || 'Admin Section'} />;
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#0b0f26' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' } }}
        >
          <DrawerContent />
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none', boxShadow: '4px 0 24px rgba(0,0,0,0.45)' } }}
        >
          <DrawerContent />
        </Drawer>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppBar position="static" elevation={0} sx={{ background: 'rgba(11,15,38,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isMobile && (
                <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#fff' }}>
                  <MenuIcon />
                </IconButton>
              )}
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
                  {navItems.find((item) => item.path === activePath)?.label || 'Dashboard'}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
                  Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Tooltip title="Notifications">
                <IconButton onClick={() => navigate('/admin-dashboard/notifications')} sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  <Badge badgeContent={unreadCount} color="error" max={9}>
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer', p: 1, borderRadius: '12px', '&:hover': { background: 'rgba(255,255,255,0.05)' } }} onClick={handleMenuOpen}>
                <Avatar sx={{ width: 34, height: 34, background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', fontSize: '0.9rem', fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.9rem' }}>{user?.name || 'Admin'}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>Administrator</Typography>
                </Box>
                <KeyboardArrowDown sx={{ color: 'rgba(255,255,255,0.55)' }} />
              </Box>

              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    navigate('/admin-dashboard/profile');
                  }}
                >
                  Profile
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    handleLogout();
                  }}
                >
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
          <Routes>
            <Route index element={<AdminHome />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="user-management/add" element={<AddUserPage />} />
            <Route path="customer-classifications" element={<CustomerClassifications />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="overdraft-management" element={<OverdraftManagement />} />
            <Route path="notifications" element={<NotificationsAdmin />} />
            <Route path="logs-security" element={<LogsAndSecurity />} />
            <Route path="business-rules" element={<BusinessRules />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="*" element={<AdminHome />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
