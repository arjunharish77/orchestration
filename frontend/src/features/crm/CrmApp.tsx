'use client';

import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, Stack, Typography } from '@mui/material';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ToastProvider } from '../../components/common/ToastProvider';
import { CrmShell } from '../../components/layout/CrmShell';
import { apiRequest } from '../../lib/api';
import { logoutSession, restoreStoredSession } from '../../lib/auth';
import { TelephonyPopupLayer } from './components/TelephonyPopupLayer';
import { WhatsAppChatWindow } from './components/WhatsAppChatWindow';

const DashboardView = dynamic(() => import('./views/DashboardView').then((module) => module.DashboardView));
const LeadsView = dynamic(() => import('./views/LeadsView').then((module) => module.LeadsView));
const LeadDetailView = dynamic(() => import('./views/LeadDetailView').then((module) => module.LeadDetailView));
const ActivitiesView = dynamic(() => import('./views/ActivitiesView').then((module) => module.ActivitiesView));
const UploadsView = dynamic(() => import('./views/UploadsView').then((module) => module.UploadsView));
const TasksView = dynamic(() => import('./views/TasksView').then((module) => module.TasksView));
const AutomationFeatureView = dynamic(() => import('./views/AutomationView').then((module) => module.AutomationView));
const ConnectorsView = dynamic(() => import('./views/ConnectorsView').then((module) => module.ConnectorsView));
const UsersView = dynamic(() => import('./views/UsersView').then((module) => module.UsersView));
const ReportsView = dynamic(() => import('./views/ReportsView').then((module) => module.ReportsView));
const SettingsView = dynamic(() => import('./views/SettingsView').then((module) => module.SettingsView));

type ViewKey =
  | 'dashboard'
  | 'leads'
  | 'lead-detail'
  | 'activities'
  | 'uploads'
  | 'tasks'
  | 'automation'
  | 'connectors'
  | 'users'
  | 'reports'
  | 'settings';

const routeByView: Record<Exclude<ViewKey, 'lead-detail'>, string> = {
  dashboard: '/dashboard',
  leads: '/leads',
  activities: '/activities',
  uploads: '/uploads',
  tasks: '/tasks',
  automation: '/automation',
  connectors: '/settings/connectors',
  users: '/settings/users',
  reports: '/reports',
  settings: '/settings/users'
};

function routePathForView(view: ViewKey) {
  return view === 'lead-detail' ? '/leads' : routeByView[view];
}

function viewFromPath(pathname: string): ViewKey {
  if (pathname.startsWith('/leads/')) return 'lead-detail';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/activities')) return 'activities';
  if (pathname.startsWith('/uploads')) return 'uploads';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/automation')) return 'automation';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'leads';
}

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  team?: string | { id: string; name: string; code?: string | null; type?: string | null } | null;
  permissionTemplate?: string | { id: string; name: string } | null;
};

type EffectivePermissions = {
  isAdministrator: boolean;
  modulePermissions: Record<string, { view?: boolean } & Record<string, boolean | undefined>>;
  fieldPermissions: Record<string, string>;
};

type PermissionCacheEntry = {
  token: string;
  userId: string;
  permissions: EffectivePermissions;
};

let permissionCache: PermissionCacheEntry | null = null;

const moduleByView: Record<Exclude<ViewKey, 'connectors' | 'users'>, string> = {
  dashboard: 'Dashboard',
  leads: 'Lead',
  'lead-detail': 'Lead',
  activities: 'Activity',
  uploads: 'Upload',
  tasks: 'Task',
  automation: 'Automation',
  reports: 'Report',
  settings: 'Settings'
};

const guardedViews: Array<Exclude<ViewKey, 'lead-detail' | 'connectors' | 'users'>> = ['dashboard', 'leads', 'activities', 'uploads', 'tasks', 'automation', 'reports', 'settings'];

function canViewModule(effective: EffectivePermissions | null, moduleName: string) {
  if (!effective) return false;
  if (effective.isAdministrator) return true;
  return Boolean(effective.modulePermissions[moduleName]?.view);
}

function visibleViewsForPermissions(effective: EffectivePermissions | null) {
  return guardedViews.filter((view) => canViewModule(effective, moduleByView[view]));
}

