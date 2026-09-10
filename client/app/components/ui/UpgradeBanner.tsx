"use client";

import React from "react";
import {
  Check,
  ArrowRight,
  Crown,
  Building2,
  Zap,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { billingService } from "@/app/lib/services/billingService";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Plan data (mirrors /dashboard/plans) ─────────────────────

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface ModalPlan {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  features: PlanFeature[];
  cta: string;
  ctaStyle: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
}

const PLANS: ModalPlan[] = [
  {
    id: "pro",
    name: "Pro",
    price: "R$ 59,90",
    priceNote: "/mês",
    icon: Crown,
    iconColor: "#0ea5e9",
    iconBg: "#0ea5e918",
    popular: true,
    badge: "Recomendado",
    badgeColor: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
    features: [
      { text: "3 workspaces", included: true },
      { text: "Formulários ilimitados", included: true, highlight: true },
      { text: "2.000 respostas/mês", included: true, highlight: true },
      { text: "5 membros por workspace", included: true },
      { text: "Todos os templates", included: true },
      { text: "10 GB de armazenamento", included: true },
      { text: "IA — Análise de briefing (texto)", included: true, highlight: true },
      { text: "Branding personalizado", included: true },
    ],
    cta: "Assinar Pro",
    ctaStyle:
      "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20",
  },
  {
    id: "agency",
    name: "Agency",
    price: "R$ 149,90",
    priceNote: "/mês",
    icon: Building2,
    iconColor: "#f59e0b",
    iconBg: "#f59e0b18",
    badge: "Mais completo",
    badgeColor: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    features: [
      { text: "Workspaces ilimitados", included: true, highlight: true },
      { text: "Formulários ilimitados", included: true },
      { text: "Respostas ilimitadas", included: true, highlight: true },
      { text: "Membros ilimitados", included: true, highlight: true },
      { text: "100 GB de armazenamento", included: true, highlight: true },
      { text: "IA — Imagens + documentos", included: true, highlight: true },
      { text: "White-label completo", included: true, highlight: true },
      { text: "Suporte prioritário 24/7", included: true },
    ],
    cta: "Assinar Agency",
    ctaStyle:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-500/20",
  },
];

// ── Modal Component ──────────────────────────────────────────

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The error message from the backend (e.g. "Limite de 3 workspaces atingido.") */
  message?: string;
}

export function UpgradeModal({ open, onOpenChange, message }: UpgradeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    const stripePlan = planId === "pro" ? "basic" : "premium";
    setLoading(planId);
    try {
      await billingService.createCheckoutSession(stripePlan);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar checkout.");
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[760px] w-[95vw] p-0 overflow-hidden border-zinc-200/70 dark:border-white/[0.08] bg-white dark:bg-[#0A0A0A] shadow-2xl rounded-2xl font-sans"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/[0.1] dark:bg-amber-500/[0.08] mb-4">
            <Sparkles size={13} className="text-amber-500" />
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Limite atingido
            </span>
          </div>
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Faça upgrade para{" "}
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              continuar
            </span>
          </h2>
          {message && (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
              {message}
            </p>
          )}
        </div>

        {/* Plan cards */}
        <div className="px-6 md:px-8 pb-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isLoading = loading === plan.id;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden group hover:scale-[1.01] hover:shadow-lg",
                    plan.popular
                      ? "border-primary/30 dark:border-primary/20 shadow-sm"
                      : "border-zinc-200/70 dark:border-white/[0.06] shadow-sm",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
                  )}

                  <div className="relative p-5 bg-white dark:bg-[#111]">
                    {/* Badge */}
                    {plan.badge && (
                      <span
                        className={cn(
                          "absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          plan.badgeColor,
                        )}
                      >
                        {plan.badge}
                      </span>
                    )}

                    {/* Icon + Name */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: plan.iconBg, border: `1px solid ${plan.iconColor}20` }}
                      >
                        <Icon size={17} style={{ color: plan.iconColor }} strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-bold text-zinc-900 dark:text-white leading-tight">
                          {plan.name}
                        </h3>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-[28px] font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none">
                        {plan.price}
                      </span>
                      <span className="text-[12px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {plan.priceNote}
                      </span>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={isLoading}
                      className={cn(
                        "w-full h-9 rounded-xl text-[12.5px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60",
                        plan.ctaStyle,
                      )}
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          {plan.cta}
                          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 h-px bg-zinc-100 dark:bg-white/[0.05]" />

                  {/* Features */}
                  <div className="p-5 pt-4 bg-white dark:bg-[#111] flex-1">
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-[16px] h-[16px] rounded-full flex items-center justify-center shrink-0 mt-[1px]",
                              f.included
                                ? f.highlight
                                  ? "bg-primary/15 dark:bg-primary/20"
                                  : "bg-emerald-50 dark:bg-emerald-950/30"
                                : "bg-zinc-100 dark:bg-zinc-800/50",
                            )}
                          >
                            {f.included ? (
                              <Check
                                size={9}
                                strokeWidth={2.5}
                                className={f.highlight ? "text-primary" : "text-emerald-500 dark:text-emerald-400"}
                              />
                            ) : (
                              <span className="w-[5px] h-[1.5px] bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[11.5px] leading-snug",
                              f.included
                                ? f.highlight
                                  ? "text-zinc-900 dark:text-white font-semibold"
                                  : "text-zinc-700 dark:text-zinc-300 font-medium"
                                : "text-zinc-400 dark:text-zinc-600 font-medium",
                            )}
                          >
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                onOpenChange(false);
                router.push("/dashboard/plans");
              }}
              className="text-[12px] text-zinc-400 dark:text-zinc-500 hover:text-primary dark:hover:text-primary transition-colors font-medium"
            >
              Ver todos os planos e comparar →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to detect if an error message is a plan-limit error (from 403 responses).
 */
export function isPlanLimitError(errorMessage: string): boolean {
  return errorMessage.includes("Faça upgrade") || errorMessage.includes("Limite de");
}
