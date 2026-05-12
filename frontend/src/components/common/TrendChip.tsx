'use client';

import { Typography } from '@mui/material';

export function TrendChip({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 1,
        borderRadius: '4px',
        bgcolor: positive ? 'var(--s-conv-bg)' : 'var(--s-lost-bg)',
        color: positive ? 'var(--s-conv-fg)' : 'var(--s-lost-fg)',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {positive ? '+' : ''}{value}%
    </Typography>
  );
}
