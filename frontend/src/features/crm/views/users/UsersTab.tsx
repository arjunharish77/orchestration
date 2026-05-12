'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Checkbox, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FieldSelector } from '../../../../components/common/FieldSelector';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { AccessPermissionTemplate, AccessRole, AccessSalesGroup, AccessTeam, AccessUser, CustomFieldDefinition } from '../settings/settings-types';

type UserForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  teamId: string;
  permissionTemplateId: string;
  salesGroupIds: string[];
};

type UsersTabProps = {
  embedded: boolean;
  saving: boolean;
  userForm: UserForm;
  setUserForm: (form: UserForm) => void;
  roles: AccessRole[];
  teams: AccessTeam[];
  salesGroups: AccessSalesGroup[];
  permissionTemplates: AccessPermissionTemplate[];
  userFieldDefinitions: CustomFieldDefinition[];
  userCustomValues: Record<string, unknown>;
  setUserCustomValues: (values: Record<string, unknown>) => void;
  customFieldOptions: (field: CustomFieldDefinition) => string[];
  createUser: () => void;
  updateUser: (userId: string) => void;
  deactivateUser: (userId: string) => void;
  onRefresh: () => void;
  fieldOptions: Array<{ key: string; label: string }>;
  visibleFields: string[];
  setVisibleFields: (fields: string[]) => void;
  columns: string[];
  rows: Array<Array<ReactNode>>;
  users: AccessUser[];
};

export function UsersTab({
  saving,
  userForm,
  setUserForm,
  roles,
  teams,
  salesGroups,
  permissionTemplates,
  userFieldDefinitions,
  userCustomValues,
  setUserCustomValues,
  customFieldOptions,
  createUser,
  updateUser,
  deactivateUser,
  fieldOptions,
  visibleFields,
  setVisibleFields,
  columns,
  rows,
  users
}: UsersTabProps) {
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const openCreateUser = () => {
    setEditingUserId(null);
    setUserForm({ name: '', email: '', phone: '', password: '', roleId: '', teamId: '', permissionTemplateId: '', salesGroupIds: [] });
    setUserCustomValues({});
    setUserDialogOpen(true);
  };

  const openEditUser = (user: AccessUser) => {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
      roleId: user.roleId ?? user.role?.id ?? '',
      teamId: user.teamId ?? user.team?.id ?? '',
      permissionTemplateId: user.permissionTemplateId ?? user.permissionTemplate?.id ?? '',
      salesGroupIds: (user.salesGroups ?? []).map((group) => group.salesGroup?.id ?? group.id).filter(Boolean) as string[]
    });
    setUserCustomValues(Object.fromEntries((user.customFields ?? []).map((field) => [field.key, field.value])));
    setUserDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (editingUserId) {
      await Promise.resolve(updateUser(editingUserId));
    } else {
      await Promise.resolve(createUser());
    }
    setUserDialogOpen(false);
    setEditingUserId(null);
  };

  return (
    <>
      <Section
        title="Users"
        actions={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <FieldSelector fields={fieldOptions} selected={visibleFields} onChange={setVisibleFields} />
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateUser} sx={{ borderRadius: 1 }}>Create User</Button>
          </Stack>
        }
      >
        <CompactDataTable
          columns={[...columns, 'Action']}
          rows={rows.map((row, index) => [
            ...row,
            users[index] ? (
              <RowActionMenu
                key={`${users[index].id}-actions`}
                actions={[
                  { label: 'Edit user', icon: <EditIcon fontSize="small" />, onClick: () => openEditUser(users[index]) },
                  { label: users[index].isActive ? 'Deactivate user' : 'Inactive', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: !users[index].isActive, onClick: () => deactivateUser(users[index].id) }
                ]}
              />
            ) : null
          ])}
        />
      </Section>
      <FormDialog
        open={userDialogOpen}
        title={editingUserId ? 'Edit User' : 'Create User'}
        subtitle="Users can belong to one team and can receive custom field values used in assignment."
        onClose={() => setUserDialogOpen(false)}
        maxWidth="lg"
        actions={(
          <>
            <Button variant="text" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !userForm.name || !userForm.email} onClick={handleCreateUser}>{editingUserId ? 'Save User' : 'Create User'}</Button>
          </>
        )}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
          <TextField size="small" label="Name" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          <TextField size="small" label="Email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
          <TextField size="small" label="10-digit phone" value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })} />
          <TextField size="small" label="Password" type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
          <FormControl size="small"><Select displayEmpty value={userForm.roleId} onChange={(event) => setUserForm({ ...userForm, roleId: event.target.value })}><MenuItem value="">Role</MenuItem>{roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><Select displayEmpty value={userForm.teamId} onChange={(event) => setUserForm({ ...userForm, teamId: event.target.value })}><MenuItem value="">Team</MenuItem>{teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><Select displayEmpty value={userForm.permissionTemplateId} onChange={(event) => setUserForm({ ...userForm, permissionTemplateId: event.target.value })}><MenuItem value="">Permission Template</MenuItem>{permissionTemplates.map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}</Select></FormControl>
          <FormControl size="small">
            <Select
              multiple
              displayEmpty
              value={userForm.salesGroupIds}
              onChange={(event) => setUserForm({ ...userForm, salesGroupIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value })}
              renderValue={(selected) => selected.length ? selected.map((id) => salesGroups.find((group) => group.id === id)?.name ?? id).join(', ') : 'Sales Groups'}
            >
              {salesGroups.map((group) => <MenuItem key={group.id} value={group.id}><Checkbox size="small" checked={userForm.salesGroupIds.includes(group.id)} />{group.name}</MenuItem>)}
            </Select>
          </FormControl>
          {userFieldDefinitions.map((field) => {
            const options = customFieldOptions(field);
            if (field.fieldType === 'boolean') {
              return (
                <Stack key={field.id} direction="row" alignItems="center" spacing={0.5}>
                  <Checkbox size="small" checked={Boolean(userCustomValues[field.fieldKey])} onChange={(event) => setUserCustomValues({ ...userCustomValues, [field.fieldKey]: event.target.checked })} />
                  <Typography fontSize={12}>{field.label}{field.isRequired ? ' *' : ''}</Typography>
                </Stack>
              );
            }
            if (options.length > 0 && field.fieldType === 'select') {
              return (
                <FormControl key={field.id} size="small">
                  <Select displayEmpty value={String(userCustomValues[field.fieldKey] ?? '')} onChange={(event) => setUserCustomValues({ ...userCustomValues, [field.fieldKey]: event.target.value })}>
                    <MenuItem value="">{field.label}{field.isRequired ? ' *' : ''}</MenuItem>
                    {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </Select>
                </FormControl>
              );
            }
            return (
              <TextField
                key={field.id}
                size="small"
                label={`${field.label}${field.isRequired ? ' *' : ''}`}
                value={String(userCustomValues[field.fieldKey] ?? '')}
                onChange={(event) => setUserCustomValues({ ...userCustomValues, [field.fieldKey]: event.target.value })}
              />
            );
          })}
        </Box>
      </FormDialog>
    </>
  );
}
