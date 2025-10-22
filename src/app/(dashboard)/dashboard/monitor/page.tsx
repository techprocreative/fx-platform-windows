'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DEPRECATED: This page has been merged into Executors Dashboard
 * 
 * All monitoring functionality is now available in:
 * /dashboard/executors (click on "Real-time Monitor" tab)
 * 
 * This page redirects users to the new location.
 */
export default function MonitorPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/executors?tab=monitor');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-neutral-600">Redirecting to Executors Dashboard...</p>
        <p className="text-xs text-neutral-500 mt-2">
          Monitor page has been merged into Executors
        </p>
      </div>
    </div>
  );
}
