'use client';

import { Paper, Stack, Switch, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { PropertyRow } from '../../components/LeadDetailParts';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';

const bg = '#fafdfa';

export function SettingsSecurityPage({
  securityOverview,
  saving,
  setAccountTwoFactor,
  setUserTwoFactor
}: {
  securityOverview: {
    accountTwoFactorEnabled?: boolean;
    users?: Array<{
      id: string;
      email: string;
      name: string;
      role?: string;
      twoFactorEnabled?: boolean;
      twoFactorDisabledByAdmin?: boolean;
    }>;
  };
  saving: boolean;
  setAccountTwoFactor: (enabled: boolean) => void;
  setUserTwoFactor: (userId: string, patch: { enabled?: boolean; disabledByAdmin?: boolean }) => void;
}) {
  const users = securityOverview.users ?? [];

  return (
    <Section title="Security" defaultExpanded={false}>
      <Stack spacing={1} sx={{ p: 1 }}>
        <Paper variant="outlined" sx={{ borderRadius: 1, bgcolor: bg, borderColor: '#e0ede0', overflow: 'hidden', boxShadow: '0 8px 20px rgba(22, 39, 22, 0.03)' }}>
          <PropertyRow label="Login" value="Email + password" />
          <PropertyRow label="Email OTP" value="Resend provision enabled" />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.8, borderTop: '1px solid #e0ede0' }}>
            <Stack>
              <Typography color="text.secondary">2FA account policy</Typography>
              <Typography fontSize={12} color="text.secondary">Admins can disable 2FA account-wide or user-by-user.</Typography>
            </Stack>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <AppChip label={securityOverview.accountTwoFactorEnabled ? 'Enabled' : 'Disabled'} />
              <Switch
                disabled={saving}
                checked={Boolean(securityOverview.accountTwoFactorEnabled)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setAccountTwoFactor(event.target.checked)}
              />
            </Stack>
          </Stack>
          <PropertyRow label="Admin Operations Center" value="Separate backend-created login only" />
        </Paper>
        <CompactDataTable
          columns={['User', 'Role', '2FA Enabled', 'Disabled By Admin']}
          rows={users.map((user) => [
            `${user.name} (${user.email})`,
            user.role ?? '-',
            <Switch
              key={`${user.id}-enabled`}
              disabled={saving || user.twoFactorDisabledByAdmin}
              checked={Boolean(user.twoFactorEnabled)}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setUserTwoFactor(user.id, { enabled: event.target.checked })}
            />,
            <Switch
              key={`${user.id}-disabled`}
              disabled={saving}
              checked={Boolean(user.twoFactorDisabledByAdmin)}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setUserTwoFactor(user.id, { disabledByAdmin: event.target.checked })}
            />
          ])}
        />
      </Stack>
    </Section>
  );
}
