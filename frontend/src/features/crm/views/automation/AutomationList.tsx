'use client';

import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { StatusChip } from '../../../../components/common/StatusChip';
import { CrmDataTable, CrmTableColumn } from '../../../../components/common/CompactDataTable';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { TableToolbar } from '../../../../components/common/TableToolbar';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { formatDate } from '../../../../lib/format';

type AutomationWorkflow = {
  id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  versions?: Array<{
    version?: number | null;
    isPublished?: boolean | null;
    definition?: {
      nodes?: unknown[];
      edges?: unknown[];
    } | null;
  }>;
};

type AutomationListProps = {
  workflows: AutomationWorkflow[];
  loading?: boolean;
  onEdit: (workflowId: string) => void;
  onRun: (workflowId: string) => void;
};

export function AutomationList({ workflows, loading = false, onEdit, onRun }: AutomationListProps) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!normalizedSearch) return workflows;
    return workflows.filter((workflow) => [
      workflow.name,
      workflow.description,
      workflow.status
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)));
  }, [normalizedSearch, workflows]);

  const columns: Array<CrmTableColumn<AutomationWorkflow>> = [
    {
      key: 'name',
      label: 'Automation',
      primary: true,
      render: (workflow) => (
        <Stack spacing={0.2} sx={{ minWidth: 0 }}>
          <Typography color="primary.main" fontWeight={800} noWrap>{workflow.name ?? 'Untitled automation'}</Typography>
          <Typography color="text.secondary" fontSize={12} noWrap>{workflow.description || 'No description'}</Typography>
        </Stack>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (workflow) => <StatusChip status={workflow.status ?? 'draft'} />
    },
    {
      key: 'version',
      label: 'Version',
      render: (workflow) => {
        const latest = workflow.versions?.[0];
        return latest?.version ? `v${latest.version}${latest.isPublished ? ' published' : ' draft'}` : 'v1 draft';
      }
    },
    {
      key: 'nodes',
      label: 'Nodes',
      render: (workflow) => String(workflow.versions?.[0]?.definition?.nodes?.length ?? 0)
    },
    {
      key: 'updated',
      label: 'Updated',
      render: (workflow) => formatDate(workflow.updatedAt ?? workflow.createdAt)
    }
  ];

  return (
    <Section title="Automation Workflows">
      <Stack spacing={1} sx={{ p: 1 }}>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search automations"
          columnsControl={null}
          densityControl={null}
          actions={<Typography color="text.secondary" fontSize={12}>{rows.length} workflows</Typography>}
        />
        <CrmDataTable
          columns={columns}
          rows={rows}
          getRowId={(workflow) => workflow.id}
          loading={loading}
          emptyLabel="No automation workflows found"
          onPrimaryRowClick={(workflow) => onEdit(workflow.id)}
          rowActions={(workflow) => (
            <RowActionMenu
              actions={[
                { label: 'Open Builder', icon: <EditIcon fontSize="small" />, onClick: () => onEdit(workflow.id) },
                { label: 'Run Published', icon: <PlayArrowIcon fontSize="small" />, disabled: workflow.status !== 'active', onClick: () => onRun(workflow.id) }
              ]}
            />
          )}
        />
      </Stack>
    </Section>
  );
}
