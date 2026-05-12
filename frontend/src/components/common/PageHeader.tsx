'use client';

import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      alignItems={{ xs: 'stretch', lg: 'flex-end' }}
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: 1.15, minHeight: { md: 76 } }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: { xs: 32, md: 38 }, fontWeight: 900, lineHeight: 0.98, color: '#162716', letterSpacing: 0 }}>{title}</Typography>
        {subtitle ? <Typography color="text.secondary" sx={{ mt: 0.65, fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{subtitle}</Typography> : null}
      </Box>
      {actions ? (
        <Stack
          direction="row"
          spacing={0.65}
          flexWrap="wrap"
          useFlexGap
          justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
          alignItems="center"
          sx={{
            maxWidth: { lg: '68%' },
            '& .MuiButton-root, & .MuiInputBase-root': { minHeight: 36, borderRadius: '8px' },
            '& .MuiFormControl-root': { minWidth: { xs: '100%', sm: 180 } }
          }}
        >
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
