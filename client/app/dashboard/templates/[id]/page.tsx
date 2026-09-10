"use client";

import React, { useEffect, useState, use } from "react";
import { templateService } from "@/app/lib/services";
import type { FormTemplate, BrandingConfig, Form, FieldGroup } from "@/app/lib/types";
import { ArrowLeft, Smartphone, Copy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import BrandingEditor from "@/app/components/dashboard/BrandingEditor";
import FormFieldsEditor from "@/app/components/dashboard/FormFieldsEditor";
import FormPreview from "@/app/components/dashboard/FormPreview";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function templateToForm(template: FormTemplate, branding: BrandingConfig, groups: FieldGroup[]): Form {
  return {
    id: template.id,
    name: template.name,
    slug: template.id,
    status: "active",
    branding,
    groups,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [activePanel, setActivePanel] = useState<"fields" | "branding">("fields");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloningAndEdit, setIsCloningAndEdit] = useState(false);

  useEffect(() => {
    templateService.getTemplateEffective(id).then((data) => {
      if (data) {
        setTemplate(data);
        setBranding(data.defaultBranding ?? null);
        setGroups(data.defaultGroups ?? []);
      }
      setIsLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (!template || !branding || template.isSystem) return;
    setIsSaving(true);
    try {
      await Promise.all([
        templateService.updateTemplateBranding(id, branding),
        templateService.updateTemplateGroups(id, groups),
      ]);
      setHasUnsavedChanges(false);
      toast.success("Template salvo!");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloneAndEdit = async () => {
    if (!template) return;
    setIsCloningAndEdit(true);
    try {
      const cloned = await templateService.cloneTemplate(template);
      toast.success(`"${cloned.name}" criado. Personalize-o agora.`);
      router.replace(`/dashboard/templates/${cloned.id}`);
    } catch {
      toast.error("Erro ao clonar template.");
      setIsCloningAndEdit(false);
    }
  };

  if (isLoading || !template || !branding) {
    return (
      <div className="flex flex-col absolute top-14 bottom-0 left-0 right-0 z-10 overflow-hidden bg-white dark:bg-[#0A0A0A]">
        <div className="h-12 border-b border-zinc-200/50 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 animate-pulse" />
        <div className="flex-1 flex">
          <div className="flex-1 bg-zinc-50 dark:bg-[#0A0A0A]" />
          <div className="hidden lg:block w-[480px] bg-zinc-100 dark:bg-[#111]" />
        </div>
      </div>
    );
  }

  const isSystem = template.isSystem === true;
  const previewForm = templateToForm(template, branding, groups);

  return (
    <div className="flex flex-col absolute top-14 bottom-0 left-0 right-0 z-10 overflow-hidden bg-white dark:bg-[#0A0A0A]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-zinc-200/50 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/templates">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg w-8 h-8 text-zinc-500 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div className="hidden sm:block">
            <h1 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none mb-0.5">
              {template.name}
            </h1>
            <div className="flex items-center gap-1.5">
              {isSystem ? (
                <>
                  <Lock size={10} className="text-zinc-400" />
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Template do sistema · somente leitura</p>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Editando</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Segmented control */}
        <div className="flex items-center bg-zinc-100/80 dark:bg-white/5 rounded-lg p-0.5 border border-zinc-200/50 dark:border-transparent">
          <button
            onClick={() => setActivePanel("fields")}
            className={cn(
              "px-3 sm:px-5 py-1.5 text-[12.5px] font-semibold rounded-md transition-all duration-200",
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
              "px-3 sm:px-5 py-1.5 text-[12.5px] font-semibold rounded-md transition-all duration-200",
              activePanel === "branding"
                ? "bg-white dark:bg-black/40 shadow-sm text-zinc-900 dark:text-white border border-black/[0.04] dark:border-white/10"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            Aparência
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isSystem ? (
            /* System template: clone CTA */
            <Button
              onClick={handleCloneAndEdit}
              disabled={isCloningAndEdit}
              className="rounded-lg px-4 h-8 text-[12.5px] font-medium bg-primary hover:bg-primary/85 text-white shadow-sm transition-colors gap-1.5"
            >
              <Copy size={13} />
              {isCloningAndEdit ? "Clonando..." : "Clonar e editar"}
            </Button>
          ) : (
            /* User template: normal save flow */
            <>
              <span className="text-[12px] font-medium hidden md:block">
                {isSaving ? (
                  <span className="text-zinc-400 dark:text-zinc-500">Salvando...</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-amber-500 dark:text-amber-400">Alterações não salvas</span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">Salvo</span>
                )}
              </span>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg px-4 h-8 text-[12.5px] font-medium bg-primary hover:bg-primary/85 text-white shadow-sm transition-colors"
              >
                Salvar
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg w-8 h-8 lg:hidden bg-zinc-50 dark:bg-white/5 text-zinc-500"
              >
                <Smartphone size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-[85vh] rounded-t-[2rem] p-6 flex justify-center bg-zinc-100 dark:bg-zinc-900"
            >
              <FormPreview form={previewForm} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* System template read-only banner */}
      {isSystem && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-4 lg:px-6 py-3 sm:py-2.5 bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200/50 dark:border-white/5 shrink-0">
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Template padrão do sistema.</span>
            {" "}Clone-o para criar sua própria versão personalizável.
          </p>
          <Button
            onClick={handleCloneAndEdit}
            disabled={isCloningAndEdit}
            variant="outline"
            size="sm"
            className="h-7 px-3 text-[11.5px] font-semibold shrink-0 gap-1.5 border-zinc-300 dark:border-zinc-700 w-fit"
          >
            <Copy size={11} />
            {isCloningAndEdit ? "Clonando..." : "Clonar e editar"}
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex overflow-hidden relative bg-[#FAFAFA] dark:bg-[#0A0A0A]">
          {activePanel === "fields" ? (
            <FormFieldsEditor
              groups={groups}
              onChange={(updated) => {
                if (isSystem) return;
                setGroups(updated);
                setHasUnsavedChanges(true);
              }}
            />
          ) : (
            <BrandingEditor
              config={branding}
              onChange={(updated) => {
                if (isSystem) return;
                setBranding(updated);
                setHasUnsavedChanges(true);
              }}
            />
          )}
        </div>

        {/* Right: Live Preview (desktop only) */}
        <div className="hidden lg:flex w-[480px] xl:w-[540px] border-l border-zinc-200/50 dark:border-white/5 bg-zinc-100/50 dark:bg-[#111111] items-center justify-center overflow-hidden shrink-0 relative h-full">
          <div className="w-full flex justify-center h-full">
            <FormPreview form={previewForm} />
          </div>
        </div>
      </div>
    </div>
  );
}
