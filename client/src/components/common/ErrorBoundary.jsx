import React, { Component } from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // You could log the error to an external service here
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Simple reload – could also trigger a full page refresh
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f4b 100%)',
          color: '#fff',
          p: 3,
        }}>
          <Typography variant="h4" sx={{ mb: 2, color: '#f59e0b' }}>
            Something went wrong
          </Typography>
          <Typography sx={{ mb: 3, maxWidth: 600, textAlign: 'center' }}>
            {this.state.error?.toString() || 'An unexpected error occurred.'}
          </Typography>
          <Button variant="contained" onClick={this.handleReload} sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            Reload
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
