'use client';

import CallIcon from '@mui/icons-material/Call';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl, apiRequest } from '../../../lib/api';

const green = '#2d6a2d';
const panel = '#ffffff';
const line = '#e0ede0';
const closedPopupStorageKey = 'unnatify_closed_telephony_popups';
const popupWidth = 360;
const popupMinHeight = 228;
const viewportPadding = 16;
const visiblePopupLimit = 3;

type PopupConfig = {
  visibleFields: string[];
  tabs: string[];
};

const defaultPopupConfig: PopupConfig = {
  visibleFields: ['customerName', 'mobile', 'status', 'category', 'disposition', 'branchCode', 'offerAmount'],
  tabs: ['Overview', 'Activities', 'Dispositions', 'Tasks', 'Calls', 'Notes', 'Custom Fields', 'Automation History']
};

const popupFieldLabels: Record<string, string> = {
  externalLeadId: 'Lead ID',
  customerName: 'Customer Name',
  mobile: 'Mobile',
  email: 'Email',
  status: 'Status',
  category: 'Category',
  disposition: 'Disposition',
  branchCode: 'Branch Code',
  branchName: 'Branch',
  offerAmount: 'Loan Offer',
  emiAmount: 'EMI',
  preferredLanguage: 'Language',
  customerLocation: 'Location',
  location: 'Location',
  uploadDate: 'Upload Date',
  offerExpiryDate: 'Expiry Date'
};

function PopupChip({ label }: { label: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', minHeight: 22, alignItems: 'center', border: '1px solid #e0ede0', borderRadius: 1, px: 0.75, color: green, bgcolor: '#fff', fontSize: 11, fontWeight: 800 }}>
      {label}
    </Box>
  );
}

