'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import {
  StrategyForm,
  StrategyFormData,
  StrategyRules,
} from '@/components/forms/StrategyForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useApiRequest } from '@/hooks/useApiRequest';

interface StrategyResponse {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  type: string;
  rules: StrategyRules;
}

export default function EditStrategyPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: strategy, loading, error, execute } = useApiRequest<StrategyResponse>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    execute(async () => {
      const response = await fetch(`/api/strategy/${params.id}`);

      if (response.status === 401) {
        router.replace('/login');
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Strategy not found');
      }

      return response.json();
    }).catch((err) => {
      if (err.message !== 'Unauthorized') {
        toast.error(err.message);
      }
    });
  }, [execute, params.id, router]);

  const handleSubmit = async ({ formData, rules }: { formData: StrategyFormData; rules: StrategyRules }) => {
    setSubmitting(true);

    try {
      const response = await fetch(`/api/strategy/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rules,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to update strategy');
      }

      toast.success('Strategy updated successfully!');
      router.push(`/dashboard/strategies/${params.id}`);
    } catch (err) {
      setSubmitting(false);
      throw err instanceof Error ? err : new Error('Failed to update strategy');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="space-y-4">
        <Link
          href={`/dashboard/strategies/${params.id}`}
          className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          ← Back to strategy
        </Link>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-neutral-600">{error?.message || 'Strategy not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/strategies/${params.id}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          ←
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Edit Strategy</h1>
          <p className="text-neutral-600">Update configuration and rules for this strategy.</p>
        </div>
      </div>

      <StrategyForm
        initialData={{
          formData: {
            name: strategy.name,
            description: strategy.description || '',
            symbol: strategy.symbol,
            timeframe: strategy.timeframe,
            type: strategy.type,
          },
          rules: strategy.rules,
          conditions: strategy.rules.entry?.conditions?.map((condition, index) => ({
            id: `${index}`,
            ...condition,
          })) || [],
          mode: 'manual',
        }}
        onSubmit={handleSubmit}
        onCancelHref={`/dashboard/strategies/${params.id}`}
        title="Edit Strategy"
        subtitle="Adjust rules, risk controls, and other strategy parameters."
        submitLabel="Save Changes"
        loading={submitting}
        showModeToggle={false}
      />
    </div>
  );
}
