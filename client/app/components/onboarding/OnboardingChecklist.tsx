"use client";

import React, { useState, useEffect } from "react";
import { Check, X, ArrowRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
}

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onDismiss: () => void;
  collapsed: boolean;
}

export function OnboardingChecklist({ steps, onDismiss, collapsed }: OnboardingChecklistProps) {
  const completedCount = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const allDone = completedCount === total;
  const progress = total > 0 ? (completedCount / total) * 100 : 0;

  // Show congratulations state briefly when all steps are done
  const [showCongrats, setShowCongrats] = useState(false);
  useEffect(() => {
    if (allDone) {
      setShowCongrats(true);
      const t = setTimeout(() => onDismiss(), 3500);
      return () => clearTimeout(t);
    }
  }, [allDone, onDismiss]);

  // ── Collapsed: donut progress badge ─────────────────────────────────────
  if (collapsed) {
    const r = 9;
    const circ = 2 * Math.PI * r;
    const dash = (progress / 100) * circ;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {}}
            className="mx-auto flex items-center justify-center w-10 h-10 rounded-lg hover:bg-sidebar-accent transition-colors relative"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
              {/* Track */}
              <circle
                cx="12"
                cy="12"
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-zinc-200 dark:text-zinc-800"
              />
              {/* Progress */}
              <circle
                cx="12"
                cy="12"
                r={r}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-zinc-500 dark:text-zinc-400" style={{ rotate: "0deg" }}>
              {completedCount}/{total}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-[12px] font-semibold">
          Primeiros passos — {completedCount}/{total}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded: full checklist card ───────────────────────────────────────
  return (
    <div className="mx-2.5 mb-2 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/80 dark:bg-white/[0.03] overflow-hidden">
      {/* Congratulations state */}
      {showCongrats ? (
        <div className="p-4 flex flex-col items-center text-center gap-2">
          <PartyPopper size={22} className="text-primary" />
          <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 leading-snug">
            Tudo pronto!
          </p>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-500 leading-snug">
            Você completou todos os primeiros passos.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">Primeiros passos</span>
              <span className="text-[10.5px] font-medium text-zinc-400 dark:text-zinc-600">
                {completedCount}/{total}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-3 pb-2.5">
            <div className="w-full h-1 rounded-full bg-zinc-200 dark:bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "var(--primary)" }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="px-2 pb-2.5 space-y-0.5 max-h-[180px] overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 px-1.5 py-1.5 rounded-lg group",
                  step.completed
                    ? "opacity-60"
                    : "hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition-colors",
                )}
              >
                {/* Check circle */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full shrink-0 flex items-center justify-center border transition-all",
                    step.completed
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-300 dark:border-zinc-700 bg-transparent",
                  )}
                >
                  {step.completed && <Check size={9} strokeWidth={3} className="text-white" />}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "flex-1 text-[12px] font-medium leading-snug",
                    step.completed
                      ? "line-through text-zinc-400 dark:text-zinc-600"
                      : "text-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {step.label}
                </span>

                {/* Arrow link for incomplete steps */}
                {!step.completed && step.href && (
                  <Link href={step.href}>
                    <ArrowRight
                      size={12}
                      strokeWidth={2.2}
                      className="text-zinc-400 dark:text-zinc-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
