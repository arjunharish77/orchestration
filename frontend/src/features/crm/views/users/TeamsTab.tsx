'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, FormControl, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { AccessTeam } from '../settings/settings-types';

type TeamForm = {
  name: string;
  code: string;
  type: string;
};

export function TeamsTab({
  teamForm,
  setTeamForm,
  teamTypeOptions,
  saving,
  createTeam,
  updateTeam,
  deactivateTeam,
  teams
}: {
  teamForm: TeamForm;
  setTeamForm: (form: TeamForm) => void;
  teamTypeOptions: string[];
  saving: boolean;
  createTeam: () => void;
  updateTeam: (teamId: string) => void;
  deactivateTeam: (teamId: string) => void;
  teams: AccessTeam[];
}) {
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const openCreateTeam = () => {
    setEditingTeamId(null);
    setTeamForm({ name: '', code: '', type: 'Team' });
    setTeamDialogOpen(true);
  };

  const openEditTeam = (team: AccessTeam) => {
    setEditingTeamId(team.id);
    setTeamForm({ name: team.name ?? '', code: team.code ?? '', type: team.type ?? 'Team' });
    setTeamDialogOpen(true);
  };

  const handleCreateTeam = async () => {
    if (editingTeamId) {
      await Promise.resolve(updateTeam(editingTeamId));
    } else {
      await Promise.resolve(createTeam());
    }
    setTeamDialogOpen(false);
    setEditingTeamId(null);
  };

  return (
    <Section title="Teams" defaultExpanded={false} actions={<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateTeam} sx={{ borderRadius: 1 }}>Create Team</Button>}>
      <Stack spacing={1} sx={{ p: 1 }}>
        <CompactDataTable
          columns={['Name', 'Code', 'Type', 'Users', 'Leads', 'Status', 'Action']}
          rows={teams.map((team) => [
            team.name,
            team.code ?? '-',
            team.type ?? '-',
            String(team._count?.users ?? 0),
            String(team._count?.leads ?? 0),
            <AppChip key={team.id} label={team.isActive ? 'Online' : 'Offline'} />,
            <RowActionMenu
              key={`${team.id}-actions`}
              actions={[
                { label: 'Edit team', icon: <EditIcon fontSize="small" />, onClick: () => openEditTeam(team) },
                { label: team.isActive ? 'Deactivate team' : 'Inactive', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: !team.isActive, onClick: () => deactivateTeam(team.id) }
              ]}
            />
          ])}
        />
      </Stack>
      <FormDialog
        open={teamDialogOpen}
        title={editingTeamId ? 'Edit Team' : 'Create Team'}
        subtitle="Teams cover branches, partners, and configurable assignment groups."
        onClose={() => setTeamDialogOpen(false)}
        maxWidth="sm"
        actions={(
          <>
            <Button variant="text" onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !teamForm.name} onClick={handleCreateTeam}>{editingTeamId ? 'Save Team' : 'Create Team'}</Button>
          </>
        )}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' } }}>
          <TextField size="small" label="Team name" value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} />
          <TextField size="small" label="Code" value={teamForm.code} onChange={(event) => setTeamForm({ ...teamForm, code: event.target.value })} />
          <FormControl size="small" sx={{ gridColumn: { md: '1 / -1' } }}>
            <Select value={teamForm.type} onChange={(event) => setTeamForm({ ...teamForm, type: event.target.value })}>
              {teamTypeOptions.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </FormDialog>
    </Section>
  );
}
