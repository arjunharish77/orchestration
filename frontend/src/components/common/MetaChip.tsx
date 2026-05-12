'use client';

import { Typography } from '@mui/material';

export function MetaChip({ label }: { label: string }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 1,
        borderRadius: '4px',
        bgcolor: 'var(--g50)',
        color: 'var(--g700)',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      {label}
    </Typography>
  );
}
