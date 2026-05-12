'use client';

import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CallIcon from '@mui/icons-material/Call';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PhoneIcon from '@mui/icons-material/Phone';
import { Avatar, Box, Card, IconButton, Paper, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { AppChip } from '../../../components/common/AppChip';
import { formatDate } from '../../../lib/format';

const green = '#2d6a2d';
const panel = '#ffffff';
const line = '#e0ede0';
const mutedPanel = '#eef7ee';
const textMain = '#162716';

type LeadDetailLead = {
  id: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  branchName: string;
  amount: string;
  emi: string;
  status: string;
  category: string;
  source: string;
  created: string;
  owner: string;
  team: string;
  language: string;
  location?: string;
  uploadDate?: string;
  offerExpiryDate?: string;
  disposition?: string;
  customFields?: Array<{ key: string; label: string; value: unknown }>;
};

type LeadDetailActivity = {
  id: string;
  type: string;
  title: string;
  notes?: string | null;
  disposition?: string | null;
  createdAt?: string;
  createdBy?: string | null;
};

function normalizeActivityTypeCode(type?: string | null) {
  const activityTypes = [
    { code: '001', label: 'Call' },
    { code: '002', label: 'Meeting' },
    { code: '003', label: 'Note' },
    { code: '004', label: 'Disposition' },
    { code: '005', label: 'WhatsApp' },
    { code: '006', label: 'Voicebot' },
    { code: '007', label: 'Document Shared' },
    { code: '008', label: 'System' },
    { code: '009', label: 'Task' },
    { code: '010', label: 'Upload' },
    { code: '011', label: 'Assignment' },
    { code: '013', label: 'Telephony Call' }
  ];
  const labels = Object.fromEntries(activityTypes.map((item) => [item.label, item.code]));
  return type ? labels[type] ?? type : '001';
}

function labelForActivityType(type?: string | null) {
  const activityTypes = [
    { code: '001', label: 'Call' },
    { code: '002', label: 'Meeting' },
    { code: '003', label: 'Note' },
    { code: '004', label: 'Disposition' },
    { code: '005', label: 'WhatsApp' },
    { code: '006', label: 'Voicebot' },
    { code: '007', label: 'Document Shared' },
    { code: '008', label: 'System' },
    { code: '009', label: 'Task' },
    { code: '010', label: 'Upload' },
    { code: '011', label: 'Assignment' },
    { code: '013', label: 'Telephony Call' }
  ];
  const code = normalizeActivityTypeCode(type);
  const match = activityTypes.find((item) => item.code === code);
  return match ? `${match.code} · ${match.label}` : code;
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function PropertyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.25, py: 0.8, borderBottom: `1px solid ${line}` }}>
      <Typography component="span" color="text.secondary">{label}</Typography>
      <Box component="div" sx={{ fontWeight: 800, textAlign: 'right' }}>{value}</Box>
    </Stack>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function ProfileSection({ title, rows }: { title: string; rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Card sx={{ borderRadius: 1, overflow: 'hidden', border: `1px solid ${line}`, boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Typography variant="h6" sx={{ px: 1.25, py: 0.8, borderBottom: `1px solid ${line}`, bgcolor: '#eef7ee' }}>{title}</Typography>
      {rows.map((row) => (
        <PropertyRow key={row.label} label={row.label} value={row.value} />
      ))}
    </Card>
  );
}

export function LeadProfileCard({ lead }: { lead: LeadDetailLead }) {
  const customerRows = [
    { label: 'Owner', value: lead.owner },
    { label: 'Status', value: <AppChip label={lead.status} /> },
    { label: 'Category', value: lead.category },
    { label: 'Disposition', value: lead.disposition ?? '-' },
    { label: 'Source', value: lead.source },
    { label: 'Branch Code', value: lead.branch },
    { label: 'Branch Name', value: lead.branchName },
    { label: 'Team', value: lead.team },
    { label: 'Customer Location', value: lead.location ?? '-' },
    { label: 'Preferred Language', value: lead.language }
  ];
  const loanRows = [
    { label: 'Loan Offer Amount', value: lead.amount },
    { label: 'EMI Amount', value: lead.emi },
    { label: 'Upload Date', value: lead.uploadDate ?? '-' },
    { label: 'Loan Closure / Offer Expiry', value: lead.offerExpiryDate ?? '-' }
  ];
  const customRows = (lead.customFields ?? []).map((field) => ({ label: field.label || field.key, value: formatValue(field.value) }));
  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 1, overflow: 'hidden', boxShadow: '0 12px 30px rgba(22, 39, 22, 0.08)' }}>
        <Box sx={{ p: 1.4, color: '#fff', background: 'linear-gradient(145deg, #162716 0%, #2d6a2d 100%)' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 46, height: 46, bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 20, fontWeight: 800 }}>{lead.initials}</Avatar>
            <Box>
              <Typography variant="h5" color="#fff">{lead.name}</Typography>
              <Typography sx={{ opacity: 0.85, fontStyle: 'italic' }}>{lead.status === 'HOT' ? 'Hot' : lead.category}</Typography>
            </Box>
          </Stack>
          <Stack spacing={0.75} sx={{ mt: 1.25 }}>
            <Stack direction="row" spacing={1.4}><EmailIcon fontSize="small" /><Typography>{lead.email}</Typography></Stack>
            <Stack direction="row" spacing={1.4}><PhoneIcon fontSize="small" /><Typography>{lead.phone}</Typography></Stack>
            <Stack direction="row" spacing={1.4}><BusinessCenterIcon fontSize="small" /><Typography>{lead.branchName}</Typography></Stack>
            <Stack direction="row" spacing={1.4}><DescriptionIcon fontSize="small" /><Typography>{lead.source}</Typography></Stack>
          </Stack>
        </Box>
        <Stack direction="row" justifyContent="space-around" sx={{ bgcolor: '#eef7ee', color: textMain, py: 0.65 }}>
          {['2|Activities', '1|Assignments', '3|Automations'].map((item) => {
            const [value, label] = item.split('|');
            return <Box key={label} textAlign="center"><Typography fontWeight={800}>{value}</Typography><Typography>{label}</Typography></Box>;
          })}
        </Stack>
      </Card>
      <ProfileSection title="Customer" rows={customerRows} />
      <ProfileSection title="Loan Details" rows={loanRows} />
      <ProfileSection title="System Details" rows={[{ label: 'Created', value: lead.created }]} />
      <ProfileSection title="Custom Fields" rows={customRows.length > 0 ? customRows : [{ label: 'No custom fields', value: '-' }]} />
    </Stack>
  );
}

