import React from 'react';
import { Box } from '@mui/material';
import logoImage from '../../assets/adnate-paynest-logo.png';

const PayNestLogo = ({ size = 'medium', variant = 'full', color = 'light' }) => {
  const sizes = {
    small: { width: 112, height: 112 },
    medium: { width: 168, height: 168 },
    large: { width: 240, height: 240 },
  };
  const s = sizes[size] || sizes.medium;
  const compact = variant === 'icon';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        width: compact ? s.height : { xs: Math.min(s.width, 180), sm: s.width },
        height: compact ? s.height : s.height,
        maxWidth: '100%',
        borderRadius: compact ? '50%' : '10px',
        background: color === 'light' ? '#ffffff' : 'transparent',
        overflow: 'hidden',
        boxShadow: color === 'light' ? '0 10px 28px rgba(0,0,0,0.18)' : 'none',
      }}
    >
      <Box
        component="img"
        src={logoImage}
        alt="Adnate PayNest"
        sx={{
          display: 'block',
          width: compact ? '160%' : '100%',
          height: compact ? '160%' : '100%',
          objectFit: 'contain',
        }}
      />
    </Box>
  );
};

export default PayNestLogo;
