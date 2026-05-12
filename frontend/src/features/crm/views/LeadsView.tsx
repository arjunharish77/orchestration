'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Alert, Button, FormControl, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import { useEffect, useState } from 'react';
import { CapsuleButton } from '../../../components/common/CapsuleButton';
import { FieldSelector } from '../../../components/common/FieldSelector';
import { ToastState, useToast } from '../../../components/common/ToastProvider';
import { ModuleShell } from '../../../components/common/WorkspacePrimitives';
import { apiRequest, apiText } from '../../../lib/api';
import { normalizeOptions } from '../../../lib/field-metadata';
import { LeadRow, cleanLeadFormValue, toLeadRows } from '../types/lead';
import { LeadAdvancedFilters } from './leads/LeadAdvancedFilters';
import { LeadCreatePanel } from './leads/LeadCreatePanel';
import { LeadFilters } from './leads/LeadFilters';
import { LeadTable } from './leads/LeadTable';
import { defaultLeadLists, isVisibleLeadListField, leadFilterBaseFields, leadListFieldOptions as buildLeadListFieldOptions } from './leads/lead-table-columns';
import { FormDialog } from '../../../components/common/FormDialog';

const leadSavedViewStoragePrefix = 'unnatify_lead_saved_views_v1';
const leadColumnStoragePrefix = 'unnatify_lead_columns_v1';
const defaultVisibleLeadFields = ['name', 'email', 'status', 'source', 'created'];
const leadQueryKeys = new Set([
  'userId',
  'search',
  'status',
  'category',
  'disposition',
  'teamId',
  'assignedUserId',
  'branchCode',
  'createdFrom',
  'createdTo',
  'advancedFilters',
  'page',
  'pageSize',
  'sortBy',
  'sortOrder'
]);

function sanitizeLeadQueryParams(entries: Iterable<[string, string]>) {
  return Object.fromEntries(Array.from(entries).filter(([key, value]) => leadQueryKeys.has(key) && value.trim() !== ''));
}

export type { LeadRow };
export type LeadListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const emptyLeadMeta: LeadListMeta = { page: 1, pageSize: 0, total: 0, totalPages: 1 };

function leadPayloadItems(payload: any) {
  return Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
}

function leadPayloadMeta(payload: any): LeadListMeta {
  const items = leadPayloadItems(payload);
  return {
    page: Number(payload?.page ?? 1),
    pageSize: Number(payload?.pageSize ?? items.length ?? 0),
    total: Number(payload?.total ?? items.length ?? 0),
    totalPages: Number(payload?.totalPages ?? 1)
  };
}
type CustomFieldDefinition = {
  id: string;
  moduleName: 'Lead' | 'User' | 'Activity';
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multi_select' | 'boolean' | 'json';
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  defaultValue?: unknown;
  validation?: Record<string, unknown> | null;
  options?: unknown[] | null;
};

type LeadSavedView = {
  id: string;
  name: string;
  isDefault?: boolean;
  filterForm: {
    search: string;
    status: string;
    category: string;
	    branchCode: string;
	    assignedUserId: string;
	    createdFrom: string;
    createdTo: string;
    sortBy: string;
    sortOrder: string;
    pageSize: string;
  };
  advancedMatch: 'all' | 'any';
  advancedConditions: Array<{ field: string; operator: string; value: string }>;
  visibleLeadFields: string[];
  density: 'compact';
  updatedAt: string;
};

type LeadSavedViewPayload = Partial<Omit<LeadSavedView, 'filterForm' | 'advancedMatch' | 'advancedConditions' | 'visibleLeadFields' | 'density'>> & {
  filterForm?: Partial<LeadSavedView['filterForm']>;
  advancedMatch?: string;
  advancedConditions?: unknown;
  visibleLeadFields?: unknown;
  density?: string;
};

function savedViewStorageKey(userId?: string | null) {
  return `${leadSavedViewStoragePrefix}:${userId || 'local'}`;
}

function readSavedViews(userId?: string | null): LeadSavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(savedViewStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((view) => normalizeSavedView(view)) : [];
  } catch {
    return [];
  }
}