export function TelephonyPopupLayer({ authToken }: { authToken: string | null }) {
  const [popups, setPopups] = useState<any[]>([]);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [popupConfig, setPopupConfig] = useState<PopupConfig>(defaultPopupConfig);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const sessionId = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(closedPopupStorageKey);
    setClosedIds(stored ? JSON.parse(stored) : []);
    setPosition(defaultBottomRightPosition());
    const listener = (event: StorageEvent) => {
      if (event.key === closedPopupStorageKey) {
        setClosedIds(event.newValue ? JSON.parse(event.newValue) : []);
      }
    };
    const resizeListener = () => setPosition((current) => boundPosition(current ?? defaultBottomRightPosition()));
    window.addEventListener('storage', listener);
    window.addEventListener('resize', resizeListener);
    return () => {
      window.removeEventListener('storage', listener);
      window.removeEventListener('resize', resizeListener);
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;

    async function sendHeartbeat() {
      await apiRequest('/connectors/telephony/agent-heartbeat', {
        token: authToken,
        method: 'POST',
      }).catch(() => undefined);
    }

    async function loadPopups() {
      try {
        const payload = await apiRequest<any[]>('/connectors/telephony/popups/recent', { token: authToken });
        if (!cancelled) setPopups(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) setPopups([]);
      }
    }

    async function loadPopupConfig() {
      try {
        const payload = await apiRequest<any>('/connectors/telephony/reference', { token: authToken });
        const config = payload?.connector?.config?.popupConfig ?? {};
        if (!cancelled) {
          setPopupConfig({
            visibleFields: Array.isArray(config.visibleFields) && config.visibleFields.length ? config.visibleFields : payload?.popupConfig?.defaultVisibleFields ?? defaultPopupConfig.visibleFields,
            tabs: Array.isArray(config.tabs) && config.tabs.length ? config.tabs : payload?.popupConfig?.defaultTabs ?? defaultPopupConfig.tabs
          });
        }
      } catch {
        if (!cancelled) setPopupConfig(defaultPopupConfig);
      }
    }

    async function connectPopupStream() {
      const streamToken = await apiRequest<{ token: string }>('/connectors/telephony/popups/stream-token', {
        method: 'POST',
        token: authToken
      }).catch(() => null);
      if (!streamToken?.token || cancelled) return;
      eventSource = new EventSource(`${apiBaseUrl}/connectors/telephony/popups/stream?token=${encodeURIComponent(streamToken.token)}`);
      eventSource.addEventListener('telephony-popup', (event) => {
        if (cancelled) return;
        try {
          const popup = JSON.parse((event as MessageEvent).data);
          setPopups((current) => [popup, ...current.filter((item) => item.id !== popup.id)].slice(0, 5));
        } catch {
          // Ignore malformed stream events and let the fallback poll refresh state.
        }
      });
      eventSource.addEventListener('telephony-popup-closed', (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          const popupId = String(payload?.id ?? '');
          if (!popupId) return;
          setPopups((current) => current.filter((item) => item.id !== popupId));
          setClosedIds((current) => {
            const next = Array.from(new Set([...current, popupId])).slice(-50);
            localStorage.setItem(closedPopupStorageKey, JSON.stringify(next));
            return next;
          });
        } catch {
          // Ignore malformed close messages; the backend state is still authoritative.
        }
      });
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!cancelled) {
          reconnectTimer = window.setTimeout(() => {
            if (!cancelled && !eventSource) void connectPopupStream();
          }, 5000);
        }
      };
    }

    void sendHeartbeat();
    void loadPopupConfig();
    void loadPopups();
    void connectPopupStream();
    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, 30_000);
    const fallbackTimer = window.setInterval(() => {
      if (!eventSource) void loadPopups();
    }, 30_000);
    return () => {
      cancelled = true;
      eventSource?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(fallbackTimer);
    };
  }, [authToken]);

  const openPopups = popups.filter((popup) => !closedIds.includes(popup.id));
  const visiblePopups = openPopups.slice(0, visiblePopupLimit);
  const overflowCount = Math.max(0, openPopups.length - visiblePopupLimit);
  const activePopup = visiblePopups[0];
  const visibleFields = useMemo(() => popupConfig.visibleFields.filter((field) => popupFieldLabels[field]), [popupConfig.visibleFields]);

  useEffect(() => {
    if (!authToken || !activePopup?.id) return;
    setPosition(defaultBottomRightPosition());
    void apiRequest(`/connectors/telephony/popups/${encodeURIComponent(activePopup.id)}/delivery`, {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({ status: 'seen', sessionId })
    }).catch(() => undefined);
  }, [activePopup?.id, authToken, sessionId]);

  if (!visiblePopups.length) return null;

  const closePopup = (popupId: string) => {
    const next = Array.from(new Set([...closedIds, popupId])).slice(-50);
    setClosedIds(next);
    localStorage.setItem(closedPopupStorageKey, JSON.stringify(next));
    if (authToken) {
      void apiRequest(`/connectors/telephony/popups/${encodeURIComponent(popupId)}/delivery`, {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({ status: 'closed', sessionId })
      }).catch(() => undefined);
    }
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    const current = position ?? defaultBottomRightPosition();
    setDragState({
      pointerId: event.pointerId,
      offsetX: event.clientX - current.x,
      offsetY: event.clientY - current.y
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const next = boundPosition({
      x: event.clientX - dragState.offsetX,
      y: event.clientY - dragState.offsetY
    });
    setPosition(next);
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    setDragState(null);
  };

  return (
    <Stack
      spacing={0.8}
      sx={{
        position: 'fixed',
        left: position?.x ?? `calc(100vw - ${popupWidth + 18}px)`,
        top: position?.y ?? `calc(100vh - ${popupMinHeight + 18}px)`,
        zIndex: 25,
        width: popupWidth,
        maxWidth: 'calc(100vw - 32px)'
      }}
    >
      {visiblePopups.map((popup, index) => (
        <Paper
          key={popup.id}
          variant="outlined"
          sx={{
            borderRadius: 1,
            borderColor: '#e0ede0',
            overflow: 'hidden',
            bgcolor: panel,
            boxShadow: '0 14px 40px rgba(20, 43, 22, 0.18)',
            opacity: index === 0 ? 1 : 0.94
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onPointerDown={index === 0 ? handleDragStart : undefined}
            onPointerMove={index === 0 ? handleDragMove : undefined}
            onPointerUp={index === 0 ? handleDragEnd : undefined}
            onPointerCancel={index === 0 ? handleDragEnd : undefined}
            sx={{ px: 1.25, py: 1, bgcolor: '#eef7ee', borderBottom: `1px solid ${line}`, cursor: index === 0 ? (dragState ? 'grabbing' : 'grab') : 'default', touchAction: 'none', userSelect: 'none' }}
          >
            <Stack direction="row" spacing={0.8} alignItems="center">
              <CallIcon fontSize="small" />
              <Typography fontWeight={800}>{popup.payload?.normalizedDirection === 'Outbound' ? 'Outbound Call' : 'Incoming Call'}</Typography>
            </Stack>
            <IconButton size="small" onPointerDown={(event) => event.stopPropagation()} onClick={() => closePopup(popup.id)}><ExpandMoreIcon fontSize="small" /></IconButton>
          </Stack>
          <Stack spacing={0.8} sx={{ p: 1 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>{popup.lead?.customerName ?? 'Unknown lead'}</Typography>
                <Typography color="text.secondary" fontSize={13}>{popup.payload?.normalizedLeadPhone ?? popup.lead?.mobile ?? 'No matched lead phone'}</Typography>
              </Box>
              <PopupChip label={popup.payload?.normalizedDirection ?? 'Call'} />
            </Stack>
            {popup.lead ? (
              <Stack spacing={0.35}>
                {visibleFields.map((field) => (
                  <Stack key={field} direction="row" justifyContent="space-between" spacing={1} sx={{ borderTop: `1px solid ${line}`, pt: 0.35 }}>
                    <Typography color="text.secondary" fontSize={12}>{popupFieldLabels[field]}</Typography>
                    <Typography fontWeight={800} fontSize={12} textAlign="right" sx={{ maxWidth: 185, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatPopupValue(popup.lead?.[field])}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : null}
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {popupConfig.tabs.map((tab) => <PopupChip key={tab} label={tab} />)}
            </Stack>
            <Typography color="text.secondary" fontSize={13}>Session: {popup.callSessionId ?? '-'}</Typography>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" variant="contained" startIcon={<OpenInNewIcon />} disabled={!popup.lead?.id} onClick={() => window.open(`/leads/${popup.lead.id}`, '_blank')} sx={{ borderRadius: 1 }}>View Lead</Button>
              <Button size="small" variant="outlined" onClick={() => closePopup(popup.id)} sx={{ borderRadius: 1 }}>Close</Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {overflowCount ? (
        <Box sx={{ alignSelf: 'flex-end', px: 1, py: 0.35, borderRadius: 999, bgcolor: '#eef7ee', border: `1px solid ${line}`, color: green, fontSize: 12, fontWeight: 800 }}>
          +{overflowCount} more
        </Box>
      ) : null}
    </Stack>
  );
}

function defaultBottomRightPosition() {
  if (typeof window === 'undefined') return { x: 18, y: 92 };
  return {
    x: Math.max(viewportPadding, window.innerWidth - popupWidth - 18),
    y: Math.max(viewportPadding, window.innerHeight - popupMinHeight - 18)
  };
}

function boundPosition(position: { x: number; y: number }) {
  if (typeof window === 'undefined') return position;
  return {
    x: Math.min(Math.max(viewportPadding, position.x), Math.max(viewportPadding, window.innerWidth - popupWidth - viewportPadding)),
    y: Math.min(Math.max(viewportPadding, position.y), Math.max(viewportPadding, window.innerHeight - 180))
  };
}

function formatPopupValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === 'object' && 'toString' in value) return String(value);
  return String(value);
}
