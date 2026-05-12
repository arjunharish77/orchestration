'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { AccessSalesGroup } from '../settings/settings-types';

export function SalesGroupsTab({
  salesGroupName,
  setSalesGroupName,
  saving,
  createSalesGroup,
  updateSalesGroup,
  deactivateSalesGroup,
  salesGroups
}: {
  salesGroupName: string;
  setSalesGroupName: (name: string) => void;
  saving: boolean;
  createSalesGroup: () => void;
  updateSalesGroup: (salesGroupId: string) => void;
  deactivateSalesGroup: (salesGroupId: string) => void;
  salesGroups: AccessSalesGroup[];
}) {
  const [salesGroupDialogOpen, setSalesGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const openCreateGroup = () => {
    setEditingGroupId(null);
    setSalesGroupName('');
    setSalesGroupDialogOpen(true);
  };

  const openEditGroup = (group: AccessSalesGroup) => {
    setEditingGroupId(group.id);
    setSalesGroupName(group.name ?? '');
    setSalesGroupDialogOpen(true);
  };

  const handleCreateSalesGroup = async () => {
    if (editingGroupId) {
      await Promise.resolve(updateSalesGroup(editingGroupId));
    } else {
      await Promise.resolve(createSalesGroup());
    }
    setSalesGroupDialogOpen(false);
    setEditingGroupId(null);
  };

  return (
    <Section title="Sales Groups" defaultExpanded={false} actions={<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateGroup} sx={{ borderRadius: 1 }}>Create Group</Button>}>
      <Stack spacing={1} sx={{ p: 1 }}>
        <CompactDataTable
          columns={['Name', 'Users', 'Status', 'Action']}
          rows={salesGroups.map((group) => [
            group.name,
            String(group._count?.users ?? 0),
            <AppChip key={group.id} label={group.isActive ? 'Online' : 'Offline'} />,
            <RowActionMenu
              key={`${group.id}-actions`}
              actions={[
                { label: 'Edit group', icon: <EditIcon fontSize="small" />, onClick: () => openEditGroup(group) },
                { label: group.isActive ? 'Deactivate group' : 'Inactive', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: !group.isActive, onClick: () => deactivateSalesGroup(group.id) }
              ]}
            />
          ])}
        />
      </Stack>
      <FormDialog
        open={salesGroupDialogOpen}
        title={editingGroupId ? 'Edit Sales Group' : 'Create Sales Group'}
        subtitle="Sales groups organize users for assignment, follow-up queues, and reporting."
        onClose={() => setSalesGroupDialogOpen(false)}
        maxWidth="sm"
        actions={(
          <>
            <Button variant="text" onClick={() => setSalesGroupDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !salesGroupName} onClick={handleCreateSalesGroup}>{editingGroupId ? 'Save Group' : 'Create Group'}</Button>
          </>
        )}
      >
        <Box>
          <TextField fullWidth size="small" label="Sales group name" value={salesGroupName} onChange={(event) => setSalesGroupName(event.target.value)} />
        </Box>
      </FormDialog>
    </Section>
  );
}