function writeSavedViews(userId: string | null | undefined, views: LeadSavedView[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(savedViewStorageKey(userId), JSON.stringify(views));
}

function normalizeSavedView(view: LeadSavedViewPayload): LeadSavedView {
  const filter = view.filterForm ?? {};
  return {
    id: String(view.id ?? `lead-view-${Date.now()}`),
    name: String(view.name ?? 'Saved view'),
    isDefault: Boolean(view.isDefault),
    filterForm: {
      search: String(filter.search ?? ''),
      status: String(filter.status ?? ''),
	      category: String(filter.category ?? ''),
	      branchCode: String(filter.branchCode ?? ''),
	      assignedUserId: String(filter.assignedUserId ?? ''),
	      createdFrom: String(filter.createdFrom ?? ''),
      createdTo: String(filter.createdTo ?? ''),
      sortBy: String(filter.sortBy ?? 'createdAt'),
      sortOrder: String(filter.sortOrder ?? 'desc'),
      pageSize: String(filter.pageSize ?? '50')
    },
    advancedMatch: view.advancedMatch === 'any' ? 'any' : 'all',
    advancedConditions: Array.isArray(view.advancedConditions)
      ? view.advancedConditions
          .filter((condition): condition is { field?: unknown; operator?: unknown; value?: unknown } => Boolean(condition) && typeof condition === 'object')
          .map((condition) => ({
            field: String(condition.field ?? ''),
            operator: String(condition.operator ?? ''),
            value: String(condition.value ?? '')
          }))
      : [],
    visibleLeadFields: Array.isArray(view.visibleLeadFields) && view.visibleLeadFields.every((item) => typeof item === 'string')
      ? view.visibleLeadFields
      : [...defaultVisibleLeadFields],
    density: 'compact',
    updatedAt: String(view.updatedAt ?? new Date().toISOString())
  };
}

function savedViewPayload(view: LeadSavedView) {
  return {
    name: view.name,
    isDefault: Boolean(view.isDefault),
    filterForm: view.filterForm,
    advancedMatch: view.advancedMatch,
    advancedConditions: view.advancedConditions,
    visibleLeadFields: view.visibleLeadFields,
    density: view.density
  };
}

function leadColumnStorageKey(userId?: string | null) {
  return `${leadColumnStoragePrefix}:${userId || 'local'}`;
}

function readVisibleLeadFields(userId?: string | null) {
  if (typeof window === 'undefined') return [...defaultVisibleLeadFields];
  try {
    const raw = localStorage.getItem(leadColumnStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') && parsed.length > 0
      ? parsed
      : [...defaultVisibleLeadFields];
  } catch {
    return [...defaultVisibleLeadFields];
  }
}

function writeVisibleLeadFields(userId: string | null | undefined, fields: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(leadColumnStorageKey(userId), JSON.stringify(fields));
}

function parseCustomFieldFormValue(field: CustomFieldDefinition, value: unknown) {
  if (value === '' || value === undefined || value === null) return undefined;
  if (field.fieldType === 'number') return Number(value);
  if (field.fieldType === 'boolean') return Boolean(value);
  if (field.fieldType === 'multi_select') return String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
  if (field.fieldType === 'json' && typeof value === 'string') return JSON.parse(value);
  return value;
}

function customFieldOptions(field: CustomFieldDefinition) {
  return normalizeOptions(field.options);
}

function LeadRowActionsMenu({
  lead,
  calling,
  onView,
  onEdit,
  onAssign,
  onClickToCall
}: {
  lead: LeadRow;
  calling?: boolean;
  onView: (lead: LeadRow) => void;
  onEdit: (lead: LeadRow) => void;
  onAssign: (lead: LeadRow) => void;
  onClickToCall: (lead: LeadRow) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const close = () => setAnchorEl(null);
  const run = (action: (lead: LeadRow) => void) => {
    close();
    action(lead);
  };

  return (
    <>
      <Tooltip title="Lead actions">
        <IconButton size="small" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label={`Actions for ${lead.name}`}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => run(onView)}>
          <ListItemIcon><VisibilityOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => run(onEdit)}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => run(onAssign)}>
          <ListItemIcon><AssignmentIndOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Assign owner</ListItemText>
        </MenuItem>
        <MenuItem disabled={calling || !lead.phone || lead.phone === '-'} onClick={() => run(onClickToCall)}>
          <ListItemIcon><CallOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{calling ? 'Calling...' : 'Click-to-call'}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export function LeadsView({
  leadRows: initialLeadRows = [],
  leadMeta: initialLeadMeta = emptyLeadMeta,
  openLead,
  authToken,
  currentUserId,
  onCreated,
  onFilter,
  fieldPermissions = {}
}: {
  leadRows?: LeadRow[];
  leadMeta?: LeadListMeta;
  openLead: (lead: LeadRow) => void;
  authToken: string | null;
  currentUserId?: string | null;
  onCreated?: (lead: LeadRow) => void;
  onFilter?: (params: Record<string, string>) => void;
  fieldPermissions?: Record<string, string>;
}) {
  const toast = useToast() as (toast: ToastState) => void;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leadRows, setLeadRows] = useState<LeadRow[]>(initialLeadRows);
  const [leadMeta, setLeadMeta] = useState<LeadListMeta>(initialLeadMeta);
  const [loadingLeads, setLoadingLeads] = useState(Boolean(authToken && initialLeadRows.length === 0));
  const [leadDefinitions, setLeadDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [leadLists, setLeadLists] = useState(defaultLeadLists);
  const [leadListsFallback, setLeadListsFallback] = useState(false);
  const [leadForm, setLeadForm] = useState({ customerName: '', mobile: '', email: '', category: '', status: 'New' });
  const [editLeadId, setEditLeadId] = useState('');
  const [filterForm, setFilterForm] = useState({ search: searchParams.get('search') ?? '', status: searchParams.get('status') ?? '', category: searchParams.get('category') ?? '', branchCode: searchParams.get('branchCode') ?? '', assignedUserId: searchParams.get('assignedUserId') ?? '', createdFrom: searchParams.get('createdFrom') ?? '', createdTo: searchParams.get('createdTo') ?? '', sortBy: searchParams.get('sortBy') ?? 'createdAt', sortOrder: searchParams.get('sortOrder') ?? 'desc', pageSize: searchParams.get('pageSize') ?? '50' });
  const [advancedMatch, setAdvancedMatch] = useState<'all' | 'any'>('all');
  const [advancedConditions, setAdvancedConditions] = useState([{ field: 'status', operator: 'equals', value: '' }]);
  const [leadCustomValues, setLeadCustomValues] = useState<Record<string, unknown>>({});
  const [visibleLeadFields, setVisibleLeadFields] = useState<string[]>(() => readVisibleLeadFields(currentUserId));
  const [leadMessage, setLeadMessage] = useState<ToastState>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [accessOverview, setAccessOverview] = useState<{ users?: Array<{ id: string; name: string; email?: string; teamId?: string | null }>; teams?: Array<{ id: string; name: string }> }>({});
  const [assignLead, setAssignLead] = useState<LeadRow | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: '__system__', reason: 'Manual list assignment' });
  const [assigning, setAssigning] = useState(false);
  const [selectedLeadRows, setSelectedLeadRows] = useState<number[]>([]);
  const [savedViews, setSavedViews] = useState<LeadSavedView[]>([]);
  const [activeSavedViewId, setActiveSavedViewId] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [callingLeadId, setCallingLeadId] = useState('');

  const loadLeads = async (params: Record<string, string> = filterParams()) => {
    if (!authToken) return;
    onFilter?.(params);
    const requestParams = new URLSearchParams(params);
    router.replace(`/leads${requestParams.toString() ? `?${requestParams.toString()}` : ''}`);
    setLoadingLeads(true);
    try {
      const payload = await apiRequest<any>(`/leads${requestParams.toString() ? `?${requestParams.toString()}` : ''}`, { token: authToken });
      const items = leadPayloadItems(payload);
      setLeadRows(toLeadRows(items));
      setLeadMeta(leadPayloadMeta(payload));
      setSelectedLeadRows([]);
    } catch (error) {
      setLeadMessage({ message: error instanceof Error ? error.message : 'Could not load leads', severity: 'error' });
      setLeadRows([]);
      setLeadMeta(emptyLeadMeta);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadLeadDefinitions() {
      try {
        const payload = await apiRequest<CustomFieldDefinition[]>('/custom-fields/definitions?moduleName=Lead', { token: authToken });
        if (!cancelled) setLeadDefinitions(Array.isArray(payload) ? payload.filter((field) => field.isActive) : []);
      } catch {
        if (!cancelled) setLeadDefinitions([]);
      }
    }

    async function loadLeadLists() {
      try {
        const payload = await apiRequest<typeof defaultLeadLists>('/settings/lead-lists', { token: authToken });
        if (!cancelled) {
          setLeadLists({
            status: Array.isArray(payload.status) ? payload.status : defaultLeadLists.status,
            category: Array.isArray(payload.category) ? payload.category : defaultLeadLists.category,
            disposition: Array.isArray(payload.disposition) ? payload.disposition : defaultLeadLists.disposition
          });
          setLeadListsFallback(!Array.isArray(payload.status) || !Array.isArray(payload.category) || !Array.isArray(payload.disposition));
        }
      } catch {
        if (!cancelled) {
          setLeadLists(defaultLeadLists);
          setLeadListsFallback(true);
        }
      }
    }

    void loadLeadDefinitions();
    void loadLeadLists();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    setVisibleLeadFields(readVisibleLeadFields(currentUserId));

    async function loadSavedViews() {
      const localViews = readSavedViews(currentUserId);
      if (!authToken) {
        setSavedViews(localViews);
        const defaultView = localViews.find((view) => view.isDefault);
        if (defaultView) applySavedView(defaultView, false);
        return;
      }
      try {
        const payload = await apiRequest<LeadSavedViewPayload[]>('/leads/saved-views', { token: authToken });
        if (cancelled) return;
        const serverViews = Array.isArray(payload) ? payload.map((view) => normalizeSavedView(view)) : [];
        const views = serverViews.length > 0 ? serverViews : localViews;
        setSavedViews(views);
        writeSavedViews(currentUserId, views);
        const defaultView = views.find((view) => view.isDefault);
        if (defaultView) applySavedView(defaultView, false);
      } catch {
        if (cancelled) return;
        setSavedViews(localViews);
        const defaultView = localViews.find((view) => view.isDefault);
        if (defaultView) applySavedView(defaultView, false);
      }
    }

    void loadSavedViews();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, currentUserId]);

  useEffect(() => {
    writeVisibleLeadFields(currentUserId, visibleLeadFields);
  }, [currentUserId, visibleLeadFields]);

  useEffect(() => {
    const initialParams = sanitizeLeadQueryParams(searchParams.entries());
    void loadLeads(initialParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccessOverview() {
      if (!authToken) return;
      try {
        const payload = await apiRequest<typeof accessOverview>('/access/overview', { token: authToken });
        if (!cancelled) setAccessOverview(payload ?? {});
      } catch {
        if (!cancelled) setAccessOverview({});
      }
    }
    void loadAccessOverview();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  function filterParams(form = filterForm, conditions = advancedConditions, match = advancedMatch) {
    const params = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
    const activeConditions = conditions.filter((condition) => condition.field && condition.operator && (['exists', 'not_exists'].includes(condition.operator) || condition.value.trim()));
    if (activeConditions.length > 0) params.advancedFilters = JSON.stringify({ match, conditions: activeConditions });
    return params;
  }

  const applyFilters = () => {
    void loadLeads(filterParams());
    setFilterOpen(false);
  };

  useEffect(() => {
    const nextSearch = searchParams.get('search') ?? '';
    if (nextSearch && nextSearch !== filterForm.search) {
      const next = { ...filterForm, search: nextSearch };
      setFilterForm(next);
      void loadLeads(filterParams(next, advancedConditions, advancedMatch));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const createLead = async () => {
    if (!authToken) {
      setLeadMessage({ message: 'Login required', severity: 'warning' });
      return;
    }
    setSavingLead(true);
    setLeadMessage(null);
    try {
      const customFields = Object.fromEntries(
        leadDefinitions
          .filter((field) => leadFieldAccess(field.fieldKey) === 'editable')
          .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, leadCustomValues[field.fieldKey])])
          .filter(([, value]) => value !== undefined)
      );
      const standardFields = editableLeadPayload({
        customerName: leadForm.customerName,
        mobile: leadForm.mobile,
        email: leadForm.email || undefined,
        status: leadForm.status || undefined,
        category: leadForm.category || undefined
      });
      const payload = await apiRequest<any>('/leads', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...standardFields,
          customFields
        })
      });
      const [createdRow] = toLeadRows([payload]);
      if (createdRow) {
        onCreated?.(createdRow);
        setLeadRows((current) => [createdRow, ...current]);
        setLeadMeta((current) => ({ ...current, total: current.total + 1 }));
      }
      setLeadForm({ customerName: '', mobile: '', email: '', category: '', status: 'New' });
      setLeadCustomValues({});
      setEditLeadId('');
      setLeadDrawerOpen(false);
      setLeadMessage({ message: 'Lead created', severity: 'success' });
      toast({ message: 'Lead created', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create lead';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    } finally {
      setSavingLead(false);
    }
  };

  const editLead = async () => {
    if (!authToken || !editLeadId) {
      setLeadMessage({ message: 'Select a lead to edit', severity: 'warning' });
      return;
    }
    setSavingLead(true);
    setLeadMessage(null);
    try {
      const customFields = Object.fromEntries(
        leadDefinitions
          .filter((field) => leadFieldAccess(field.fieldKey) === 'editable')
          .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, leadCustomValues[field.fieldKey])])
          .filter(([, value]) => value !== undefined)
      );
      const standardFields = editableLeadPayload({
        customerName: leadForm.customerName || undefined,
        mobile: leadForm.mobile || undefined,
        email: leadForm.email || undefined,
        status: leadForm.status || undefined,
        category: leadForm.category || undefined
      });
      await apiRequest(`/leads/${encodeURIComponent(editLeadId)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...standardFields,
          customFields
        })
      });
      setLeadMessage({ message: 'Lead updated', severity: 'success' });
      toast({ message: 'Lead updated', severity: 'success' });
      setLeadDrawerOpen(false);
      applyFilters();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update lead';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    } finally {
      setSavingLead(false);
    }
  };

  const loadLeadForEdit = async (lead: LeadRow) => {
    setEditLeadId(lead.dbId ?? lead.id);
    setLeadForm({
      customerName: cleanLeadFormValue(lead.name),
      mobile: cleanLeadFormValue(lead.phone),
      email: cleanLeadFormValue(lead.email),
      category: cleanLeadFormValue(lead.category),
      status: cleanLeadFormValue(lead.status) || 'New'
    });
    setLeadDrawerOpen(true);
    setLeadMessage({ message: 'Lead loaded for edit', severity: 'info' });
  };

  const resetLeadForm = () => {
    setEditLeadId('');
    setLeadForm({ customerName: '', mobile: '', email: '', category: '', status: 'New' });
    setLeadCustomValues({});
    setLeadDrawerOpen(true);
  };

  const applyQuickFilter = (patch: Partial<typeof filterForm>) => {
    const next = { ...filterForm, ...patch };
    setFilterForm(next);
    void loadLeads(filterParams(next, advancedConditions));
  };

  const persistSavedViews = (views: LeadSavedView[]) => {
    setSavedViews(views);
    writeSavedViews(currentUserId, views);
  };

  const buildCurrentSavedView = (name: string, existing?: LeadSavedView): LeadSavedView => ({
    id: existing?.id ?? `lead-view-${Date.now()}`,
    name: name.trim(),
    isDefault: existing?.isDefault ?? savedViews.length === 0,
    filterForm: { ...filterForm },
    advancedMatch,
    advancedConditions: advancedConditions.map((condition) => ({ ...condition })),
    visibleLeadFields: [...visibleLeadFields],
    density: 'compact',
    updatedAt: new Date().toISOString()
  });

  const saveCurrentView = async () => {
    const name = saveViewName.trim();
    if (!name) {
      toast({ message: 'Saved view name is required', severity: 'warning' });
      return;
    }
    const existing = savedViews.find((view) => view.id === activeSavedViewId);
    const nextView = buildCurrentSavedView(name, existing);
    try {
      const saved = authToken
        ? normalizeSavedView(await apiRequest<LeadSavedViewPayload>(existing ? `/leads/saved-views/${encodeURIComponent(existing.id)}` : '/leads/saved-views', {
            token: authToken,
            method: existing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savedViewPayload(nextView))
          }))
        : nextView;
      const nextViews = existing
        ? savedViews.map((view) => view.id === existing.id ? saved : view)
        : [...savedViews, saved];
      persistSavedViews(nextViews);
      setActiveSavedViewId(saved.id);
      setSaveViewOpen(false);
      setSaveViewName('');
      toast({ message: existing ? 'Saved view updated' : 'Saved view created', severity: 'success' });
    } catch (error) {
      const nextViews = existing
        ? savedViews.map((view) => view.id === existing.id ? nextView : view)
        : [...savedViews, nextView];
      persistSavedViews(nextViews);
      setActiveSavedViewId(nextView.id);
      setSaveViewOpen(false);
      setSaveViewName('');
      toast({ message: error instanceof Error ? `Saved locally only: ${error.message}` : 'Saved locally only', severity: 'warning' });
    }
  };

  const openSaveView = () => {
    const active = savedViews.find((view) => view.id === activeSavedViewId);
    setSaveViewName(active?.name ?? '');
    setSaveViewOpen(true);
  };

  function applySavedView(view: LeadSavedView, shouldLoad = true) {
    setActiveSavedViewId(view.id);
    setFilterForm(view.filterForm);
    setAdvancedMatch(view.advancedMatch);
    setAdvancedConditions(view.advancedConditions.length > 0 ? view.advancedConditions : [{ field: 'status', operator: 'equals', value: '' }]);
    setVisibleLeadFields(view.visibleLeadFields.length > 0 ? view.visibleLeadFields : [...defaultVisibleLeadFields]);
    if (shouldLoad) void loadLeads(filterParams(view.filterForm, view.advancedConditions, view.advancedMatch));
  }

  const resetFilters = () => {
    setFilterForm({ search: '', status: '', category: '', branchCode: '', assignedUserId: '', createdFrom: '', createdTo: '', sortBy: 'createdAt', sortOrder: 'desc', pageSize: '50' });
    setAdvancedMatch('all');
    setAdvancedConditions([{ field: 'status', operator: 'equals', value: '' }]);
  };

  const hiddenLeadFields = new Set(
    Object.entries(fieldPermissions)
      .filter(([key, access]) => key.startsWith('Lead.') && access === 'hidden')
      .map(([key]) => key.replace('Lead.', ''))
  );
  function leadFieldAccess(fieldKey: string) {
    return fieldPermissions[`Lead.${fieldKey}`] ?? 'editable';
  }
  function editableLeadPayload(values: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(values).filter(([fieldKey]) => leadFieldAccess(fieldKey) === 'editable')
    );
  }
  const leadListFieldOptions = buildLeadListFieldOptions(leadRows, leadDefinitions, hiddenLeadFields);
  const leadFilterFields = Array.from(new Map([
    ...leadFilterBaseFields.filter((field) => !hiddenLeadFields.has(field.key)),
    ...leadDefinitions.map((field) => ({ key: `custom:${field.fieldKey}`, label: field.label, fieldType: field.fieldType, options: customFieldOptions(field) }))
  ].map((field) => [field.key, field])).values());
  const allowedLeadListFieldKeys = new Set(leadListFieldOptions.map((field) => field.key));
  const effectiveVisibleLeadFields = visibleLeadFields.filter((field) => allowedLeadListFieldKeys.has(field));
  const tableVisibleLeadFields = effectiveVisibleLeadFields.length > 0
    ? effectiveVisibleLeadFields
    : leadListFieldOptions.slice(0, 5).map((field) => field.key);
  const branchOptions = Array.from(new Set(leadRows.map((lead) => lead.branch).filter((value) => value && value !== '-'))).sort();
  const activeSavedView = savedViews.find((view) => view.id === activeSavedViewId);
  const leadSortLabel = filterForm.sortBy === 'createdAt' ? 'Created date' : filterForm.sortBy === 'updatedAt' ? 'Last activity' : filterForm.sortBy;
  const leadStart = leadMeta.total === 0 ? 0 : ((leadMeta.page - 1) * leadMeta.pageSize) + 1;
  const leadEnd = leadMeta.total === 0 ? 0 : Math.min(leadMeta.page * leadMeta.pageSize, leadMeta.total);
  const leadRangeLabel = `Showing ${leadStart}-${leadEnd} of ${leadMeta.total}`;
  const fieldByKey = new Map(leadFilterFields.map((field) => [field.key, field]));
  const renderFilterValue = (condition: { field: string; operator: string; value: string }, index: number) => {
    const field = fieldByKey.get(condition.field);
    const optionKey = (field as any)?.optionKey as keyof typeof leadLists | undefined;
    const options = Array.isArray((field as any)?.options) ? (field as any).options as string[] : optionKey ? leadLists[optionKey] : [];
    const disabled = ['exists', 'not_exists'].includes(condition.operator);
    const update = (value: string) => setAdvancedConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item));
    if (disabled) return <TextField size="small" label="Value" value="" disabled />;
    if (options.length > 0 || field?.fieldType === 'select' || field?.fieldType === 'multi_select') {
      return (
        <FormControl size="small">
          <Select displayEmpty value={condition.value} onChange={(event) => update(event.target.value)}>
            <MenuItem value="">Select value</MenuItem>
            {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select>
        </FormControl>
      );
    }
    return <TextField size="small" type={field?.fieldType === 'date' || field?.fieldType === 'datetime' ? 'date' : field?.fieldType === 'number' ? 'number' : 'text'} label="Value" value={condition.value} onChange={(event) => update(event.target.value)} InputLabelProps={field?.fieldType === 'date' || field?.fieldType === 'datetime' ? { shrink: true } : undefined} />;
  };

  const exportLeads = async () => {
    if (!authToken) {
      setLeadMessage({ message: 'Login required', severity: 'warning' });
      return;
    }
    try {
      const searchParams = new URLSearchParams(filterParams());
      const text = await apiText(`/leads/export.csv?${searchParams.toString()}`, { token: authToken });
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads-export.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast({ message: 'Lead export started', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export leads';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    }
  };

  const openAssignLead = (lead: LeadRow) => {
    setAssignLead(lead);
    setAssignForm({ userId: lead.assignedUserId ?? '__system__', reason: 'Manual list assignment' });
  };

  const saveLeadAssignment = async () => {
    if (!authToken || !assignLead) return;
    setAssigning(true);
    setLeadMessage(null);
    try {
      await apiRequest(`/leads/${encodeURIComponent(assignLead.dbId ?? assignLead.id)}/assign`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedUserId: assignForm.userId,
          reason: assignForm.reason
        })
      });
      toast({ message: 'Lead assigned', severity: 'success' });
      setAssignLead(null);
      void loadLeads(filterParams());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not assign lead';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  const saveBulkLeadAssignment = async () => {
    if (!authToken || selectedLeadRows.length === 0) return;
    setAssigning(true);
    setLeadMessage(null);
    try {
      const selectedLeads = selectedLeadRows.map((rowIndex) => leadRows[rowIndex]).filter(Boolean);
      const payload = await apiRequest<{ updated?: number; requested?: number }>('/leads/bulk-assign', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeads.map((lead) => lead.dbId ?? lead.id),
          assignedUserId: assignForm.userId,
          reason: assignForm.reason || 'Bulk owner change'
        })
      });
      const updatedCount = payload.updated ?? selectedLeads.length;
      setSelectedLeadRows([]);
      setBulkAssignOpen(false);
      setLeadMessage({ message: `${updatedCount} lead owner(s) updated`, severity: 'success' });
      toast({ message: `${updatedCount} lead owner(s) updated`, severity: 'success' });
      void loadLeads(filterParams());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update selected lead owners';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  const clickToCallLead = async (lead: LeadRow) => {
    if (!authToken) {
      toast({ message: 'Login required', severity: 'warning' });
      return;
    }
    const leadId = lead.dbId ?? lead.id;
    setCallingLeadId(leadId);
    try {
      const payload = await apiRequest<any>('/connectors/telephony/click-to-call', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });
      const details = payload.success === false || payload.status === 'failed'
        ? [payload.httpStatus ? `HTTP ${payload.httpStatus}` : null, payload.error || payload.response].filter(Boolean).join(' · ')
        : '';
      toast({ message: details ? `Click-to-call failed: ${details}` : `Click-to-call ${payload.status ?? 'started'}`, severity: payload.success === false ? 'warning' : 'success' });
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : 'Could not start click-to-call', severity: 'error' });
    } finally {
      setCallingLeadId('');
    }
  };

  const bulkUpdateLeadStatus = async (status: string) => {
    if (!authToken || selectedLeadRows.length === 0) return;
    setSavingLead(true);
    setLeadMessage(null);
    try {
      const selectedLeads = selectedLeadRows.map((rowIndex) => leadRows[rowIndex]).filter(Boolean);
      const payload = await apiRequest<{ updated?: number; requested?: number }>('/leads/bulk-update', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads.map((lead) => lead.dbId ?? lead.id), patch: { status } })
      });
      const updatedCount = payload.updated ?? selectedLeads.length;
      setSelectedLeadRows([]);
      setLeadMessage({ message: `${updatedCount} lead(s) updated`, severity: 'success' });
      toast({ message: `${updatedCount} lead(s) updated`, severity: 'success' });
      void loadLeads(filterParams());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update selected leads';
      setLeadMessage({ message, severity: 'error' });
      toast({ message, severity: 'error' });
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <ModuleShell
      title="Leads"
      subtitle={`${leadMeta.total} results · sorted by ${leadSortLabel} · saved view: ${activeSavedView?.name ?? 'Unsaved view'}`}
      actions={(
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select
              displayEmpty
              value={activeSavedViewId}
              onChange={(event) => {
                const viewId = event.target.value;
                if (!viewId) {
                  setActiveSavedViewId('');
                  return;
                }
                const view = savedViews.find((item) => item.id === viewId);
                if (view) applySavedView(view);
              }}
            >
              <MenuItem value="">Saved views</MenuItem>
              {savedViews.map((view) => (
                <MenuItem key={view.id} value={view.id}>{view.name}{view.isDefault ? ' · Default' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={openSaveView}>Save View</Button>
          <FieldSelector
            fields={leadListFieldOptions}
            selected={tableVisibleLeadFields}
            onChange={(fields) => setVisibleLeadFields(fields.filter((field) => allowedLeadListFieldKeys.has(field) && isVisibleLeadListField(field, hiddenLeadFields)))}
          />
          <CapsuleButton startIcon={<FileDownloadIcon />} variant="outlined" onClick={exportLeads}>Export CSV</CapsuleButton>
          <CapsuleButton startIcon={<AddIcon />} onClick={resetLeadForm}>Add Lead</CapsuleButton>
        </Stack>
      )}
    >
      <Stack spacing={1}>
        {leadMessage ? <Alert severity={leadMessage.severity} sx={{ borderRadius: '8px' }}>{leadMessage.message}</Alert> : null}
        {leadListsFallback ? <Alert severity="warning" sx={{ borderRadius: '8px' }}>Lead dropdowns are using seed defaults because configured list values could not be loaded.</Alert> : null}
        <LeadFilters
          filterForm={filterForm}
          setFilterForm={setFilterForm}
          leadLists={leadLists}
	          branchOptions={branchOptions}
	          currentUserId={currentUserId}
	          applyQuickFilter={applyQuickFilter}
          setFilterOpen={setFilterOpen}
          onSearch={() => void loadLeads(filterParams())}
          resultLabel={leadRangeLabel}
        />
        <LeadTable
          leadRows={leadRows}
          openLead={openLead}
          visibleLeadFields={tableVisibleLeadFields}
          leadMeta={leadMeta}
          filterParams={filterParams}
          onFilter={loadLeads}
          rowActions={(lead) => (
            <LeadRowActionsMenu
              lead={lead}
              calling={callingLeadId === (lead.dbId ?? lead.id)}
              onView={openLead}
              onEdit={loadLeadForEdit}
              onAssign={openAssignLead}
              onClickToCall={clickToCallLead}
            />
          )}
          selectedRows={selectedLeadRows}
          onSelectionChange={setSelectedLeadRows}
          bulkActions={(
            <Stack direction="row" spacing={0.5}>
              <Button size="small" variant="outlined" disabled={savingLead || selectedLeadRows.length === 0} onClick={() => {
                setAssignForm({ userId: '__system__', reason: 'Bulk owner change' });
                setBulkAssignOpen(true);
              }}>Change owner</Button>
              {['New', 'Assigned', 'In Progress', 'Converted'].map((status) => (
                <Button key={status} size="small" variant="outlined" disabled={savingLead} onClick={() => void bulkUpdateLeadStatus(status)}>{status}</Button>
              ))}
            </Stack>
          )}
          loading={loadingLeads}
        />
        <LeadAdvancedFilters
          open={filterOpen}
          onApply={applyFilters}
          onClose={() => setFilterOpen(false)}
          onReset={resetFilters}
          advancedMatch={advancedMatch}
          setAdvancedMatch={setAdvancedMatch}
          advancedConditions={advancedConditions}
          setAdvancedConditions={setAdvancedConditions}
          leadFilterFields={leadFilterFields}
          fieldByKey={fieldByKey}
          renderFilterValue={renderFilterValue}
        />
        <LeadCreatePanel
          open={leadDrawerOpen}
          onClose={() => setLeadDrawerOpen(false)}
          editLeadId={editLeadId}
          leadRows={leadRows}
          leadForm={leadForm}
          setLeadForm={setLeadForm}
          leadLists={leadLists}
          leadDefinitions={leadDefinitions}
          leadCustomValues={leadCustomValues}
          setLeadCustomValues={setLeadCustomValues}
          customFieldOptions={customFieldOptions}
          leadFieldAccess={leadFieldAccess}
          loadLeadForEdit={loadLeadForEdit}
          savingLead={savingLead}
          createLead={createLead}
          editLead={editLead}
        />
        <FormDialog
          open={Boolean(assignLead)}
          title="Assign Lead"
          subtitle={assignLead ? assignLead.name : 'Choose a user or System.'}
          onClose={() => setAssignLead(null)}
          actions={[
            <Button key="cancel" onClick={() => setAssignLead(null)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={assigning || !assignForm.userId} onClick={saveLeadAssignment}>Assign</Button>
          ]}
        >
          <Stack spacing={1}>
            <FormControl size="small">
              <Select displayEmpty value={assignForm.userId} onChange={(event) => setAssignForm((form) => ({ ...form, userId: event.target.value }))}>
                <MenuItem value="__system__">System</MenuItem>
                {(accessOverview.users ?? []).map((user) => <MenuItem key={user.id} value={user.id}>{user.name} {user.email ? `(${user.email})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Reason" value={assignForm.reason} onChange={(event) => setAssignForm((form) => ({ ...form, reason: event.target.value }))} />
          </Stack>
        </FormDialog>
        <FormDialog
          open={bulkAssignOpen}
          title="Change Owner"
          subtitle={`${selectedLeadRows.length} selected visible lead(s)`}
          onClose={() => setBulkAssignOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={assigning || !assignForm.userId} onClick={saveBulkLeadAssignment}>Change Owner</Button>
          ]}
        >
          <Stack spacing={1}>
            <FormControl size="small">
              <Select displayEmpty value={assignForm.userId} onChange={(event) => setAssignForm((form) => ({ ...form, userId: event.target.value }))}>
                <MenuItem value="__system__">System</MenuItem>
                {(accessOverview.users ?? []).map((user) => <MenuItem key={user.id} value={user.id}>{user.name} {user.email ? `(${user.email})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Reason" value={assignForm.reason} onChange={(event) => setAssignForm((form) => ({ ...form, reason: event.target.value }))} />
          </Stack>
        </FormDialog>
        <FormDialog
          open={saveViewOpen}
          title={activeSavedViewId ? 'Update Saved View' : 'Save Lead View'}
          subtitle="Save filters, columns, sort, and compact density for your Leads page."
          onClose={() => setSaveViewOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setSaveViewOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" startIcon={<SaveOutlinedIcon />} onClick={saveCurrentView}>Save View</Button>
          ]}
        >
          <TextField autoFocus fullWidth size="small" label="View name" value={saveViewName} onChange={(event) => setSaveViewName(event.target.value)} />
        </FormDialog>
      </Stack>
    </ModuleShell>
  );
}
