"use client";

import React, { useEffect, useState } from "react";
import { formService, submissionService } from "@/app/lib/services";
import { useSocket } from "@/app/hooks/useSocket";
import { RISK_MAP } from "@/app/lib/risk";
import type { Form, InboxItem } from "@/app/lib/types";
import {
  Plus,
  MoreHorizontal,
  FileText,
  Clock,
  Layout,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  Paperclip,
  Filter,
  AlertTriangle,
  ArrowUpRight,
  Eye,
  Copy,
  Check,
  Power,
  CopyCheck,
  Inbox,
  Loader2,
  Pin,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkspace, useOnboarding } from "@/app/contexts";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DashboardSkeleton } from "./SkeletonLoader";
import ConfirmDeleteDialog from "@/components/ui/confirm-delete-dialog";

const DRAFT_MAX_AGE_DAYS = 7;

function getDraftExpiration(form: Form): { daysLeft: number; label: string } | null {
  if (form.status !== "draft" || !form.updatedAt) return null;
  const updated = new Date(form.updatedAt);
  const daysElapsed = differenceInDays(new Date(), updated);
  const daysLeft = DRAFT_MAX_AGE_DAYS - daysElapsed;
  if (daysLeft > DRAFT_MAX_AGE_DAYS) return null;
  if (daysLeft <= 0) return { daysLeft: 0, label: "Expira hoje" };
  return { daysLeft, label: `Expira em ${daysLeft}d` };
}

