"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Check } from "lucide-react";
import { createWorkspace } from "@/app/lib/services/workspaceService";
import type { Workspace } from "@/app/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUpgradeModal, handlePlanLimitError } from "@/app/contexts";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: Workspace) => void;
  /** When true, dialog cannot be dismissed without creating a workspace (first login) */
  required?: boolean;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const PRESET_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0f172a"];

export default function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
  required = false,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const { showUpgradeModal } = useUpgradeModal();

  const slug = slugify(name);
  const initial = name.trim()[0]?.toUpperCase() ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug) return;
    setLoading(true);
    try {
      const ws = await createWorkspace(name.trim(), slug, brandColor);
      toast.success("Workspace criado!");
      setName("");
      setBrandColor(PRESET_COLORS[0]);
      onCreated(ws);
    } catch (err: any) {
      const msg = err?.message || "";
      if (!handlePlanLimitError(msg, showUpgradeModal)) {
        toast.error("Erro ao criar workspace.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={required ? () => {} : onOpenChange}>
      <DialogContent
        showCloseButton={!required}
        className="p-0 gap-0 max-w-[380px] overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-white/[0.06] bg-white dark:bg-[#111] shadow-xl"
      >
        <form onSubmit={handleSubmit}>
          {/* ── Top section — avatar preview ── */}
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            {/* Live workspace avatar */}
            <div
              className="w-[64px] h-[64px] rounded-2xl flex items-center justify-center mb-5 transition-colors duration-200 ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
              style={{ background: brandColor + "1a" }}
            >
              {initial ? (
                <span
                  className="text-[26px] font-bold leading-none transition-all duration-150"
                  style={{ color: brandColor }}
                >
                  {initial}
                </span>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: brandColor + "80" }}>
                  <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
                  <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.5" />
                  <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.5" />
                  <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.25" />
                </svg>
              )}
            </div>

            {/* Title */}
            <DialogTitle className="text-[15px] font-semibold text-zinc-900 dark:text-white mb-1">
              {required ? "Crie seu workspace" : "Novo workspace"}
            </DialogTitle>
            <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
              {required
                ? "Seu espaço de trabalho para criar e gerenciar formulários."
                : "Organize formulários e equipes em um espaço separado."}
            </p>
          </div>

          {/* ── Form fields ── */}
          <div className="px-6 space-y-4 pb-6">
            {/* Name input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 block">
                Nome
              </label>
              <Input
                placeholder="Ex: Studio Lume"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={loading}
                className="h-9 text-[13.5px] rounded-xl bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/[0.07] focus-visible:ring-1 focus-visible:ring-offset-0"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
              />
              {slug && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                  onb.app/<span className="font-mono text-zinc-500 dark:text-zinc-500">{slug}</span>
                </p>
              )}
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 block">
                Cor
              </label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBrandColor(c)}
                    className="relative w-6 h-6 rounded-full shrink-0 transition-transform duration-150 hover:scale-110 flex items-center justify-center"
                    style={{ background: c }}
                  >
                    {brandColor === c && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            <button
              type="submit"
              disabled={!name.trim() || !slug || loading}
              className="w-full h-9 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: brandColor }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Criando…" : "Criar workspace"}
            </button>

            {!required && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="w-full h-9 rounded-xl text-[13px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
