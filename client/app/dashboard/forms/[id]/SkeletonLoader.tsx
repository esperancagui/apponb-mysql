import { Skeleton } from "@/components/ui/skeleton";

export default function FormEditorSkeleton() {
  return (
    <div className="flex flex-col absolute top-14 bottom-0 left-0 right-0 z-10 overflow-hidden bg-white dark:bg-[#0A0A0A]">
      {/* ─── Apple-style Top Bar Skeleton ─── */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-zinc-200/50 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="rounded-lg w-8 h-8" />
          <div className="hidden sm:block space-y-1.5 pl-1">
            <Skeleton className="h-4 w-[120px]" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-1.5 h-1.5 rounded-full" />
              <Skeleton className="h-3 w-[50px]" />
            </div>
          </div>
        </div>

        {/* Segmented Control Skeleton */}
        <div className="flex items-center bg-zinc-100/80 dark:bg-white/5 rounded-lg p-0.5 border border-zinc-200/50 dark:border-transparent gap-1">
          <Skeleton className="px-5 py-1.5 h-[28px] w-[70px] rounded-md" />
          <Skeleton className="px-5 py-1.5 h-[28px] w-[80px] rounded-md" />
          <Skeleton className="px-5 py-1.5 h-[28px] w-[80px] rounded-md" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-[40px] hidden md:block" />
          <Skeleton className="rounded-lg w-[70px] h-8" />
          <Skeleton className="rounded-lg w-8 h-8 lg:hidden" />
        </div>
      </header>

      {/* ─── Main Content Area Skeleton ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Panel Skeleton */}
        <div className="flex-1 flex flex-col pt-8 px-6 lg:px-12 relative bg-[#FAFAFA] dark:bg-[#0A0A0A] space-y-6">
          <div className="max-w-[600px] w-full mx-auto space-y-8">
            <div className="space-y-2">
              <Skeleton className="h-8 w-[200px]" />
              <Skeleton className="h-4 w-[350px]" />
            </div>

            {/* Fields skeleton (FormFieldsEditor mimic) */}
            <div className="space-y-6">
              {/* Section Group */}
              <div className="relative group/section space-y-2 p-1 border-t-[3px] border-transparent">
                {/* Section Header */}
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Skeleton className="w-3 h-3 pt-0.5" />
                  </div>
                  <Skeleton className="h-6 w-[200px] rounded-md" />
                  <Skeleton className="h-5 w-[80px] rounded-full ml-2 opacity-60" />
                </div>

                {/* Fields List Container */}
                <div className="bg-white dark:bg-[#111111] rounded-2xl border border-zinc-200/60 dark:border-white/5 shadow-sm overflow-hidden flex flex-col pt-1">
                  {/* Field 1 (Text) */}
                  <div className="flex flex-col gap-2 px-6 py-4 relative">
                    <div className="flex-1 min-w-0 pr-12 leading-snug">
                      <Skeleton className="h-4 w-[140px] mb-3" />
                      <div className="w-full md:w-2/3 xl:w-1/2">
                        <Skeleton className="h-10 w-full rounded-md opacity-50" />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-white/5 mx-14" />

                  {/* Field 2 (Textarea) */}
                  <div className="flex flex-col gap-2 px-6 py-4 relative">
                    <div className="flex-1 min-w-0 pr-12 leading-snug">
                      <Skeleton className="h-4 w-[220px] mb-3" />
                      <div className="w-full xl:w-3/4">
                        <Skeleton className="h-[80px] w-full rounded-md opacity-50" />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-white/5 mx-14" />

                  {/* Field 3 (Select) */}
                  <div className="flex flex-col gap-2 px-6 py-4 relative">
                    <div className="flex-1 min-w-0 pr-12 leading-snug">
                      <Skeleton className="h-4 w-[180px] mb-4" />
                      <div className="flex flex-col gap-3 w-full max-w-md pointer-events-none mt-1">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-[18px] h-[18px] rounded-full shrink-0" />
                          <Skeleton className="h-3 w-[120px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-[18px] h-[18px] rounded-full shrink-0" />
                          <Skeleton className="h-3 w-[160px]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add Field Button inside group */}
                  <div className="p-3 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/1">
                    <Skeleton className="h-9 w-[200px] rounded-md opacity-70 border-dashed" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Preview Skeleton */}
        <div className="hidden lg:flex w-[480px] xl:w-[540px] border-l border-zinc-200/50 dark:border-white/5 bg-zinc-100/50 dark:bg-[#111111] items-center justify-center p-0 shrink-0 relative h-full pt-8 pb-12">
          {/* Control Bar Skeleton */}
          <div className="absolute top-0 left-2 right-0 z-50 flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between w-full max-w-lg mx-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-xl p-1.5 shadow-sm">
              <div className="flex items-center bg-zinc-100/50 dark:bg-black/20 p-1 rounded-md gap-1">
                <Skeleton className="h-7 w-8 rounded-sm" />
                <Skeleton className="h-7 w-8 rounded-sm" />
              </div>
              <div className="flex items-center bg-zinc-100/50 dark:bg-black/20 p-1 rounded-md mx-2 flex-1 justify-center max-w-[180px] gap-1">
                <Skeleton className="h-7 w-full rounded-sm" />
                <Skeleton className="h-7 w-full rounded-sm" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-6 w-10" />
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          </div>

          <div className="w-[320px] h-[650px] bg-white dark:bg-[#0A0A0A] rounded-[2.5rem] border-8 border-zinc-800 dark:border-zinc-800 relative overflow-hidden flex flex-col shadow-2xl mx-auto my-auto">
            {/* Fake iPhone Notch / Dynamic Island */}
            <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
              <div className="w-[100px] h-[20px] bg-zinc-800 rounded-b-2xl"></div>
            </div>

            {/* Form Content Skeleton inside the phone */}
            <div className="flex-1 overflow-hidden p-5 pt-12 space-y-5">
              {/* Header area */}
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-5 w-[160px]" />
                <Skeleton className="h-3 w-[220px]" />
              </div>

              <div className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-[100px]" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-[120px]" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-[80px]" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>

              <div className="pt-4">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
