export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading dashboard...</p>
      </div>
    </div>
  );
}
