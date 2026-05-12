'use client';

import { Box, Button, Checkbox, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import type { TelephonyAccessUser, TelephonyMappingForm, TelephonyReference } from './connector-types';

const bg = '#fafdfa';

export function AgentPopupConfigPanel({
  telephonyRef,
  telephonyMapping,
  setTelephonyMapping,
  accessUsers,
  selectedPopupFields,
  selectedPopupTabs,
  popupFieldOptions,
  popupTabOptions,
  labelForPopupField,
  saveTelephonyMapping,
  mode = 'popup-layout'
}: {
  telephonyRef: TelephonyReference;
  telephonyMapping: TelephonyMappingForm;
  setTelephonyMapping: (value: TelephonyMappingForm) => void;
  accessUsers: TelephonyAccessUser[];
  selectedPopupFields: string[];
  selectedPopupTabs: string[];
  popupFieldOptions: Array<{ value: string; label: string }>;
  popupTabOptions: string[];
  labelForPopupField: (value: string) => string;
  saveTelephonyMapping: () => void;
  mode?: 'popup-layout' | 'user-agent-mapping';
}) {
  const showLayout = mode === 'popup-layout';
  const showMapping = mode === 'user-agent-mapping';

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 1.25, bgcolor: bg, borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Stack spacing={1}>
        <Typography fontWeight={800}>{showLayout ? 'Popup Layout' : 'User-Agent Mapping'}</Typography>
        <Typography color="text.secondary">Popup opens at the bottom-right by default, can be dragged, syncs across active tabs, and can open the full lead in a new tab.</Typography>
        {showMapping ? (
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField size="small" label="Virtual/display number" value={telephonyMapping.virtualNumber} onChange={(event) => setTelephonyMapping({ ...telephonyMapping, virtualNumber: event.target.value })} />
            <FormControl size="small">
              <Select displayEmpty value={telephonyMapping.userId} onChange={(event) => setTelephonyMapping({ ...telephonyMapping, userId: event.target.value })}>
                <MenuItem value="">Select mapped user</MenuItem>
                {accessUsers.map((user) => <MenuItem key={user.id} value={user.id}>{user.name} - {user.phone ?? 'no phone'}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        ) : null}
        {showLayout ? (
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <FormControl size="small">
              <Select
                multiple
                displayEmpty
                value={selectedPopupFields}
                renderValue={(selected) => selected.length ? selected.map(labelForPopupField).join(', ') : 'Popup fields'}
                onChange={(event) => {
                  const value = event.target.value;
                  const next = typeof value === 'string' ? value.split(',') : value;
                  setTelephonyMapping({ ...telephonyMapping, visibleFields: next.join(',') });
                }}
              >
                {popupFieldOptions.map((field) => <MenuItem key={field.value} value={field.value}><Checkbox size="small" checked={selectedPopupFields.includes(field.value)} />{field.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select
                multiple
                displayEmpty
                value={selectedPopupTabs}
                renderValue={(selected) => selected.length ? selected.join(', ') : 'Popup tabs'}
                onChange={(event) => {
                  const value = event.target.value;
                  const next = typeof value === 'string' ? value.split(',') : value;
                  setTelephonyMapping({ ...telephonyMapping, tabs: next.join(',') });
                }}
              >
                {popupTabOptions.map((tab) => <MenuItem key={tab} value={tab}><Checkbox size="small" checked={selectedPopupTabs.includes(tab)} />{tab}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        ) : null}
        <Button variant="contained" size="small" onClick={saveTelephonyMapping} sx={{ borderRadius: 1, alignSelf: 'flex-start' }}>{showLayout ? 'Save Layout' : 'Save Mapping'}</Button>
        {showLayout ? (
          <CompactDataTable
            columns={['Area', 'Configured Values']}
            rows={[
              ['Fields', selectedPopupFields.map(labelForPopupField).join(', ') || telephonyRef.popupConfig.defaultVisibleFields.map(labelForPopupField).join(', ')],
              ['Tabs', selectedPopupTabs.join(', ') || telephonyRef.popupConfig.defaultTabs.join(', ')],
              ['Default position', 'Bottom right, draggable'],
              ['Open Lead', 'Open full lead detail in new tab']
            ]}
          />
        ) : (
          <CompactDataTable
            columns={['Area', 'Configured Values']}
            rows={[
              ['Virtual/display number', telephonyMapping.virtualNumber || '-'],
              ['Mapped user', accessUsers.find((user) => user.id === telephonyMapping.userId)?.name ?? '-'],
              ['Offline Agent', 'Store popup event for missed/recent notifications'],
              ['Delivery', 'SSE event to mapped online user']
            ]}
          />
        )}
      </Stack>
    </Paper>
  );
}
