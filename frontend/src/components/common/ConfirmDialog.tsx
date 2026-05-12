'use client';

import { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onClose }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 1, border: '1px solid #e0ede0', boxShadow: '0 24px 70px rgba(22, 39, 22, 0.18)', overflow: 'hidden' } }}>
      <DialogTitle sx={{ py: 1, bgcolor: '#eef7ee', borderBottom: '1px solid #e0ede0' }}><Typography variant="h6">{title}</Typography></DialogTitle>
      <DialogContent><Typography color="text.secondary">{message}</Typography></DialogContent>
      <DialogActions sx={{ bgcolor: '#fafdfa', borderTop: '1px solid #e0ede0' }}>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button variant="contained" color={destructive ? 'error' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
