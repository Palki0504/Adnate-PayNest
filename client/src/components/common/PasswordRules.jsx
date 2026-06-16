import React from 'react';
import { Box, Typography } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'At least one uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'At least one lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'At least one number (0–9)', test: (p) => /\d/.test(p) },
  { key: 'special', label: 'At least one special character (@ $ ! % * ? &)', test: (p) => /[@$!%*?&]/.test(p) },
];

export const getPasswordRuleStatus = (password = '') =>
  RULES.map((rule) => ({ ...rule, met: rule.test(password) }));

export const isPasswordValid = (password = '') =>
  getPasswordRuleStatus(password).every((r) => r.met);

const PasswordRules = ({ password = '', compact = false }) => {
  const statuses = getPasswordRuleStatus(password);
  const metCount = statuses.filter((r) => r.met).length;

  return (
    <Box
      sx={{
        mt: 1.5,
        p: compact ? 1.5 : 2,
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Password Requirements ({metCount}/{statuses.length})
      </Typography>
      {statuses.map((rule) => (
        <Box key={rule.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.6 }}>
          {rule.met ? (
            <CheckCircle sx={{ fontSize: 18, color: '#22c55e', mt: 0.1 }} />
          ) : (
            <Cancel sx={{ fontSize: 18, color: '#f87171', mt: 0.1 }} />
          )}
          <Typography sx={{ fontSize: '0.8rem', color: rule.met ? '#86efac' : 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
            {rule.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default PasswordRules;
