'use client';

import { RouteErrorState } from '../../components/common/RouteState';

export default function ConnectorsError({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorState error={error} reset={reset} />;
}
