'use client';

import { Button, ButtonProps } from '@mui/material';

export function AppButton({ sx, size = 'small', variant = 'contained', ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      size={size}
      variant={variant}
      sx={{
        minHeight: 32,
        borderRadius: '8px',
        px: 1.35,
        fontWeight: 800,
        textTransform: 'none',
        ...sx
      }}
    />
  );
}
