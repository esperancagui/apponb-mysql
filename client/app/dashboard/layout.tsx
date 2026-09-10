"use client";

import React, { ReactNode, useState, useEffect, Suspense } from "react";
import { useAsyncAction } from "@/app/hooks/useAsyncAction";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Inbox,
  Settings,
  Search,
  Plus,
  Command,
  CheckCircle2,
  Check,
  UserCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardSidebar from "@/app/components/dashboard/DashboardSidebar";
import { formService, templateService } from "@/app/lib/services";
import { getDefaultBranding } from "@/app/lib/services/workspaceService";
import { useWorkspace } from "@/app/contexts";
import type { Form, FormTemplate } from "@/app/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { NotificationBell } from "@/app/components/notifications/NotificationBell";
import { NotificationCenter } from "@/app/components/notifications/NotificationCenter";
import { useOnboarding } from "@/app/contexts";

const mobileNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/forms", label: "Formulários", icon: FileText },
  { href: "/dashboard/templates", label: "Templates", icon: FolderOpen },
  { href: "/dashboard/settings", label: "Ajustes", icon: Settings },
  { href: "/dashboard/profile", label: "Perfil", icon: UserCircle },
];

function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace, workspaces, setActiveWorkspace, openCreateDialog: openWorkspaceDialog } = useWorkspace();
  const { completeStep } = useOnboarding();
  const [collapsed, setCollapsed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forms, setForms] = useState<Form[]>([]);

  // ── Create Form Dialog ──
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [newFormName, setNewFormName] = useState("");
  const [clientName, setClientName] = useState("");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");

  useEffect(() => {
    const wsId = activeWorkspace?.id;
    formService.getForms(wsId).then(setForms);
    templateService.getTemplates(undefined, wsId).then(setTemplates);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Open dialog when any page navigates with ?new=1 (e.g. dashboard sidebar button)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreateDialog();
      router.replace(pathname);
    }
  }, [searchParams]);

  const openCreateDialog = () => {
    setSelectedTemplate(null);
    setNewFormName("");
    setClientName("");
    setTemplateSearch("");
    setIsCreateDialogOpen(true);
  };

  const handleToggle = () => setCollapsed((prev) => !prev);

  const handleSelectTemplate = (templateId: string, templateName: string, isZero: boolean) => {
    const base = isZero
      ? null
      : templates.find((t) => t.id === templateId) || templates[0] || { id: templateId, name: templateName };
    setSelectedTemplate((base || { id: "custom", name: "Do zero" }) as FormTemplate);

    if (!isZero) {
      const prefix = clientName.trim() ? `${clientName.trim()} — ` : "Briefing — ";
      setNewFormName(`${prefix}${templateName}`);
    } else {
      setNewFormName("");
    }
  };

  const [handleConfirmCreate, isCreatingForm] = useAsyncAction(async () => {
    if (!newFormName.trim() || !selectedTemplate) return;
    try {
      const wsDefault = activeWorkspace ? await getDefaultBranding(activeWorkspace.id) : null;
      const fallbackBranding = {
        primaryColor: "#007AFF",
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
      const form = await formService.createForm({
        name: newFormName,
        clientName: clientName.trim() || undefined,
        templateId: selectedTemplate.id,
        groups: selectedTemplate.defaultGroups || [],
        branding: { ...fallbackBranding, ...wsDefault, ...(selectedTemplate as any).defaultBranding } as any,
        status: "draft",
        workspaceId: activeWorkspace?.id,
      });
      setIsCreateDialogOpen(false);
      completeStep("form_created");
      toast.success("Formulário criado com sucesso!");
      router.push(`/dashboard/forms/${form.id}`);
    } catch {
      toast.error("Erro ao criar formulário.");
    }
  });

  const brandColor = activeWorkspace?.brandColor;

  return (
    <div
      suppressHydrationWarning
      className="h-screen bg-background flex overflow-hidden font-sans"
      style={
        brandColor
          ? ({
              "--primary": brandColor,
              "--ring": brandColor,
              "--sidebar-primary": brandColor,
              "--sidebar-ring": brandColor,
              "--sidebar-accent": `color-mix(in oklch, ${brandColor} 12%, var(--sidebar))`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {/* ─── Sidebar (Desktop) ─── */}
      <DashboardSidebar collapsed={collapsed} onToggle={handleToggle} />

      {/* ─── Main Content Wrapper ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden relative h-full">
        {/* ─── Topbar ─── */}
        <header className="h-14 shrink-0 bg-background/70 backdrop-blur-2xl border-b border-border flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0">
          {/* Left: Workspace switcher (mobile) + page title */}
          <div className="flex items-center gap-2.5">
            {/* Mobile workspace mini-switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center shrink-0 outline-none"
                  style={{
                    background: (brandColor || "#6366f1") + "18",
                    border: `1px solid ${brandColor || "#6366f1"}28`,
                  }}
                >
                  {activeWorkspace?.logoUrl ? (
                    <img src={activeWorkspace.logoUrl} alt="" className="w-full h-full object-contain rounded-md" />
                  ) : (
                    <span className="text-[11px] font-bold" style={{ color: brandColor || "#6366f1" }}>
                      {(activeWorkspace?.name || "W")[0].toUpperCase()}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 rounded-xl shadow-lg border-border bg-background/95 backdrop-blur-xl"
              >
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    className="cursor-pointer text-[13px] rounded-lg gap-2.5"
                    onClick={() => {
                      setActiveWorkspace(ws);
                      router.push("/dashboard");
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: (ws.brandColor || "#6366f1") + "18",
                        border: `1px solid ${ws.brandColor || "#6366f1"}28`,
                      }}
                    >
                      {ws.logoUrl ? (
                        <img src={ws.logoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[9px] font-bold" style={{ color: ws.brandColor || "#6366f1" }}>
                          {ws.name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn("flex-1 truncate", ws.id === activeWorkspace?.id ? "font-semibold" : "font-medium")}
                    >
                      {ws.name}
                    </span>
                    {ws.id === activeWorkspace?.id && <Check size={12} className="text-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer font-medium text-[13px] rounded-lg gap-2 text-muted-foreground"
                  onClick={openWorkspaceDialog}
                >
                  <Plus size={13} />
                  Criar workspace...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Page title / breadcrumb */}
            {(() => {
              const currentNav = [...mobileNav].find(
                (n) => pathname === n.href || (n.href !== "/dashboard" && pathname?.startsWith(n.href)),
              );
              const Icon = currentNav?.icon || LayoutDashboard;
              return (
                <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                  <Icon size={16} className="text-muted-foreground" strokeWidth={2} />
                  {currentNav?.label || "Dashboard"}
                </div>
              );
            })()}
          </div>

          {/* Center: Search Command Palette Style (Desktop only) */}
          <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md mx-6">
            <button
              onClick={() => setSearchOpen(true)}
              className="relative w-full flex items-center h-8 bg-muted/80 hover:bg-muted border border-transparent hover:border-border rounded-lg px-3 text-muted-foreground transition-colors group"
            >
              <Search size={14} className="shrink-0" />
              <span className="ml-2 text-[13px] font-medium">Buscar formulários...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-sans text-[10px] font-medium opacity-100 transition-opacity">
                <Command size={10} /> K
              </kbd>
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-0.5">
            {/* Search icon — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
            </Button>
            <ThemeToggle />
            <NotificationBell />
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={openCreateDialog}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-[12px] font-semibold hidden md:block">
                  Novo formulário
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        {/* ─── Scrollable Main Content ─── */}
        <main className="flex-1 overflow-y-auto w-full pb-24 md:pb-8">{children}</main>
      </div>

      {/* ─── Floating Tab Bar (Mobile only) ─── */}
      <div className="md:hidden fixed bottom-5 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <nav className="rounded-2xl pointer-events-auto flex items-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.08] rounded-[24px] px-1.5 py-1.5 shadow-[0_4px_28px_-4px_rgba(0,0,0,0.16),0_1px_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_-4px_rgba(0,0,0,0.8)]">
          {mobileNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 w-[60px] py-2.5 rounded-[16px] transition-colors duration-150",
                  isActive ? "text-primary" : "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-[16px] bg-primary/[0.08] dark:bg-primary/[0.12]" />
                )}
                <item.icon size={20} strokeWidth={isActive ? 2.1 : 1.7} />
                <span className="text-[9.5px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <NotificationCenter />

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar formulários, respostas..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {forms.length > 0 && (
            <CommandGroup heading="Meus Formulários">
              {forms.map((form) => (
                <CommandItem
                  key={form.id}
                  value={form.name}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(`/dashboard/forms/${form.id}`);
                  }}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{form.name}</span>
                  {form.status === "draft" && (
                    <span className="ml-auto text-[10px] text-zinc-400 font-medium">Rascunho</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Ações">
            <CommandItem
              onSelect={() => {
                setSearchOpen(false);
                openCreateDialog();
              }}
              className="cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Novo formulário</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setSearchOpen(false);
                router.push("/dashboard/templates?new=1");
              }}
              className="cursor-pointer"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>Novo template</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setSearchOpen(false);
                router.push("/dashboard/settings");
              }}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Ajustes</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* ─── Create Form Dialog ─── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[900px] w-[95vw] p-0 overflow-y-auto md:overflow-hidden border-zinc-200 dark:border-white/10 shadow-2xl bg-white dark:bg-[#0A0A0A] font-sans flex flex-col md:flex-row md:h-[600px] max-h-[90vh]"
        >
          {/* LEFT COLUMN: Config */}
          <div className="w-full md:w-[320px] bg-zinc-50/50 dark:bg-[#111] border-b md:border-b-0 border-r-0 md:border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-6 md:gap-0 md:justify-between shrink-0">
            <div className="space-y-6">
              <div>
                <DialogTitle className="text-[18px] font-bold text-zinc-900 dark:text-white">
                  Novo Formulário
                </DialogTitle>
                <DialogDescription className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Escolha um template e dê um nome.
                </DialogDescription>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Nome do cliente
                  </Label>
                  <Input
                    placeholder="Ex: Café Aurora"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (selectedTemplate && selectedTemplate.id !== "custom") {
                        const prefix = e.target.value.trim() ? `${e.target.value.trim()} — ` : "Briefing — ";
                        setNewFormName(`${prefix}${selectedTemplate.name}`);
                      }
                    }}
                    className="bg-white dark:bg-[#1A1A1A] border-zinc-200 dark:border-zinc-800 text-[13.5px] h-9 rounded-md focus-visible:ring-2 focus-visible:ring-primary/20"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Nome do formulário
                  </Label>
                  <Input
                    placeholder="Ex: Café Aurora — Identidade Visual"
                    value={newFormName}
                    onChange={(e) => setNewFormName(e.target.value)}
                    className="bg-white dark:bg-[#1A1A1A] border-zinc-200 dark:border-zinc-800 text-[13.5px] h-9 rounded-md focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>

                {selectedTemplate && selectedTemplate.id !== "custom" && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                    <p className="text-[11px] font-bold text-primary dark:text-blue-400 uppercase tracking-wider mb-1">
                      Template selecionado
                    </p>
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">{selectedTemplate.name}</p>
                    <p className="text-[11.5px] text-zinc-500 mt-0.5">
                      {selectedTemplate.defaultGroups?.reduce((acc, g) => acc + (g.fields?.length || 0), 0) || 0}{" "}
                      perguntas • {selectedTemplate.defaultGroups?.length || 0} seções
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:flex flex-col gap-2 pt-6">
              <Button
                onClick={handleConfirmCreate}
                disabled={!newFormName.trim() || !selectedTemplate || isCreatingForm}
                className="w-full rounded-md h-9 text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isCreatingForm && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isCreatingForm ? "Criando..." : "Criar formulário"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreatingForm}
                className="w-full rounded-md h-9 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </Button>
            </div>
          </div>

          {/* RIGHT COLUMN: Templates */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#0A0A0A] p-6 md:overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h3 className="text-[16px] font-bold text-zinc-900 dark:text-white shrink-0">Comece de um template</h3>
              <div className="relative w-56 shrink-0 hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar template..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 h-8 bg-zinc-100 dark:bg-zinc-900 border border-transparent dark:border-zinc-800 rounded-sm text-[12.5px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="md:flex-1 md:overflow-y-auto md:min-h-0 pb-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templateSearch === "" && (
                  <div
                    onClick={() => handleSelectTemplate("custom", "Do zero", true)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-center items-center text-center group h-[110px]",
                      selectedTemplate?.id === "custom"
                        ? "border-primary bg-blue-50/30 dark:bg-blue-900/10 ring-1 ring-primary shadow-sm"
                        : "border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111] hover:border-zinc-300 dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
                      <Plus
                        size={16}
                        className={selectedTemplate?.id === "custom" ? "text-primary" : "text-zinc-500"}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-[13px] font-bold",
                        selectedTemplate?.id === "custom"
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      Em branco
                    </p>
                  </div>
                )}

                {templates
                  .filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                  .map((t) => {
                    const isSelected = selectedTemplate?.id === t.id;
                    const nQuestions = t.defaultGroups?.reduce((acc, g) => acc + (g.fields?.length || 0), 0) || 0;
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.id, t.name, false)}
                        className={cn(
                          "p-4 rounded-xl border cursor-pointer transition-all flex flex-col relative h-[110px]",
                          isSelected
                            ? "border-primary bg-white dark:bg-[#0A0A0A] ring-1 ring-primary shadow-sm"
                            : "border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] hover:bg-zinc-50 dark:hover:bg-[#111]",
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white">
                            <CheckCircle2 size={12} strokeWidth={3} />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-[13.5px] font-bold text-zinc-900 dark:text-white mb-1.5 pr-6 leading-tight">
                            {t.name}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(t.tags || []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="px-1.5 py-0 h-4 text-[9px] uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent font-bold"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 font-medium">
                          ~ {nQuestions} perguntas
                        </p>
                      </div>
                    );
                  })}

                {templateSearch &&
                  templates.filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                    <div className="col-span-2 text-center py-8">
                      <p className="text-[13px] text-zinc-500 mb-3">
                        Nenhum template encontrado para "{templateSearch}"
                      </p>
                      <Button
                        onClick={() => {
                          setTemplateSearch("");
                          handleSelectTemplate("custom", "Do zero", true);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-8 text-[12px]"
                      >
                        Começar do zero
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Mobile-only bottom buttons — appears after templates */}
          <div className="flex md:hidden flex-col gap-2 p-6 pt-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111]">
            <Button
              onClick={handleConfirmCreate}
              disabled={!newFormName.trim() || !selectedTemplate || isCreatingForm}
              className="w-full rounded-md h-9 text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isCreatingForm && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {isCreatingForm ? "Criando..." : "Criar formulário"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreatingForm}
              className="w-full rounded-md h-9 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
