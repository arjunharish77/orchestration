'use client';

import { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

const line = '#e0ede0';

export function SectionCard({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: line, borderRadius: 1, overflow: 'hidden', bgcolor: '#fff', boxShadow: '0 10px 26px rgba(22, 39, 22, 0.035)' }}>
      {title || actions ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 40, px: 1, borderBottom: `1px solid ${line}`, bgcolor: '#eef7ee' }}>
          {title ? <Typography variant="h6">{title}</Typography> : <Box />}
          {actions}
        </Stack>
      ) : null}
      <Box>{children}</Box>
    </Paper>
  );
}
