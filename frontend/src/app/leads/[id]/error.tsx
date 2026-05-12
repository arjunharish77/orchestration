'use client';

import { RouteErrorState } from '../../../components/common/RouteState';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorState error={error} reset={reset} />;
}
