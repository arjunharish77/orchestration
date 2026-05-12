'use client';

import { RouteErrorState } from '../../components/common/RouteState';

export default function UsersError({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorState error={error} reset={reset} />;
}
