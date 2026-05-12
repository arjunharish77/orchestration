'use client';

import { Alert, Snackbar } from '@mui/material';
import { ReactNode, createContext, useContext, useState } from 'react';

export type ToastState = { message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null;

const ToastContext = createContext<(toast: ToastState) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  return (
    <ToastContext.Provider value={setToast}>
      {children}
      <Snackbar open={Boolean(toast)} autoHideDuration={3600} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)} sx={{ borderRadius: '8px' }}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}
