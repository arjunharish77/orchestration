'use client';

import { Box, Paper, Typography } from '@mui/material';

const panel = '#ffffff';
const line = '#e0ede0';

export function AutomationMetrics({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
      {rows.map(([label, value]) => (
        <Paper key={label} variant="outlined" sx={{ borderRadius: 1, borderColor: line, bgcolor: panel, p: 1 }}>
          <Typography color="text.secondary" fontSize={11} fontWeight={800}>{label}</Typography>
          <Typography variant="h5" sx={{ mt: 0.2 }}>{value}</Typography>
        </Paper>
      ))}
    </Box>
  );
}
