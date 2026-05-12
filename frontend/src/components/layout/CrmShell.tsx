'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';

export type ShellViewKey =
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

export type ShellUser = {
  name: string;
  email: string;
  role: string;
  team?: string | { name: string; code?: string | null; type?: string | null } | null;
};

const green = '#2d6a2d';
const bg = '#f8fcf8';
const line = '#e0ede0';
const sidebarBg = '#162716';
const softGreen = '#eef7ee';
const textMuted = '#526252';
const shellStorageKey = 'unnatify_sidebar_collapsed';

const navItems: Array<{ key: Exclude<ShellViewKey, 'lead-detail' | 'connectors' | 'users'>; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon /> },
  { key: 'leads', label: 'Leads', icon: <PeopleAltOutlinedIcon /> },
  { key: 'activities', label: 'Activities', icon: <FactCheckOutlinedIcon /> },
  { key: 'tasks', label: 'Tasks', icon: <ChecklistRtlOutlinedIcon /> },
  { key: 'uploads', label: 'CSV Uploads', icon: <CloudUploadOutlinedIcon /> },
  { key: 'automation', label: 'Automation', icon: <AutoAwesomeOutlinedIcon /> },
  { key: 'reports', label: 'Reports', icon: <FormatListBulletedOutlinedIcon /> },
  { key: 'settings', label: 'Settings', icon: <TuneOutlinedIcon /> }
];

const navGroups: Array<{ label: string; keys: Array<Exclude<ShellViewKey, 'lead-detail' | 'connectors' | 'users'>> }> = [
  { label: 'Pipeline', keys: ['dashboard', 'leads', 'activities', 'tasks'] },
  { label: 'Operations', keys: ['uploads', 'automation', 'reports', 'settings'] }
];

const routeByNavItem: Record<Exclude<ShellViewKey, 'lead-detail' | 'connectors' | 'users'>, string> = {
  dashboard: '/dashboard',
  leads: '/leads',
  activities: '/activities',
  uploads: '/uploads',
  tasks: '/tasks',
  automation: '/automation',
  reports: '/reports',
  settings: '/settings/users'
};

