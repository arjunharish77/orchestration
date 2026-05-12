'use client';

import { Alert, AlertColor } from '@mui/material';

type MessageAlertProps = {
  message: string | null | undefined;
  severity?: AlertColor;
};

function inferSeverity(message: string): AlertColor {
  const normalized = message.toLowerCase();
  if (/\b(could not|failed|failure|error|invalid|missing|blocked)\b/.test(normalized)) return 'error';
  if (/\b(waiting|queued|not configured|fallback|skipped|pending)\b/.test(normalized)) return 'warning';
  return 'success';
}

export function MessageAlert({ message, severity }: MessageAlertProps) {
  if (!message) return null;
  return (
    <Alert
      severity={severity ?? inferSeverity(message)}
      sx={{
        borderRadius: '8px',
        py: 0.25,
        alignItems: 'center',
        '& .MuiAlert-message': {
          fontWeight: 800
        }
      }}
    >
      {message}
    </Alert>
  );
}
