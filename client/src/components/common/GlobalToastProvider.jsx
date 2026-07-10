import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Box, IconButton, Slide, Snackbar } from '@mui/material';
import { CheckCircle, Close, Error, Info, WarningAmber } from '@mui/icons-material';
import { showToast, subscribeToast } from './toastService';

const ToastContext = createContext(null);

const icons = {
  success: <CheckCircle fontSize="small" />,
  error: <Error fontSize="small" />,
  warning: <WarningAmber fontSize="small" />,
  info: <Info fontSize="small" />,
};

const colors = {
  success: { bg: '#16a34a', border: '#86efac' },
  error: { bg: '#dc2626', border: '#fecaca' },
  warning: { bg: '#f97316', border: '#fed7aa' },
  info: { bg: '#2563eb', border: '#bfdbfe' },
};

const ToastContextProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, severity = 'info', options = {}) => {
    showToast(message, severity, options);
  }, []);

  useEffect(() => subscribeToast((toast) => {
    setToasts((current) => [toast, ...current].slice(0, 4));
  }), []);

  const closeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({
    notify,
    success: (message, options) => notify(message, 'success', options),
    error: (message, options) => notify(message, 'error', { persist: true, ...options }),
    warning: (message, options) => notify(message, 'warning', options),
    info: (message, options) => notify(message, 'info', options),
  }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box sx={{ position: 'fixed', top: 18, right: 18, zIndex: 999999, width: { xs: 'calc(100% - 32px)', sm: 430 }, pointerEvents: 'none' }}>
        {toasts.map((toast, index) => (
          <Snackbar
            key={toast.id}
            open
            autoHideDuration={toast.persist ? null : toast.duration || 4200}
            onClose={(_, reason) => {
              if (reason !== 'clickaway') closeToast(toast.id);
            }}
            TransitionComponent={Slide}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ position: 'relative', top: 'auto !important', right: 'auto !important', left: 'auto !important', transform: 'none !important', mb: index === 0 ? 0 : 1.25, pointerEvents: 'auto' }}
          >
            <Alert
              variant="filled"
              icon={icons[toast.severity] || icons.info}
              severity={toast.severity}
              action={<IconButton size="small" color="inherit" onClick={() => closeToast(toast.id)}><Close fontSize="small" /></IconButton>}
              sx={{
                width: '100%',
                alignItems: 'center',
                bgcolor: colors[toast.severity]?.bg || colors.info.bg,
                color: '#fff',
                border: `1px solid ${colors[toast.severity]?.border || colors.info.border}`,
                boxShadow: '0 18px 40px rgba(2,12,36,.32)',
                borderRadius: '12px',
                fontWeight: 800,
                '& .MuiAlert-icon, & .MuiAlert-action': { color: '#fff' },
              }}
            >
              {toast.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext) || {
  notify: showToast,
  success: (message, options) => showToast(message, 'success', options),
  error: (message, options) => showToast(message, 'error', { persist: true, ...options }),
  warning: (message, options) => showToast(message, 'warning', options),
  info: (message, options) => showToast(message, 'info', options),
};

export default ToastContextProvider;
