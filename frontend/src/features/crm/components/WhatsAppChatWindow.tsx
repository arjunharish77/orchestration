'use client';

import AttachFileIcon from '@mui/icons-material/AttachFile';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import { Box, Button, CircularProgress, IconButton, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../components/common/ToastProvider';
import { apiRequest } from '../../../lib/api';
import { formatDate } from '../../../lib/format';

type ChatLead = {
  id: string;
  customerName?: string | null;
  mobile?: string | null;
  status?: string | null;
  category?: string | null;
  serviceWindowUntil?: string | null;
  lastMessageAt?: string | null;
  lastMessage?: string | null;
  lastMessageStatus?: string | null;
  lastMessageDirection?: string | null;
};

type ChatTemplate = {
  id: string;
  name?: string | null;
  content?: string | null;
};

type ChatNumber = {
  id: string;
  phoneNumber?: string | null;
  label?: string | null;
  isDefault?: boolean;
};

type ChatMessage = {
  id: string;
  leadId?: string | null;
  direction?: string | null;
  messageType?: string | null;
  status?: string | null;
  content?: string | null;
  createdAt?: string | null;
};

type ChatOverview = {
  leadSummaries?: ChatLead[];
  templates?: ChatTemplate[];
  messages?: ChatMessage[];
  quickReplies?: Array<{ id: string; name?: string | null; content?: string | null }>;
  numbers?: ChatNumber[];
  conversations?: Array<{ id: string; leadId?: string | null; userId?: string | null; serviceWindowUntil?: string | null }>;
  settings?: { enableSendFromNumber?: boolean; enableRichMedia?: boolean; showUrlPreview?: boolean; qualityRating?: string };
};

const line = '#dceadc';
const green = '#2d6a2d';
const selectMenuProps = {
  sx: {
    zIndex: 2000
  },
  PaperProps: {
    sx: {
      zIndex: 2001,
      maxHeight: 260
    }
  }
};

function withinServiceWindow(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function leadTitle(lead?: ChatLead | null) {
  return lead?.customerName || lead?.mobile || 'Unnamed lead';
}

export function WhatsAppChatWindow({ authToken }: { authToken: string | null }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [overview, setOverview] = useState<ChatOverview>({});
  const [leadId, setLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [whatsAppNumberId, setWhatsAppNumberId] = useState('');
  const [content, setContent] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [showDocument, setShowDocument] = useState(false);

  const loadChat = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const payload = await apiRequest<ChatOverview>('/connectors/whatsapp/chat', { token: authToken });
      const next = payload ?? {};
      setOverview(next);
      setLeadId((current) => current || next.leadSummaries?.[0]?.id || '');
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : 'Could not load WhatsApp chat', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [authToken, toast]);

  useEffect(() => {
    if (open) void loadChat();
  }, [loadChat, open]);

  const selectedLead = overview.leadSummaries?.find((lead) => lead.id === leadId) ?? null;
  const selectedConversation = overview.conversations?.find((conversation) => conversation.leadId === leadId);
  const serviceWindowOpen = withinServiceWindow(selectedLead?.serviceWindowUntil);
  const selectedTemplate = overview.templates?.find((template) => template.id === templateId);
  const requiresTemplate = !serviceWindowOpen && !templateId;
  const documentBlocked = Boolean(documentUrl) && !serviceWindowOpen;
  const richMediaDisabled = overview.settings?.enableRichMedia === false;
  const filteredLeads = useMemo(() => {
    const needle = leadSearch.trim().toLowerCase();
    return (overview.leadSummaries ?? []).filter((lead) => {
      if (!needle) return true;
      return [lead.customerName, lead.mobile, lead.status, lead.category, lead.lastMessage].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [leadSearch, overview.leadSummaries]);
  const messages = useMemo(() => {
    return (overview.messages ?? [])
      .filter((message) => message.leadId === leadId)
      .slice()
      .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  }, [leadId, overview.messages]);

  const send = async () => {
    if (!authToken || !leadId || requiresTemplate || documentBlocked) return;
    setSending(true);
    try {
      await apiRequest('/connectors/whatsapp/messages', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          templateId: templateId || undefined,
          whatsAppNumberId: whatsAppNumberId || undefined,
          content: content || selectedTemplate?.content || undefined,
          mediaUrl: documentUrl || undefined,
          mediaFileName: documentUrl ? documentUrl.split('/').pop() : undefined,
          messageType: documentUrl ? 'media' : templateId ? 'template' : 'text',
          previewUrl: overview.settings?.showUrlPreview === true
        })
      });
      setContent('');
      setDocumentUrl('');
      setTemplateId('');
      setShowDocument(false);
      toast({ message: 'WhatsApp message queued', severity: 'success' });
      await loadChat();
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : 'Could not send WhatsApp message', severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const endChat = async () => {
    if (!authToken || !selectedConversation?.id) return;
    try {
      await apiRequest(`/connectors/whatsapp/conversations/${selectedConversation.id}/end`, { token: authToken, method: 'POST' });
      setContent('');
      setDocumentUrl('');
      setTemplateId('');
      setShowDocument(false);
      toast({ message: 'WhatsApp session ended. Use a template to reopen it.', severity: 'success' });
      await loadChat();
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : 'Could not end chat', severity: 'error' });
    }
  };

  if (!authToken) return null;

  return (
    <Box sx={{ position: 'fixed', right: { xs: 12, md: 20 }, bottom: { xs: 12, md: 20 }, zIndex: 1400 }}>
      {open ? (
        <Paper
          elevation={8}
          sx={{
            width: { xs: 'calc(100vw - 24px)', md: 720 },
            height: { xs: 'min(720px, calc(100vh - 24px))', md: 580 },
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${line}`,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
            bgcolor: '#fbfefb'
          }}
        >
          <Stack sx={{ borderRight: { md: `1px solid ${line}` }, minHeight: 0, display: { xs: selectedLead ? 'none' : 'flex', md: 'flex' } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.1, py: 1, bgcolor: '#eef7ee', borderBottom: `1px solid ${line}` }}>
              <Typography fontWeight={900} fontSize={14}>WhatsApp</Typography>
              <Stack direction="row" spacing={0.25}>
                <Tooltip title="Refresh"><IconButton size="small" onClick={() => void loadChat()}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Close"><IconButton size="small" onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            </Stack>
            <Box sx={{ p: 0.75, borderBottom: `1px solid ${line}` }}>
              <TextField size="small" fullWidth placeholder="Search visible leads" value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} />
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#f8fcf8' }}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress size={22} /></Stack>
              ) : filteredLeads.length ? filteredLeads.map((lead) => {
                const active = lead.id === leadId;
                const windowOpen = withinServiceWindow(lead.serviceWindowUntil);
                return (
                  <Box
                    key={lead.id}
                    component="button"
                    type="button"
                    onClick={() => setLeadId(lead.id)}
                    sx={{
                      width: '100%',
                      display: 'block',
                      textAlign: 'left',
                      border: 0,
                      borderBottom: `1px solid ${line}`,
                      bgcolor: active ? '#eef7ee' : '#fff',
                      p: 0.9,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f3faf3' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={0.75}>
                      <Typography fontWeight={850} fontSize={13} noWrap>{leadTitle(lead)}</Typography>
                      <Typography fontSize={10.5} color={windowOpen ? green : 'text.secondary'} fontWeight={800}>{windowOpen ? '24h' : 'Template'}</Typography>
                    </Stack>
                    <Typography fontSize={11.5} color="text.secondary" noWrap>{lead.lastMessage || lead.mobile || lead.status || '-'}</Typography>
                  </Box>
                );
              }) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', p: 2, color: 'text.secondary' }}>
                  <Typography fontWeight={800}>No visible leads</Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          <Stack sx={{ minHeight: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.1, py: 1, bgcolor: '#eef7ee', borderBottom: `1px solid ${line}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={900} fontSize={14} noWrap>{leadTitle(selectedLead)}</Typography>
                <Typography color={serviceWindowOpen ? green : 'text.secondary'} fontSize={11} fontWeight={800} noWrap>
                  {selectedLead ? serviceWindowOpen ? `Free text until ${formatDate(selectedLead.serviceWindowUntil)}` : '24-hour window closed. Use a template.' : 'Select a lead'}
                  {overview.settings?.qualityRating ? ` · Quality ${overview.settings.qualityRating}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Button size="small" variant="outlined" disabled={!selectedConversation?.id || !serviceWindowOpen} onClick={endChat} sx={{ borderRadius: 1 }}>End session</Button>
                <IconButton size="small" onClick={() => setLeadId('')} sx={{ display: { md: 'none' } }}><CloseIcon fontSize="small" /></IconButton>
              </Stack>
            </Stack>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 1, bgcolor: '#f8fcf8' }}>
              {messages.length ? (
                <Stack spacing={0.75}>
                  {messages.map((message) => {
                    const outbound = message.direction === 'outbound';
                    return (
                      <Box key={message.id} sx={{ display: 'flex', justifyContent: outbound ? 'flex-end' : 'flex-start' }}>
                        <Box sx={{ maxWidth: '82%', p: 0.85, borderRadius: 1.5, bgcolor: outbound ? '#dcf8d8' : '#ffffff', border: `1px solid ${line}` }}>
                          <Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content || message.messageType || '-'}</Typography>
                          <Typography fontSize={10.5} color="text.secondary" sx={{ mt: 0.4 }}>{message.status ?? '-'} · {formatDate(message.createdAt)}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.secondary' }}>
                  <Typography fontWeight={800}>{selectedLead ? 'No messages yet' : 'Choose a lead to start'}</Typography>
                </Stack>
              )}
            </Box>

            <Stack spacing={0.75} sx={{ p: 1, borderTop: `1px solid ${line}`, bgcolor: '#ffffff' }}>
              {overview.settings?.enableSendFromNumber !== false && (overview.numbers ?? []).length ? (
                <Select size="small" value={whatsAppNumberId} displayEmpty MenuProps={selectMenuProps} onChange={(event) => setWhatsAppNumberId(event.target.value)}>
                  <MenuItem value="">Default WhatsApp number</MenuItem>
                  {(overview.numbers ?? []).map((number) => <MenuItem key={number.id} value={number.id}>{number.label || number.phoneNumber}{number.isDefault ? ' · Default' : ''}</MenuItem>)}
                </Select>
              ) : null}
              <Select size="small" value={templateId} displayEmpty MenuProps={selectMenuProps} onChange={(event) => setTemplateId(event.target.value)}>
                <MenuItem value="">{serviceWindowOpen ? 'Free text / no template' : 'Select template to reopen chat'}</MenuItem>
                {(overview.templates ?? []).map((template) => <MenuItem key={template.id} value={template.id}>{template.name ?? template.id}</MenuItem>)}
              </Select>
              <Stack direction="row" spacing={0.75}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={requiresTemplate ? 'Template required outside 24-hour window' : 'Type a message'}
                  value={content}
                  disabled={!selectedLead || requiresTemplate}
                  onChange={(event) => setContent(event.target.value)}
                  multiline
                  maxRows={3}
                />
                <Tooltip title={richMediaDisabled ? 'Rich media is disabled' : !serviceWindowOpen ? 'Documents require an open 24-hour service window' : 'Document URL'}>
                  <span>
                    <IconButton disabled={!selectedLead || !serviceWindowOpen || richMediaDisabled} onClick={() => setShowDocument((value) => !value)} sx={{ border: `1px solid ${line}`, borderRadius: 1 }}>
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button variant="contained" disabled={sending || !selectedLead || requiresTemplate || documentBlocked || (!content && !templateId && !documentUrl)} onClick={send} sx={{ minWidth: 42, borderRadius: 1 }}>
                  {sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
                </Button>
              </Stack>
              {showDocument ? <TextField size="small" label="Document URL" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} /> : null}
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <Tooltip title="WhatsApp Chat">
          <IconButton onClick={() => setOpen(true)} sx={{ width: 52, height: 52, bgcolor: green, color: '#fff', boxShadow: '0 14px 32px rgba(45,106,45,0.28)', '&:hover': { bgcolor: '#245824' } }}>
            <ChatBubbleOutlineIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
