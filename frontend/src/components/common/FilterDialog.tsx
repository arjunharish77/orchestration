'use client';

import CloseIcon from '@mui/icons-material/Close';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

const line = '#e0ede0';
const panel = '#ffffff';

export function FilterDialog({
  open,
  title = 'Filters',
  children,
  onApply,
  onClose,
  onReset
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onApply: () => void;
  onClose: () => void;
  onReset?: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1, border: `1px solid ${line}`, bgcolor: panel, boxShadow: '0 24px 70px rgba(22, 39, 22, 0.18)', overflow: 'hidden' } }}>
      <DialogTitle sx={{ py: 0.85, px: 1.1, borderBottom: `1px solid ${line}`, bgcolor: '#eef7ee' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <FilterAltIcon color="primary" fontSize="small" />
            <Typography variant="h6">{title}</Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 1.1, bgcolor: '#fff' }}>
        <Box>{children}</Box>
        <Stack direction="row" justifyContent="flex-end" spacing={0.75} sx={{ mt: 1 }}>
          {onReset ? <Button size="small" variant="text" onClick={onReset}>Reset</Button> : null}
          <Button size="small" variant="outlined" onClick={onClose}>Cancel</Button>
          <Button size="small" variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