export function CrmApp({ initialView = 'leads', leadId, initialSettingsTab }: { initialView?: ViewKey; leadId?: string; initialSettingsTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeView = viewFromPath(pathname || routePathForView(initialView));
  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissions | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const session = await restoreStoredSession<CurrentUser>();
      if (!session) {
        if (!cancelled) setAuthLoading(false);
        return;
      }
      try {
        if (cancelled) return;
        setAuthToken(session.token);
        setCurrentUser(session.user);
        const cached = permissionCache?.token === session.token && permissionCache.userId === session.user.id ? permissionCache.permissions : null;
        const effective = cached ?? await apiRequest<EffectivePermissions>(`/access/users/${encodeURIComponent(session.user.id)}/effective-permissions`, { token: session.token });
        permissionCache = { token: session.token, userId: session.user.id, permissions: effective };
        if (!cancelled) setEffectivePermissions(effective);
      } catch {
        if (cancelled) return;
        setAuthToken(null);
        setCurrentUser(null);
        setEffectivePermissions(null);
        permissionCache = null;
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !currentUser && pathname !== '/login') {
      router.replace('/login');
    }
  }, [authLoading, currentUser, pathname, router]);

  useEffect(() => {
    if (!currentUser || !effectivePermissions) return;
    setWorkspaceError(null);
  }, [currentUser, effectivePermissions]);

  const visibleViews = useMemo(() => visibleViewsForPermissions(effectivePermissions), [effectivePermissions]);
  const firstVisibleView = visibleViews[0] ?? null;

  useEffect(() => {
    if (!currentUser || !effectivePermissions || !firstVisibleView) return;
    const targetView = activeView === 'lead-detail' ? 'leads' : activeView;
    const moduleName = moduleByView[targetView as Exclude<ViewKey, 'connectors' | 'users'>];
    if (!moduleName || canViewModule(effectivePermissions, moduleName)) return;
    router.replace(routeByView[firstVisibleView]);
  }, [activeView, currentUser, effectivePermissions, firstVisibleView, router]);

  const navigateView = useCallback((view: Exclude<ViewKey, 'lead-detail'>) => {
    const targetView = view === 'connectors' || view === 'users' ? 'settings' : view;
    if (effectivePermissions && !canViewModule(effectivePermissions, moduleByView[targetView])) return;
    router.push(routeByView[view]);
  }, [effectivePermissions, router]);

  const handleLogout = useCallback(async () => {
    await logoutSession(authToken);
    setAuthToken(null);
    setCurrentUser(null);
    setEffectivePermissions(null);
    permissionCache = null;
    router.replace('/login');
  }, [authToken, router]);

  const openLead = useCallback((lead: { id: string }) => {
    router.push(`/leads/${lead.id}`);
  }, [router]);

  let content: ReactNode;
  if (!firstVisibleView) {
    content = <NoModulesAssigned />;
  } else if (activeView === 'dashboard') content = <DashboardView authToken={authToken} openLead={openLead} visibleViews={visibleViews} />;
  else if (activeView === 'leads') content = <LeadsView openLead={openLead} authToken={authToken} currentUserId={currentUser?.id} fieldPermissions={effectivePermissions?.fieldPermissions ?? {}} />;
  else if (activeView === 'lead-detail') content = <LeadDetailView leadId={leadId} authToken={authToken} currentUser={currentUser} canViewAutomation={canViewModule(effectivePermissions, 'Automation')} onBack={() => navigateView('leads')} />;
  else if (activeView === 'activities') content = <ActivitiesView authToken={authToken} openLead={openLead} currentUserId={currentUser?.id} />;
  else if (activeView === 'uploads') content = <UploadsView authToken={authToken} />;
  else if (activeView === 'tasks') content = <TasksView authToken={authToken} openLead={openLead} />;
  else if (activeView === 'automation') content = <AutomationFeatureView authToken={authToken} />;
  else if (activeView === 'connectors') content = <ConnectorsView authToken={authToken} />;
  else if (activeView === 'users') content = <UsersView authToken={authToken} />;
  else if (activeView === 'reports') content = <ReportsView authToken={authToken} />;
  else content = <SettingsView authToken={authToken} initialTab={initialSettingsTab} />;

  if (authLoading || !currentUser || !effectivePermissions) return null;

  return (
    <ToastProvider>
      <CrmShell
        activeView={activeView}
        currentUser={currentUser}
        visibleViews={visibleViews}
        error={workspaceError}
        onLogout={handleLogout}
        popupLayer={
          <>
            <TelephonyPopupLayer authToken={authToken} />
            <WhatsAppChatWindow authToken={authToken} />
          </>
        }
      >
        {content}
      </CrmShell>
    </ToastProvider>
  );
}

function NoModulesAssigned() {
  return (
    <Box component="main" sx={{ p: 3 }}>
      <Stack
        component="section"
        spacing={0.75}
        sx={{
          maxWidth: 560,
          border: '1px solid',
          borderRadius: 1,
          borderColor: '#e0ede0',
          p: 2.5,
          bgcolor: '#fafdfa',
          boxShadow: '0 14px 34px rgba(22, 39, 22, 0.06)'
        }}
      >
        <Typography variant="h5" fontWeight={800}>No modules assigned</Typography>
        <Typography color="text.secondary">Your account is active, but no CRM modules are visible in your permission template. Ask an administrator to update your access.</Typography>
      </Stack>
    </Box>
  );
}
