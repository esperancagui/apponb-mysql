"use client";

import React, { useEffect, useState, use, useRef, useCallback } from "react";
import { useSocket } from "@/app/hooks/useSocket";
import Link from "next/link";
import {
  ChevronLeft,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Paperclip,
  FileText,
  Sparkles,
  Share2,
  Download,
  Copy,
  MoreHorizontal,
  ImageIcon,
  File,
  Archive,
  Clock3,
  ChevronDown,
  FileSpreadsheet,
  TrendingUp,
  User2,
  Loader2,
  Calendar,
  Brain,
  ShieldAlert,
  Eye,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { submissionService, formService, insightService } from "@/app/lib/services";
import type { AIInsight, RedFlagEstrategica, Form, InboxItem, InboxStatus } from "@/app/lib/types";
import { RISK_MAP } from "@/app/lib/risk";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import ResponseDetailsSkeleton from "./SkeletonLoader";

const STATUS_LABELS: Record<InboxStatus, string> = {
  new: "Nova resposta",
  reviewing: "Em revisão",
  pending: "Aguardando cliente",
  reviewed: "Revisado",
  archived: "Arquivado",
};

const STATUS_DOT_COLORS: Record<InboxStatus, string> = {
  new: "bg-primary",
  reviewing: "bg-yellow-500",
  pending: "bg-orange-500",
  reviewed: "bg-emerald-500",
  archived: "bg-zinc-400",
};

const STATUS_PILL_COLORS: Record<InboxStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
  reviewing:
    "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30",
  pending:
    "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
  reviewed:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  archived: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700",
};

const SEVERITY_COLORS = {
  Alta: { bar: "#ef4444", text: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
  Média: { bar: "#f97316", text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
  Baixa: { bar: "#eab308", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/20" },
};

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return FileText;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
  if (["zip", "rar", "7z"].includes(ext)) return Archive;
  return File;
}

function getFilenameFromUrl(url: string): string {
  try {
    const pathPart = new URL(url).pathname.split("/o/")[1];
    if (pathPart) return decodeURIComponent(pathPart).split("/").pop() || "arquivo";
  } catch {}
  return "arquivo";
}

function isImageUrl(url: string): boolean {
  const ext = getFilenameFromUrl(url).split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

function formatAnswer(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

const HEADER_STATUS_STYLES: Record<string, string> = {
  "Ready to Pitch":
    "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
  "Needs Deep Dive":
    "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50",
  "High Alert": "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50",
};

const STATUS_TRANSLATION: Record<string, string> = {
  "Ready to Pitch": "Pronto para Pitch",
  "Needs Deep Dive": "Análise Profunda",
  "High Alert": "Alerta Crítico",
};

function HeaderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
        HEADER_STATUS_STYLES[status] ?? HEADER_STATUS_STYLES["Needs Deep Dive"],
      )}
    >
      {STATUS_TRANSLATION[status] || status}
    </span>
  );
}

const CLASSIFICACAO_STYLES = {
  Premium: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
  Regular: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400",
  Crítico: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
};

function ScoreClassificacaoBadge({ classificacao }: { classificacao: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-md",
        CLASSIFICACAO_STYLES[classificacao as keyof typeof CLASSIFICACAO_STYLES] ?? CLASSIFICACAO_STYLES["Regular"],
      )}
    >
      {classificacao}
    </span>
  );
}

