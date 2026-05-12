'use client';

import { Box, Stack, Typography } from '@mui/material';

export type LeadStatus = 'New' | 'Assigned' | 'In Progress' | 'Valid' | 'Converted' | 'Lost' | 'Expired';

const TONES: Record<string, { bg: string; fg: string; dot: string }> = {
  'New':         { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Assigned':    { bg: 'var(--s-asg-bg)',  fg: 'var(--s-asg-fg)',  dot: 'var(--s-asg-dot)' },
  'In Progress': { bg: 'var(--s-prog-bg)', fg: 'var(--s-prog-fg)', dot: 'var(--s-prog-dot)' },
  'Converted':   { bg: 'var(--s-conv-bg)', fg: 'var(--s-conv-fg)', dot: 'var(--s-conv-dot)' },
  'Lost':        { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
  'Valid':       { bg: 'var(--s-asg-bg)',  fg: 'var(--s-asg-fg)',  dot: 'var(--s-asg-dot)' },
  'Expired':     { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
  // Task statuses
  'Pending':     { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Completed':   { bg: 'var(--s-conv-bg)', fg: 'var(--s-conv-fg)', dot: 'var(--s-conv-dot)' },
  'Cancelled':   { bg: '#f3f6f9',          fg: '#55718c',          dot: '#8eaec8' },
  // Priority
  'High':        { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
  'Medium':      { bg: 'var(--s-prog-bg)', fg: 'var(--s-prog-fg)', dot: 'var(--s-prog-dot)' },
  'Low':         { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Normal':      { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Overdue':     { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
  // Upload/run statuses
  'Queued':      { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Processing':  { bg: 'var(--s-prog-bg)', fg: 'var(--s-prog-fg)', dot: 'var(--s-prog-dot)' },
  'Done':        { bg: 'var(--s-conv-bg)', fg: 'var(--s-conv-fg)', dot: 'var(--s-conv-dot)' },
  'Failed':      { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
  // User statuses
  'Active':      { bg: 'var(--s-conv-bg)', fg: 'var(--s-conv-fg)', dot: 'var(--s-conv-dot)' },
  'Invited':     { bg: 'var(--s-asg-bg)',  fg: 'var(--s-asg-fg)',  dot: 'var(--s-asg-dot)' },
  'Suspended':   { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
};

const fallback = { bg: 'var(--s-new-bg)', fg: 'var(--s-new-fg)', dot: 'var(--s-new-dot)' };

export function StatusChip({ status }: { status: string }) {
  const tone = TONES[status] ?? fallback;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{
        height: 22,
        px: 1,
        borderRadius: '4px',
        bgcolor: tone.bg,
        color: tone.fg,
        display: 'inline-flex',
        flexShrink: 0
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{status}</Typography>
    </Stack>
  );
}
