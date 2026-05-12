'use client';

import { LeadDetailRoute } from '../../../features/crm/CrmRoute';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <LeadDetailRoute params={params} />;
}
