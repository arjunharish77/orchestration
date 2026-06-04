'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { restoreStoredSession } from '../lib/auth';
import { RouteLoadingState } from '../components/common/RouteState';

export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function routeBySession() {
      const session = await restoreStoredSession<unknown>();
      if (cancelled) return;
      router.replace(session ? '/leads' : '/login');
    }

    void routeBySession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <RouteLoadingState title="Opening workspace" />;
}
