'use client';

import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { formatDate } from '../../../../lib/format';
import type { ConnectorEvent } from './connector-types';

type ConnectorLogsPanelProps = {
  connectorEvents: ConnectorEvent[];
};

export function ConnectorLogsPanel({ connectorEvents }: ConnectorLogsPanelProps) {
  return (
    <Section title="Connector Request Logs">
      <CompactDataTable
        columns={['Type', 'Status', 'Error', 'Created', 'Connector', 'Payload']}
        rows={connectorEvents.map((event) => [
          event.eventType ?? '-',
          <AppChip key={`${event.id}-status`} label={event.status ?? '-'} />,
          event.error ?? '-',
          formatDate(event.createdAt),
          event.connectorName ?? event.connectorId ?? '-',
          JSON.stringify(event.normalizedPayload ?? event.rawPayload ?? {}).slice(0, 120)
        ])}
      />
    </Section>
  );
}
