'use client';

import { Paper, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../../../components/common/StatusChip';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';

export function RunHistory({ automationRows }: { automationRows: ReadonlyArray<readonly [string, string, string, number]> }) {
  return (
    <Section title="Lead Automation Report">
      <Stack spacing={1} sx={{ p: 1 }}>
        {automationRows.map(([name, step, status]) => (
          <Paper key={name} variant="outlined" sx={{ p: 1, borderRadius: '8px', borderColor: '#e0ede0', bgcolor: '#fafdfa' }}>
            <Typography fontWeight={800}>{name}</Typography>
            <Typography color="text.secondary">{step}</Typography>
            <StatusChip status={status} />
          </Paper>
        ))}
      </Stack>
    </Section>
  );
}
