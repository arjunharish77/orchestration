'use client';

import { useState } from 'react';
import { Box, Button, Card, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { MessageAlert } from '../../components/common/MessageAlert';
import { apiRequest } from '../../lib/api';

export default function OpsLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');

  const login = async () => {
    setMessage(null);
    try {
      const payload = await apiRequest<{ accessToken: string }>('/ops/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      setToken(payload.accessToken);
      setMessage('Ops session started');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ops login failed');
    }
  };

  const load = async (path: string) => {
    if (!token) return;
    try {
      const payload = await apiRequest<Record<string, unknown>>(path, { token });
      setData(payload);
      if (Array.isArray(payload.tables)) {
        setDbTables(payload.tables.map(String));
        setSelectedTable(payload.tables[0] ? String(payload.tables[0]) : '');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load ops data');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fcf8', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: 'min(920px, 100%)', borderRadius: 1, p: 2 }}>
        <Stack spacing={1.2}>
          <Typography variant="h5" fontWeight={800}>Admin Operations Center</Typography>
          <Typography color="text.secondary">Backend-created ops login only. Not visible to normal admin users.</Typography>
          {!token ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField size="small" label="Ops email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <TextField size="small" label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <Button variant="contained" onClick={login}>Login</Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="outlined" onClick={() => load('/ops/health')}>Health</Button>
              <Button size="small" variant="outlined" onClick={() => load('/ops/logs?file=app.log')}>Logs</Button>
              <Button size="small" variant="outlined" onClick={() => load('/ops/db')}>DB Tables</Button>
              <Button size="small" variant="outlined" onClick={() => load('/ops/queues')}>Queues</Button>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField size="small" label="Upload file path" value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="batch/file.csv" sx={{ minWidth: 260 }} />
              <Button size="small" variant="outlined" onClick={() => load(`/ops/files?path=${encodeURIComponent(filePath)}`)}>View File</Button>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select displayEmpty value={selectedTable} onChange={(event) => setSelectedTable(event.target.value)}>
                  <MenuItem value="">Select DB table</MenuItem>
                  {dbTables.map((table) => <MenuItem key={table} value={table}>{table}</MenuItem>)}
                </Select>
              </FormControl>
              <Button size="small" variant="outlined" disabled={!selectedTable} onClick={() => load(`/ops/db?table=${encodeURIComponent(selectedTable)}`)}>View Table</Button>
            </Stack>
            </Stack>
          )}
          <MessageAlert message={message} />
          <TextField
            size="small"
            multiline
            minRows={18}
            value={JSON.stringify(data, null, 2)}
            InputProps={{ readOnly: true }}
            sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 } }}
          />
        </Stack>
      </Card>
    </Box>
  );
}
