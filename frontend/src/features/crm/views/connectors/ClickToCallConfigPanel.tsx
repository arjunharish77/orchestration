'use client';

import { Box, Button, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import type { TelephonyClickTestForm, TelephonyConfigForm, TelephonyReference } from './connector-types';

const bg = '#fafdfa';
const variableTailPattern = /\{\{\s*([A-Za-z0-9_.]*)?$/;

export function ClickToCallConfigPanel({
  telephonyRef,
  telephonyConfig,
  setTelephonyConfig,
  clickTest,
  setClickTest,
  testClickToCall,
  saveTelephonyConfig
}: {
  telephonyRef: TelephonyReference;
  telephonyConfig: TelephonyConfigForm;
  setTelephonyConfig: (value: TelephonyConfigForm) => void;
  clickTest: TelephonyClickTestForm;
  setClickTest: (value: TelephonyClickTestForm) => void;
  testClickToCall: () => void;
  saveTelephonyConfig: () => void;
}) {
  const variableSuggestions = telephonyRef.clickToCall.supportedVariables;
  const appendVariable = (field: 'clickToCallUrl' | 'dataTemplate', variable: string) => {
    const current = String(telephonyConfig[field] ?? '');
    const next = current.match(variableTailPattern)
      ? current.replace(variableTailPattern, variable)
      : `${current}${current.endsWith(' ') || current.length === 0 ? '' : ' '}${variable}`;
    setTelephonyConfig({ ...telephonyConfig, [field]: next });
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 1, bgcolor: bg, borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800}>Click-to-Call Configuration</Typography>
          <Stack direction="row" spacing={0.5}>{telephonyRef.clickToCall.supportedMethods.map((method: string) => <AppChip key={method} label={method} />)}</Stack>
        </Stack>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1.5fr 130px 1fr' } }}>
          <TextField size="small" label="Provider URL" value={telephonyConfig.clickToCallUrl} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, clickToCallUrl: event.target.value })} placeholder="https://api.mcube.com/Restmcube-api/outbound-calls?phone={{lead.mobile}}" />
          <FormControl size="small"><Select value={telephonyConfig.httpMethod} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, httpMethod: event.target.value })}><MenuItem value="GET">GET</MenuItem><MenuItem value="POST">POST</MenuItem></Select></FormControl>
          <TextField size="small" label="Response keyword (optional)" value={telephonyConfig.responseKeyword} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, responseKeyword: event.target.value })} />
          <TextField size="small" label="Webhook secret" type="password" value={telephonyConfig.webhookSecret} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, webhookSecret: event.target.value })} helperText="Used by inbound route, popup, and call-log webhooks." />
          <TextField size="small" label="Provider support email" value={telephonyConfig.providerSupportEmail} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, providerSupportEmail: event.target.value })} />
          <FormControl size="small"><Select value={telephonyConfig.requestType} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, requestType: event.target.value })}>{telephonyRef.clickToCall.requestTypes.map((type: string) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><Select value={telephonyConfig.responseType} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, responseType: event.target.value })}>{telephonyRef.clickToCall.responseTypes.map((type: string) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
	        </Box>
	        <Stack spacing={0.45}>
	          <Typography variant="caption" color="text.secondary">URL variables</Typography>
	          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
	            {variableSuggestions.map((item) => (
	              <Box key={item} component="button" type="button" onClick={() => appendVariable('clickToCallUrl', item)} sx={{ border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer' }}>
	                <AppChip label={item} />
	              </Box>
	            ))}
	          </Stack>
	        </Stack>
	        <Typography fontWeight={800}>Data Template</Typography>
	        <TextField size="small" multiline minRows={7} value={telephonyConfig.dataTemplate} onChange={(event) => setTelephonyConfig({ ...telephonyConfig, dataTemplate: event.target.value })} placeholder={'{\n  "custnumber": "{{lead.mobile}}",\n  "exenumber": "{{user.phone}}"\n}'} />
	        <Typography variant="caption" color="text.secondary">Body variables</Typography>
	        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
	          {variableSuggestions.map((item) => (
	            <Box key={item} component="button" type="button" onClick={() => appendVariable('dataTemplate', item)} sx={{ border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer' }}>
	              <AppChip label={item} />
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">{'Type {{ or {{lead. in URL/body, then click a token to insert it.'}</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField size="small" label="Lead ID for test" value={clickTest.leadId} onChange={(event) => setClickTest({ ...clickTest, leadId: event.target.value })} />
          <TextField size="small" label="Agent user ID override" value={clickTest.userId} onChange={(event) => setClickTest({ ...clickTest, userId: event.target.value })} />
          <Button variant="contained" size="small" disabled={!clickTest.leadId} onClick={testClickToCall} sx={{ borderRadius: 1 }}>Test Call</Button>
          <Button variant="contained" size="small" onClick={saveTelephonyConfig} sx={{ borderRadius: 1 }}>Save Config</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
