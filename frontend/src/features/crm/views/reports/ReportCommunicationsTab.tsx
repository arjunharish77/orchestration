'use client';

import { Stack } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { ReportsOverview } from './report-types';
import { formatDate, numberValue, stringValue } from './report-utils';

export function ReportCommunicationsTab({ reportsOverview }: { reportsOverview: ReportsOverview }) {
  return (
    <Stack spacing={0.85}>
      <Section title="Telephony Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Lead', 'Phone', 'Direction', 'Status', 'Duration', 'Created']}
          rows={(reportsOverview.telephonyCalls ?? []).map((call) => [
            stringValue(call.leadName, stringValue(call.leadId)),
            stringValue(call.phoneNumber),
            stringValue(call.callDirection),
            <AppChip key={`${stringValue(call.id)}-status`} label={stringValue(call.callStatus)} />,
            String(numberValue(call.callDuration)),
            formatDate(stringValue(call.createdAt))
          ])}
        />
      </Section>
      <Section title="WhatsApp Message Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Lead', 'Direction', 'Type', 'Status', 'Message ID', 'Created']}
          rows={(reportsOverview.whatsAppMessages ?? []).map((message) => [
            stringValue(message.leadName, stringValue(message.leadId)),
            stringValue(message.direction),
            stringValue(message.messageType),
            <AppChip key={`${stringValue(message.id)}-status`} label={stringValue(message.status)} />,
            stringValue(message.providerMessageId),
            formatDate(stringValue(message.createdAt))
          ])}
        />
      </Section>
      <Section title="Voicebot Call Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Lead', 'Status', 'Intent', 'Disposition', 'Duration', 'Created']}
          rows={(reportsOverview.voicebotCalls ?? []).map((call) => [
            stringValue(call.leadName, stringValue(call.leadId)),
            <AppChip key={`${stringValue(call.id)}-status`} label={stringValue(call.callStatus)} />,
            stringValue(call.intent),
            stringValue(call.disposition),
            String(numberValue(call.duration)),
            formatDate(stringValue(call.createdAt))
          ])}
        />
      </Section>
    </Stack>
  );
}
