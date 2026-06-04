'use client';

import AutorenewIcon from '@mui/icons-material/Autorenew';
import { alpha, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { SettingsRouteItem, SettingsSidebar } from '../../../components/settings/SettingsSidebar';

const panel = '#ffffff';
const line = '#e0ede0';

type SettingsFrameProps = {
  routes: SettingsRouteItem[];
  active: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  message?: ReactNode;
  children: ReactNode;
};

export function SettingsFrame({ routes, active, onChange, onRefresh, message, children }: SettingsFrameProps) {
  const activeRoute = routes.find((route) => route.value === active) ?? routes[0];

  return (
    <Stack spacing={1.25}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, gap: { xs: 1.1, md: 1.8 }, alignItems: 'start', minWidth: 0 }}>
        <SettingsSidebar items={routes} active={active} onChange={onChange} />
        <Paper
          variant="outlined"
          sx={{
            minHeight: { md: 'calc(100vh - 180px)' },
            borderRadius: 1,
            borderColor: line,
            bgcolor: alpha(panel, 0.78),
            overflow: 'clip',
            boxShadow: '0 10px 26px rgba(22, 39, 22, 0.035)'
          }}
        >
          <Stack spacing={1.2} sx={{ p: { xs: 1.1, md: 1.6 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'flex-start' }} justifyContent="space-between" spacing={1.2}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{activeRoute.label}</Typography>
                {'description' in activeRoute ? <Typography color="text.secondary" sx={{ mt: 0.45, maxWidth: 680 }}>{activeRoute.description}</Typography> : null}
                {message ? <Box sx={{ mt: 0.8 }}>{message}</Box> : null}
              </Box>
              <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', flexShrink: 0 }}>
                <Button size="small" variant="outlined" startIcon={<AutorenewIcon />} onClick={onRefresh} sx={{ minHeight: 32, borderRadius: 1, fontWeight: 800 }}>Refresh</Button>
              </Stack>
            </Stack>
            <Box sx={{ height: 1, bgcolor: line }} />
            <Stack spacing={1.15}>{children}</Stack>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
