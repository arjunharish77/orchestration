'use client';

/**
 * @deprecated Use StatusChip for lead/task/user statuses, MetaChip for neutral tags, TrendChip for +/-% values.
 */
import { Box, BoxProps } from '@mui/material';

const successLabels = new Set(['hot', 'running', 'online', 'active', 'success', 'completed', 'converted', 'valid', 'assigned']);
const mutedLabels = new Set(['cold', 'offline', 'inactive', 'failed', 'expired', 'invalid', 'duplicate']);
const warningLabels = new Set(['pending', 'queued', 'processing', 'waiting', 'completed with errors', 'warm lead', 'callback requested', 'follow-up required', 'documents pending']);
const dangerLabels = new Set(['high', 'overdue', 'missed', 'error', 'blocked']);

export function AppChip({ label, tone, sx, ...props }: BoxProps & { label: string; tone?: 'success' | 'muted' | 'warning' | 'danger' | 'neutral' }) {
  const normalized = String(label).toLowerCase();
  const resolvedTone = tone
    ?? (successLabels.has(normalized) ? 'success' : mutedLabels.has(normalized) ? 'muted' : warningLabels.has(normalized) ? 'warning' : dangerLabels.has(normalized) ? 'danger' : 'neutral');

  const palette = {
    success: { border: '#e0ede0', bg: '#eef7ee', color: '#2d6a2d' },
    muted: { border: '#cbd7e3', bg: '#f3f6f9', color: '#55718c' },
    warning: { border: '#e6d4a5', bg: '#fff8e4', color: '#7a5a00' },
    danger: { border: '#f0c4c4', bg: '#fbeaea', color: '#ad3434' },
    neutral: { border: '#e0ede0', bg: '#ffffff', color: '#2d6a2d' }
  }[resolvedTone];

  return (
    <Box
      component="span"
      {...props}
      sx={{
        display: 'inline-flex',
        minHeight: 22,
        alignItems: 'center',
        gap: 0.45,
        px: 0.75,
        border: '1px solid',
        borderColor: palette.border,
        bgcolor: palette.bg,
        color: palette.color,
        fontSize: 11,
        fontWeight: 800,
        borderRadius: '4px',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...sx
      }}
    >
      <Box
        component="span"
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          bgcolor: palette.color,
          flexShrink: 0
        }}
      />
      {label}
    </Box>
  );
}
