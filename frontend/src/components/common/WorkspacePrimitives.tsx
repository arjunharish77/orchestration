'use client';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Button, Card, Drawer, IconButton, Paper, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { motion, reducedMotionMedia } from '../../lib/motion';
import { PageHeader } from './PageHeader';

const line = 'var(--crm-border)';
const panel = 'var(--crm-paper)';
const mutedPanel = 'var(--crm-soft)';
const textMain = 'text.primary';
const green = 'var(--crm-primary)';

export function ModuleShell({ title, subtitle, children, actions }: { title: string; subtitle: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2.2 }, py: { xs: 1.25, md: 1.8 }, transition: motion.page, [reducedMotionMedia]: { transition: 'none' } }}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </Box>
  );
}

export function PageFilterBar({ children, rightContent }: { children: ReactNode; rightContent?: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: line,
        borderRadius: '8px',
        bgcolor: panel,
        p: 0.65,
        boxShadow: '0 8px 20px rgba(22, 39, 22, 0.018)',
        '& .MuiInputBase-root, & .MuiButton-root': {
          minHeight: 40,
          borderRadius: '8px'
        },
        '& .MuiFormControl-root': {
          flexShrink: 0
        }
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.85} alignItems={{ xs: 'stretch', lg: 'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
          {children}
        </Stack>
        {rightContent ? (
          <Box sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 750, whiteSpace: 'nowrap' }}>{rightContent}</Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function FilterPill({ label, value, onClick, startIcon, muted }: { label: string; value?: string; onClick?: () => void; startIcon?: ReactNode; muted?: boolean }) {
  const interactive = Boolean(onClick);
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={startIcon}
      endIcon={interactive ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
      onClick={onClick}
      disableRipple={!interactive}
      sx={{
        minHeight: 38,
        px: 1.05,
        borderRadius: '8px',
        borderColor: line,
        bgcolor: interactive && muted ? mutedPanel : panel,
        color: interactive ? textMain : 'text.secondary',
        fontWeight: 750,
        justifyContent: 'space-between',
        cursor: interactive ? 'pointer' : 'default',
        '&:hover': {
          borderColor: interactive ? green : line,
          bgcolor: interactive ? mutedPanel : panel
        },
        '& .MuiButton-endIcon': { ml: 0.7 }
      }}
    >
      {value ? `${label}: ${value}` : label}
    </Button>
  );
}

export function BulkActionBar({ count, children, onClear }: { count: number; children: ReactNode; onClear?: () => void }) {
  if (!count) return null;
  return (
    <Paper variant="outlined" sx={{ borderColor: line, borderRadius: '8px', bgcolor: mutedPanel, p: 0.9 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontWeight: 800, color: green, minWidth: 88 }}>{count} selected</Typography>
        {children}
        {onClear ? (
          <Button size="small" variant="text" onClick={onClear} sx={{ color: 'text.secondary', fontWeight: 750 }}>Clear</Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function MetricCard({ label, value, detail, trend, icon, tone = 'green' }: { label: string; value: string | number; detail?: string; trend?: string; icon?: ReactNode; tone?: 'green' | 'red' | 'amber' | 'neutral' }) {
  const toneMap = {
    green: { color: green, bg: mutedPanel },
    red: { color: '#ad3434', bg: '#fff0f0' },
    amber: { color: '#996a11', bg: '#fff7e6' },
    neutral: { color: '#5b6b5b', bg: '#f6faf6' }
  }[tone];
  return (
    <Card
      variant="outlined"
      sx={{
        minHeight: 84,
        borderColor: line,
        borderRadius: '8px',
        p: 0.85,
        bgcolor: panel,
        boxShadow: '0 10px 24px rgba(22, 39, 22, 0.025)',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': { borderColor: 'var(--g200)', transform: 'translateY(-1px)' },
        transition: motion.surface,
        [reducedMotionMedia]: { transition: 'none', '&:hover': { transform: 'none' } }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ width: 30, height: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: toneMap.bg, color: toneMap.color }}>
          {icon}
        </Box>
        {trend ? <Box sx={{ px: 0.7, py: 0.25, borderRadius: '4px', bgcolor: toneMap.bg, color: toneMap.color, fontWeight: 800, fontSize: 11 }}>{trend}</Box> : null}
      </Stack>
      <Typography sx={{ mt: 0.7, color: 'text.secondary', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</Typography>
      <Typography sx={{ mt: 0.1, color: textMain, fontWeight: 800, fontSize: 23, lineHeight: 1 }}>{value}</Typography>
      {detail ? <Typography sx={{ mt: 0.4, color: toneMap.color, fontWeight: 750, fontSize: 12 }}>{detail}</Typography> : null}
    </Card>
  );
}

export function SectionPanel({ title, children, actions, defaultExpanded }: { title: string; children: ReactNode; actions?: ReactNode; defaultExpanded?: boolean }) {
  void defaultExpanded;
  return (
    <Paper variant="outlined" sx={{ bgcolor: panel, borderColor: line, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(22, 39, 22, 0.02)', transition: motion.surface, [reducedMotionMedia]: { transition: 'none' } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 38, px: 1.1, py: 0.5, borderBottom: `1px solid ${line}`, bgcolor: mutedPanel }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>{title}</Typography>
        {actions}
      </Stack>
      <Box>{children}</Box>
    </Paper>
  );
}

export function SegmentedTabs({ value, onChange, tabs }: { value: string; onChange: (value: string) => void; tabs: Array<{ value: string; label: string }> }) {
  return (
    <Stack direction="row" spacing={0.3} flexWrap="wrap" useFlexGap sx={{ p: 0.3, bgcolor: mutedPanel, border: `1px solid ${line}`, borderRadius: '8px' }}>
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          size="small"
          variant={value === tab.value ? 'contained' : 'text'}
          onClick={() => onChange(tab.value)}
          sx={{ minHeight: 30, borderRadius: '4px', px: 1.15, fontSize: 12, fontWeight: 800, color: value === tab.value ? '#fff' : textMain }}
        >
          {tab.label}
        </Button>
      ))}
    </Stack>
  );
}

export function FormDrawer({ open, title, children, actions, onClose }: { open: boolean; title: string; children: ReactNode; actions?: ReactNode; onClose: () => void }) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, bgcolor: panel, transition: motion.drawer, [reducedMotionMedia]: { transition: 'none' } } }}>
      <Stack spacing={0.9} sx={{ p: 1.15, height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{title}</Typography>
          <IconButton size="small" onClick={onClose}><ChevronRightIcon fontSize="small" /></IconButton>
        </Stack>
        <Box sx={{ height: 2, bgcolor: green, borderRadius: 99 }} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>{children}</Box>
        {actions ? <Stack direction="row" spacing={0.75} justifyContent="flex-end">{actions}</Stack> : null}
      </Stack>
    </Drawer>
  );
}

export function EmptyState({ title = 'No records found', detail }: { title?: string; detail?: string }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: line, borderRadius: '8px', p: 1.5, bgcolor: panel, textAlign: 'center' }}>
      <Typography fontWeight={800}>{title}</Typography>
      {detail ? <Typography color="text.secondary" sx={{ mt: 0.4 }}>{detail}</Typography> : null}
    </Paper>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: '#f0b9b9', borderRadius: '8px', p: 1, bgcolor: '#fff8f8' }}>
      <Typography color="error.main" fontWeight={800}>{message}</Typography>
    </Paper>
  );
}

export function ActionToolbar({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {children}
    </Stack>
  );
}
