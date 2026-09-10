import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 space-y-6 pb-24 font-sans">
      {/* ─── 1) Header ─── */}
      <div className="flex flex-col gap-5 mb-2">
        {/* Line 1: Title & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-[150px] rounded-md" />
            <Skeleton className="h-9 w-[150px] rounded-md" />
          </div>
        </div>

        {/* Line 2: Search & Views */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <Skeleton className="h-9 w-full md:max-w-[400px] rounded-lg" />
          <Skeleton className="h-9 w-[130px] rounded-md" />
        </div>
      </div>

      <div className="w-full">
        {/* Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Skeleton className="h-9 w-[220px] rounded-md" />
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-8 w-[80px] rounded-sm" />
            <Skeleton className="h-8 w-[90px] rounded-sm" />
            <Skeleton className="h-8 w-[100px] rounded-sm" />
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="min-w-0 space-y-4">
            {/* Clickable Metrics Bar Skeleton */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Skeleton className="h-[32px] w-[80px] rounded-sm" />
              <Skeleton className="h-[32px] w-[90px] rounded-sm" />
              <Skeleton className="h-[32px] w-[110px] rounded-sm" />
              <Skeleton className="h-[32px] w-[90px] rounded-sm" />
              <Skeleton className="h-[32px] w-[80px] rounded-sm" />
            </div>

            {/* Inbox List Skeleton */}
            <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col items-stretch">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-4 border-b border-zinc-100 dark:border-white/5 last:border-0 items-center"
                >
                  <div className="pt-1.5 shrink-0 flex items-center justify-center w-3">
                    <Skeleton className="w-2 h-2 rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <div className="flex-1 min-w-0 pr-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-[160px]" />
                        <Skeleton className="h-3 w-[100px]" />
                      </div>
                      <Skeleton className="h-3 w-[85%] max-w-[420px]" />
                    </div>
                    <div className="shrink-0 flex items-center justify-end">
                      <Skeleton className="h-3 w-[60px]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column Skeleton */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl p-5 space-y-4">
              <Skeleton className="h-3 w-[120px]" />
              <div className="space-y-1">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-3 w-[60px] mx-1" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-lg flex gap-2.5 items-center"
                  >
                    <Skeleton className="w-6 h-6 rounded shrink-0" />
                    <Skeleton className="h-3.5 w-[60%]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
