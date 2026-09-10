"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  PauseCircle,
  Receipt,
  Shield,
  Sparkles,
  Star,
  Trash2,
  UserCircle,
  XCircle,
  Zap,
} from "lucide-react";
import { updateProfile as firebaseUpdateProfile } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth, useWorkspace } from "@/app/contexts";
import { userService } from "@/app/lib/services";
import { billingService } from "@/app/lib/services/billingService";
import { uploadAvatarImage } from "@/app/lib/services/storageService";
import ImageCropModal from "@/app/components/ui/ImageCropModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { BillingSubscription, Invoice, PlanTier, UserProfile } from "@/app/lib/types";

// ─── Constants ────────────────────────────────────────────────

const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Gratuito",
  basic: "Pro",
  premium: "Agency",
};

const PLAN_ICONS: Record<PlanTier, React.ReactNode> = {
  free: <Lock size={10} />,
  basic: <Zap size={10} />,
  premium: <Star size={10} />,
};

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  free: [
    "Até 3 formulários ativos",
    "100 respostas por mês",
    "Análise básica de IA",
    "Relatórios em PDF",
  ],
  basic: [
    "Formulários ilimitados",
    "1.000 respostas por mês",
    "Análise avançada de IA",
    "Relatórios em PDF",
    "Suporte por e-mail",
  ],
  premium: [
    "Tudo do Pro",
    "Respostas ilimitadas",
    "White-label (sem marca onb.)",
    "Múltiplos workspaces",
    "Suporte prioritário",
  ],
};

const PLAN_BADGE: Record<
  PlanTier,
  { bg: string; text: string; border: string; dot: string }
> = {
  free: {
    bg: "bg-zinc-100 dark:bg-zinc-800/60",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
    dot: "bg-zinc-400",
  },
  basic: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/40",
    dot: "bg-blue-500",
  },
  premium: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/40",
    dot: "bg-amber-500",
  },
};

const PLAN_GRADIENT: Record<PlanTier, string> = {
  free: "from-zinc-100/70 to-zinc-50/30 dark:from-zinc-800/30 dark:to-transparent",
  basic: "from-blue-50 to-white dark:from-blue-950/25 dark:to-transparent",
  premium: "from-amber-50 to-white dark:from-amber-950/25 dark:to-transparent",
};

const PLAN_ICON_COLOR: Record<PlanTier, string> = {
  free: "text-zinc-500 dark:text-zinc-400",
  basic: "text-blue-500 dark:text-blue-400",
  premium: "text-amber-500 dark:text-amber-400",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  owner:
    "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30",
  admin:
    "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/30",
  member:
    "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700",
  viewer:
    "text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700",
};

const NAV_ITEMS = [
  { id: "perfil", num: "01", label: "Perfil", sub: "Foto · Nome" },
  { id: "seguranca", num: "02", label: "Segurança", sub: "Senha · Notif." },
  { id: "plano", num: "03", label: "Plano", sub: "Assinatura · Uso" },
  { id: "conta", num: "04", label: "Conta", sub: "Dados · Opções" },
];

// ─── Shared components ────────────────────────────────────────

/** Label for subsections */
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
      {children}
    </p>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[148px_1fr] gap-2 md:gap-6 items-start py-4 border-b border-zinc-100 dark:border-white/[0.05] last:border-0">
      <div className="pt-[3px]">
        <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {hint && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed">
            {hint}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 pb-4 border-b border-zinc-100 dark:border-white/[0.05]">
      <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PlanBadge({ plan }: { plan: PlanTier }) {
  const a = PLAN_BADGE[plan];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase",
        a.bg,
        a.text,
        a.border,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.dot)} />
      {PLAN_LABELS[plan]}
    </span>
  );
}

function Field({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full text-[13px] text-zinc-900 dark:text-zinc-100",
        "bg-white dark:bg-[#1A1A1A]",
        "border border-zinc-200 dark:border-white/10 rounded-lg px-3 h-9",
        "placeholder:text-zinc-300 dark:placeholder:text-zinc-600",
        "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
        "disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
        className,
      )}
    />
  );
}

// ─── Plan Section ──────────────────────────────────────────────

const PLAN_ACCENT: Record<PlanTier, string> = {
  free:    "#71717a",
  basic:   "#0ea5e9",
  premium: "#d97706",
};

