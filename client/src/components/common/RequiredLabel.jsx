import React from 'react';
import { Typography } from '@mui/material';

const RequiredLabel = ({ children }) => (
  <Typography component="span" sx={{ color: 'inherit', fontSize: 'inherit' }}>
    {children}
    <Typography component="span" sx={{ color: '#ef4444', ml: 0.3 }}>*</Typography>
  </Typography>
);

export default RequiredLabel;
