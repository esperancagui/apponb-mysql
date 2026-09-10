"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  Sparkles,
  Building2,
  Zap,
  Users,
  FileText,
  BrainCircuit,
  Palette,
  Infinity,
  ArrowRight,
  Crown,
  Star,
  Shield,
  Layers,
  MessageSquare,
  Globe,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { billingService } from "@/app/lib/services/billingService";
import { toast } from "sonner";
import type { BillingSubscription } from "@/app/lib/types";

// ── Plan data ─────────────────────────────────────────────────

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNote: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  features: PlanFeature[];
  cta: string;
  ctaVariant: "default" | "primary" | "premium";
  popular?: boolean;
  badge?: string;
  badgeColor?: string;
}

const plans: Plan[] = [
  {
    id: "trial",
    name: "Teste Grátis",
    description: "Experimente os recursos do Pro por 15 dias.",
    price: "R$ 0",
    priceNote: "por 15 dias",
    icon: Zap,
    iconColor: "#6366f1",
    iconBg: "#6366f118",
    badge: "Teste grátis",
    badgeColor: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    features: [
      { text: "3 workspaces", included: true },
      { text: "Formulários ilimitados", included: true },
      { text: "2.000 respostas/mês", included: true },
      { text: "5 membros na equipe", included: true },
      { text: "Todos os templates", included: true },
      { text: "10 GB de armazenamento", included: true },
      { text: "IA — Análise de briefing (texto)", included: true },
      { text: "IA — Análise de imagens", included: false },
      { text: "IA — Análise de documentos", included: false },
      { text: "Branding personalizado (com badge onb.)", included: true },
      { text: "Suporte padrão", included: false },
    ],
    cta: "Começar teste grátis",
    ctaVariant: "primary" as const,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para profissionais que querem escalar.",
    price: "R$ 59,90",
    priceNote: "/mês",
    icon: Crown,
    iconColor: "#0ea5e9",
    iconBg: "#0ea5e918",
    popular: true,
    badge: "Recomendado",
    badgeColor:
      "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
    features: [
      { text: "3 workspaces", included: true },
      { text: "Formulários ilimitados", included: true, highlight: true },
      { text: "2.000 respostas/mês", included: true, highlight: true },
      { text: "5 membros na equipe", included: true },
      { text: "Todos os templates", included: true },
      { text: "10 GB de armazenamento", included: true },
      { text: "IA — Análise de briefing (texto)", included: true, highlight: true },
      { text: "IA — Análise de imagens", included: false },
      { text: "IA — Análise de documentos", included: false },
      { text: "Branding personalizado (com badge onb.)", included: true },
      { text: "Suporte padrão", included: true },
    ],
    cta: "Fazer upgrade",
    ctaVariant: "primary",
  },
  {
    id: "agency",
    name: "Agency",
    description: "Para agências e equipes avançadas.",
    price: "R$ 149,90",
    priceNote: "/mês",
    icon: Building2,
    iconColor: "#f59e0b",
    iconBg: "#f59e0b18",
    badge: "Mais completo",
    badgeColor:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    features: [
      { text: "Workspaces ilimitados", included: true, highlight: true },
      { text: "Formulários ilimitados", included: true },
      { text: "Respostas ilimitadas", included: true, highlight: true },
      { text: "Membros ilimitados", included: true, highlight: true },
      { text: "Todos os templates", included: true },
      { text: "100 GB de armazenamento", included: true, highlight: true },
      { text: "IA — Análise de briefing (texto)", included: true },
      { text: "IA — Análise de imagens (modelo avançado)", included: true, highlight: true },
      { text: "IA — Análise de documentos (PDF, planilhas, etc.)", included: true, highlight: true },
      { text: "White-label completo", included: true, highlight: true },
      { text: "Suporte prioritário 24/7", included: true },
    ],
    cta: "Fazer upgrade",
    ctaVariant: "premium",
  },
];

// ── Page ──────────────────────────────────────────────────────