export function ActivityCard({ activity, createdByName, expanded, onToggle }: { activity: LeadDetailActivity; lead: { name: string; owner: string }; createdByName?: string; expanded?: boolean; onToggle?: () => void }) {
  const border = line;
  const iconBg = mutedPanel;
  const iconColor = green;
  const kind = labelForActivityType(activity.type);
  const note = activity.notes || activity.title || activity.disposition || '-';

  return (
    <Box>
      <AppChip label={formatDate(activity.createdAt)} sx={{ bgcolor: mutedPanel, color: green, mb: 1, fontSize: 12, px: 0.5, minHeight: 24 }} />
      <Paper variant="outlined" sx={{ borderColor: border, borderRadius: 1, p: 1, bgcolor: panel, boxShadow: '0 8px 22px rgba(22, 39, 22, 0.04)' }}>
        <Stack direction="row" spacing={1.2} alignItems="flex-start">
          <Stack alignItems="center" spacing={0.5}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: iconBg, color: iconColor }}><CallIcon fontSize="small" /></Avatar>
            <Typography fontWeight={800}>{formatTime(activity.createdAt)}</Typography>
          </Stack>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography fontWeight={800}>{kind}</Typography>
              {activity.disposition ? <AppChip label={activity.disposition} sx={{ bgcolor: mutedPanel }} /> : null}
            </Stack>
            <Typography sx={{ mt: 1 }}>{note}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Added by <b>{createdByName || 'System'}</b></Typography>
          </Box>
          <Typography color="text.secondary">{activity.title}</Typography>
          <IconButton
            onClick={onToggle}
            aria-label={expanded ? 'Hide activity details' : 'Show activity details'}
            sx={{ bgcolor: iconBg, borderRadius: 1, border: `1px solid ${line}` }}
          >
            <ExpandMoreIcon sx={{ color: iconColor, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
          </IconButton>
        </Stack>
      </Paper>
    </Box>
  );
}
