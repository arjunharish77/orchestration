'use client';

import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';

const bg = '#fafdfa';

export function SettingsListsPage({
  leadLists,
  taskLists,
  leadListText,
  taskListText,
  setLeadListText,
  setTaskListText,
  savingField,
  saveLeadList,
  saveTaskList
}: {
  leadLists: Record<'status' | 'category' | 'disposition', string[]>;
  taskLists: Record<'type' | 'status', string[]>;
  leadListText: Record<'status' | 'category' | 'disposition', string>;
  taskListText: Record<'type' | 'status', string>;
  setLeadListText: (value: Record<'status' | 'category' | 'disposition', string>) => void;
  setTaskListText: (value: Record<'type' | 'status', string>) => void;
  savingField: boolean;
  saveLeadList: (type: 'status' | 'category' | 'disposition') => void;
  saveTaskList: (type: 'type' | 'status') => void;
}) {
  return (
    <Section title="Configurable List Values" defaultExpanded={false}>
      <Stack spacing={1} sx={{ p: 1 }}>
        {(['status', 'category', 'disposition'] as const).map((type) => (
          <Paper key={type} variant="outlined" sx={{ borderRadius: 1, p: 1, bgcolor: bg, borderColor: '#e0ede0', boxShadow: '0 8px 20px rgba(22, 39, 22, 0.03)' }}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography fontWeight={800}>Lead {type}</Typography>
                <Button size="small" variant="contained" disabled={savingField} onClick={() => saveLeadList(type)} sx={{ borderRadius: 1 }}>Save</Button>
              </Stack>
              <TextField size="small" value={leadListText[type]} onChange={(event) => setLeadListText({ ...leadListText, [type]: event.target.value })} />
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {leadLists[type].map((item) => <AppChip key={item} label={item} />)}
              </Stack>
            </Stack>
          </Paper>
        ))}
        {(['type', 'status'] as const).map((type) => (
          <Paper key={`task-${type}`} variant="outlined" sx={{ borderRadius: 1, p: 1, bgcolor: bg, borderColor: '#e0ede0', boxShadow: '0 8px 20px rgba(22, 39, 22, 0.03)' }}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography fontWeight={800}>Task {type}</Typography>
                <Button size="small" variant="contained" disabled={savingField} onClick={() => saveTaskList(type)} sx={{ borderRadius: 1 }}>Save</Button>
              </Stack>
              <TextField size="small" value={taskListText[type]} onChange={(event) => setTaskListText({ ...taskListText, [type]: event.target.value })} />
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {taskLists[type].map((item) => <AppChip key={item} label={item} />)}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Section>
  );
}
