'use client';

import { ReactNode } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export function FormDialog({
  open,
  title,
  subtitle,
  children,
  actions,
  onClose,
  maxWidth = 'md',
  paperSx,
  contentSx
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  paperSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      PaperProps={{
        sx: [
          {
            borderRadius: '8px',
            border: '1px solid #e0ede0',
            boxShadow: '0 24px 70px rgba(22, 39, 22, 0.18)',
            overflow: 'hidden'
          },
          ...(Array.isArray(paperSx) ? paperSx : paperSx ? [paperSx] : [])
        ]
      }}
    >
      <DialogTitle sx={{ py: 1, px: 1.25, pr: 5, bgcolor: '#eef7ee', borderBottom: '1px solid #e0ede0' }}>
        <Typography variant="h6">{title}</Typography>
        {subtitle ? <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>{subtitle}</Typography> : null}
        <IconButton size="small" onClick={onClose} sx={{ position: 'absolute', top: 10, right: 10, color: 'text.secondary' }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={[{ p: 1.25, bgcolor: '#fff', borderColor: '#e0ede0' }, ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : [])]}>{children}</DialogContent>
      {actions ? <DialogActions sx={{ px: 1.25, py: 1, bgcolor: '#fafdfa', borderTop: '1px solid #e0ede0' }}><Stack direction="row" spacing={0.75}>{actions}</Stack></DialogActions> : null}
    </Dialog>
  );
}
