'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Button } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import type { ConnectorOverview, GenericConnector } from './connector-types';

type ApiCallConnectorPanelProps = {
  connectorOverview: ConnectorOverview;
  openCreateApi: () => void;
  openEditApi: (connector: GenericConnector) => void;
  deleteApiConnector: (connectorId: string) => void;
};

export function ApiCallConnectorPanel({ connectorOverview, openCreateApi, openEditApi, deleteApiConnector }: ApiCallConnectorPanelProps) {
  return (
    <Section title="Generic API Call" actions={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateApi} sx={{ borderRadius: 1 }}>Add API</Button>}>
      <CompactDataTable
        columns={['Name', 'Provider', 'Method', 'URL', 'Status', 'Action']}
        rows={(connectorOverview.connectors ?? []).map((connector) => [
          connector.name ?? '-',
          connector.provider ?? '-',
          String(connector.config?.method ?? '-'),
          String(connector.config?.url ?? '-'),
          <AppChip key={`${connector.id}-status`} label={connector.isActive ? 'Active' : 'Inactive'} />,
          <RowActionMenu
            key={`${connector.id}-actions`}
            actions={[
              { label: 'Edit API', icon: <EditIcon fontSize="small" />, onClick: () => openEditApi(connector) },
              { label: 'Delete API', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteApiConnector(connector.id) }
            ]}
          />
        ])}
      />
    </Section>
  );
}
