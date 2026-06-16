import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children, allowedRoles, allowTemp = false }) => {
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#f59e0b' }} size={48} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.isTempPassword && !allowTemp) {
    return <Navigate to="/change-temp-password" replace />;
  }

  if (!user?.isTempPassword && allowTemp) {
    const roleRedirects = {
      customer: '/customer-dashboard',
      manager: '/manager-dashboard',
      admin: '/admin-dashboard',
    };
    return <Navigate to={roleRedirects[user?.role] || '/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to correct dashboard based on actual role
    const roleRedirects = {
      customer: '/customer-dashboard',
      manager: '/manager-dashboard',
      admin: '/admin-dashboard',
    };
    return <Navigate to={roleRedirects[user?.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
