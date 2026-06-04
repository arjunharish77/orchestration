'use client';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import GroupsIcon from '@mui/icons-material/Groups';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SecurityIcon from '@mui/icons-material/Security';
import TuneIcon from '@mui/icons-material/Tune';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

const line = '#e0ede0';
const green = '#2d6a2d';
const hoverGreen = '#eef7ee';
const activeGreen = '#eef7ee';
const textMain = '#162716';
const muted = '#526252';

export type SettingsRouteItem = {
  value: string;
  label: string;
  path: string;
  description?: string;
  icon?: ReactNode;
};

const routeIcons: Record<string, ReactNode> = {
  access: <GroupsIcon fontSize="small" />,
  connectors: <IntegrationInstructionsIcon fontSize="small" />,
  fields: <TuneIcon fontSize="small" />,
  'activity-types': <FactCheckOutlinedIcon fontSize="small" />,
  lists: <FormatListBulletedIcon fontSize="small" />,
  uploads: <CloudUploadIcon fontSize="small" />,
  security: <SecurityIcon fontSize="small" />
};

export function SettingsSidebar({ items, active, onChange }: { items: SettingsRouteItem[]; active: string; onChange: (value: string) => void }) {
  return (
    <Box
      component="nav"
      aria-label="Settings sections"
      sx={{
        position: { md: 'sticky' },
        top: { md: 72 },
        maxHeight: { md: 'calc(100dvh - 96px)' },
        overflowY: 'auto',
        overflowX: 'hidden',
        pr: { md: 1 },
        borderRight: { md: `1px solid ${line}` },
        scrollbarWidth: 'thin',
        overscrollBehavior: 'contain'
      }}
    >
      <Stack spacing={0.2}>
        {items.map((item) => (
          <Button
            key={item.value}
            size="small"
            aria-current={active === item.value ? 'page' : undefined}
            onClick={() => onChange(item.value)}
            sx={{
              justifyContent: 'flex-start',
              minHeight: 40,
              borderRadius: 1,
              px: 1,
              py: 0.5,
              color: active === item.value ? green : textMain,
              bgcolor: active === item.value ? activeGreen : 'transparent',
              border: '1px solid',
              borderColor: active === item.value ? '#d0e4d0' : 'transparent',
              '&:hover': { bgcolor: active === item.value ? activeGreen : hoverGreen },
              '&:focus-visible': { outline: `2px solid ${green}`, outlineOffset: 2 }
            }}
          >
            <Stack direction="row" spacing={0.9} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: 1, color: active === item.value ? green : muted, bgcolor: active === item.value ? '#dff0df' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {item.icon ?? routeIcons[item.value]}
              </Box>
              <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                <Typography fontWeight={active === item.value ? 850 : 750} fontSize={13} noWrap>{item.label}</Typography>
                {item.description ? <Typography color="text.secondary" fontSize={11} noWrap>{item.description}</Typography> : null}
              </Box>
            </Stack>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