export default function PlansPage() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    billingService.getSubscription().then(setSub).catch(() => {});
  }, []);

  const currentPlan = sub?.plan ?? "free";
  const hasSubscription = currentPlan !== "free" && !!sub?.subscription_status;

  const handleCta = async (planId: string) => {
    if (planId === "trial") {
      // Trial maps to basic
      setCheckoutLoading("trial");
      try {
        await billingService.createCheckoutSession("basic");
      } catch (e: any) {
        toast.error(e.message || "Erro ao iniciar checkout.");
        setCheckoutLoading(null);
      }
      return;
    }

    if (hasSubscription) {
      setPortalLoading(true);
      try {
        await billingService.createPortalSession();
      } catch (e: any) {
        toast.error(e.message || "Erro ao abrir portal.");
        setPortalLoading(false);
      }
      return;
    }

    const plan = planId === "pro" ? "basic" : "premium";
    setCheckoutLoading(planId);
    try {
      await billingService.createCheckoutSession(plan);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar checkout.");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-full px-5 md:px-8 py-10 max-w-[1100px] mx-auto">
      {/* ── Header ── */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/[0.08] dark:bg-primary/[0.12] mb-4">
          <Sparkles size={13} className="text-primary" />
          <span className="text-[11.5px] font-bold text-primary uppercase tracking-wider">
            Planos & Preços
          </span>
        </div>
        <h1 className="text-[28px] md:text-[34px] font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
          Escolha o plano ideal
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {" "}para o seu negócio
          </span>
        </h1>
        <p className="text-[14px] md:text-[15px] text-zinc-500 dark:text-zinc-400 mt-3 max-w-md mx-auto leading-relaxed">
          Teste grátis de 15 dias com acesso completo ao plano Pro. Sem surpresas, cancele quando quiser.
        </p>
      </div>

      {/* ── Plan cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-start">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isHovered = hoveredPlan === plan.id;
          const planStripeName = plan.id === "pro" ? "basic" : plan.id === "agency" ? "premium" : null;
          const isCurrentPlan = planStripeName === currentPlan || (plan.id === "trial" && currentPlan === "free");
          const isLoading = checkoutLoading === plan.id || (plan.id !== "trial" && portalLoading && hasSubscription);

          return (
            <div
              key={plan.id}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={cn(
                "relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden group",
                plan.popular
                  ? "border-primary/30 dark:border-primary/20 shadow-[0_4px_32px_-8px_rgba(14,165,233,0.15)] dark:shadow-[0_4px_32px_-8px_rgba(14,165,233,0.08)]"
                  : "border-zinc-200/70 dark:border-white/[0.06] shadow-sm",
                isHovered && "scale-[1.015] shadow-xl dark:shadow-2xl",
              )}
            >
              {/* Popular glow effect */}
              {plan.popular && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent dark:from-primary/[0.06] pointer-events-none" />
              )}

              {/* Card content */}
              <div className="relative p-6 pb-4 bg-white dark:bg-[#111]">
                {/* Badge */}
                {plan.badge && (
                  <span
                    className={cn(
                      "absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                      plan.badgeColor,
                    )}
                  >
                    {plan.badge}
                  </span>
                )}

                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: plan.iconBg, border: `1px solid ${plan.iconColor}20` }}
                >
                  <Icon size={20} style={{ color: plan.iconColor }} strokeWidth={1.8} />
                </div>

                {/* Name & description */}
                <h3 className="text-[18px] font-bold text-zinc-900 dark:text-white mb-1">
                  {plan.name}
                </h3>
                <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-5">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-[32px] font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none">
                    {plan.price}
                  </span>
                  <span className="text-[13px] text-zinc-400 dark:text-zinc-500 font-medium">
                    {plan.priceNote}
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleCta(plan.id)}
                  disabled={plan.ctaVariant === "default" || isLoading}
                  className={cn(
                    "w-full h-10 rounded-xl text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                    isCurrentPlan && plan.id !== "trial"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 cursor-default"
                      : plan.ctaVariant === "default"
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-default"
                        : plan.ctaVariant === "primary"
                          ? "bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-md shadow-primary/20 disabled:opacity-60"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] shadow-md shadow-amber-500/20 disabled:opacity-60",
                  )}
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isCurrentPlan && plan.id !== "trial" ? (
                    "Plano atual"
                  ) : hasSubscription && plan.id !== "trial" ? (
                    <>Gerenciar <ArrowRight size={14} /></>
                  ) : (
                    <>
                      {plan.cta}
                      {plan.ctaVariant !== "default" && (
                        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      )}
                    </>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="mx-6 h-px bg-zinc-100 dark:bg-white/[0.05]" />

              {/* Features */}
              <div className="relative p-6 pt-5 bg-white dark:bg-[#111] flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-3">
                  O que está incluído
                </p>
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-[1px] transition-colors",
                          feature.included
                            ? feature.highlight
                              ? "bg-primary/15 dark:bg-primary/20"
                              : "bg-emerald-50 dark:bg-emerald-950/30"
                            : "bg-zinc-100 dark:bg-zinc-800/50",
                        )}
                      >
                        {feature.included ? (
                          <Check
                            size={10}
                            strokeWidth={2.5}
                            className={cn(
                              feature.highlight
                                ? "text-primary"
                                : "text-emerald-500 dark:text-emerald-400",
                            )}
                          />
                        ) : (
                          <span className="w-[6px] h-[1.5px] bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[12.5px] leading-snug",
                          feature.included
                            ? feature.highlight
                              ? "text-zinc-900 dark:text-white font-semibold"
                              : "text-zinc-700 dark:text-zinc-300 font-medium"
                            : "text-zinc-400 dark:text-zinc-600 font-medium",
                        )}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom note ── */}
      <div className="mt-10 text-center">
        <p className="text-[12px] text-zinc-400 dark:text-zinc-600 leading-relaxed max-w-lg mx-auto">
          Todos os planos incluem SSL, backups automáticos e suporte por e-mail.
          <br />
          Precisa de algo personalizado?{" "}
          <button className="text-primary font-semibold hover:underline">
            Entre em contato
          </button>
        </p>
      </div>
    </div>
  );
}
