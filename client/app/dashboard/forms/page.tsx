"use client";

import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  Inbox,
  Trash2,
  Plus,
  MoreHorizontal,
  Copy,
  FolderInput,
  ExternalLink,
  X,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formService, folderService } from "@/app/lib/services";
import type { Form, Folder } from "@/app/lib/types";
import { useWorkspace } from "@/app/contexts";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Constants ───────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
  archived: "Arquivado",
};

const STATUS_DOT: Record<string, string> = {
  active: "#10b981",
  draft: "#a1a1aa",
  archived: "#f59e0b",
};

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

// ─── Form Card ───────────────────────────────────────────────

function FormCard({
  form,
  folders,
  onMoveToFolder,
  onDuplicate,
  onDelete,
}: {
  form: Form;
  folders: Folder[];
  onMoveToFolder: (formId: string, folderId: string | null) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const brandColor = form.branding?.primaryColor || "#6366f1";
  const totalFields = (form.groups ?? []).reduce((acc, g) => acc + (g.fields?.length ?? 0), 0);
  const sections = (form.groups ?? []).length;
  const dotColor = STATUS_DOT[form.status] ?? STATUS_DOT.draft;
  const initial = (form.name || "F")[0].toUpperCase();

  return (
    <div className="group relative bg-white dark:bg-[#111] border-y sm:border-x sm:border border-zinc-200/60 dark:border-white/[0.06] rounded-none sm:rounded-2xl overflow-hidden sm:hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] dark:sm:hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)] sm:hover:-translate-y-0.5 transition-all duration-200">
      {/* Top accent bar */}
      <div className="h-[3px] w-full" style={{ background: brandColor }} />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Brand initial */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[14px] font-bold"
            style={{ background: brandColor + "18", color: brandColor }}
          >
            {initial}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <Link href={`/dashboard/forms/${form.id}`}>
              <p className="text-[13.5px] font-bold text-zinc-900 dark:text-white truncate leading-snug hover:underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600">
                {form.name}
              </p>
            </Link>
            {form.clientName && (
              <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{form.clientName}</p>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 -mr-1 -mt-0.5"
              >
                <MoreHorizontal size={14} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg">
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/forms/${form.id}`}
                  className="flex items-center gap-2 text-[13px] cursor-pointer"
                >
                  <ExternalLink size={13} className="text-zinc-400" />
                  Abrir
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 text-[13px]">
                  <FolderInput size={13} className="text-zinc-400" />
                  Mover para pasta
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 rounded-xl">
                  {form.folderId && (
                    <>
                      <DropdownMenuItem className="text-[12px]" onClick={() => onMoveToFolder(form.id, null)}>
                        Sem pasta
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {folders.length === 0 ? (
                    <DropdownMenuItem disabled className="text-[12px] text-zinc-400">
                      Nenhuma pasta
                    </DropdownMenuItem>
                  ) : (
                    folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        className="flex items-center gap-2 text-[12px]"
                        onClick={() => onMoveToFolder(form.id, folder.id)}
                        disabled={form.folderId === folder.id}
                      >
                        <FolderOpen size={12} className="text-zinc-400" />
                        <span className="truncate">{folder.name}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem className="flex items-center gap-2 text-[13px]" onClick={() => onDuplicate(form.id)}>
                <Copy size={13} className="text-zinc-400" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-[13px] text-red-500 focus:text-red-600"
                onClick={() => onDelete(form.id)}
              >
                <Trash2 size={13} />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta: fields + sections */}
        {(totalFields > 0 || sections > 0) && (
          <div className="flex items-center gap-2 text-[11.5px] text-zinc-400 dark:text-zinc-500">
            <span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">{totalFields}</span> campos
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">{sections}</span> seções
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-50 dark:border-white/[0.04] mt-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
            <span className="text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
              {STATUS_LABELS[form.status] ?? form.status}
            </span>
            {(() => {
              const exp = getDraftExpiration(form);
              if (!exp) return null;
              const isUrgent = exp.daysLeft <= 1;
              return (
                <span
                  className={cn(
                    "ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
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
          <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
            <span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">{form.submissionCount ?? 0}</span> resp.
            </span>
            {form.updatedAt && (
              <span>{formatDistanceToNow(new Date(form.updatedAt), { addSuffix: true, locale: ptBR })}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ───────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="h-[3px] bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
            <div className="h-2.5 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-2.5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
          <div className="h-2.5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
        </div>
        <div className="pt-3 border-t border-zinc-50 dark:border-white/[0.04] flex justify-between">
          <div className="h-2.5 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
          <div className="h-2.5 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function FormsPage() {
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingForms, setIsLoadingForms] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "unfiled">(null);

  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDeletingFolderId, setIsDeletingFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;

    setIsLoadingFolders(true);
    folderService
      .getFolders(activeWorkspace.id)
      .then(setFolders)
      .catch(() => toast.error("Erro ao carregar pastas"))
      .finally(() => setIsLoadingFolders(false));

    setIsLoadingForms(true);
    formService
      .getForms(activeWorkspace.id)
      .then(setForms)
      .catch(() => toast.error("Erro ao carregar formulários"))
      .finally(() => setIsLoadingForms(false));
  }, [activeWorkspace]);

  const displayedForms =
    selectedFolderId === null
      ? forms
      : selectedFolderId === "unfiled"
        ? forms.filter((f) => !f.folderId)
        : forms.filter((f) => f.folderId === selectedFolderId);

  const selectedFolder =
    typeof selectedFolderId === "string" && selectedFolderId !== "unfiled"
      ? folders.find((f) => f.id === selectedFolderId)
      : null;

  const pageTitle =
    selectedFolderId === null
      ? "Formulários"
      : selectedFolderId === "unfiled"
        ? "Sem pasta"
        : (selectedFolder?.name ?? "Formulários");

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const folder = await folderService.createFolder(activeWorkspace.id, newFolderName.trim());
      setFolders((prev) => [folder, ...prev]);
      setNewFolderName("");
      setShowFolderInput(false);
      toast.success("Pasta criada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar pasta");
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setIsDeletingFolderId(folderId);
    try {
      await folderService.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      toast.success("Pasta excluída");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir pasta");
    } finally {
      setIsDeletingFolderId(null);
    }
  }

  async function handleMoveToFolder(formId: string, folderId: string | null) {
    try {
      await folderService.assignFormToFolder(formId, folderId);
      setForms((prev) => prev.map((f) => (f.id === formId ? { ...f, folderId: folderId ?? undefined } : f)));
      toast.success(folderId ? "Formulário movido" : "Formulário removido da pasta");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao mover formulário");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const copy = await formService.duplicateForm(id);
      setForms((prev) => [copy, ...prev]);
      toast.success("Formulário duplicado");
    } catch {
      toast.error("Erro ao duplicar formulário");
    }
  }

  async function handleDelete(id: string) {
    try {
      await formService.deleteForm(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
      toast.success("Formulário excluído");
    } catch {
      toast.error("Erro ao excluir formulário");
    }
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* ─── Left Sidebar ─── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-zinc-100 dark:border-white/[0.05] bg-zinc-50/40 dark:bg-[#0A0A0A]">
        <div className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {/* All */}
          <SidebarItem
            icon={Inbox}
            label="Todos"
            count={forms.length}
            active={selectedFolderId === null}
            onClick={() => setSelectedFolderId(null)}
          />

          {/* Unfiled */}
          <SidebarItem
            icon={FileText}
            label="Sem pasta"
            count={forms.filter((f) => !f.folderId).length}
            active={selectedFolderId === "unfiled"}
            onClick={() => setSelectedFolderId("unfiled")}
          />

          {/* Folder list */}
          <div className="pt-2">
            {folders.length > 0 && (
              <>
                <p className="px-3 mb-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                  Pastas
                </p>
                {folders.map((folder) => {
                  const count = forms.filter((f) => f.folderId === folder.id).length;
                  return (
                    <div key={folder.id} className="group/folder flex items-center gap-0.5">
                      <SidebarItem
                        icon={FolderOpen}
                        label={folder.name}
                        count={count}
                        active={selectedFolderId === folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="flex-1 min-w-0"
                      />
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        disabled={isDeletingFolderId === folder.id}
                        className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-1.5 rounded-md text-zinc-300 dark:text-zinc-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {/* New folder — always visible inside the scroll area */}
            {showFolderInput ? (
              <form onSubmit={handleCreateFolder} className="flex items-center gap-1 mt-1">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta"
                  autoFocus
                  className="h-7 text-[11.5px] rounded-lg flex-1 min-w-0"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="h-7 px-2 text-[11px] shrink-0"
                >
                  OK
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFolderInput(false);
                    setNewFolderName("");
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 shrink-0"
                >
                  <X size={11} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowFolderInput(true)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors mt-1"
              >
                <FolderPlus size={13} />
                Nova pasta
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 pb-32 md:pb-8">
        {/* Mobile Folder Filter Chips — above title */}
        <div className="md:hidden -mx-4 px-4 mb-5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 w-max pb-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors",
                selectedFolderId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
              )}
            >
              <Inbox size={11} />
              Todos
              <span className={cn("text-[10px] ml-0.5", selectedFolderId === null ? "opacity-70" : "opacity-50")}>
                {forms.length}
              </span>
            </button>
            <button
              onClick={() => setSelectedFolderId("unfiled")}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors",
                selectedFolderId === "unfiled"
                  ? "bg-primary text-primary-foreground"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
              )}
            >
              <FileText size={11} />
              Sem pasta
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors",
                  selectedFolderId === folder.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                )}
              >
                <FolderOpen size={11} />
                {folder.name}
                <span
                  className={cn("text-[10px] ml-0.5", selectedFolderId === folder.id ? "opacity-70" : "opacity-50")}
                >
                  {forms.filter((f) => f.folderId === folder.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4 md:mb-6">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[18px] md:text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">
              {pageTitle}
            </h1>
            {!isLoadingForms && (
              <span className="text-[12px] md:text-[13px] font-medium text-zinc-400 dark:text-zinc-500">
                {displayedForms.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="h-8 w-8 px-0 sm:w-auto sm:px-3.5 text-[12.5px] font-semibold gap-1.5 shrink-0"
            onClick={() => router.push("?new=1")}
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">Novo formulário</span>
          </Button>
        </div>

        {/* Grid */}
        {isLoadingForms ? (
          <div className="-mx-4 sm:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-3 md:gap-4 border-t sm:border-transparent border-zinc-200/60 dark:border-white/[0.06]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayedForms.length === 0 ? (
          <EmptyState selectedFolderId={selectedFolderId} />
        ) : (
          <div className="-mx-4 sm:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-3 md:gap-4 border-t sm:border-transparent border-zinc-200/60 dark:border-white/[0.06]">
            {displayedForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                folders={folders}
                onMoveToFolder={handleMoveToFolder}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar Item ─────────────────────────────────────────────

function SidebarItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  className,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors text-left",
        active
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-sidebar-accent hover:text-zinc-900 dark:hover:text-zinc-100",
        className,
      )}
    >
      <Icon size={13} className="shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span className={cn("text-[10.5px] shrink-0", active ? "opacity-70" : "opacity-50")}>{count}</span>
    </button>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({ selectedFolderId }: { selectedFolderId: string | null | "unfiled" }) {
  const message =
    selectedFolderId === "unfiled"
      ? "Todos os formulários estão em pastas."
      : selectedFolderId
        ? "Esta pasta está vazia."
        : "Crie seu primeiro formulário.";

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
          <FileText size={22} className="text-zinc-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Plus size={11} className="text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-zinc-600 dark:text-zinc-400">Nenhum formulário aqui</p>
      <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500 mt-1">{message}</p>
    </div>
  );
}
