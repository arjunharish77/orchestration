'use client';

import { Button } from '@mui/material';
import { ReactNode } from 'react';

export function CapsuleButton({
  children,
  startIcon,
  variant = 'contained',
  onClick,
  disabled
}: {
  children: ReactNode;
  startIcon?: ReactNode;
  variant?: 'contained' | 'outlined';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      startIcon={startIcon}
      onClick={onClick}
      disabled={disabled}
      size="small"
      sx={{ minHeight: 32, borderRadius: '8px', px: 1.2, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}
    >
      {children}
    </Button>
  );
}