export default function DashboardPage() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { completeStep } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);
  const [forms, setForms] = useState<Form[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);

  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<"all" | "new" | "reviewing" | "risk">("all");
  const [formTab, setFormTab] = useState<"ativos" | "rascunhos">("ativos");
  const [focusItem, setFocusItem] = useState<InboxItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "risk" | "inactive" | "attachments">("recent");
  const [filterFormId, setFilterFormId] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [togglingFormId, setTogglingFormId] = useState<string | null>(null);
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);
  const [pendingDeleteFormId, setPendingDeleteFormId] = useState<string | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"respostas" | "formularios">("respostas");
  const [pinnedFormIds, setPinnedFormIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  const socket = useSocket();

  // ──── Derived: unique forms for filter popover ────
  const formOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of inboxItems) {
      if (!seen.has(item.formId)) seen.set(item.formId, item.formName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [inboxItems]);

  const activeFilterCount = (filterFormId !== "all" ? 1 : 0) + (filterDateRange !== "all" ? 1 : 0);

  // ──── Derived: filtered + sorted inbox ────
  const filteredItems = React.useMemo(() => {
    let items = [...inboxItems];

    // 1) Status filter
    if (activeFilter === "reviewing") items = items.filter((i) => i.status === "reviewing");
    else if (activeFilter === "new") items = items.filter((i) => i.status === "new");
    else if (activeFilter === "risk") items = items.filter((i) => i.aiRisk !== "low");
    // "all" — show everything except archived
    else items = items.filter((i) => i.status !== "archived");

    // 2) Form filter
    if (filterFormId !== "all") {
      items = items.filter((i) => i.formId === filterFormId);
    }

    // 3) Date range filter
    if (filterDateRange !== "all") {
      const ms = { today: 86_400_000, week: 604_800_000, month: 2_592_000_000 }[filterDateRange];
      const cutoff = Date.now() - ms;
      items = items.filter((i) => new Date(i.submittedAt).getTime() >= cutoff);
    }

    // 4) Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.clientName.toLowerCase().includes(q) ||
          i.formName.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q),
      );
    }

    // 5) Sort
    items.sort((a, b) => {
      if (sortBy === "risk") {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return (
          (riskOrder[a.aiRisk as keyof typeof riskOrder] ?? 2) - (riskOrder[b.aiRisk as keyof typeof riskOrder] ?? 2)
        );
      }
      if (sortBy === "attachments") {
        return b.attachments - b.attachmentsOk - (a.attachments - a.attachmentsOk);
      }
      if (sortBy === "inactive") {
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }
      // recent (default)
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    return items;
  }, [inboxItems, activeFilter, filterFormId, filterDateRange, searchQuery, sortBy]);

  // Reset page whenever filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [activeFilter, filterFormId, filterDateRange, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ──── Derived: shortcuts sorted by response count, pinned first ────
  const shortcutForms = React.useMemo(() => {
    const sorted = [...forms].sort((a, b) => {
      const aCount = inboxItems.filter((i) => i.formId === a.id).length;
      const bCount = inboxItems.filter((i) => i.formId === b.id).length;
      return bCount - aCount;
    });
    const pinned = sorted.filter((f) => pinnedFormIds.includes(f.id));
    const unpinned = sorted.filter((f) => !pinnedFormIds.includes(f.id));
    return [...pinned, ...unpinned].slice(0, 3);
  }, [forms, inboxItems, pinnedFormIds]);

  const activeForms = React.useMemo(() => forms.filter((f) => f.status === "active"), [forms]);

  const stats = React.useMemo(() => {
    const newCount = inboxItems.filter((i) => i.status === "new").length;
    const reviewingCount = inboxItems.filter((i) => i.status === "reviewing").length;
    const riskCount = inboxItems.filter((i) => i.aiRisk === "high").length;
    const pending = inboxItems.filter((i) => i.status === "new" || i.status === "reviewing");
    const avgResponseTimeHours =
      pending.length > 0
        ? Math.round(
            pending.reduce((sum, i) => sum + (Date.now() - new Date(i.submittedAt).getTime()) / 3_600_000, 0) /
              pending.length,
          )
        : 0;
    return { newCount, reviewingCount, riskCount, avgResponseTimeHours };
  }, [inboxItems]);

  useEffect(() => {
    const wsId = activeWorkspace?.id;
    // Don't fetch until the active workspace is resolved to avoid loading
    // data from all workspaces before the context finishes hydrating.
    if (!wsId) return;
    setIsLoading(true);
    Promise.all([
      formService.getForms(wsId).then(setForms),
      submissionService.getInboxItems(undefined, wsId).then(setInboxItems),
    ]).then(() => {
      setIsLoading(false);
    });
  }, [activeWorkspace?.id]);

  // Load pinned forms from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("onb-pinned-forms") || "[]");
      if (Array.isArray(saved)) setPinnedFormIds(saved);
    } catch {}
  }, []);

  // ──── Real-time socket listeners ────
  useEffect(() => {
    if (!socket) return;

    const onNewSubmission = async (data: {
      submissionId: string;
      workspaceId: string;
      formName: string;
      clientName: string;
    }) => {
      if (activeWorkspace && data.workspaceId !== activeWorkspace.id) return;
      try {
        const item = await submissionService.getInboxItem(data.submissionId);
        if (item) {
          setInboxItems((prev) => {
            if (prev.some((i) => i.id === item.id)) return prev;
            return [item, ...prev];
          });
          completeStep("first_response");
          toast.info(`Nova resposta de ${item.formName}`);
        }
      } catch {}
    };

    const onStatusUpdated = (data: { submissionId: string; newStatus: string; workspaceId?: string }) => {
      if (activeWorkspace && data.workspaceId && data.workspaceId !== activeWorkspace.id) return;
      setInboxItems((prev) => prev.map((i) => (i.id === data.submissionId ? { ...i, status: data.newStatus as any } : i)));
    };

    socket.on("inbox:new_submission", onNewSubmission);
    socket.on("inbox:status_updated", onStatusUpdated);

    return () => {
      socket.off("inbox:new_submission", onNewSubmission);
      socket.off("inbox:status_updated", onStatusUpdated);
    };
  }, [socket, activeWorkspace]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const handleCopyFormLink = (form: Form) => {
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedFormId(form.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedFormId(null), 2000);
  };

  const handleUpdateStatus = async (itemId: string, status: "reviewing" | "reviewed" | "archived", closeFocus = false) => {
    if (pendingStatusId) return;
    setPendingStatusId(itemId);
    try {
      await submissionService.updateInboxStatus(itemId, status);
      setInboxItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: status as any } : i)));
      if (closeFocus) setFocusItem(null);
    } catch {
      toast.error("Erro ao atualizar status");
    } finally {
      setPendingStatusId(null);
    }
  };

  const handleTogglePublish = async (form: Form) => {
    setTogglingFormId(form.id);
    const newStatus = form.status === "active" ? "draft" : "active";
    try {
      await formService.updateForm(form.id, { status: newStatus });
      setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, status: newStatus } : f)));
      toast.success(newStatus === "active" ? "Formulário publicado!" : "Formulário despublicado");
    } catch {
      toast.error("Erro ao atualizar status.");
    } finally {
      setTogglingFormId(null);
    }
  };

  const handleDuplicateForm = async (formId: string) => {
    setDuplicatingFormId(formId);
    try {
      const newForm = await formService.duplicateForm(formId);
      setForms((prev) => [newForm, ...prev]);
      toast.success("Formulário duplicado!");
    } catch {
      toast.error("Erro ao duplicar formulário.");
    } finally {
      setDuplicatingFormId(null);
    }
  };

  const handleTogglePin = (formId: string) => {
    setPinnedFormIds((prev) => {
      const next = prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId];
      localStorage.setItem("onb-pinned-forms", JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteForm = async (formId: string) => {
    setIsDeletingForm(true);
    try {
      await formService.deleteForm(formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
      if (expandedFormId === formId) setExpandedFormId(null);
      setPendingDeleteFormId(null);
      toast.success("Formulário deletado!");
    } catch {
      toast.error("Erro ao deletar formulário.");
    } finally {
      setIsDeletingForm(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-[1400px] mx-auto px-5 md:px-8 pt-6 text-zinc-900 dark:text-zinc-50 font-sans">
      {/* ─── 1) Header ─── */}
      <div className="flex flex-col gap-4 mb-4 shrink-0">
        {/* Line 1: Title & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Inbox</h1>
            <p className="text-[13px] text-zinc-500 mt-1">Tudo que chegou dos seus formulários.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Button
              className="h-9 px-4 bg-primary hover:bg-primary/85 text-white font-semibold text-[13px] shadow-sm"
              onClick={() => router.push("?new=1")}
            >
              <Plus size={14} className="mr-2" /> Novo Formulário
            </Button>
          </div>
        </div>

        {/* Line 2: Search & Views */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div className="relative w-full md:max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente, formulário, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 h-9 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary transition-all font-medium"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
                  <Filter size={14} className="mr-2" /> Views Salvas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Todos (Padrão)</DropdownMenuItem>
                <DropdownMenuItem>Clientes VIP</DropdownMenuItem>
                <DropdownMenuItem>Em Atraso</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "respostas" | "formularios")} className="flex-1 min-h-0 flex flex-col w-full">
        {/* Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
          <TabsList className="bg-zinc-100 dark:bg-[#1A1A1A] p-1 h-9 items-center rounded-md border border-black/5 dark:border-white/5 w-full sm:w-fit">
            <TabsTrigger
              value="respostas"
              className="flex-1 sm:flex-none text-[13px] leading-none px-4 h-7 rounded-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#2C2C2C] data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white transition-all"
            >
              Respostas
            </TabsTrigger>
            <TabsTrigger
              value="formularios"
              className="flex-1 sm:flex-none text-[13px] leading-none px-4 h-7 rounded-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#2C2C2C] data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white transition-all"
            >
              <span className="hidden sm:inline">Meus </span>Formulários
            </TabsTrigger>
          </TabsList>

          {/* Sort & Display options */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 text-[12px] px-3 font-semibold border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-300 relative",
                    activeFilterCount > 0 && "border-primary text-primary dark:border-primary dark:text-primary",
                  )}
                >
                  <Filter size={13} className="mr-2" /> Filtros
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-64 p-0 rounded-xl overflow-hidden shadow-xl border-zinc-200 dark:border-white/10"
              >
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                    Filtros
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setFilterFormId("all");
                        setFilterDateRange("all");
                      }}
                      className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>

                {/* Date range */}
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                  <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Período
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { value: "all", label: "Todos" },
                        { value: "today", label: "Hoje" },
                        { value: "week", label: "Esta semana" },
                        { value: "month", label: "Este mês" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFilterDateRange(opt.value)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-left transition-colors",
                          filterDateRange === opt.value
                            ? "bg-primary/10 text-primary"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form filter */}
                {formOptions.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      Formulário
                    </p>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => setFilterFormId("all")}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-left transition-colors flex items-center gap-2",
                          filterFormId === "all"
                            ? "bg-primary/10 text-primary"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5",
                        )}
                      >
                        <Check size={12} className={filterFormId === "all" ? "opacity-100" : "opacity-0"} />
                        Todos
                      </button>
                      {formOptions.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFilterFormId(f.id)}
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-left transition-colors flex items-center gap-2",
                            filterFormId === f.id
                              ? "bg-primary/10 text-primary"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5",
                          )}
                        >
                          <Check size={12} className={filterFormId === f.id ? "opacity-100" : "opacity-0"} />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 text-[12px] px-3 font-semibold border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-300"
                >
                  Ordenar <ChevronRight size={13} className="ml-1.5 text-zinc-400 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(
                  [
                    { value: "recent", label: "Mais recentes" },
                    { value: "risk", label: "Por risco" },
                    { value: "attachments", label: "Anexos pendentes" },
                    { value: "inactive", label: "Mais antigos" },
                  ] as const
                ).map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className="flex items-center gap-2"
                  >
                    <Check size={13} className={sortBy === opt.value ? "text-primary" : "opacity-0"} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-6">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <TabsContent value="respostas" className="mt-0 outline-none flex-1 min-h-0 flex flex-col gap-3">
              {/* Clickable Metrics Bar */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none shrink-0">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    activeFilter === "all"
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  Todas <span className="text-inherit opacity-80 font-medium">{inboxItems.length}</span>
                </button>
                <button
                  onClick={() => setActiveFilter("new")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    activeFilter === "new"
                      ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800/60 dark:text-blue-300"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Novas{" "}
                  <span className="text-inherit opacity-80 font-medium">{stats.newCount}</span>
                </button>
                <button
                  onClick={() => setActiveFilter("reviewing")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    activeFilter === "reviewing"
                      ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/40 dark:border-orange-800/60 dark:text-orange-300"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Em revisão{" "}
                  <span className="text-inherit opacity-80 font-medium">{stats.reviewingCount}</span>
                </button>
                <button
                  onClick={() => setActiveFilter(activeFilter === "risk" ? "all" : "risk")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    activeFilter === "risk"
                      ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-800/60 dark:text-red-300"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Risco{" "}
                  <span className="text-inherit opacity-80 font-medium">{stats.riskCount}</span>
                </button>
                <div className="px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-1.5 border bg-white border-zinc-200 text-zinc-500 dark:bg-[#111] dark:border-zinc-800 shrink-0 cursor-default">
                  <Clock size={12} className="text-zinc-400" /> SLA{" "}
                  <span className="text-zinc-900 dark:text-white">{stats.avgResponseTimeHours}h</span>
                </div>
              </div>

              {/* Inbox List (Apple Mail Like) */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col items-stretch outline-none">
                {filteredItems.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <CheckCircle2 size={32} className="text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">Nenhuma resposta encontrada</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                      Tente ajustar os filtros ou aguarde novas respostas.
                    </p>
                  </div>
                )}
                {paginatedItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setFocusItem(item)}
                    className={cn(
                      "group flex gap-3 p-4 border-b border-zinc-100 dark:border-white/5 last:border-0 cursor-pointer transition-colors relative hover:bg-zinc-50/80 dark:hover:bg-white/[0.02]",
                      item.status === "new"
                        ? "bg-white dark:bg-[#111]"
                        : "bg-zinc-50/30 dark:bg-[#0A0A0A]/50 text-zinc-500",
                    )}
                  >
                    {/* Status dot */}
                    <div className="pt-1.5 shrink-0 flex items-start justify-center w-3">
                      {item.status === "new" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>

                    {/* Compact layout */}
                    <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                      {/* Left Block: Client & Form */}
                      <div className="flex-1 min-w-0 pr-12 md:pr-4">
                        <div className="flex items-center gap-2 mb-[3px]">
                          <span
                            className={cn(
                              "text-[14px] font-bold truncate",
                              item.status === "new"
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-700 dark:text-zinc-300",
                            )}
                          >
                            {item.clientName}
                          </span>
                          {item.vip && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 h-4 text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-wider"
                            >
                              VIP
                            </Badge>
                          )}
                          <span className="hidden md:inline-block text-zinc-300 dark:text-zinc-700 mx-1">•</span>
                          <span className="text-[12.5px] font-medium text-zinc-500 truncate hidden md:block">
                            {item.formName}
                          </span>
                        </div>
                        {/* Form name — mobile only subtitle */}
                        <p className="text-[11.5px] font-medium text-zinc-400 dark:text-zinc-500 truncate mb-[2px] md:hidden">
                          {item.formName}
                        </p>
                        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate">{item.summary}</p>
                      </div>

                      {/* Right Block: Badges & Time (Desktop only) */}
                      <div className="hidden md:flex shrink-0 items-center gap-3">
                        <div className="flex items-center gap-2 opacity-100 group-hover:opacity-0 transition-opacity">
                          {item.attachments > 0 && <Paperclip size={13} className="text-zinc-400" />}
                          {item.aiRisk !== "low" && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-transparent text-[10px] px-1.5 py-0 h-5",
                                item.aiRisk === "high"
                                  ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
                              )}
                            >
                              {item.aiRisk === "high" ? "Risco Alto" : "Atenção"}
                            </Badge>
                          )}
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute right-4 hidden md:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 bg-gradient-to-l from-white via-white to-transparent dark:from-[#111] dark:via-[#111] pl-6 py-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingStatusId === item.id}
                            className="h-7 px-3 text-[11px] font-semibold rounded-sm bg-white border-zinc-200 text-zinc-700 shadow-sm hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 hidden xl:flex disabled:opacity-50"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, "reviewing"); }}
                          >
                            Revisar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pendingStatusId === item.id}
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-sm disabled:opacity-50"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, "reviewed"); }}
                          >
                            <CheckCircle2 size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-sm"
                          >
                            <MoreHorizontal size={13} />
                          </Button>
                        </div>
                        <span className="text-[11.5px] font-medium text-zinc-400 w-[60px] text-right tabular-nums group-hover:opacity-0 transition-opacity">
                          {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp — Mobile only, absolute top-right */}
                    <span className="md:hidden absolute right-4 top-4 text-[11.5px] font-medium text-zinc-400 tabular-nums">
                      {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: false, locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between pt-3 pb-1">
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredItems.length)} de {filteredItems.length} respostas
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="h-7 px-2.5 rounded-md text-[12px] font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={cn(
                          "h-7 w-7 rounded-md text-[12px] font-semibold transition-colors",
                          i === currentPage
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                            : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5",
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="h-7 px-2.5 rounded-md text-[12px] font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="formularios" className="mt-0 outline-none flex-1 min-h-0 overflow-y-auto space-y-4">
              {/* Clickable Filters for Forms */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => setFormTab("ativos")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    formTab === "ativos"
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  Ativos{" "}
                  <span className="opacity-80 font-medium">{forms.filter((f) => f.status === "active").length}</span>
                </button>
                <button
                  onClick={() => setFormTab("rascunhos")}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-[12px] font-semibold flex items-center gap-2 border transition-colors shrink-0",
                    formTab === "rascunhos"
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-[#111] dark:border-zinc-800 dark:text-zinc-400",
                  )}
                >
                  Rascunhos{" "}
                  <span className="opacity-80 font-medium">{forms.filter((f) => f.status === "draft").length}</span>
                </button>
              </div>

              {/* Forms List View */}
              <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col items-stretch">
                {(() => {
                  let visibleForms = forms.filter((f) =>
                    formTab === "ativos" ? f.status === "active" : f.status === "draft",
                  );
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    visibleForms = visibleForms.filter(
                      (f) =>
                        f.name.toLowerCase().includes(q) || (f.clientName && f.clientName.toLowerCase().includes(q)),
                    );
                  }
                  if (visibleForms.length === 0) {
                    return (
                      <div className="py-20 flex flex-col items-center justify-center text-center">
                        <FileText size={32} className="text-zinc-300 dark:text-zinc-700 mb-3" />
                        <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">
                          {formTab === "rascunhos" ? "Nenhum rascunho" : "Nenhum formulário ativo"}
                        </p>
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                          {formTab === "rascunhos"
                            ? "Você não possui formulários em rascunho."
                            : "Crie seu primeiro formulário para começar."}
                        </p>
                      </div>
                    );
                  }
                  return visibleForms.map((form) => {
                    const formResponses = inboxItems.filter((i) => i.formId === form.id);
                    const responseCount = formResponses.length;
                    const lastResponse = formResponses[0]?.submittedAt;
                    const isExpanded = expandedFormId === form.id;
                    return (
                      <div key={form.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0">
                        <div
                          className="group flex items-center gap-3 p-4 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer relative"
                          onClick={() => setExpandedFormId((prev) => (prev === form.id ? null : form.id))}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0 pr-10 sm:pr-0">
                            <div className="shrink-0 text-zinc-400">
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </div>
                            <div className="w-9 h-9 rounded-md bg-blue-50 text-primary dark:bg-blue-900/20 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800/50">
                              <Layout size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {form.name}
                                </p>
                                <span
                                  className={cn(
                                    "shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                                    form.status === "active"
                                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                                  )}
                                >
                                  {form.status === "active" ? "Ativo" : "Rascunho"}
                                </span>
                                {(() => {
                                  const exp = getDraftExpiration(form);
                                  if (!exp) return null;
                                  const isUrgent = exp.daysLeft <= 1;
                                  return (
                                    <span
                                      className={cn(
                                        "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                                        isUrgent
                                          ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                          : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
                                      )}
                                    >
                                      {exp.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-3 text-[12.5px] text-zinc-500 font-medium mt-0.5">
                                <span className="flex items-center gap-1.5">
                                  <Inbox size={12} className="text-zinc-400" />
                                  {responseCount} {responseCount === 1 ? "resposta" : "respostas"}
                                </span>
                                <span>
                                  Última:{" "}
                                  {lastResponse
                                    ? formatDistanceToNow(new Date(lastResponse), { addSuffix: false, locale: ptBR })
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div
                            className="absolute right-4 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0 shrink-0 flex items-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "hidden sm:flex h-8 w-8 rounded-sm transition-colors",
                                      form.status === "active"
                                        ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                        : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                                    )}
                                    onClick={() => handleTogglePublish(form)}
                                    disabled={togglingFormId === form.id}
                                  >
                                    {togglingFormId === form.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Power size={14} />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="text-[11px]">
                                  {form.status === "active" ? "Despublicar" : "Publicar"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {form.status === "active" && (
                            <Button
                              variant="outline"
                              className="hidden sm:flex h-8 px-3 text-[12px] font-semibold border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm text-zinc-700 dark:text-zinc-300 min-w-[110px]"
                              onClick={() => handleCopyFormLink(form)}
                            >
                              {copiedFormId === form.id ? (
                                <>
                                  <Check size={13} className="mr-2 text-emerald-500" /> Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy size={13} className="mr-2 text-zinc-400" /> Copiar link
                                </>
                              )}
                            </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-sm"
                                >
                                  <MoreHorizontal size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/forms/${form.id}`}>
                                    <Eye size={13} className="mr-2 text-zinc-400" /> Editar formulário
                                  </Link>
                                </DropdownMenuItem>
                                {form.status === "active" && (
                                <DropdownMenuItem className="sm:hidden" onClick={() => handleCopyFormLink(form)}>
                                  <Copy size={13} className="mr-2 text-zinc-400" /> Copiar link
                                </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="sm:hidden"
                                  onClick={() => handleTogglePublish(form)}
                                  disabled={togglingFormId === form.id}
                                >
                                  <Power size={13} className="mr-2 text-zinc-400" />
                                  {form.status === "active" ? "Despublicar" : "Publicar"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="sm:hidden" />
                                <DropdownMenuItem
                                  onClick={() => handleDuplicateForm(form.id)}
                                  disabled={duplicatingFormId === form.id}
                                >
                                  {duplicatingFormId === form.id ? (
                                    <>
                                      <Loader2 size={13} className="mr-2 animate-spin" /> Duplicando...
                                    </>
                                  ) : (
                                    <>
                                      <CopyCheck size={13} className="mr-2 text-zinc-400" /> Duplicar formulário
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setPendingDeleteFormId(form.id)}
                                  className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30"
                                >
                                  <Trash2 size={13} className="mr-2" /> Deletar formulário
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Expanded responses section */}
                        {isExpanded && (
                          <div className="bg-zinc-50/70 dark:bg-zinc-900/20 border-t border-zinc-100 dark:border-white/5 px-4 py-3">
                            {formResponses.length === 0 ? (
                              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 italic py-1">
                                Nenhuma resposta recebida ainda.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {formResponses.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-white dark:hover:bg-white/5 transition-colors group/row"
                                  >
                                    <div
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                        item.status === "new" ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600",
                                      )}
                                    />
                                    <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 truncate flex-1">
                                      {item.clientName}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "text-[9px] px-1.5 py-0 h-4 border-transparent font-bold uppercase shrink-0",
                                        item.status === "new"
                                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                          : item.status === "reviewing"
                                            ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                            : "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400",
                                      )}
                                    >
                                      {item.status === "new"
                                        ? "Nova"
                                        : item.status === "reviewing"
                                          ? "Em revisão"
                                          : "Revisada"}
                                    </Badge>
                                    <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">
                                      {formatDistanceToNow(new Date(item.submittedAt), {
                                        addSuffix: false,
                                        locale: ptBR,
                                      })}
                                    </span>
                                    <Link
                                      href={`/dashboard/responses/${item.id}`}
                                      className="shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ArrowUpRight size={13} />
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </TabsContent>
          </div>

          {/* ─── COLUNA DIREITA (Ações Rápidas & Dashboard Lateral) ─── */}
          <div className="hidden lg:flex flex-col gap-6 w-[280px] xl:w-[320px] shrink-0 overflow-y-auto">
            {/* Bloco 1: Ações Rápidas */}
            <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Ações Rápidas
              </h3>
              <div className="space-y-1">
                <Button
                  onClick={() => router.push("?new=1")}
                  variant="ghost"
                  className="w-full justify-start h-9 px-3 text-[13px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-900 dark:text-zinc-200 transition-all"
                >
                  <Plus size={14} className="mr-3 text-zinc-400" /> Novo Formulário
                </Button>

                {/* Copiar link rápido */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-9 px-3 text-[13px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-900 dark:text-zinc-200 transition-all disabled:opacity-40"
                      disabled={activeForms.length === 0}
                    >
                      <Copy size={14} className="mr-3 text-zinc-400" /> Copiar link rápido
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {activeForms.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/f/${f.slug}`);
                          toast.success(`Link de "${f.name}" copiado!`);
                        }}
                      >
                        <FileText size={13} className="mr-2 text-zinc-400" />
                        <span className="truncate">{f.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Ver novas respostas */}
                <Button
                  variant="ghost"
                  className="w-full justify-start h-9 px-3 text-[13px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-900 dark:text-zinc-200 transition-all"
                  onClick={() => {
                    setActiveTab("respostas");
                    setActiveFilter("new");
                  }}
                >
                  <Inbox size={14} className="mr-3 text-zinc-400" />
                  Novas respostas
                  {stats.newCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                      {stats.newCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* Bloco 2: Últimos Formulários Gerados */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                Atalhos
              </h3>
              <div className="space-y-2">
                {shortcutForms.length === 0 ? (
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-500 italic px-1">
                    Nenhum formulário criado ainda.
                  </p>
                ) : (
                  shortcutForms.map((f) => {
                    const isPinned = pinnedFormIds.includes(f.id);
                    return (
                      <Link
                        key={`short-${f.id}`}
                        href={`/dashboard/forms/${f.id}`}
                        className="group flex items-center justify-between px-3 py-2 bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="min-w-0 pr-2 flex items-center gap-2.5">
                          {isPinned && <div className="w-1 h-4 rounded-full bg-primary shrink-0" />}
                          <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                            <Layout size={10} className="text-zinc-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {f.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-7 w-7 rounded-sm transition-opacity bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                                    isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                  )}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleTogglePin(f.id);
                                  }}
                                >
                                  <Pin
                                    size={12}
                                    className={cn(
                                      isPinned ? "text-primary fill-primary" : "text-zinc-600 dark:text-zinc-300",
                                    )}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-[11px]">
                                {isPinned ? "Desafixar" : "Fixar"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigator.clipboard.writeText(`${window.location.origin}/f/${f.slug}`);
                                    toast.success("Link copiado!");
                                  }}
                                >
                                  <Copy size={12} className="text-zinc-600 dark:text-zinc-300" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-[11px]">Copiar link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </Tabs>

      {/* ─── FOCUS MODE DRAWER (Response Sheet) ─── */}
      <Sheet open={!!focusItem} onOpenChange={(open) => !open && setFocusItem(null)}>
        <SheetContent className="sm:max-w-[440px] p-0 w-[90vw] bg-white dark:bg-[#0A0A0A] border-l dark:border-zinc-800 flex flex-col font-sans shadow-2xl">
          <SheetHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-[16px] font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  Resumo &mdash; {focusItem?.clientName}
                </SheetTitle>
                {focusItem?.vip && (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0 h-5 border-transparent font-bold"
                  >
                    VIP
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-5 border-transparent font-bold uppercase",
                    focusItem?.status === "new"
                      ? "bg-blue-50 text-primary dark:bg-blue-900/30 dark:text-blue-400"
                      : focusItem?.status === "reviewing"
                        ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400",
                  )}
                >
                  {focusItem?.status === "new"
                    ? "Novo recebimento"
                    : focusItem?.status === "reviewing"
                      ? "Em revisão"
                      : "Aguardando"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/dashboard/responses/${focusItem?.id}`}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mr-6"
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent className="text-[11px]">Abrir página detalhada</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Meta: form + timestamp */}
            <div className="flex items-center gap-2 text-[12px] text-zinc-400 dark:text-zinc-500 font-medium">
              <FileText size={13} className="shrink-0" />
              <span className="truncate">{focusItem?.formName}</span>
              <span className="shrink-0">·</span>
              <span className="shrink-0">
                {focusItem
                  ? formatDistanceToNow(new Date(focusItem.submittedAt), { addSuffix: true, locale: ptBR })
                  : "—"}
              </span>
            </div>

            {/* Resumo do briefing */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Resumo
              </h4>
              <p className="text-[13.5px] text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                {focusItem?.summary}
              </p>
            </div>

            {/* Pontos de atenção (data-driven, no hardcoded text) */}
            {focusItem?.aiRisk !== "low" && (
              <div className="space-y-1.5">
                <h4
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                    focusItem?.aiRisk === "high"
                      ? "text-red-500 dark:text-red-400"
                      : "text-orange-500 dark:text-orange-400",
                  )}
                >
                  <AlertTriangle size={12} />
                  {focusItem?.aiRisk === "high" ? "Risco alto" : "Atenção"}
                </h4>
                <div
                  className={cn(
                    "p-3 rounded-lg border text-[12.5px] font-medium leading-relaxed",
                    focusItem?.aiRisk === "high"
                      ? "bg-red-50/60 dark:bg-red-950/10 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300"
                      : "bg-orange-50/60 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-300",
                  )}
                >
                  {focusItem?.aiRisk === "high"
                    ? "Este briefing tem indicadores de risco. Revise com atenção antes de aceitar o projeto."
                    : "Há pontos de atenção neste briefing. Confirme as expectativas com o cliente antes de prosseguir."}
                </div>
              </div>
            )}

            {/* Anexos (real data from InboxItem) */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip size={12} /> Anexos
              </h4>
              {focusItem?.attachments === 0 ? (
                <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500 italic p-3 bg-zinc-50 dark:bg-white/5 rounded-lg border border-zinc-100 dark:border-transparent">
                  Nenhum anexo enviado.
                </p>
              ) : (
                <div
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-3",
                    focusItem && focusItem.attachmentsOk < focusItem.attachments
                      ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900/30"
                      : "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30",
                  )}
                >
                  {focusItem && focusItem.attachmentsOk < focusItem.attachments ? (
                    <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">
                      {focusItem?.attachmentsOk} de {focusItem?.attachments}{" "}
                      {focusItem?.attachments === 1 ? "arquivo validado" : "arquivos validados"}
                    </p>
                    {focusItem && focusItem.attachmentsOk < focusItem.attachments && (
                      <p className="text-[11.5px] text-orange-600 dark:text-orange-400 font-medium mt-0.5">
                        {focusItem.attachments - focusItem.attachmentsOk}{" "}
                        {focusItem.attachments - focusItem.attachmentsOk === 1
                          ? "arquivo com problema"
                          : "arquivos com problema"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0A0A0A] flex items-center gap-3">
            <Button
              variant="outline"
              disabled={!!pendingStatusId}
              className="flex-[0.4] rounded-md h-10 border-zinc-200 dark:border-zinc-700 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 shadow-sm disabled:opacity-50 flex items-center gap-2"
              onClick={() => focusItem && handleUpdateStatus(focusItem.id, "reviewed", true)}
            >
              {pendingStatusId === focusItem?.id && <span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />}
              Marcar revisado
            </Button>
            <Button
              asChild
              className="flex-1 rounded-md h-10 bg-primary text-white hover:bg-primary/85 font-semibold text-[13px] shadow-sm"
            >
              <Link
                href={`/dashboard/responses/${focusItem?.id}`}
                className="w-full h-full flex items-center justify-center gap-2"
              >
                Abrir página detalhada <ArrowUpRight size={14} className="text-white/80" />
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Form Confirmation */}
      <ConfirmDeleteDialog
        open={!!pendingDeleteFormId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFormId(null);
        }}
        title="Deletar formulário?"
        description="Essa ação é permanente. O formulário e todas as suas respostas serão removidos."
        confirmLabel="Deletar formulário"
        onConfirm={() => {
          if (pendingDeleteFormId) handleDeleteForm(pendingDeleteFormId);
        }}
        isLoading={isDeletingForm}
      />
    </div>
  );
}
