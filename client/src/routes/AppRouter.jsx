import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import ProtectedRoute from './ProtectedRoute';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Lazy loaded pages
const Login = lazy(() => import('../pages/auth/Login'));
const Signup = lazy(() => import('../pages/auth/Signup'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const ChangeTempPassword = lazy(() => import('../pages/auth/ChangeTempPassword'));
const CustomerDashboard = lazy(() => import('../pages/customer/CustomerDashboard'));
const ManagerDashboard = lazy(() => import('../pages/manager/ManagerDashboard'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));

const PageLoader = () => (
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

const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<PageLoader />}> {/* Keep fallback for lazy loading */}
      <ErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/change-temp-password"
            element={
              <ProtectedRoute allowedRoles={["customer"]} allowTemp={true}>
                <ChangeTempPassword />
              </ProtectedRoute>
            }
          />

          {/* Protected dashboards */}
          <Route
            path="/customer-dashboard/*"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager-dashboard/*"
            element={
              <ProtectedRoute allowedRoles={["manager"]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute allowedRoles={["manager"]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
