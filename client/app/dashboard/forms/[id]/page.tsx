"use client";

import React, { useEffect, useState, use } from "react";
import { formService } from "@/app/lib/services";
import { Form, BrandingConfig, FieldGroup } from "@/app/lib/types";
import { ArrowLeft, Save, Eye, Palette, Smartphone, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { useOnboarding } from "@/app/contexts";
import FormFieldsEditor from "@/app/components/dashboard/FormFieldsEditor";
import BrandingEditor from "@/app/components/dashboard/BrandingEditor";
import PublishPanel from "@/app/components/dashboard/PublishPanel";
import FormPreview from "@/app/components/dashboard/FormPreview";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import FormEditorSkeleton from "./SkeletonLoader";

export default function FormEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [form, setForm] = useState<Form | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { completeStep } = useOnboarding();
  const [activePanel, setActivePanel] = useState<"fields" | "branding" | "publish">("fields");
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    formService.getForm(id).then((data) => {
      if (data) setForm(data);
      setIsLoading(false);
    });
  }, [id]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (!form) return;

    // Basic validation
    if (!form.name.trim()) {
      toast.error("O formulário precisa ter um nome.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await formService.saveForm(form);
      // Sync SEO metadata server-side
      await fetch(`/api/forms/${form.slug}/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          seoTitle: form.branding?.seoTitle,
          seoDescription: form.branding?.seoDescription,
          seoThumbnailUrl: form.branding?.seoThumbnailUrl,
          faviconUrl: form.branding?.faviconUrl,
          status: form.status,
        }),
      }).catch(() => {});

      setIsSaving(false);
      setHasUnsavedChanges(false);
      setSaveError(null);
      completeStep("form_customized");
      toast.success("Salvo com sucesso!");
    } catch (e: any) {
      console.error("Save error:", e);
      setIsSaving(false);
      const msg = e.message || "Tente novamente.";
      setSaveError(msg);
      toast.error(`Erro ao salvar: ${msg}`);
    }
  };

  const updateForm = (updates: Partial<Form>) => {
    if (!form) return;
    setForm({ ...form, ...updates });
    setHasUnsavedChanges(true);
  };

  if (isLoading || !form) {
    return <FormEditorSkeleton />;
  }

  return (
    <div className="flex flex-col absolute top-14 bottom-0 left-0 right-0 z-10 overflow-hidden bg-white dark:bg-[#0A0A0A]">
      {/* ─── Apple-style Top Bar ─── */}
      <header className="flex items-center px-4 lg:px-6 py-2.5 border-b border-zinc-200/50 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shrink-0">
        {/* Left — back + title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg w-8 h-8 shrink-0 text-zinc-500 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div className="hidden sm:block min-w-0">
            <h1 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none mb-0.5 truncate">
              {form.name}
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Editando</p>
            </div>
          </div>
        </div>

        {/* Center — Segmented Control */}
        <div className="flex items-center bg-zinc-100/80 dark:bg-white/5 rounded-lg p-0.5 border border-zinc-200/50 dark:border-transparent shrink-0 mx-1 sm:mx-4">
          <button
            onClick={() => setActivePanel("fields")}
            className={cn(
              "px-1.5 sm:px-4 lg:px-5 py-1.5 text-[10px] sm:text-[12.5px] font-semibold rounded-md transition-all duration-200",
              activePanel === "fields"
                ? "bg-white dark:bg-black/40 shadow-sm text-zinc-900 dark:text-white border border-black/[0.04] dark:border-white/10"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            Campos
          </button>
          <button
            onClick={() => setActivePanel("branding")}
            className={cn(
              "px-1.5 sm:px-4 lg:px-5 py-1.5 text-[10px] sm:text-[12.5px] font-semibold rounded-md transition-all duration-200",
              activePanel === "branding"
                ? "bg-white dark:bg-black/40 shadow-sm text-zinc-900 dark:text-white border border-black/[0.04] dark:border-white/10"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            Aparência
          </button>
          <button
            onClick={() => setActivePanel("publish")}
            className={cn(
              "px-1.5 sm:px-4 lg:px-5 py-1.5 text-[10px] sm:text-[12.5px] font-semibold rounded-md transition-all duration-200 flex items-center gap-1",
              activePanel === "publish"
                ? "bg-white dark:bg-black/40 shadow-sm text-zinc-900 dark:text-white border border-black/[0.04] dark:border-white/10"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            <Send size={11} className="hidden sm:block" /> Publicar
          </button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end">
          <span className="text-[12px] font-medium hidden md:block">
            {isSaving ? (
              <span className="text-zinc-400 dark:text-zinc-500">Salvando...</span>
            ) : saveError ? (
              <span className="text-red-500 dark:text-red-400 flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                <AlertCircle size={12} />
                Erro ao salvar
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-amber-500 dark:text-amber-400">Alterações não salvas</span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">Salvo</span>
            )}
          </span>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg px-3 sm:px-4 h-8 text-[12.5px] font-medium bg-primary hover:bg-primary/85 text-white shadow-sm transition-colors shrink-0"
          >
            Salvar
          </Button>

          {/* Mobile preview toggle */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg w-8 h-8 shrink-0 lg:hidden bg-zinc-50 dark:bg-white/5 text-zinc-500"
              >
                <Smartphone size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-[85vh] rounded-t-[2rem] p-6 flex justify-center bg-zinc-100 dark:bg-zinc-900"
            >
              <FormPreview form={form} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Panel (Occupies remaining space, handles own scroll/layout) */}
        <div className="flex-1 flex overflow-hidden relative bg-[#FAFAFA] dark:bg-[#0A0A0A]">
          {activePanel === "fields" ? (
            <FormFieldsEditor groups={form.groups || []} onChange={(groups) => updateForm({ groups })} />
          ) : activePanel === "branding" ? (
            <BrandingEditor config={form.branding} onChange={(branding) => updateForm({ branding })} />
          ) : (
            <PublishPanel
              form={form}
              onUpdate={updateForm}
              onBrandingUpdate={(updates) => updateForm({ branding: { ...form.branding, ...updates } })}
            />
          )}
        </div>

        {/* Right: Live Preview (desktop only, fixed width) */}
        <div className="hidden lg:flex w-[480px] xl:w-[540px] border-l border-zinc-200/50 dark:border-white/5 bg-zinc-100/50 dark:bg-[#111111] items-center justify-center p-0 overflow-hidden shrink-0 relative h-full">
          <div className="w-full flex justify-center h-full">
            <FormPreview form={form} />
          </div>
        </div>
      </div>
    </div>
  );
}
