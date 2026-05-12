'use client';

import { Alert, Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { motion, reducedMotionMedia } from '../../lib/motion';

const line = '#e0ede0';
const bg = '#f8fcf8';
const panel = '#ffffff';
const skeletonGreen = '#eef7ee';

export function RouteLoadingState({ title = 'Loading' }: { title?: string }) {
  return (
    <Box aria-label={title} sx={{ minHeight: '100vh', bgcolor: bg, p: { xs: 1.25, md: 2 } }}>
      <Paper
        variant="outlined"
        sx={{
          width: 'min(1120px, 100%)',
          mx: 'auto',
          mt: { xs: 1, md: 3 },
          borderColor: line,
          borderRadius: '8px',
          p: { xs: 1.2, md: 1.6 },
          bgcolor: panel,
          transition: motion.page,
          [reducedMotionMedia]: { transition: 'none' }
        }}
      >
        <Stack spacing={1.15}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0.5} sx={{ width: 'min(420px, 60%)' }}>
              <Skeleton variant="rounded" width="52%" height={18} sx={{ bgcolor: skeletonGreen }} />
              <Skeleton variant="rounded" height={12} sx={{ bgcolor: skeletonGreen }} />
            </Stack>
            <Skeleton variant="rounded" width={112} height={34} sx={{ bgcolor: skeletonGreen }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            {[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={72} sx={{ flex: 1, bgcolor: skeletonGreen }} />)}
          </Stack>
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} variant="rounded" height={42} sx={{ bgcolor: skeletonGreen }} />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}

export function RouteErrorState({ error, reset }: { error?: Error & { digest?: string }; reset?: () => void }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: bg, p: 2 }}>
      <Paper variant="outlined" sx={{ width: 'min(520px, 100%)', borderColor: line, borderRadius: '8px', p: 2, bgcolor: panel }}>
        <Stack spacing={1}>
          <Typography variant="h6">Something went wrong</Typography>
          <Alert severity="error" sx={{ borderRadius: '8px' }}>
            {error?.message ?? 'The page could not be loaded.'}
          </Alert>
          {reset ? <Button variant="contained" onClick={reset} sx={{ alignSelf: 'flex-start' }}>Try again</Button> : null}
        </Stack>
      </Paper>
    </Box>
  );
}
