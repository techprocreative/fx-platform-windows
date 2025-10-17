'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { status } = useSession();

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Analytics</h1>
        <p className="text-neutral-600 mt-1">Monitor your trading performance</p>
      </div>

      {/* Coming Soon */}
      <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
        <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900">Analytics Coming Soon</h3>
        <p className="text-neutral-600 mt-1">
          Detailed analytics and performance charts will be available soon
        </p>
      </div>
    </div>
  );
}
