'use client';

import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import { AppButton } from '../../../../components/common/AppButton';
import { AppChip } from '../../../../components/common/AppChip';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CrmDataTable, CrmTableColumn } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { ActivityTypeConfig } from './settings-types';

const bg = '#fafdfa';

type ActivityTypeForm = Omit<ActivityTypeConfig, 'code' | 'isSystem'>;

const defaultActivityTypeForm: ActivityTypeForm = {
  label: '',
  isActive: true,
  showInGlobalList: true,
  showInLeadDetail: true,
  allowManualCreate: true
};

function visibilityLabel(type: ActivityTypeConfig) {
  const labels = [];
  if (type.showInGlobalList !== false) labels.push('Activities page');
  if (type.showInLeadDetail !== false) labels.push('Lead detail');
  return labels.length ? labels.join(', ') : 'Hidden';
}

async function actionSucceeded(action: boolean | void | Promise<boolean | void>) {
  return (await Promise.resolve(action)) !== false;
}

export function SettingsActivityTypesPage({
  activityTypes,
  activityTypeForm,
  setActivityTypeForm,
  savingField,
  createActivityType,
  updateActivityType,
  deactivateActivityType
}: {
  activityTypes: ActivityTypeConfig[];
  activityTypeForm: ActivityTypeForm;
  setActivityTypeForm: (value: ActivityTypeForm) => void;
  savingField: boolean;
  createActivityType: () => boolean | void | Promise<boolean | void>;
  updateActivityType: (type: ActivityTypeConfig, patch: Partial<ActivityTypeConfig>) => boolean | void | Promise<boolean | void>;
  deactivateActivityType: (code: string) => boolean | void | Promise<boolean | void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<ActivityTypeConfig | null>(null);
  const [editForm, setEditForm] = useState<ActivityTypeForm>(defaultActivityTypeForm);
  const [deactivateTarget, setDeactivateTarget] = useState<ActivityTypeConfig | null>(null);

  const openCreate = () => {
    setActivityTypeForm(defaultActivityTypeForm);
    setCreateOpen(true);
  };

  const openEdit = (type: ActivityTypeConfig) => {
    setEditForm({
      label: type.label,
      isActive: type.isActive !== false,
      showInGlobalList: type.showInGlobalList !== false,
      showInLeadDetail: type.showInLeadDetail !== false,
      allowManualCreate: type.allowManualCreate === true
    });
    setEditingType(type);
  };

  const columns = useMemo<Array<CrmTableColumn<ActivityTypeConfig>>>(() => [
    {
      key: 'code',
      label: 'Code',
      render: (type) => <Typography fontWeight={800}>{type.code}</Typography>
    },
    {
      key: 'label',
      label: 'Activity type',
      render: (type) => (
        <Stack spacing={0.2}>
          <Typography fontWeight={800}>{type.label}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {type.isSystem ? 'System type, code locked' : 'Custom type'}
          </Typography>
        </Stack>
      )
    },
    {
      key: 'visibility',
      label: 'Visible in',
      render: (type) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <VisibilityOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>{visibilityLabel(type)}</Typography>
        </Stack>
      )
    },
    {
      key: 'manual',
      label: 'Manual create',
      render: (type) => <AppChip label={type.allowManualCreate === true ? 'Allowed' : 'Blocked'} />
    },
    {
      key: 'status',
      label: 'Status',
      render: (type) => <AppChip label={type.isActive === false ? 'Inactive' : type.isSystem ? 'System' : 'Active'} />
    }
  ], []);

  return (
    <Stack spacing={1}>
      <Section title="Activity Types">
        <Stack spacing={1.25} sx={{ p: 1 }}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 1,
              p: 1.25,
              bgcolor: bg,
              borderColor: '#e0ede0',
              boxShadow: '0 8px 20px rgba(22, 39, 22, 0.03)',
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1,
              flexDirection: { xs: 'column', sm: 'row' }
            }}
          >
            <Stack spacing={0.25}>
              <Typography fontWeight={800}>Activity type setup</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                Configure the visible activity queues, lead-detail timeline types, and whether users can add that activity manually.
              </Typography>
            </Stack>
            <AppButton startIcon={<AddIcon />} onClick={openCreate}>
              Add Type
            </AppButton>
          </Paper>

          <CrmDataTable
            columns={columns}
            rows={activityTypes}
            getRowId={(type) => type.code}
            emptyLabel="No activity types configured"
            rowActions={(type) => (
              <RowActionMenu
                ariaLabel={`Actions for ${type.label}`}
                actions={[
                  { label: 'Edit type', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => openEdit(type) },
                  {
                    label: type.isActive === false ? 'Activate type' : 'Deactivate type',
                    icon: <PowerSettingsNewOutlinedIcon fontSize="small" />,
                    tone: type.isActive === false ? 'default' : 'danger',
                    disabled: type.isSystem || savingField,
                    onClick: () => {
                      if (type.isActive === false) {
                        void actionSucceeded(updateActivityType(type, { isActive: true }));
                        return;
                      }
                      setDeactivateTarget(type);
                    }
                  }
                ]}
              />
            )}
          />
        </Stack>
      </Section>

      <FormDialog
        open={createOpen}
        title="Create Activity Type"
        subtitle="A 3-digit code is generated automatically. Custom fields can be added for this type after creation."
        onClose={() => setCreateOpen(false)}
        actions={(
          <>
            <AppButton variant="outlined" onClick={() => setCreateOpen(false)}>Cancel</AppButton>
            <AppButton
              disabled={savingField || !activityTypeForm.label.trim()}
              onClick={async () => {
                if (await actionSucceeded(createActivityType())) setCreateOpen(false);
              }}
            >
              Create
            </AppButton>
          </>
        )}
      >
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Activity type name"
            value={activityTypeForm.label}
            onChange={(event) => setActivityTypeForm({ ...activityTypeForm, label: event.target.value })}
            autoFocus
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <FormControlLabel
              control={<Checkbox checked={activityTypeForm.showInGlobalList !== false} onChange={(event) => setActivityTypeForm({ ...activityTypeForm, showInGlobalList: event.target.checked })} />}
              label="Show on Activities page"
            />
            <FormControlLabel
              control={<Checkbox checked={activityTypeForm.showInLeadDetail !== false} onChange={(event) => setActivityTypeForm({ ...activityTypeForm, showInLeadDetail: event.target.checked })} />}
              label="Show in lead detail"
            />
            <FormControlLabel
              control={<Checkbox checked={activityTypeForm.allowManualCreate !== false} onChange={(event) => setActivityTypeForm({ ...activityTypeForm, allowManualCreate: event.target.checked })} />}
              label="Allow manual create"
            />
          </Stack>
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(editingType)}
        title="Edit Activity Type"
        subtitle={editingType?.isSystem ? 'System activity codes are locked. Visibility and label can still be configured.' : 'Update visibility, status, and manual-create behavior.'}
        onClose={() => setEditingType(null)}
        actions={(
          <>
            <AppButton variant="outlined" onClick={() => setEditingType(null)}>Cancel</AppButton>
            <AppButton
              disabled={savingField || !editForm.label.trim() || !editingType}
              onClick={async () => {
                if (!editingType) return;
                if (await actionSucceeded(updateActivityType(editingType, editForm))) setEditingType(null);
              }}
            >
              Save
            </AppButton>
          </>
        )}
      >
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Activity type name"
            value={editForm.label}
            onChange={(event) => setEditForm({ ...editForm, label: event.target.value })}
            autoFocus
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <FormControlLabel
              control={<Checkbox checked={editForm.showInGlobalList !== false} onChange={(event) => setEditForm({ ...editForm, showInGlobalList: event.target.checked })} />}
              label="Show on Activities page"
            />
            <FormControlLabel
              control={<Checkbox checked={editForm.showInLeadDetail !== false} onChange={(event) => setEditForm({ ...editForm, showInLeadDetail: event.target.checked })} />}
              label="Show in lead detail"
            />
            <FormControlLabel
              control={<Checkbox checked={editForm.allowManualCreate === true} disabled={editingType?.isSystem} onChange={(event) => setEditForm({ ...editForm, allowManualCreate: event.target.checked })} />}
              label="Allow manual create"
            />
            <FormControlLabel
              control={<Checkbox checked={editForm.isActive !== false} disabled={editingType?.isSystem} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />}
              label="Active"
            />
          </Stack>
        </Stack>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate Activity Type"
        message={deactivateTarget ? `Deactivate ${deactivateTarget.label}? Existing activity records will remain available.` : ''}
        confirmLabel="Deactivate"
        destructive
        onClose={() => setDeactivateTarget(null)}
        onConfirm={async () => {
          if (!deactivateTarget) return;
          if (await actionSucceeded(deactivateActivityType(deactivateTarget.code))) setDeactivateTarget(null);
        }}
      />
    </Stack>
  );
}