/** Circular SVG score indicator */
function ScoreCircle({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e4e4e7" strokeWidth="3.5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[8px] font-semibold text-zinc-400">/100</span>
      </div>
    </div>
  );
}
export default function ResponseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [inboxItem, setInboxItem] = useState<InboxItem | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<InboxStatus>("new");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"analise" | "riscos" | "kickoff" | "briefing">("analise");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 20;

  const socket = useSocket();

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
    pollAttemptsRef.current = 0;
  }, []);

  const startPolling = useCallback(
    (currentId: string) => {
      if (pollIntervalRef.current) return;
      setIsPolling(true);
      pollAttemptsRef.current = 0;
      pollIntervalRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          return;
        }
        try {
          const data = await insightService.getInsight(currentId);
          if (data) {
            setInsight(data);
            stopPolling();
          }
        } catch {
          // silent — keep polling
        }
      }, 3000);
    },
    [stopPolling],
  );

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ──── Real-time socket listeners ────
  useEffect(() => {
    if (!socket) return;

    const onInsightCompleted = async (data: { submissionId: string; insightId: string }) => {
      if (data.submissionId !== id) return;
      stopPolling();
      try {
        const data2 = await insightService.getInsight(id);
        if (data2) {
          setInsight(data2);
          toast.success("Análise de IA concluída");
        }
      } catch {}
    };

    const onStatusUpdated = (data: { submissionId: string; status: string }) => {
      if (data.submissionId !== id) return;
      setStatus(data.status as InboxStatus);
    };

    socket.on("insight:completed", onInsightCompleted);
    socket.on("inbox:status_updated", onStatusUpdated);

    return () => {
      socket.off("insight:completed", onInsightCompleted);
      socket.off("inbox:status_updated", onStatusUpdated);
    };
  }, [socket, id, stopPolling]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const item = await submissionService.getInboxItem(id);
      if (!item) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setInboxItem(item);
      setStatus(item.status);

      if (item.formId) {
        const formData = await formService.getForm(item.formId);
        setForm(formData || null);
      }

      try {
        const insightData = await insightService.getInsight(id);
        if (insightData) {
          setInsight(insightData);
        } else {
          startPolling(id);
        }
      } catch (e) {
        console.error("Failed to load insight", e);
        startPolling(id);
      }

      setIsLoading(false);
    }
    load();
  }, [id, startPolling]);

  async function handleAnalyze() {
    stopPolling();
    setIsAnalyzing(true);
    try {
      const data = await insightService.analyzeSubmission(id);
      setInsight(data);
      toast.success("Análise gerada com sucesso");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar análise.");
      startPolling(id);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleStatusChange(newStatus: InboxStatus) {
    setIsUpdatingStatus(true);
    try {
      await submissionService.updateInboxStatus(id, newStatus);
      setStatus(newStatus);
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado para a área de transferência");
  }

  function handleExportCSV() {
    if (!inboxItem) return;
    const ans = inboxItem.data || {};
    const groups = form && form.groups.length > 0 ? form.groups : inboxItem.formGroups || [];
    const rows: string[][] = [["Pergunta", "Resposta"]];

    if (groups.length > 0) {
      groups.forEach((g) => {
        g.fields.forEach((field: any) => {
          const val = ans[field.id];
          if (val !== undefined && val !== "") rows.push([field.label, formatAnswer(val)]);
        });
      });
    } else {
      Object.entries(ans).forEach(([key, value]) => rows.push([key, formatAnswer(value)]));
    }

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inboxItem.clientName || "Resposta"} - ${inboxItem.formName || "Formulário"}.csv`.replace(
      /[/\\?%*:|"<>]/g,
      "-",
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  async function handleExportPDF() {
    setIsExportingPDF(true);
    try {
      const { auth } = await import("@/app/lib/firebase");
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/insights/${id}/pdf`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inboxItem?.clientName || "Resposta"} - Análise IA.pdf`.replace(/[/\\?%*:|"<>]/g, "-");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso");
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  }

  const downloadAllAsZip = async () => {
    if (!inboxItem?.files) return;
    setIsDownloadingZip(true);
    try {
      const { auth } = await import("@/app/lib/firebase");
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/submissions/${id}/files/zip`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("ZIP generation failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${inboxItem.clientName || "Anexos"} - Arquivos.zip`.replace(/[/\\?%*:|"<>]/g, "-");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error("Erro ao gerar ZIP.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  if (isLoading) return <ResponseDetailsSkeleton />;

  if (notFound || !inboxItem) {
    return (
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 text-zinc-900 dark:text-zinc-50 font-sans">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors mb-6"
        >
          <ChevronLeft size={14} /> Inbox
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={32} className="text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-[14px] font-semibold text-zinc-500">Resposta não encontrada</p>
        </div>
      </div>
    );
  }

  const clientName = inboxItem.clientName || "Cliente";
  const formName = inboxItem.formName || "Briefing";
  const submittedAt = inboxItem.submittedAt ? new Date(inboxItem.submittedAt) : new Date();
  const answers = inboxItem.data || {};

  const healthScore = insight?.scoreONB.pontuacao ?? 0;
  const healthColor = healthScore >= 85 ? "#10b981" : healthScore >= 65 ? "#eab308" : "#ef4444";
  const healthBg =
    healthScore >= 85
      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
      : healthScore >= 65
        ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-100 dark:border-yellow-900/30"
        : "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30";
  const healthIconBg =
    healthScore >= 85
      ? "bg-emerald-100 dark:bg-emerald-900/40"
      : healthScore >= 65
        ? "bg-yellow-100 dark:bg-yellow-900/40"
        : "bg-red-100 dark:bg-red-900/40";
  const healthTextColor =
    healthScore >= 85
      ? "text-emerald-600 dark:text-emerald-400"
      : healthScore >= 65
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  const attachTotal = inboxItem.attachments ?? 0;
  const attachOk = inboxItem.attachmentsOk ?? 0;
  const attachBg =
    attachTotal === 0
      ? "bg-zinc-50 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800"
      : attachOk === attachTotal
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
        : "bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30";
  const attachIconBg =
    attachTotal === 0
      ? "bg-zinc-100 dark:bg-zinc-800"
      : attachOk === attachTotal
        ? "bg-emerald-100 dark:bg-emerald-900/40"
        : "bg-orange-100 dark:bg-orange-900/40";
  const attachTextColor =
    attachTotal === 0
      ? "text-zinc-500 dark:text-zinc-400"
      : attachOk === attachTotal
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-orange-600 dark:text-orange-400";

  const aiRisk = inboxItem.aiRisk ?? "low";
  const riskInfo = RISK_MAP[aiRisk];

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 pb-24 text-zinc-900 dark:text-zinc-50 font-sans">
      {/* ─── 1) HEADER ─── */}
      <div className="space-y-5 pb-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={14} /> Inbox
        </Link>

        {/* Title row + status dropdown (moved from sidebar) */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
              <span className="text-[17px] font-bold text-white">{clientName.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                {clientName}
              </h1>
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5">
                {formName}
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                {formatDistanceToNow(submittedAt, { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Inline status dropdown — replaces sidebar Status Card */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold shrink-0 hover:opacity-80 transition-opacity cursor-pointer",
                  STATUS_PILL_COLORS[status],
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    STATUS_DOT_COLORS[status],
                    isUpdatingStatus && "animate-pulse",
                  )}
                />
                {STATUS_LABELS[status]}
                <ChevronDown size={11} className="opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.entries(STATUS_LABELS) as [InboxStatus, string][]).map(([s, label]) => (
                <DropdownMenuItem
                  key={s}
                  className="flex items-center gap-2 text-[13px]"
                  onClick={() => handleStatusChange(s)}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                  {label}
                </DropdownMenuItem>
              ))}
              {status !== "reviewed" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold"
                    onClick={() => handleStatusChange("reviewed")}
                  >
                    <CheckCircle2 size={13} /> Marcar como Revisado
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Share */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-8 px-3.5 rounded-[8px] text-[12px] font-semibold border-zinc-200/80 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 bg-white dark:bg-zinc-900/40 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Share2 size={12} /> Compartilhar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem className="flex items-center gap-2 text-[13px]" onClick={handleCopyLink}>
                <Copy size={13} className="text-zinc-400" /> Copiar link da resposta
              </DropdownMenuItem>
              {/* Future: Share with team, generate client summary link */}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export PDF */}
          <Button
            variant="outline"
            className="h-8 px-3.5 rounded-[8px] text-[12px] font-semibold border-zinc-200/80 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 bg-white dark:bg-zinc-900/40 shadow-sm flex items-center gap-1.5 transition-colors"
            onClick={handleExportPDF}
            disabled={!insight || isExportingPDF}
            title={!insight ? "Aguardando análise IA para gerar PDF" : undefined}
          >
            {isExportingPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Exportar PDF
          </Button>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-[8px] border-zinc-200/80 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 bg-white dark:bg-zinc-900/40 shadow-sm transition-colors"
              >
                <MoreHorizontal size={14} className="text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="flex items-center gap-2 text-[13px]" onClick={handleExportCSV}>
                <FileSpreadsheet size={13} className="text-zinc-400" /> Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-[13px] text-zinc-500"
                onClick={() => handleStatusChange("archived")}
              >
                Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="border-b border-zinc-100 dark:border-white/5" />
      </div>

      {/* ─── 2) METRICS BAR ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 py-5">
        {/* Saúde do Brief */}
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3.5 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
            insight ? healthBg : "bg-white dark:bg-zinc-900/20 border-zinc-200/80 dark:border-zinc-800",
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
              insight ? healthIconBg : "bg-zinc-100 dark:bg-zinc-800",
            )}
          >
            <Sparkles size={18} className={insight ? healthTextColor : "text-zinc-400"} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5">
              Score ONB
            </p>
            <p
              className={cn(
                "text-[18px] font-black leading-none",
                insight ? healthTextColor : "text-zinc-400 dark:text-zinc-500",
              )}
            >
              {insight ? healthScore : "—"}
              {insight && <span className="text-[11px] font-bold opacity-50">/100</span>}
            </p>
            <p className="text-[10.5px] mt-1 opacity-70 font-semibold truncate">
              {insight ? insight.scoreONB.classificacao : "Em breve"}
            </p>
          </div>
        </div>

        {/* Risco IA */}
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3.5 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
            riskInfo.color,
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-white/60 dark:bg-black/20 shadow-sm flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="opacity-80" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">Risco IA</p>
            <p className="text-[18px] font-black leading-none">{riskInfo.label}</p>
            <p className="text-[10.5px] mt-1 opacity-70 font-semibold">
              {insight
                ? `${insight.redFlagsEstrategicas.length} flag${insight.redFlagsEstrategicas.length !== 1 ? "s" : ""}`
                : "Em breve"}
            </p>
          </div>
        </div>

        {/* Anexos */}
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3.5 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
            attachBg,
          )}
        >
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm", attachIconBg)}>
            <Paperclip size={18} className={attachTextColor} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5">
              Anexos
            </p>
            <p className={cn("text-[18px] font-black leading-none", attachTextColor)}>
              {attachOk}
              <span className="text-[11px] font-bold opacity-50">/{attachTotal}</span>
            </p>
            <p className={cn("text-[10.5px] mt-1 font-semibold opacity-70", attachTextColor)}>
              {attachTotal === 0 ? "Sem anexos" : attachOk === attachTotal ? "Todos validados" : "Parcialmente válidos"}
            </p>
          </div>
        </div>

        {/* Recebido */}
        <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900/20 border-zinc-200/80 dark:border-zinc-800 flex items-center gap-3.5 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
            <Clock3 size={18} className="text-zinc-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5">
              Recebido
            </p>
            <p className="text-[14px] font-black leading-none text-zinc-800 dark:text-zinc-200 mt-1">
              {formatDistanceToNow(submittedAt, { addSuffix: false, locale: ptBR })}
            </p>
            <p className="text-[10.5px] mt-1 text-zinc-400 dark:text-zinc-500 font-semibold">
              {format(submittedAt, "d MMM, HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3) AI HEADLINE ─── */}
      {insight ? (
        <div className="mb-5 rounded-2xl border border-indigo-200/50 dark:border-white/[0.08] bg-gradient-to-r from-indigo-50/50 via-white to-transparent dark:from-indigo-950/20 dark:via-[#0D0D0D] dark:to-[#0D0D0D] shadow-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.8),rgba(255,255,255,0))] dark:bg-[linear-gradient(rgba(0,0,0,0.1),rgba(0,0,0,0))] pointer-events-none mix-blend-overlay" />
          <div className="px-6 py-4 flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 shadow-inner flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
              </div>
              <p className="text-[14.5px] font-bold text-zinc-900 dark:text-white leading-snug">
                {insight.headerImpacto.headline}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <HeaderStatusBadge status={insight.headerImpacto.status} />
            </div>
          </div>
        </div>
      ) : (
        <section className="mb-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/40 dark:bg-indigo-950/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-10 h-10 shrink-0">
                {(isPolling || isAnalyzing) && (
                  <div className="absolute inset-0 rounded-full bg-indigo-300 dark:bg-indigo-700 animate-ping opacity-30" />
                )}
                <div className="relative w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center">
                  {isPolling || isAnalyzing ? (
                    <Loader2 size={16} className="text-indigo-500 dark:text-indigo-400 animate-spin" />
                  ) : (
                    <Sparkles size={16} className="text-indigo-500 dark:text-indigo-400" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-zinc-900 dark:text-white">
                  {isAnalyzing ? "Gerando análise IA…" : isPolling ? "Aguardando análise IA…" : "Análise IA não gerada"}
                </p>
                <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  {isAnalyzing
                    ? "A análise está sendo processada, aguarde."
                    : isPolling
                      ? "Verificando a cada 3 segundos…"
                      : 'Clique em "Gerar análise" para iniciar o processamento.'}
                </p>
              </div>
            </div>
            {!isAnalyzing && (
              <Button size="sm" className="shrink-0 h-8 px-3.5 text-[12px] font-semibold" onClick={handleAnalyze}>
                <Sparkles size={12} className="mr-1.5" /> Gerar análise
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ─── 4) TAB NAV ─── */}
      <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/60 p-1 mb-5 overflow-x-auto rounded-xl">
        {(["analise", "riscos", "kickoff", "briefing"] as const).map((tab) => {
          const config = {
            analise: { label: "Análise", Icon: Brain },
            riscos: { label: "Riscos", Icon: AlertTriangle },
            kickoff: { label: "Kickoff", Icon: Lightbulb },
            briefing: { label: "Briefing", Icon: FileText },
          }[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap",
                activeTab === tab
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-transparent"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]",
              )}
            >
              <config.Icon size={13} className={activeTab === tab ? "opacity-100" : "opacity-70"} />
              {config.label}
              {tab === "riscos" && insight && insight.redFlagsEstrategicas.length > 0 && (
                <span
                  className={cn(
                    "min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-1 border",
                    activeTab === tab
                      ? "bg-red-500 text-white border-red-600"
                      : "bg-red-100 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
                  )}
                >
                  {insight.redFlagsEstrategicas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 5) TAB: Análise ─── */}
      {activeTab === "analise" &&
        (insight ? (
          <div className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-50 dark:border-white/[0.03]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mb-4">
                <Sparkles size={10} className="text-indigo-400" /> Diagnóstico Estratégico
              </p>
              <p className="text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-200 font-medium border-l-2 border-indigo-200 dark:border-indigo-800 pl-4">
                {insight.diagnosticoEstrategico.visaoGeral}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-50 dark:divide-white/[0.03]">
              <div className="px-6 py-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <ShieldAlert size={11} className="text-zinc-400 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Dor do Cliente
                  </p>
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {insight.diagnosticoEstrategico.dorDoCliente}
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp size={11} className="text-zinc-400 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Potencial de Lucro
                  </p>
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {insight.diagnosticoEstrategico.potencialDeLucro}
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Score ONB
                  </p>
                  <ScoreClassificacaoBadge classificacao={insight.scoreONB.classificacao} />
                </div>
                <div className="flex items-start gap-3">
                  <ScoreCircle score={healthScore} color={healthColor} />
                  <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 flex-1">
                    {insight.scoreONB.analiseTecnica}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-900/30 p-10 text-center">
            <Loader2 size={16} className="text-zinc-300 dark:text-zinc-700 animate-spin mx-auto mb-2" />
            <p className="text-[12px] text-zinc-400">Aguardando análise IA</p>
          </div>
        ))}

      {/* ─── 6) TAB: Riscos ─── */}
      {activeTab === "riscos" &&
        (insight ? (
          <div className={cn("grid grid-cols-1 gap-5", insight.estrategiaDeProtecao && "lg:grid-cols-5")}>
            <div
              className={cn(
                "bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden",
                insight.estrategiaDeProtecao ? "lg:col-span-3" : "",
              )}
            >
              <div className="px-5 py-4 border-b border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-400" /> Red Flags Estratégicas
                </h4>
                {insight.redFlagsEstrategicas.length > 0 && (
                  <span className="min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                    {insight.redFlagsEstrategicas.length}
                  </span>
                )}
              </div>
              {insight.redFlagsEstrategicas.length === 0 ? (
                <div className="p-5 flex flex-col items-center gap-2 py-10">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-1">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-[12.5px] font-medium text-zinc-500 text-center">Nenhum problema detectado</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
                  {insight.redFlagsEstrategicas.map((flag: RedFlagEstrategica, idx: number) => {
                    const sev = SEVERITY_COLORS[flag.severidade] ?? SEVERITY_COLORS["Baixa"];
                    return (
                      <div key={idx} className="flex gap-0 relative">
                        <div className="w-[3px] shrink-0 self-stretch" style={{ backgroundColor: sev.bar }} />
                        <div className="flex-1 px-4 py-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug flex-1">
                              {flag.alerta}
                            </p>
                            <span className={cn("text-[10px] font-bold shrink-0 mt-0.5", sev.text)}>
                              {flag.severidade}
                            </span>
                          </div>
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {flag.impactoNoNegocio}
                          </p>
                          <div className="pt-1 border-t border-dashed border-zinc-100 dark:border-white/[0.05]">
                            <p className="text-[10.5px] font-semibold text-indigo-500 dark:text-indigo-400 mb-0.5">
                              Recomendação
                            </p>
                            <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              {flag.recomendacao}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {insight.estrategiaDeProtecao && (
              <div className="lg:col-span-2 bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={12} className="text-violet-400" /> Proteção de Escopo
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40">
                      Agency
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        insight.estrategiaDeProtecao.nivelDeRisco === "Alto"
                          ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                          : insight.estrategiaDeProtecao.nivelDeRisco === "Médio"
                            ? "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400"
                            : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      Risco {insight.estrategiaDeProtecao.nivelDeRisco}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TriangleAlert size={11} className="text-orange-400 shrink-0" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        Alerta de Escopo
                      </p>
                    </div>
                    <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {insight.estrategiaDeProtecao.alertaDeEscopo}
                    </p>
                  </div>
                  {insight.estrategiaDeProtecao.clausulasRecomendadas.length > 0 && (
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                        Cláusulas Recomendadas
                      </p>
                      <ol className="space-y-2.5">
                        {insight.estrategiaDeProtecao.clausulasRecomendadas.map((clause, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="w-4 h-4 rounded-full bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 flex items-center justify-center text-[8px] font-bold text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              {clause}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {insight.estrategiaDeProtecao.sinaisDeAlerta.length > 0 && (
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                        Sinais de Alerta no Briefing
                      </p>
                      <ul className="space-y-2">
                        {insight.estrategiaDeProtecao.sinaisDeAlerta.map((sinal, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed"
                          >
                            <span className="w-1 h-1 rounded-full bg-orange-400 mt-2 shrink-0" />
                            {sinal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-900/30 p-10 text-center">
            <Loader2 size={16} className="text-zinc-300 dark:text-zinc-700 animate-spin mx-auto mb-2" />
            <p className="text-[12px] text-zinc-400">Aguardando análise IA</p>
          </div>
        ))}

      {/* ─── 7) TAB: Kickoff ─── */}
      {activeTab === "kickoff" &&
        (insight ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-50 dark:border-white/[0.03]">
                <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb size={12} className="text-indigo-400" /> Kickoff Masterlist
                </h4>
              </div>
              <div className="px-5 pt-5 pb-2">
                <p className="text-[10.5px] font-semibold text-zinc-400 dark:text-zinc-500 mb-4">Perguntas de Ouro</p>
                <ol className="space-y-3.5">
                  {insight.kickoffMasterlist.perguntasDeOuro.map((q, idx) => (
                    <li key={idx} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-[12.5px] text-zinc-700 dark:text-zinc-300 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="p-4 m-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar size={12} className="text-indigo-500 dark:text-indigo-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                    Próxima Ação
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {insight.kickoffMasterlist.proximoPasso}
                </p>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-50 dark:border-white/[0.03]">
                <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain size={12} className="text-violet-400" /> Perfil Psicográfico
                </h4>
              </div>
              <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User2 size={11} className="text-zinc-400 shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                      Perfil
                    </p>
                  </div>
                  <p className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">
                    {insight.perfilPsicografico.perfil}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={11} className="text-zinc-400 shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                      Estratégia de Venda
                    </p>
                  </div>
                  <p className="text-[12.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {insight.perfilPsicografico.estrategaDeVenda}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-900/30 p-10 text-center">
            <Loader2 size={16} className="text-zinc-300 dark:text-zinc-700 animate-spin mx-auto mb-2" />
            <p className="text-[12px] text-zinc-400">Aguardando análise IA</p>
          </div>
        ))}

      {/* ─── 8) TAB: Briefing ─── */}
      {activeTab === "briefing" && (
        <div className="space-y-5">
          {/* Audit Visual — Agency, when available */}
          {insight?.auditVisual && (
            <div className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={12} className="text-sky-400" /> Audit Visual
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40">
                    Agency
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      insight.auditVisual.consistenciaComBriefing.startsWith("Alta")
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                        : insight.auditVisual.consistenciaComBriefing.startsWith("Parcial")
                          ? "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400"
                          : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
                    )}
                  >
                    {insight.auditVisual.consistenciaComBriefing.split(" ")[0]}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-50 dark:divide-white/[0.03]">
                <div className="px-5 py-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 text-center">
                      <p
                        className={cn(
                          "text-[32px] font-bold leading-none",
                          insight.auditVisual.scoreVisual >= 70
                            ? "text-emerald-600 dark:text-emerald-400"
                            : insight.auditVisual.scoreVisual >= 45
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-500 dark:text-red-400",
                        )}
                      >
                        {insight.auditVisual.scoreVisual}
                      </p>
                      <p className="text-[9px] font-semibold text-zinc-400">/100</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5">
                        Maturidade da Marca
                      </p>
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {insight.auditVisual.maturidadeDaMarca}
                      </p>
                    </div>
                  </div>
                </div>
                {insight.auditVisual.observacoes.length > 0 && (
                  <div className="px-5 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                      Observações
                    </p>
                    <ul className="space-y-2">
                      {insight.auditVisual.observacoes.map((obs, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          <span className="w-1 h-1 rounded-full bg-sky-400 mt-2 shrink-0" />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.auditVisual.oportunidades.length > 0 && (
                  <div className="px-5 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                      Oportunidades Visuais
                    </p>
                    <ul className="space-y-2">
                      {insight.auditVisual.oportunidades.map((op, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                          {op}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Answers */}
          <section className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText size={15} className="text-zinc-400" /> Respostas do Formulário
              </h3>
              <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                Preenchido pelo Cliente
              </span>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
              {(() => {
                const groups = form && form.groups.length > 0 ? form.groups : inboxItem.formGroups || [];
                if (groups.length > 0) {
                  return groups.map((group, gIdx) => {
                    const groupAnswers = group.fields.filter(
                      (f: any) => answers[f.id] !== undefined && answers[f.id] !== "" && f.type !== "file",
                    );
                    if (groupAnswers.length === 0) return null;
                    return (
                      <div key={group.id} className="px-6 py-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                            {gIdx + 1}
                          </span>
                          <h4 className="text-[10.5px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            {group.name}
                          </h4>
                        </div>
                        <div>
                          {groupAnswers.map((field: any, fIdx: number) => (
                            <div
                              key={field.id}
                              className={
                                fIdx > 0
                                  ? "border-t border-dashed border-zinc-100 dark:border-white/[0.04] py-3.5"
                                  : "py-3.5"
                              }
                            >
                              <p className="text-[11.5px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5">
                                {field.label}
                              </p>
                              <p className="text-[13.5px] font-normal leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                                {formatAnswer(answers[field.id])}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                } else if (Object.keys(answers).length > 0) {
                  const flatEntries = Object.entries(answers).filter(([, value]) => {
                    if (
                      Array.isArray(value) &&
                      value.every((v) => typeof v === "string" && v.startsWith("https://firebasestorage"))
                    )
                      return false;
                    if (typeof value === "string" && value.startsWith("https://firebasestorage")) return false;
                    return true;
                  });
                  return (
                    <div className="px-6 py-5">
                      {flatEntries.map(([key, value], idx) => (
                        <div
                          key={key}
                          className={
                            idx > 0
                              ? "border-t border-dashed border-zinc-100 dark:border-white/[0.04] py-3.5"
                              : "py-3.5"
                          }
                        >
                          <p className="text-[11.5px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5 font-mono">
                            {key}
                          </p>
                          <p className="text-[13.5px] font-normal leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                            {formatAnswer(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                } else {
                  return (
                    <div className="px-6 py-10 text-center">
                      <p className="text-[13px] text-zinc-400">Nenhuma resposta registrada.</p>
                    </div>
                  );
                }
              })()}
            </div>
          </section>

          {/* File Assets */}
          {inboxItem.files &&
            Object.keys(inboxItem.files).length > 0 &&
            (() => {
              const allUrls = Object.values(inboxItem.files!).flat();
              const groups = form && form.groups.length > 0 ? form.groups : inboxItem.formGroups || [];
              const fieldLabelMap: Record<string, string> = {};
              groups.forEach((g) =>
                g.fields.forEach((f: any) => {
                  fieldLabelMap[f.id] = f.label;
                }),
              );
              return (
                <section className="bg-white dark:bg-[#0D0D0D] border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Paperclip size={15} className="text-zinc-400" /> Anexos
                      </h3>
                      <span className="text-[12px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
                        {allUrls.length} {allUrls.length === 1 ? "arquivo" : "arquivos"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      className="h-8 px-3 rounded-md border-zinc-200 dark:border-zinc-800 text-[12px] font-semibold flex items-center gap-1.5"
                      onClick={downloadAllAsZip}
                      disabled={isDownloadingZip}
                    >
                      {isDownloadingZip ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Baixar todos
                    </Button>
                  </div>
                  <div className="space-y-5">
                    {Object.entries(inboxItem.files!).map(([fieldId, urls]) => (
                      <div key={fieldId}>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                          {fieldLabelMap[fieldId] || fieldId}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {urls.map((url, i) => {
                            const filename = getFilenameFromUrl(url);
                            const isImg = isImageUrl(url);
                            const FileIcon = getFileIcon(filename);
                            return (
                              <div
                                key={i}
                                className="rounded-xl border border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-zinc-800/20 overflow-hidden flex flex-col"
                              >
                                {isImg ? (
                                  <button
                                    type="button"
                                    className="block w-full aspect-square overflow-hidden cursor-pointer"
                                    onClick={() => window.open(url, "_blank")}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt={filename}
                                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                    />
                                  </button>
                                ) : (
                                  <div className="aspect-square flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                                    <FileIcon size={32} className="text-zinc-400 dark:text-zinc-500" />
                                  </div>
                                )}
                                <div className="p-2 flex items-center gap-1.5">
                                  <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate flex-1 leading-tight">
                                    {filename}
                                  </p>
                                  <a
                                    href={url}
                                    download={filename}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center justify-center transition-colors"
                                    title="Baixar"
                                  >
                                    <Download size={11} className="text-zinc-600 dark:text-zinc-300" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}
        </div>
      )}
    </div>
  );
}
