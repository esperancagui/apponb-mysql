"use client";

import React, { useEffect, useState } from "react";
import { templateService, formService } from "@/app/lib/services";
import { getDefaultBranding } from "@/app/lib/services/workspaceService";
import type { FormTemplate, BrandingConfig } from "@/app/lib/types";
import { useWorkspace } from "@/app/contexts";
import {
  Palette,
  Globe,
  Instagram,
  Layers,
  FileText,
  Users,
  ShoppingBag,
  Camera,
  Music,
  Briefcase,
  Zap,
  Heart,
  ArrowRight,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "@/components/ui/confirm-delete-dialog";

const ICON_OPTIONS = [
  { name: "Palette", icon: Palette },
  { name: "Globe", icon: Globe },
  { name: "Instagram", icon: Instagram },
  { name: "Layers", icon: Layers },
  { name: "FileText", icon: FileText },
  { name: "Users", icon: Users },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Camera", icon: Camera },
  { name: "Music", icon: Music },
  { name: "Briefcase", icon: Briefcase },
  { name: "Zap", icon: Zap },
  { name: "Heart", icon: Heart },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(({ name, icon }) => [name, icon]),
);

const CATEGORY_OPTIONS = ["Design", "Web", "Marketing", "Outro"];

const CATEGORY_COLOR: Record<string, string> = {
  Design: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400",
  Web: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  Marketing: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400",
  Outro: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const DEFAULT_PRIMARY = "#007AFF";

const DEFAULT_BRANDING_FALLBACK = {
  primaryColor: DEFAULT_PRIMARY,
  backgroundType: "solid" as const,
  backgroundValue: "#ffffff",
  businessName: "Meu Negócio",
  logoPosition: "center" as const,
  logoSize: "medium" as const,
  logoShape: "natural" as const,
  logoBorder: false,
  heroBackgroundType: "none" as const,
  heroBackgroundValue: "",
  fontFamily: "Inter" as const,
  borderRadius: "medium" as const,
  buttonStyle: "filled" as const,
  inputStyle: "outlined" as const,
  spacing: "comfortable" as const,
  headerStyle: "centered" as const,
  formWidth: "medium" as const,
  sectionDivider: "space" as const,
  darkMode: false,
  animationStyle: "subtle" as const,
  showOnbBadge: true,
  submitButtonText: "Enviar Respostas",
  welcomeMessage: "Bem-vindo!",
  thankYouMessage: "Obrigado!",
};

export default function TemplatesPage() {
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);

  // Use-template dialog state
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [useTemplate, setUseTemplate] = useState<FormTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [clientName, setClientName] = useState("");
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  // New template form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Design");
  const [selectedIcon, setSelectedIcon] = useState("Layers");

  useEffect(() => {
    templateService.getTemplates().then((data) => {
      setTemplates(data);
      setIsLoading(false);
    });
  }, []);

  // Auto-open create dialog when navigated with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openDialog();
      router.replace(pathname);
    }
  }, [searchParams]);

  const openDialog = () => {
    setName("");
    setDescription("");
    setCategory("Design");
    setSelectedIcon("Layers");
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const branding = activeWorkspace ? await getDefaultBranding(activeWorkspace.id) : DEFAULT_BRANDING_FALLBACK;
      const template = await templateService.createTemplate({
        name: name.trim(),
        description: description.trim() || `Template ${name.trim()}.`,
        icon: selectedIcon,
        category,
        defaultBranding: (branding || DEFAULT_BRANDING_FALLBACK) as BrandingConfig,
      });
      setDialogOpen(false);
      toast.success("Template criado!");
      router.push(`/dashboard/templates/${template.id}`);
    } catch {
      toast.error("Erro ao criar template.");
      setIsCreating(false);
    }
  };

  const handleClone = async (template: FormTemplate) => {
    setCloningId(template.id);
    try {
      const cloned = await templateService.cloneTemplate(template);
      setTemplates((prev) => [...prev, cloned]);
      toast.success(`"${cloned.name}" criado. Personalize-o agora.`);
      router.push(`/dashboard/templates/${cloned.id}`);
    } catch {
      toast.error("Erro ao clonar template.");
      setCloningId(null);
    }
  };

  const openUseDialog = (template: FormTemplate) => {
    setUseTemplate(template);
    setFormName("");
    setClientName("");
    setUseDialogOpen(true);
  };

  const handleUseTemplate = async () => {
    if (!formName.trim() || !useTemplate) return;
    setIsCreatingForm(true);
    try {
      const newForm = await formService.createForm({
        name: formName.trim(),
        clientName: clientName.trim() || undefined,
        templateId: useTemplate.id,
        category: useTemplate.category,
        groups: useTemplate.defaultGroups,
        branding: useTemplate.defaultBranding,
        status: "draft",
      });
      setUseDialogOpen(false);
      toast.success("Formulário criado!");
      router.push(`/dashboard/forms/${newForm.id}`);
    } catch {
      toast.error("Erro ao criar formulário.");
      setIsCreatingForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingTemplate(true);
    try {
      await templateService.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setPendingDeleteId(null);
      toast.success("Template removido.");
    } catch {
      toast.error("Erro ao remover template.");
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-10 space-y-8">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.isSystem);
  const userTemplates = templates.filter((t) => !t.isSystem);

  const renderCard = (t: FormTemplate) => {
    const Icon = ICON_MAP[t.icon] || Layers;
    const categoryStyle = CATEGORY_COLOR[t.category] || CATEGORY_COLOR["Outro"];
    const questionCount = (t.defaultGroups ?? []).reduce((sum, g) => sum + g.fields.length, 0);
    const sectionCount = (t.defaultGroups ?? []).length;
    const isCloning = cloningId === t.id;

    return (
      <div
        key={t.id}
        className="group relative flex flex-col bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:border-zinc-300 dark:hover:border-white/10 transition-all duration-200 overflow-hidden"
      >
        {/* Top color bar */}
        <div className="h-1 w-full" style={{ backgroundColor: t.defaultBranding?.primaryColor || DEFAULT_PRIMARY }} />

        <div className="flex flex-col flex-1 p-5">
          {/* Icon + badges */}
          <div className="flex items-center justify-between mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: (t.defaultBranding?.primaryColor || DEFAULT_PRIMARY) + "18" }}
            >
              <Icon size={18} style={{ color: t.defaultBranding?.primaryColor || DEFAULT_PRIMARY }} />
            </div>
            <div className="flex items-center gap-1.5">
              {t.isSystem && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Lock size={9} />
                  Padrão
                </span>
              )}
              {!t.isSystem && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  Personalizado
                </span>
              )}
              <span
                className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md", categoryStyle)}
              >
                {t.category}
              </span>
            </div>
          </div>

          {/* Name + description */}
          <h3 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-1">{t.name}</h3>
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">{t.description}</p>

          {/* Tags */}
          {t.tags && t.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {t.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="px-2 py-0 h-5 text-[10px] uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent font-bold"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="mt-auto flex items-center gap-3 text-[11.5px] text-zinc-400 dark:text-zinc-500 font-medium pt-1">
            <span>{questionCount} perguntas</span>
            <span className="w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            <span>{sectionCount} seções</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-white/[0.02]">
          {t.isSystem ? (
            /* System template: Clone + Use */
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={isCloning}
                onClick={() => handleClone(t)}
                className="h-8 px-3 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 gap-1.5"
              >
                <Copy size={13} />
                {isCloning ? "Clonando..." : "Clonar"}
              </Button>
            </div>
          ) : (
            /* User template: Edit + Delete */
            <div className="flex items-center gap-1">
              <Link href={`/dashboard/templates/${t.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 gap-1.5"
                >
                  <Sparkles size={13} />
                  Editar aparência
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={() => setPendingDeleteId(t.id)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          )}

          <Button
            size="sm"
            className="h-8 px-3 text-[12px] font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 gap-1"
            onClick={() => openUseDialog(t)}
          >
            Usar
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-10 pb-28 space-y-10 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Templates</h1>
          <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400 mt-1">
            {templates.length} templates disponíveis · Edite as perguntas e personalize a aparência de cada um
          </p>
        </div>
        <Button
          onClick={openDialog}
          className="h-9 px-4 text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white shadow-sm gap-2 w-fit"
        >
          <Plus size={15} strokeWidth={2.5} />
          Novo template
        </Button>
      </div>

      {/* System templates section */}
      {systemTemplates.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Padrão do sistema
            </h2>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{systemTemplates.map(renderCard)}</div>
        </section>
      )}

      {/* User templates section */}
      {userTemplates.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Meus templates
            </h2>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{userTemplates.map(renderCard)}</div>
        </section>
      )}

      {templates.length === 0 && (
        <div className="text-center py-20">
          <Layers size={36} className="text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-zinc-500">Nenhum template disponível</p>
        </div>
      )}

      {/* Use Template Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden bg-white dark:bg-[#0A0A0A] border-zinc-200 dark:border-white/10 font-sans">
          <div className="p-6 border-b border-zinc-100 dark:border-white/5">
            <DialogTitle className="text-[17px] font-bold text-zinc-900 dark:text-white">Criar formulário</DialogTitle>
            <DialogDescription className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              A partir do template{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{useTemplate?.name}</span>
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                Nome do formulário <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="Ex: Briefing Q1 2025, Projeto Rebrand..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUseTemplate()}
                className="h-9 text-[13.5px] bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                Cliente <span className="text-zinc-400 font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Nome do cliente ou empresa"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-9 text-[13.5px] bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/5 flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setUseDialogOpen(false)}
              className="h-9 px-4 text-[13px] font-semibold text-zinc-500"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUseTemplate}
              disabled={!formName.trim() || isCreatingForm}
              className="h-9 px-4 text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white"
            >
              {isCreatingForm ? "Criando..." : "Criar formulário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white dark:bg-[#0A0A0A] border-zinc-200 dark:border-white/10 font-sans">
          <div className="p-6 border-b border-zinc-100 dark:border-white/5">
            <DialogTitle className="text-[17px] font-bold text-zinc-900 dark:text-white">Novo template</DialogTitle>
            <DialogDescription className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Defina o nome, categoria e ícone. Você poderá editar a aparência depois.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                Nome do template <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="Ex: E-commerce, Fotografia..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-9 text-[13.5px] bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                Descrição <span className="text-zinc-400 font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Para que tipo de projeto serve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 text-[13.5px] bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all",
                      category === cat
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">Ícone</Label>
              <div className="grid grid-cols-6 gap-2">
                {ICON_OPTIONS.map(({ name: iconName, icon: IconComp }) => (
                  <button
                    key={iconName}
                    onClick={() => setSelectedIcon(iconName)}
                    className={cn(
                      "w-full aspect-square rounded-lg flex items-center justify-center border transition-all",
                      selectedIcon === iconName
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-zinc-50 dark:bg-[#111] border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700",
                    )}
                  >
                    <IconComp size={16} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/5 flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="h-9 px-4 text-[13px] font-semibold text-zinc-500"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="h-9 px-4 text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white"
            >
              {isCreating ? "Criando..." : "Criar template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <ConfirmDeleteDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Deletar template?"
        description="Isso removerá o template permanentemente. Formulários já criados não serão afetados."
        confirmLabel="Deletar template"
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
        }}
        isLoading={isDeletingTemplate}
      />
    </div>
  );
}
