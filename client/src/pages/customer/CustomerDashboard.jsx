import React, { useState, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, IconButton, Avatar,
  Badge, Tooltip, Divider, useMediaQuery, useTheme, Menu, MenuItem, Alert,
  Collapse,
} from '@mui/material';
import {
  Dashboard, AccountBalance, Receipt, Analytics, Notifications,
  Person, Menu as MenuIcon, ChevronLeft, Logout, KeyboardArrowDown,
  Send, CreditScore, AccountBalanceWallet, Savings, Autorenew,
  TrendingUp, ExpandLess, ExpandMore, Lock,
} from '@mui/icons-material';
import { logout } from '../../redux/slices/authSlice';
import PayNestLogo from '../../components/common/PayNestLogo';
import { getDisplayName } from '../../utils/textFormat';

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
import CustomerLoans from './CustomerLoans';
import CustomerInvestments from './CustomerInvestments';

const DRAWER_WIDTH = 260;
const lockMessage = 'Complete your profile and wait for KYC verification to access this feature.';

const navItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '' },
  { label: 'Account Summary', icon: <AccountBalance />, path: 'accounts' },
  { label: 'Beneficiary Transfer', icon: <Person />, path: 'beneficiaries' },
  { label: 'Transfer Funds', icon: <Send />, path: 'transfer-funds' },
  { label: 'Transactions', icon: <Receipt />, path: 'transactions' },
  { label: 'Overdraft', icon: <CreditScore />, path: 'overdraft' },
  { label: 'Loans & EMI', icon: <AccountBalanceWallet />, path: 'loans' },
  {
    label: 'Investments',
    icon: <TrendingUp />,
    path: 'investments',
    children: [
      { label: 'Fixed Deposits (FD)', icon: <Savings />, path: 'investments/fd' },
      { label: 'Recurring Deposits (RD)', icon: <Autorenew />, path: 'investments/rd' },
    ],
  },
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
  const displayName = getDisplayName(user?.name, '');
  const displayFirstName = displayName.split(' ')[0] || '';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  const [lockedAlert, setLockedAlert] = useState('');
  const bankingAccess = !!(user?.profileCompleted && user?.kycStatus === 'Approved');
  const publicCustomerPaths = ['', 'profile', 'notifications'];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const currentPath = location.pathname.split('/customer-dashboard/')[1] || '';
  const investmentsActive = currentPath.startsWith('investments/');
  const activeNavItem = navItems
    .flatMap((item) => item.children || [item])
    .find((item) => item.path === currentPath);

  React.useEffect(() => {
    if (investmentsActive) setInvestmentsExpanded(true);
  }, [investmentsActive]);

  React.useEffect(() => {
    if (!bankingAccess && !publicCustomerPaths.includes(currentPath)) {
      navigate('/customer-dashboard/profile', { replace: true });
    }
  }, [bankingAccess, currentPath, navigate]);

  const isLockedPath = (path) => !bankingAccess && !publicCustomerPaths.includes(path);

  const handleLockedClick = () => {
    setLockedAlert(lockMessage);
    navigate('/customer-dashboard/profile');
    if (isMobile) setMobileOpen(false);
  };

  const DrawerContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#071b3a' }}>
      {/* Logo */}
      <Box sx={{ p: 3, pb: 2.5 }}>
        <PayNestLogo size="small" />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User card */}
      <Box sx={{ mx: 2, my: 2, p: 2, background: 'rgba(255,255,255,0.08)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 34, height: 34, background: 'linear-gradient(135deg, #38bdf8, #2563eb)', fontSize: '0.85rem', fontWeight: 700 }}>
            {user?.customerId?.slice(-1)?.toUpperCase() || displayName.charAt(0)}
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
          const hasChildren = Array.isArray(item.children);
          const isInvestmentsMenu = item.path === 'investments';
          const isActive = hasChildren
            ? item.children.some((child) => currentPath === child.path)
            : currentPath === item.path;
          return (
            <Box key={item.label} sx={{ mb: hasChildren ? 1 : 0.5 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    if (!hasChildren && isLockedPath(item.path)) {
                      handleLockedClick();
                      return;
                    }
                    if (hasChildren) {
                      if (!bankingAccess) {
                        handleLockedClick();
                        return;
                      }
                      setInvestmentsExpanded((current) => !current);
                      return;
                    }
                    navigate(`/customer-dashboard${item.path ? `/${item.path}` : ''}`);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: '10px',
                    py: 1.2,
                    background: isActive ? '#1687ff' : 'transparent',
                    border: '1px solid transparent',
                    boxShadow: isInvestmentsMenu && isActive ? '0 12px 24px rgba(22,135,255,0.28)' : 'none',
                    '&:hover': { background: isActive ? '#1687ff' : 'rgba(255,255,255,0.08)' },
                    transition: 'all 0.25s ease',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isActive ? '#fff' : 'rgba(255,255,255,0.68)' }}>
                    {isLockedPath(item.path) ? (
                      <Lock fontSize="small" />
                    ) : item.label === 'Notifications' ? (
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
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.78)',
                    }}
                  />
                  {hasChildren ? (
                    <Box sx={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', display: 'grid', placeItems: 'center', transition: 'transform 0.25s ease', transform: investmentsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      {investmentsExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </Box>
                  ) : isActive && (
                    <Box sx={{ width: 3, height: 20, borderRadius: 2, background: '#bfdbfe' }} />
                  )}
                </ListItemButton>
              </ListItem>

              {hasChildren && (
                <Collapse in={investmentsExpanded} timeout={260} unmountOnExit>
                  <Box sx={{ mt: 0.75, ml: 2.4, pl: 1.25, borderLeft: '2px solid rgba(147,197,253,0.3)' }}>
                    {item.children.map((child) => {
                      const childActive = currentPath === child.path;
                      return (
                        <ListItem key={child.path} disablePadding sx={{ mb: 0.75 }}>
                          <ListItemButton
                            onClick={() => {
                              if (isLockedPath(child.path)) {
                                handleLockedClick();
                                return;
                              }
                              navigate(`/customer-dashboard/${child.path}`);
                              if (isMobile) setMobileOpen(false);
                            }}
                            sx={{
                              borderRadius: '10px',
                              py: 1.05,
                              px: 1.35,
                              background: childActive ? 'rgba(22,135,255,0.95)' : 'rgba(255,255,255,0.055)',
                              border: '1px solid transparent',
                              transition: 'all 0.25s ease',
                              '&:hover': {
                                background: childActive ? '#1687ff' : 'rgba(255,255,255,0.09)',
                                transform: isLockedPath(child.path) ? 'none' : 'translateX(3px)',
                              },
                              opacity: isLockedPath(child.path) ? 0.58 : 1,
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 32, color: childActive ? '#fff' : 'rgba(255,255,255,0.62)' }}>
                              {isLockedPath(child.path) ? <Lock fontSize="small" /> : child.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={child.label}
                              primaryTypographyProps={{
                                fontSize: '0.82rem',
                                fontWeight: childActive ? 700 : 500,
                                color: childActive ? '#fff' : 'rgba(255,255,255,0.76)',
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </Box>
                </Collapse>
              )}
            </Box>
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
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#061633' }}>
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
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none', boxShadow: '4px 0 20px rgba(0,0,0,0.18)' } }}
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
            background: '#061633',
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
                  {activeNavItem?.label || 'Dashboard'}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                  <Box sx={{ color: '#fff', fontSize: '0.85rem' }}>Customer ID: {user?.customerId || user?.id}</Box>
                  Welcome back, {displayFirstName}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Tooltip title="Notifications">
                <IconButton
                  onClick={() => navigate('/customer-dashboard/notifications')}
                  sx={{ color: 'rgba(255,255,255,0.78)', '&:hover': { color: '#60a5fa' } }}
                >
                  <Badge badgeContent={unreadCount} color="error" max={9}>
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', p: 1, borderRadius: '12px', '&:hover': { background: 'rgba(255,255,255,0.08)' } }} onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 34, height: 34, background: 'linear-gradient(135deg, #38bdf8, #2563eb)', fontSize: '0.85rem', fontWeight: 700 }}>
                  {user?.customerId?.slice(-1)?.toUpperCase() || displayName.charAt(0)}
                </Avatar>
                <Box sx={{ flexDirection: 'column', display: { xs: 'none', sm: 'flex' } }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.85rem' }}>{displayName}</Typography>
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
          {lockedAlert && (
            <Alert
              severity="warning"
              onClose={() => setLockedAlert('')}
              sx={{ mb: 2, bgcolor: 'rgba(245,158,11,0.14)', color: '#fde68a', border: '1px solid rgba(245,158,11,0.35)', '& .MuiAlert-icon': { color: '#f59e0b' } }}
            >
              {lockedAlert}
            </Alert>
          )}
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="accounts" element={<AccountSummary />} />
            <Route path="transfer-funds" element={<TransferFundsPage />} />
            <Route path="beneficiaries" element={<BeneficiariesPage />} />
            <Route path="transactions" element={<TransactionHistory />} />
            <Route path="overdraft" element={<CustomerOverdraft />} />
            <Route path="loans" element={<CustomerLoans />} />
            <Route path="investments/fd" element={<CustomerInvestments type="FD" />} />
            <Route path="investments/rd" element={<CustomerInvestments type="RD" />} />
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