const PLAN_PRICE: Record<PlanTier, string> = {
  free:    "Grátis",
  basic:   "R$\u200b59,90",
  premium: "R$\u200b149,90",
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  active:     { label: "Ativo",              color: "#10b981" },
  trialing:   { label: "Em teste",           color: "#0ea5e9" },
  past_due:   { label: "Pag. pendente",      color: "#f59e0b" },
  canceled:   { label: "Cancelado",          color: "#71717a" },
  incomplete: { label: "Incompleto",         color: "#ef4444" },
};

function planFmt(ts: string | number | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function planCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

interface PlanSectionProps {
  currentPlan: PlanTier;
  subStatus?: string;
  trialDaysLeft: number | null;
  periodEnd: Date | null;
  billingData: BillingSubscription | null;
  invoices: Invoice[];
  billingLoading: boolean;
  portalLoading: boolean;
  checkoutLoading: string | null;
  onPortal: () => void;
  onCheckout: (plan: "basic" | "premium") => void;
  workspaces: any[];
  currentUser: any;
}

function PlanSection({
  currentPlan,
  subStatus,
  trialDaysLeft,
  periodEnd,
  billingData,
  invoices,
  billingLoading,
  portalLoading,
  checkoutLoading,
  onPortal,
  onCheckout,
  workspaces,
  currentUser,
}: PlanSectionProps) {
  const accent = PLAN_ACCENT[currentPlan];
  const isPaid = currentPlan !== "free";
  const statusCfg = subStatus ? STATUS_CFG[subStatus] : null;
  const trialPct  = trialDaysLeft != null ? Math.max(2, Math.round((trialDaysLeft / 15) * 100)) : 0;

  return (
    <div className="plan-section">
      <style>{`
        /* ── light mode defaults ── */
        .plan-section {
          --pa: ${accent};

          --ps-card:      #f8f8f8;
          --ps-card-bd:   color-mix(in srgb, ${accent} 18%, #e4e4e7);
          --ps-fg:        #09090b;
          --ps-fg-70:     rgba(9,9,11,0.70);
          --ps-fg-50:     rgba(9,9,11,0.50);
          --ps-fg-40:     rgba(9,9,11,0.40);
          --ps-fg-30:     rgba(9,9,11,0.28);
          --ps-fg-wm:     rgba(9,9,11,0.05);
          --ps-muted:     rgba(9,9,11,0.07);
          --ps-divider:   rgba(9,9,11,0.08);

          --badge-bg:     #f4f4f5;
          --upgrade-bg:   #ffffff;
        }

        /* ── dark mode overrides ── */
        .dark .plan-section,
        @media (prefers-color-scheme: dark) { .plan-section } {
          --ps-card:      #09090b;
          --ps-card-bd:   color-mix(in srgb, ${accent} 22%, transparent);
          --ps-fg:        #ffffff;
          --ps-fg-70:     rgba(255,255,255,0.70);
          --ps-fg-50:     rgba(255,255,255,0.50);
          --ps-fg-40:     rgba(255,255,255,0.40);
          --ps-fg-30:     rgba(255,255,255,0.28);
          --ps-fg-wm:     rgba(255,255,255,0.04);
          --ps-muted:     rgba(255,255,255,0.10);
          --ps-divider:   rgba(255,255,255,0.07);

          --badge-bg:     #18181b;
          --upgrade-bg:   #111111;
        }

        .dark .plan-section {
          --ps-card:      #09090b;
          --ps-card-bd:   color-mix(in srgb, ${accent} 22%, transparent);
          --ps-fg:        #ffffff;
          --ps-fg-70:     rgba(255,255,255,0.70);
          --ps-fg-50:     rgba(255,255,255,0.50);
          --ps-fg-40:     rgba(255,255,255,0.40);
          --ps-fg-30:     rgba(255,255,255,0.28);
          --ps-fg-wm:     rgba(255,255,255,0.04);
          --ps-muted:     rgba(255,255,255,0.10);
          --ps-divider:   rgba(255,255,255,0.07);

          --badge-bg:     #18181b;
          --upgrade-bg:   #111111;
        }

        @keyframes plan-in {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        .plan-animate  { animation: plan-in 0.35s ease both; }
        .plan-animate-1 { animation: plan-in 0.35s 0.05s ease both; }
        .plan-animate-2 { animation: plan-in 0.35s 0.10s ease both; }
        .plan-animate-3 { animation: plan-in 0.35s 0.15s ease both; }
        .plan-animate-4 { animation: plan-in 0.35s 0.20s ease both; }
        .plan-row-hover { transition: background 0.15s; }
        .plan-row-hover:hover { background: color-mix(in srgb, var(--pa) 4%, transparent); }
      `}</style>

      {/* ── Trial expired alert ── */}
      {subStatus === "trialing" && trialDaysLeft === 0 && (
        <div className="mx-6 mt-5 plan-animate flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: "color-mix(in srgb, #6366f1 8%, transparent)", border: "1px solid color-mix(in srgb, #6366f1 20%, transparent)" }}>
          <Clock size={13} className="shrink-0" style={{ color: "#6366f1" }} />
          <p className="flex-1 text-[12px] font-medium" style={{ color: "var(--ps-fg-70)" }}>
            Seu período de teste gratuito encerrou. Assine para continuar com acesso completo.
          </p>
        </div>
      )}

      {/* ── Past-due alert ── */}
      {subStatus === "past_due" && (
        <div className="mx-6 mt-5 plan-animate flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <AlertTriangle size={13} className="shrink-0" style={{ color: "#d97706" }} />
          <p className="flex-1 text-[12px] font-medium" style={{ color: "#92400e" }}>
            Há um problema com seu pagamento — atualize para manter o acesso.
          </p>
          <button onClick={onPortal} disabled={portalLoading}
            className="shrink-0 text-[11.5px] font-bold underline-offset-2 hover:underline disabled:opacity-50"
            style={{ color: "#b45309" }}>
            {portalLoading ? <Loader2 size={11} className="animate-spin inline" /> : "Resolver →"}
          </button>
        </div>
      )}

      <div className="px-6 pt-5 pb-6 space-y-6">

        {/* ════ PLAN IDENTITY BLOCK ════ */}
        <div className="plan-animate relative overflow-hidden rounded-2xl"
          style={{
            background: "var(--ps-card)",
            border: "1px solid var(--ps-card-bd)",
          }}>

          {/* Noise texture via SVG filter */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.035]" aria-hidden>
            <filter id="pnoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
              <feColorMatrix type="saturate" values="0"/>
            </filter>
            <rect width="100%" height="100%" filter="url(#pnoise)"/>
          </svg>

          {/* Accent top-line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 0%, transparent) 70%)` }}/>

          {/* Large watermark name */}
          <div className="absolute right-[-12px] bottom-[-20px] select-none pointer-events-none overflow-hidden"
            style={{ lineHeight: 1 }}>
            <span className="font-black uppercase"
              style={{ fontSize: "clamp(64px, 14vw, 110px)", letterSpacing: "-0.04em", color: "var(--ps-fg-wm)" }}>
              {PLAN_LABELS[currentPlan]}
            </span>
          </div>

          <div className="relative p-5">
            {/* Top row: label + status pill */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase"
                style={{ color: "var(--ps-fg-40)" }}>
                onb. — assinatura
              </p>
              {statusCfg && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${statusCfg.color} 14%, transparent)`,
                    color: statusCfg.color,
                    border: `1px solid color-mix(in srgb, ${statusCfg.color} 30%, transparent)`,
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: statusCfg.color }}/>
                  {statusCfg.label}
                </span>
              )}
            </div>

            {/* Plan name + price */}
            <div className="flex items-end justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                {currentPlan === "free"    && <Lock    size={20} style={{ color: accent }} strokeWidth={1.5}/>}
                {currentPlan === "basic"   && <Crown   size={20} style={{ color: accent }} strokeWidth={1.5}/>}
                {currentPlan === "premium" && <Star    size={20} style={{ color: accent }} strokeWidth={1.5}/>}
                <h3 className="font-black tracking-tight leading-none"
                  style={{ fontSize: 28, color: "var(--ps-fg)" }}>
                  {PLAN_LABELS[currentPlan]}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold leading-none"
                  style={{ fontSize: 20, color: "var(--ps-fg)" }}>
                  {PLAN_PRICE[currentPlan]}
                </span>
                {isPaid && (
                  <span className="block text-[10px] mt-0.5 font-mono" style={{ color: "var(--ps-fg-40)" }}>/mês</span>
                )}
              </div>
            </div>

            {/* Trial progress */}
            {subStatus === "trialing" && trialDaysLeft != null && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--ps-fg-50)" }}>Período de avaliação</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: accent }}>
                    {trialDaysLeft}d restantes
                  </span>
                </div>
                <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--ps-muted)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${trialPct}%`, background: accent }}/>
                </div>
              </div>
            )}

            {/* Renewal / action row */}
            <div className="flex items-center justify-between pt-4"
              style={{ borderTop: "1px solid var(--ps-divider)" }}>
              {periodEnd && (
                <p className="text-[11px] font-mono" style={{ color: "var(--ps-fg-40)" }}>
                  {subStatus === "trialing" ? "Cobra em" : "Renova em"}{" "}
                  <span className="font-semibold" style={{ color: "var(--ps-fg-70)" }}>
                    {periodEnd.toLocaleDateString("pt-BR")}
                  </span>
                </p>
              )}
              {!periodEnd && !isPaid && subStatus !== "trialing" && (
                <p className="text-[11px]" style={{ color: "var(--ps-fg-30)" }}>Sem cobrança recorrente</p>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {isPaid ? (
                  <button onClick={onPortal} disabled={portalLoading}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                      color: accent,
                      border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
                    }}>
                    {portalLoading
                      ? <Loader2 size={11} className="animate-spin"/>
                      : <ExternalLink size={11}/>}
                    Gerenciar
                  </button>
                ) : (
                  <button onClick={() => onCheckout("basic")} disabled={!!checkoutLoading}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: `color-mix(in srgb, ${PLAN_ACCENT.basic} 18%, transparent)`,
                      color: PLAN_ACCENT.basic,
                      border: `1px solid color-mix(in srgb, ${PLAN_ACCENT.basic} 28%, transparent)`,
                    }}>
                    {checkoutLoading === "basic"
                      ? <Loader2 size={11} className="animate-spin"/>
                      : <Sparkles size={11}/>}
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════ BILLING STATS ════ */}
        {isPaid && (
          <div className="plan-animate-1 grid grid-cols-3 divide-x divide-zinc-100 dark:divide-white/[0.06] rounded-xl border border-zinc-100 dark:border-white/[0.06] overflow-hidden">
            {[
              {
                label: "Status",
                value: statusCfg?.label ?? "—",
                valueStyle: { color: statusCfg?.color },
              },
              {
                label: "Próx. cobrança",
                value: periodEnd ? periodEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—",
              },
              {
                label: "Método",
                value: "Gerenciar",
                isAction: true,
              },
            ].map((cell) => (
              <div key={cell.label}
                className={cn("px-4 py-3.5 flex flex-col gap-1", cell.isAction ? "plan-row-hover cursor-pointer" : "")}
                onClick={cell.isAction ? onPortal : undefined}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {cell.label}
                </p>
                {cell.isAction ? (
                  <p className="text-[12.5px] font-semibold flex items-center gap-1"
                    style={{ color: accent }}>
                    {portalLoading
                      ? <Loader2 size={11} className="animate-spin"/>
                      : <ExternalLink size={11}/>}
                    {cell.value}
                  </p>
                ) : (
                  <p className="text-[12.5px] font-semibold text-zinc-900 dark:text-white font-mono"
                    style={cell.valueStyle as React.CSSProperties}>
                    {cell.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════ FEATURES ════ */}
        <div className="plan-animate-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-2.5">
            Incluído no plano
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_FEATURES[currentPlan].map((f) => (
              <span key={f}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-md"
                style={{
                  background: `color-mix(in srgb, ${accent} 6%, var(--badge-bg, #f4f4f5))`,
                  color: `color-mix(in srgb, ${accent} 60%, #3f3f46)`,
                  border: `1px solid color-mix(in srgb, ${accent} 15%, transparent)`,
                }}>
                <Check size={9} strokeWidth={3} style={{ color: accent }}/>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ════ INVOICES ════ */}
        <div className="plan-animate-2">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              Faturas
            </p>
            {isPaid && (
              <button onClick={onPortal} disabled={portalLoading}
                className="text-[10.5px] font-semibold hover:underline underline-offset-2 flex items-center gap-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                Portal de cobrança <ExternalLink size={9}/>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-zinc-100 dark:border-white/[0.06] overflow-hidden">
            {billingLoading ? (
              <div className="flex items-center justify-center py-7">
                <Loader2 size={15} className="animate-spin text-zinc-300 dark:text-zinc-600"/>
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-7 text-center">
                <Receipt size={18} className="mx-auto mb-2 text-zinc-200 dark:text-zinc-700"/>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                  {isPaid ? "Nenhuma fatura ainda." : "Sem histórico de faturamento."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/[0.05]">
                    {["Data", "Descrição", "Valor", ""].map((h) => (
                      <th key={h}
                        className="px-4 py-2 text-[9.5px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 bg-zinc-50/60 dark:bg-white/[0.02]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="plan-row-hover group">
                      <td className="px-4 py-3 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {planFmt(inv.date)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zinc-700 dark:text-zinc-300 max-w-[140px] truncate">
                        {inv.description || "Assinatura onb."}
                        <span className={cn(
                          "ml-2 text-[9.5px] font-bold uppercase tracking-wide align-middle",
                          inv.status === "paid" ? "text-emerald-500" : inv.status === "open" ? "text-amber-500" : "text-zinc-400"
                        )}>
                          {inv.status === "paid" ? "pago" : inv.status === "open" ? "pendente" : inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                        {planCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.pdf_url && (
                          <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Baixar PDF">
                            <Download size={11}/>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ════ UPGRADE CARDS ════ */}
        {currentPlan !== "premium" && (
          <div className="plan-animate-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-2.5">
              {currentPlan === "free"
                ? subStatus === "trialing" && (trialDaysLeft ?? 0) > 0
                  ? "Assinar agora — mantenha o acesso completo"
                  : subStatus === "trialing" && trialDaysLeft === 0
                    ? "Teste encerrado — escolha um plano"
                    : "Começar agora"
                : "Evoluir para Agency"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(currentPlan === "free" ? ["basic", "premium"] as PlanTier[] : ["premium"] as PlanTier[]).map((tier) => {
                const tAccent = PLAN_ACCENT[tier];
                const isLoading = checkoutLoading === tier;
                return (
                  <button key={tier}
                    onClick={() => onCheckout(tier as "basic" | "premium")}
                    disabled={!!checkoutLoading}
                    className="group relative text-left rounded-xl p-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 overflow-hidden"
                    style={{
                      background: `color-mix(in srgb, ${tAccent} 5%, var(--upgrade-bg, white))`,
                      border: `1px solid color-mix(in srgb, ${tAccent} 20%, transparent)`,
                    }}>
                    {/* Hover fill */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                      style={{ background: `color-mix(in srgb, ${tAccent} 5%, transparent)` }}/>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {tier === "basic"   && <Crown size={15} style={{ color: tAccent }} strokeWidth={1.8}/>}
                          {tier === "premium" && <Star  size={15} style={{ color: tAccent }} strokeWidth={1.8}/>}
                          <span className="text-[13px] font-bold text-zinc-900 dark:text-white">
                            {PLAN_LABELS[tier]}
                          </span>
                        </div>
                        {isLoading
                          ? <Loader2 size={13} className="animate-spin" style={{ color: tAccent }}/>
                          : <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" style={{ color: tAccent }}/>
                        }
                      </div>
                      <p className="font-mono font-black text-zinc-900 dark:text-white leading-none"
                        style={{ fontSize: 18 }}>
                        {PLAN_PRICE[tier]}
                        <span className="text-[11px] font-mono font-medium text-zinc-400 dark:text-zinc-500 ml-1">/mês</span>
                      </p>
                      <p className="text-[10.5px] mt-1.5" style={{ color: tAccent }}>
                        {tier === "basic"   ? "Formulários ilimitados · Análise de IA" : "Workspaces ilimitados · White-label"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center">
              <button onClick={() => window.location.href = "/dashboard/plans"}
                className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors underline-offset-2 hover:underline">
                Comparar todos os planos →
              </button>
            </p>
          </div>
        )}

        {/* ════ MANAGE / CANCEL FOOTER (paid) ════ */}
        {isPaid && (
          <div className="plan-animate-4 flex items-center justify-between pt-4"
            style={{ borderTop: "1px solid", borderColor: "color-mix(in srgb, currentColor 8%, transparent)" }}>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Gerencie cartão, NF e cancelamento pelo portal Stripe.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={onPortal} disabled={portalLoading}
                className="flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40">
                {portalLoading ? <Loader2 size={11} className="animate-spin"/> : <ExternalLink size={11}/>}
                Portal
              </button>
              <button onClick={onPortal} disabled={portalLoading}
                className="text-[11.5px] font-semibold text-red-400 hover:text-red-500 transition-colors disabled:opacity-40">
                Cancelar plano
              </button>
            </div>
          </div>
        )}

        {/* ════ WORKSPACES ════ */}
        {workspaces.length > 0 && (
          <div className="plan-animate-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-2.5">
              Workspaces ({workspaces.length})
            </p>
            <div className="space-y-1.5">
              {workspaces.map((ws: any) => {
                const brandColor = ws.brandColor || "#6366f1";
                const memberEntry = (
                  ws.members as unknown as Array<{ uid?: string; id?: string; role?: string }> ?? []
                ).find((m) => m.uid === currentUser?.uid || m.id === currentUser?.uid);
                const role = memberEntry?.role ?? "member";
                return (
                  <div key={ws.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-zinc-100 dark:border-white/[0.05] hover:border-zinc-200 dark:hover:border-white/[0.09] transition-colors bg-white dark:bg-[#111]">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ background: brandColor + "18", border: `1px solid ${brandColor}28` }}>
                      {ws.logoUrl
                        ? <img src={ws.logoUrl} alt="" className="w-full h-full object-contain"/>
                        : <span className="text-[10px] font-bold" style={{ color: brandColor }}>{ws.name[0].toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                        {ws.name}
                      </p>
                      <p className="text-[10.5px] text-zinc-400 dark:text-zinc-600 truncate font-mono">{ws.slug}</p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0",
                      ROLE_COLORS[role] ?? ROLE_COLORS.member)}>
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ProfilePage() {
  const { currentUser, signOut } = useAuth();
  const { workspaces, activeWorkspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const VALID_SECTIONS = ["perfil", "seguranca", "plano", "conta"];
  const sectionParam = searchParams.get("section") ?? "";
  const [activeSection, setActiveSection] = useState(
    VALID_SECTIONS.includes(sectionParam) ? sectionParam : "perfil"
  );

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Crop modal state
  const [cropSrc, setCropSrc] = useState("");
  const [showCropModal, setShowCropModal] = useState(false);

  // Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [language, setLanguage] = useState("pt-BR");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Account management state
  const [isPausing, setIsPausing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Billing state
  const [billingData, setBillingData] = useState<BillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const isEmailProvider = currentUser?.providerData.some(
    (p) => p.providerId === "password",
  );

  useEffect(() => {
    setDisplayName(currentUser?.displayName ?? "");
    setAvatarPreview(currentUser?.photoURL ?? "");
    userService.getUserProfile().then((p) => {
      if (!p) return;
      setProfile(p);
      if (p.display_name) setDisplayName(p.display_name);
      if (p.photo_url) setAvatarPreview(p.photo_url);
      if (p.email_notifications !== undefined)
        setEmailNotifications(p.email_notifications);
      if (p.language) setLanguage(p.language);
    });
  }, [currentUser]);

  useEffect(() => {
    if (activeSection !== "plano") return;
    setBillingLoading(true);
    Promise.all([
      billingService.getSubscription().catch(() => null),
      billingService.getInvoices().catch(() => []),
    ]).then(([sub, inv]) => {
      if (sub) setBillingData(sub);
      setInvoices(inv);
      setBillingLoading(false);
    });
  }, [activeSection]);

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      await billingService.createPortalSession();
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir portal de gerenciamento.");
      setPortalLoading(false);
    }
  };

  const handleCheckout = async (plan: "basic" | "premium") => {
    setCheckoutLoading(plan);
    try {
      await billingService.createCheckoutSession(plan);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar checkout.");
      setCheckoutLoading(null);
    }
  };

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setShowCropModal(true);
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  }

  function handleCropConfirm(croppedFile: File) {
    setAvatarPreview(URL.createObjectURL(croppedFile));
    setAvatarFile(croppedFile);
    setShowCropModal(false);
    setCropSrc("");
  }

  function handleCropCancel() {
    setShowCropModal(false);
    setCropSrc("");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      let photoUrl = profile?.photo_url || currentUser.photoURL || "";
      if (avatarFile)
        photoUrl = await uploadAvatarImage(avatarFile, currentUser.uid);
      await firebaseUpdateProfile(auth.currentUser!, {
        displayName: displayName.trim() || null,
        photoURL: photoUrl || null,
      });
      await userService.updateProfile({
        display_name: displayName.trim() || undefined,
        photo_url: photoUrl || undefined,
      });
      await auth.currentUser?.reload();
      setAvatarFile(null);
      toast.success("Perfil atualizado!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar perfil.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSavePreferences() {
    setIsSavingPrefs(true);
    try {
      await userService.updatePreferences({
        email_notifications: emailNotifications,
        language,
      });
      toast.success("Preferências salvas!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar preferências.",
      );
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const {
        EmailAuthProvider,
        reauthenticateWithCredential,
        updatePassword,
      } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(
        currentUser!.email!,
        currentPassword,
      );
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await updatePassword(auth.currentUser!, newPassword);
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        toast.error("Senha atual incorreta.");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Erro ao alterar senha.",
        );
      }
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handlePauseAccount() {
    setIsPausing(true);
    try {
      await userService.pauseAccount();
      await signOut();
      // Hard redirect: bypasses Next.js router cache and ensures the
      // middleware sees a fresh request without the __session cookie.
      window.location.href = "/login";
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao pausar conta.",
      );
      setIsPausing(false);
    }
  }

  async function handleDeleteAccount() {
    if (confirmEmail !== currentUser?.email) {
      toast.error("O e-mail digitado não confere.");
      return;
    }
    setIsDeleting(true);
    try {
      await userService.deleteAccount();
      await signOut();
      toast.success("Conta excluída.");
      window.location.href = "/login";
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao excluir conta.",
      );
      setIsDeleting(false);
    }
  }

  async function handleExportData() {
    setIsExporting(true);
    try {
      await userService.requestDataExport();
      toast.success("Solicitação enviada! Você receberá seus dados por e-mail em breve.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao solicitar exportação.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  const currentPlan: PlanTier = (profile?.plan as PlanTier) ?? "free";
  const subStatus = profile?.subscription_status;
  const trialEnd = profile?.trial_end ? new Date(profile.trial_end) : null;
  const periodEnd = profile?.current_period_end ? new Date(profile.current_period_end) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const avatarSrc =
    avatarPreview ||
    `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
      currentUser?.email ?? "user",
    )}&backgroundColor=transparent`;

  // ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-5 md:px-8 py-8 max-w-[860px] mx-auto">

      {/* ── Hero card ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-[60px] h-[60px] rounded-full overflow-hidden ring-2 ring-white dark:ring-[#111] shadow-sm bg-zinc-100 dark:bg-zinc-800">
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
            >
              <Camera size={14} className="text-white" strokeWidth={2} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
            {avatarFile && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111] flex items-center justify-center">
                <Check size={8} className="text-white" strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate leading-tight">
              {displayName ||
                currentUser?.email?.split("@")[0] ||
                "Meu Perfil"}
            </p>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
              {currentUser?.email}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <PlanBadge plan={currentPlan} />
              <span className="text-[11px] text-zinc-300 dark:text-zinc-700">
                ·
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {workspaces.length} workspace
                {workspaces.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Split layout ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Mobile tab strip ── */}
        <div className="md:hidden -mx-5 px-5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 w-max pb-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sidebar nav ── */}
        <nav className="shrink-0 w-[148px] sticky top-8 hidden md:block">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "relative w-full text-left pl-3 pr-3 py-2.5 rounded-xl transition-all duration-150",
                    isActive
                      ? "bg-primary/[0.06] dark:bg-primary/[0.08]"
                      : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
                  )}
                >
                  {/* Small centered pip — not a full-height border */}
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full transition-all duration-200",
                      isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                    )}
                  />
                  <p
                    className={cn(
                      "text-[13px] font-semibold transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-[10.5px] mt-0.5 transition-colors",
                      isActive
                        ? "text-primary/60"
                        : "text-zinc-400 dark:text-zinc-600",
                    )}
                  >
                    {item.sub}
                  </p>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <div
          className="flex-1 w-full min-w-0 animate-in fade-in duration-150"
          key={activeSection}
        >
          <div className="bg-white dark:bg-[#111] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm overflow-hidden">

            {/* ════════════ SECTION 1 — PERFIL ════════════ */}
            {activeSection === "perfil" && (
              <form onSubmit={handleSaveProfile}>
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SectionHead
                    title="Perfil"
                    subtitle="Sua identidade pública na plataforma."
                  />

                  <FieldRow
                    label="Foto de perfil"
                    hint="JPG, PNG ou GIF · máx. 5 MB"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 shrink-0 bg-zinc-100 dark:bg-zinc-800">
                        <img
                          src={avatarSrc}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[12px] font-semibold text-primary hover:opacity-75 transition-opacity flex items-center gap-1.5"
                      >
                        <Camera size={12} />
                        Trocar foto
                      </button>
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Nome de exibição"
                    hint="Aparece no sidebar e nos workspaces."
                  >
                    <Field
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </FieldRow>

                  <FieldRow
                    label="E-mail"
                    hint="Gerenciado pelo provedor de autenticação."
                  >
                    <Field value={currentUser?.email ?? ""} disabled />
                  </FieldRow>
                </div>

                <div className="px-6 py-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingProfile ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Salvar
                  </button>
                </div>
              </form>
            )}

            {/* Crop modal */}
            <ImageCropModal
              open={showCropModal}
              imageSrc={cropSrc}
              title="Ajustar foto de perfil"
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />

            {/* ════════════ SECTION 2 — SEGURANÇA ════════════ */}
            {activeSection === "seguranca" && (
              <div>
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SectionHead
                    title="Segurança"
                    subtitle="Gerencie sua senha e preferências de notificação."
                  />

                  <SubLabel>Alterar senha</SubLabel>

                  {isEmailProvider ? (
                    <form onSubmit={handleChangePassword}>
                      <FieldRow label="Senha atual">
                        <Field
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                      </FieldRow>
                      <FieldRow label="Nova senha">
                        <Field
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          autoComplete="new-password"
                        />
                      </FieldRow>
                      <FieldRow label="Confirmar senha">
                        <Field
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repita a nova senha"
                          autoComplete="new-password"
                        />
                      </FieldRow>
                      <div className="flex justify-end pt-4">
                        <button
                          type="submit"
                          disabled={
                            isChangingPassword ||
                            !currentPassword ||
                            !newPassword ||
                            !confirmPassword
                          }
                          className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isChangingPassword ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <KeyRound size={12} />
                          )}
                          Alterar senha
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      {/* Google-branded connected pill */}
                      <div className="inline-flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-white/10 shadow-sm">
                        {/* Google "G" logo */}
                        <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-[12.5px] font-medium text-zinc-700 dark:text-zinc-200">
                          Conectado com Google
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        Sua senha é gerenciada pelo Google. Para alterá-la, acesse as configurações da sua conta Google.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SubLabel>Notificações &amp; Idioma</SubLabel>

                  <FieldRow
                    label="Novas respostas"
                    hint="Receba um e-mail a cada nova resposta de formulário."
                  >
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </FieldRow>

                  <FieldRow label="Idioma da interface">
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-44 h-9 text-[12.5px] rounded-lg border-zinc-200 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR" className="text-[13px]">
                          🇧🇷 Português
                        </SelectItem>
                        <SelectItem value="en" className="text-[13px]">
                          🇺🇸 English
                        </SelectItem>
                        <SelectItem value="es" className="text-[13px]">
                          🇪🇸 Español
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <div className="px-6 py-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    disabled={isSavingPrefs}
                    className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-85 transition-opacity disabled:opacity-40"
                  >
                    {isSavingPrefs ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Salvar preferências
                  </button>
                </div>
              </div>
            )}

            {/* ════════════ SECTION 3 — PLANO ════════════ */}
            {activeSection === "plano" && (
              <PlanSection
                currentPlan={currentPlan}
                subStatus={subStatus}
                trialDaysLeft={trialDaysLeft}
                periodEnd={periodEnd}
                billingData={billingData}
                invoices={invoices}
                billingLoading={billingLoading}
                portalLoading={portalLoading}
                checkoutLoading={checkoutLoading}
                onPortal={handleBillingPortal}
                onCheckout={handleCheckout}
                workspaces={workspaces}
                currentUser={currentUser}
              />
            )}

            {/* ════════════ SECTION 4 — CONTA ════════════ */}
            {activeSection === "conta" && (
              <div>
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SectionHead
                    title="Conta"
                    subtitle="Exportação de dados e opções de encerramento."
                  />

                  <SubLabel>Seus dados</SubLabel>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        Exportar dados (LGPD)
                      </p>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Formulários e respostas em JSON · CSV
                      </p>
                    </div>
                    <button
                      onClick={handleExportData}
                      disabled={isExporting}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      {isExporting ? "Solicitando..." : "Solicitar"}
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SubLabel>Gerenciar conta</SubLabel>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        Pausar conta
                      </p>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Seus dados são preservados. Formulários param de
                        aceitar novas respostas.
                      </p>
                    </div>
                    <button
                      onClick={handlePauseAccount}
                      disabled={isPausing}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-50"
                    >
                      {isPausing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <PauseCircle size={12} />
                      )}
                      Pausar
                    </button>
                  </div>
                </div>

                {/* Delete account — hidden at the bottom */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <p className="text-[11.5px] text-zinc-400 dark:text-zinc-600">
                    Quer encerrar sua conta?
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-[11.5px] text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors underline underline-offset-2"
                  >
                    Excluir conta
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Delete account dialog ─────────────────────────────── */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setConfirmEmail("");
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Excluir conta permanentemente</DialogTitle>
            <DialogDescription>
              Todos os formulários, respostas e dados serão excluídos. Esta
              ação é irreversível e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-zinc-600 dark:text-zinc-400">
                Digite{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {currentUser?.email}
                </span>{" "}
                para confirmar
              </Label>
              <Field
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={currentUser?.email ?? "seu@email.com"}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfirmEmail("");
              }}
              className="h-8 px-4 rounded-lg text-[12.5px] font-semibold border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting || confirmEmail !== currentUser?.email}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12.5px] font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Excluir permanentemente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
