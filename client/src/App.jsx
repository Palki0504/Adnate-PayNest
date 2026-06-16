import React from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import store from './redux/store';
import AppRouter from './routes/AppRouter';

// Create MUI dark theme matching Adnate PayNest branding
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    secondary: {
      main: '#6366f1',
      light: '#818cf8',
    },
    background: {
      default: '#0b0f26',
      paper: 'rgba(255,255,255,0.04)',
    },
    error: {
      main: '#ef4444',
    },
    success: {
      main: '#22c55e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255,255,255,0.6)',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          backgroundImage: 'none',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          lineHeight: 1.2,
          maxWidth: 'calc(100% - 28px)',
          overflow: 'visible',
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
          zIndex: 2,
          '&.MuiInputLabel-shrink': {
            backgroundColor: 'var(--mui-field-label-bg, transparent)',
            borderRadius: 4,
            padding: '0 6px',
            transform: 'translate(14px, -9px) scale(0.75)',
          },
          '&.Mui-disabled': {
            color: 'rgba(255,255,255,0.45)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 56,
          alignItems: 'center',
          overflow: 'visible',
        },
        input: {
          lineHeight: 1.45,
          paddingTop: 16.5,
          paddingBottom: 16.5,
          overflow: 'visible',
          textOverflow: 'clip',
          '&::placeholder': {
            opacity: 0.75,
          },
          '&[type="date"]': {
            colorScheme: 'dark',
          },
          '&[type="date"]::-webkit-calendar-picker-indicator': {
            opacity: 0.75,
          },
        },
        notchedOutline: {
          overflow: 'visible',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          lineHeight: 1.45,
          minHeight: '1.45em',
          display: 'flex',
          alignItems: 'center',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          backgroundImage: 'none',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#111827',
          '&:hover': {
            backgroundColor: '#F3F4F6',
          },
          '&.Mui-selected': {
            backgroundColor: '#E5E7EB',
            '&:hover': {
              backgroundColor: '#D1D5DB',
            },
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppRouter />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
