"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import type {
  StrategyFormData,
  StrategyRules,
} from "@/components/forms/StrategyForm";
import { StrategyFormSkeleton } from "@/components/forms/StrategyForm";

const StrategyForm = dynamic(
  () =>
    import("@/components/forms/StrategyForm").then((mod) => mod.StrategyForm),
  {
    loading: () => <StrategyFormSkeleton />,
    ssr: false,
  },
);

export default function NewStrategyPage() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const router = useRouter();
  const { status } = useSession();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  // Early returns AFTER all hooks
  if (status === "loading") {
    return <StrategyFormSkeleton />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  const handleSubmit = async ({
    formData,
    rules,
  }: {
    formData: StrategyFormData;
    rules: StrategyRules;
  }) => {
    setSubmitting(true);

    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          rules,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to create strategy");
      }

      const data = await response.json();
      toast.success("Strategy created successfully!");
      router.push(`/dashboard/strategies/${data.id}`);
    } catch (error) {
      setSubmitting(false);
      throw error instanceof Error
        ? error
        : new Error("Failed to create strategy");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <StrategyForm
        onSubmit={handleSubmit}
        onCancelHref="/dashboard/strategies"
        title="Create Strategy"
        subtitle="Choose a template or build a custom trading strategy from scratch."
        submitLabel="Create Strategy"
        loading={submitting}
        showModeToggle
      />
    </div>
  );
}