function userInitials(user?: Pick<ShellUser, 'name' | 'email'> | null) {
  const source = user?.name?.trim() || user?.email || 'User';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function teamLabel(team: ShellUser['team']) {
  if (!team) return 'Default Team';
  if (typeof team === 'string') return team;
  return team.name;
}

function activeFor(item: { key: string }, activeView: ShellViewKey) {
  if (item.key === 'leads' && activeView === 'lead-detail') return true;
  return item.key === activeView;
}

function Sidebar({
  activeView,
  onNavigate,
  visibleViews,
  collapsed,
  setCollapsed,
  mobile = false
}: {
  activeView: ShellViewKey;
  onNavigate?: () => void;
  visibleViews?: Array<Exclude<ShellViewKey, 'lead-detail' | 'connectors' | 'users'>>;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  mobile?: boolean;
}) {
  const sidebarItems = visibleViews ? navItems.filter((item) => visibleViews.includes(item.key)) : navItems;

  return (
    <Box
      sx={{
        width: mobile ? 220 : collapsed ? 56 : 220,
        flexShrink: 0,
        bgcolor: sidebarBg,
        borderRight: `1px solid ${collapsed || !mobile ? 'rgba(224, 237, 224, 0.16)' : line}`,
        boxShadow: mobile ? 'none' : '8px 0 22px rgba(22, 39, 22, 0.05)',
        transition: 'width 180ms ease, background-color 180ms ease',
        minHeight: '100vh',
        position: mobile ? 'relative' : 'sticky',
        top: mobile ? undefined : 0
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: collapsed && !mobile ? 0.5 : 1, minHeight: 52 }}>
        {(!collapsed || mobile) ? (
          <Stack direction="row" alignItems="center" spacing={1.1}>
            <Avatar sx={{ bgcolor: green, borderRadius: '8px', width: 30, height: 30, fontWeight: 800 }}>U</Avatar>
            <Typography fontWeight={800} fontSize={15} sx={{ color: '#f8fcf8' }}>Unnatify</Typography>
          </Stack>
        ) : null}
        {!mobile ? (
          <IconButton
            size="small"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
            sx={{ ml: collapsed ? 'auto' : 0, mr: collapsed ? 'auto' : 0, color: '#eef7ee' }}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        ) : null}
      </Stack>
      <Box sx={{ px: collapsed && !mobile ? 0.45 : 0.65, mt: 0.4 }}>
        {navGroups.map((group, groupIndex) => {
          const groupItems = sidebarItems.filter((item) => (group.keys as string[]).includes(item.key));
          if (groupItems.length === 0) return null;
          return (
            <Box key={group.label} sx={{ mb: 0.5 }}>
              {(!collapsed || mobile) ? (
                <Typography sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: '#65a265',
                  px: 1,
                  pt: groupIndex === 0 ? 0.5 : 1.25,
                  pb: 0.5
                }}>
                  {group.label}
                </Typography>
              ) : (
                groupIndex > 0 ? <Box sx={{ height: 1, mx: 0.5, my: 1, bgcolor: 'rgba(255,255,255,0.1)' }} /> : null
              )}
              <Stack spacing={0.35}>
                {groupItems.map((item) => {
                  const selected = activeFor(item, activeView);
                  return (
                    <Tooltip key={item.key} title={collapsed && !mobile ? item.label : ''} placement="right">
                      <Button
                        component={Link}
                        href={routeByNavItem[item.key]}
                        prefetch
                        onClick={onNavigate}
                        aria-label={`Go to ${item.label}`}
                        startIcon={item.icon}
                        sx={{
                          justifyContent: collapsed && !mobile ? 'center' : 'flex-start',
                          minHeight: 38,
                          minWidth: collapsed && !mobile ? 42 : undefined,
                          borderRadius: '8px',
                          pl: collapsed && !mobile ? 0 : 2.35,
                          pr: collapsed && !mobile ? 0 : 1,
                          color: selected ? '#123d12' : '#91c091',
                          bgcolor: selected ? softGreen : 'transparent',
                          position: 'relative',
                          overflow: 'visible',
                          '&:before': selected ? {
                            content: '""',
                            position: 'absolute',
                            left: collapsed && !mobile ? 3 : 8,
                            top: 8,
                            bottom: 8,
                            width: 4,
                            borderRadius: 99,
                            bgcolor: green
                          } : undefined,
                          '& .MuiButton-startIcon': {
                            m: collapsed && !mobile ? 0 : undefined,
                            '& svg': {
                              fontSize: 21,
                              strokeWidth: 1.7
                            }
                          },
                          '&:hover': { bgcolor: selected ? softGreen : 'rgba(238, 247, 238, 0.1)' }
                        }}
                      >
                        {(!collapsed || mobile) ? <Typography fontSize={13} fontWeight={selected ? 800 : 700}>{item.label}</Typography> : null}
                      </Button>
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function TopBar({ currentUser, onLogout, onOpenMobileNav }: { currentUser: ShellUser; onLogout: () => void; onOpenMobileNav?: () => void }) {
  const router = useRouter();

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{
        height: 54,
        px: { xs: 1.25, md: 2 },
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${line}`,
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: { xs: 'auto', md: 120 } }}>
        <IconButton aria-label="Open navigation" onClick={onOpenMobileNav} sx={{ display: { xs: 'inline-flex', md: 'none' }, color: textMuted }}>
          <MenuIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', px: { xs: 0.5, md: 0 } }}>
        <TextField
          placeholder="Search leads, tasks, activities..."
          size="small"
          onKeyDown={(event) => {
            const value = (event.target as HTMLInputElement).value.trim();
            if (event.key === 'Enter' && value) router.push(`/leads?search=${encodeURIComponent(value)}`);
          }}
          inputProps={{ 'aria-label': 'Global search' }}
          sx={{
            width: { xs: '100%', md: 'min(620px, 50vw)' },
            '& .MuiOutlinedInput-root': {
              borderRadius: '9999px',
              bgcolor: '#f8fcf8',
              fontSize: 13,
              '& fieldset': { borderColor: 'transparent' },
              '&:hover': { bgcolor: '#eef7ee' },
              '&.Mui-focused': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'primary.main' } }
            }
          }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 20, color: textMuted }} /></InputAdornment> }}
        />
      </Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box textAlign="right" sx={{ display: { xs: 'none', md: 'block' } }}>
          <Typography fontWeight={800} fontSize={13}>{currentUser.name}</Typography>
          <Typography color="text.secondary" fontSize={11}>{currentUser.role} · {teamLabel(currentUser.team)}</Typography>
        </Box>
        <Avatar sx={{ bgcolor: green, width: 32, height: 32, fontSize: 14, fontWeight: 800 }}>{userInitials(currentUser)}</Avatar>
        <Tooltip title="Logout">
          <IconButton aria-label="Logout" onClick={onLogout} sx={{ color: textMuted }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

export function CrmShell({
  activeView,
  currentUser,
  visibleViews,
  error,
  onLogout,
  popupLayer,
  children
}: {
  activeView: ShellViewKey;
  currentUser: ShellUser;
  visibleViews?: Array<Exclude<ShellViewKey, 'lead-detail' | 'connectors' | 'users'>>;
  error?: string | null;
  onLogout: () => void;
  popupLayer?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(shellStorageKey) === 'true';
  });

  const updateCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(shellStorageKey, String(value));
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: bg }}>
      {!isMobile ? <Sidebar activeView={activeView} visibleViews={visibleViews} collapsed={collapsed} setCollapsed={updateCollapsed} /> : null}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: 248, bgcolor: sidebarBg } }}
      >
        <Sidebar activeView={activeView} onNavigate={() => setMobileNavOpen(false)} visibleViews={visibleViews} collapsed={false} setCollapsed={updateCollapsed} mobile />
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TopBar currentUser={currentUser} onLogout={onLogout} onOpenMobileNav={() => setMobileNavOpen(true)} />
        {error ? <Alert severity="warning" sx={{ m: 1, borderRadius: '8px' }}>{error}</Alert> : null}
        {children}
      </Box>
      {popupLayer}
    </Box>
  );
}
