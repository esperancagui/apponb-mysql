import { Skeleton } from "@/components/ui/skeleton";

export default function ResponseDetailsSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 pb-24 font-sans">
      {/* ─── 1) HEADER SKELETON ─── */}
      <div className="space-y-5 pb-5">
        {/* Breadcrumb */}
        <Skeleton className="h-4 w-[60px]" />

        {/* Avatar + name + status pill row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-[180px]" />
              <Skeleton className="h-4 w-[240px]" />
            </div>
          </div>
          <Skeleton className="h-7 w-[130px] rounded-full shrink-0" />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[150px] rounded-sm" />
          <Skeleton className="h-8 w-[120px] rounded-sm" />
          <Skeleton className="h-8 w-8 rounded-sm" />
        </div>

        {/* Divider */}
        <div className="border-b border-zinc-100 dark:border-white/5" />
      </div>

      {/* ─── 2) METRICS BAR SKELETON ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[82px] w-full rounded-xl" />
        ))}
      </div>

      {/* ─── 3) BODY GRID SKELETON ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
        {/* Left (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          {/* AI Insight card skeleton */}
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/10 overflow-hidden flex">
            <div className="w-[3px] bg-indigo-200 dark:bg-indigo-800 rounded-l-2xl shrink-0" />
            <div className="flex-1 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-5 w-[90px] rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[70%]" />
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                <Skeleton className="h-9 w-[180px] rounded-xl" />
                <Skeleton className="h-9 w-[160px] rounded-xl" />
                <Skeleton className="h-9 w-[200px] rounded-xl" />
              </div>
            </div>
          </div>

          {/* Raw Responses skeleton */}
          <div className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
              <Skeleton className="h-5 w-[180px]" />
              <Skeleton className="h-6 w-[140px] rounded-full" />
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <Skeleton className="h-3.5 w-[140px]" />
                  </div>
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-3.5 w-[60%]" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* File grid skeleton */}
          <div className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-[160px]" />
              <Skeleton className="h-8 w-[110px] rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Right (1/3) */}
        <div className="space-y-4">
          <Skeleton className="h-[148px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[260px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
