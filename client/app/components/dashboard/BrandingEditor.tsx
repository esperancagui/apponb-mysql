"use client";

import React, { useState, useRef, useEffect } from "react";
import { BrandingConfig } from "@/app/lib/types";
import { getDefaultBranding, saveDefaultBranding } from "@/app/lib/services/workspaceService";
import { uploadBrandingImage } from "@/app/lib/services/storageService";
import { useWorkspace } from "@/app/contexts";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check,
  Upload,
  X,
  ChevronDown,
  Palette,
  Image as ImageIcon,
  Sparkles,
  Layout,
  MonitorPlay,
  MessageSquare,
  BoxSelect,
  Moon,
  Star,
  Type as TypeIcon,
  Save,
  RotateCcw,
  Crown,
  Loader2,
} from "lucide-react";

interface BrandingEditorProps {
  config: BrandingConfig;
  onChange: (config: BrandingConfig) => void;
}

const THEME_PRESETS = [
  {
    name: "Minimal",
    config: {
      primaryColor: "#18181b",
      accentColor: "#71717a",
      backgroundType: "solid",
      backgroundValue: "#ffffff",
      fontFamily: "Inter",
      borderRadius: "medium",
      buttonStyle: "filled",
      inputStyle: "outlined",
      spacing: "comfortable",
      headerStyle: "minimal",
      darkMode: false,
    },
  },
  {
    name: "Luxo",
    config: {
      primaryColor: "#b8860b",
      accentColor: "#1a1a2e",
      backgroundType: "solid",
      backgroundValue: "#faf9f6",
      fontFamily: "Playfair Display",
      borderRadius: "none",
      buttonStyle: "filled",
      inputStyle: "underline",
      spacing: "spacious",
      headerStyle: "centered",
      darkMode: false,
    },
  },
  {
    name: "Tech",
    config: {
      primaryColor: "#6366f1",
      accentColor: "#3b82f6",
      backgroundType: "solid",
      backgroundValue: "#0f172a",
      fontFamily: "Space Grotesk",
      borderRadius: "medium",
      buttonStyle: "gradient",
      inputStyle: "filled",
      spacing: "comfortable",
      headerStyle: "left",
      darkMode: true,
    },
  },
  {
    name: "Suave",
    config: {
      primaryColor: "#ec4899",
      accentColor: "#f472b6",
      backgroundType: "solid",
      backgroundValue: "#fdf2f8",
      fontFamily: "Poppins",
      borderRadius: "full",
      buttonStyle: "soft",
      inputStyle: "filled",
      spacing: "comfortable",
      headerStyle: "centered",
      darkMode: false,
    },
  },
  {
    name: "Forte",
    config: {
      primaryColor: "#dc2626",
      accentColor: "#b91c1c",
      backgroundType: "solid",
      backgroundValue: "#fafafa",
      fontFamily: "DM Sans",
      borderRadius: "large",
      buttonStyle: "filled",
      inputStyle: "outlined",
      spacing: "comfortable",
      headerStyle: "hero",
      darkMode: false,
    },
  },
  {
    name: "Escuro",
    config: {
      primaryColor: "#a78bfa",
      accentColor: "#818cf8",
      backgroundType: "solid",
      backgroundValue: "#09090b",
      fontFamily: "Sora",
      borderRadius: "large",
      buttonStyle: "soft",
      inputStyle: "filled",
      spacing: "spacious",
      headerStyle: "centered",
      darkMode: true,
    },
  },
];

const FONT_PAIRINGS = [
  { name: "Inter", desc: "Clean & Universal" },
  { name: "Plus Jakarta Sans", desc: "Moderno & Limpo" },
  { name: "Montserrat", desc: "Clássico Moderno" },
  { name: "Poppins", desc: "Amigável & Arredondado" },
  { name: "Outfit", desc: "Contemporâneo" },
  { name: "Sora", desc: "Minimalista Premium" },
  { name: "DM Sans", desc: "Geométrico & Limpo" },
  { name: "Space Grotesk", desc: "Tech & Bold" },
  { name: "Syne", desc: "Diferenciado & Fashion" },
  { name: "Cabin", desc: "Humanista & Amigável" },
  { name: "Roboto", desc: "Neutro & Técnico" },
  { name: "Playfair Display", desc: "Elegante Serifado" },
  { name: "Lora", desc: "Clássico Leitura" },
  { name: "Cormorant Garamond", desc: "Luxuoso Serifado" },
];

export default function BrandingEditor({ config, onChange }: BrandingEditorProps) {
  const u = (updates: Partial<BrandingConfig>) => onChange({ ...config, ...updates });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [savedBranding, setSavedBranding] = useState<BrandingConfig | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    if (activeWorkspace) {
      getDefaultBranding(activeWorkspace.id).then(setSavedBranding as any);
    }
  }, [activeWorkspace?.id]);

  const applyPreset = (preset: Partial<BrandingConfig>) => {
    onChange({ ...config, ...preset });
  };

  const handleSaveAsDefault = async () => {
    if (!activeWorkspace) return;
    try {
      await saveDefaultBranding(activeWorkspace.id, config);
      setSavedBranding(config);
      toast.success("Design padrão salvo! Novos formulários usarão este design.");
    } catch {
      toast.error("Erro ao salvar design padrão.");
    }
  };

  const handleApplyDefault = () => {
    if (!savedBranding) return;
    onChange({ ...config, ...savedBranding });
    toast.success("Design padrão aplicado!");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadBrandingImage(file, "logo", activeWorkspace?.id);
      u({ logoUrl: url });
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar logo:", err);
      toast.error("Falha ao enviar a logo. Tente novamente.");
    } finally {
      setUploadingLogo(false);
      // Limpa o input para permitir re-upload do mesmo arquivo
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const url = await uploadBrandingImage(file, "hero", activeWorkspace?.id);
      u({ heroBackgroundValue: url, heroBackgroundType: "image" });
      toast.success("Imagem de capa enviada com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar capa:", err);
      toast.error("Falha ao enviar a imagem de capa. Tente novamente.");
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8 lg:py-12">
      <div className="max-w-2xl mx-auto space-y-12 pb-36 md:pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Aparência do Formulário
            </h2>
            <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mt-1">
              Personalize o design para combinar com a sua marca.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {savedBranding && (
              <Button
                onClick={handleApplyDefault}
                variant="outline"
                className="h-8 px-3 rounded-md text-[12px] font-semibold border-zinc-200 dark:border-zinc-700 gap-1.5"
              >
                <RotateCcw size={12} /> Restaurar padrão
              </Button>
            )}
            <Button
              onClick={handleSaveAsDefault}
              variant="outline"
              className="h-8 px-3 rounded-md text-[12px] font-semibold border-blue-200 dark:border-blue-900 text-primary dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 gap-1.5"
            >
              <Save size={12} /> Salvar como padrão
            </Button>
          </div>
        </div>

        {/* 1. TEMAS E MODO DE COR */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Palette size={16} className="text-zinc-400" /> Temas e Modo de Cor
            </h3>
          </div>

          <AppleCard>
            <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                  <Moon size={14} className="text-zinc-500 dark:text-zinc-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-200">Modo de Exibição</span>
                  <span className="text-[12px] text-zinc-500">Altere como seu formulário se adapta à luz.</span>
                </div>
              </div>
              <Segmented
                value={config.darkMode === true ? "dark" : config.darkMode === "auto" ? "auto" : "light"}
                onChange={(v) => u({ darkMode: v === "dark" ? true : v === "auto" ? "auto" : false })}
                options={[
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Escuro" },
                  { value: "auto", label: "Auto" },
                ]}
              />
            </div>
          </AppleCard>

          <div className="pt-2">
            <h4 className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Predefinições de Tema</h4>

            {/* Meu design padrão */}
            {savedBranding && (
              <button
                onClick={handleApplyDefault}
                className={cn(
                  "w-full relative flex items-center gap-4 p-4 rounded-[14px] transition-all duration-200 border text-left active:scale-[0.99] mb-3",
                  config.primaryColor === savedBranding.primaryColor &&
                    config.fontFamily === savedBranding.fontFamily &&
                    config.backgroundValue === savedBranding.backgroundValue
                    ? "bg-white dark:bg-zinc-800 shadow-sm border-primary ring-1 ring-primary"
                    : "bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10 border-blue-200/60 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm",
                )}
              >
                <div
                  className="w-14 h-14 rounded-lg border border-black/5 dark:border-white/5 overflow-hidden relative shadow-inner shrink-0"
                  style={{ background: savedBranding.backgroundValue || "#fff" }}
                >
                  <div
                    className="absolute bottom-2 left-2 w-2/3 h-2 rounded-full"
                    style={{ backgroundColor: savedBranding.primaryColor }}
                  />
                  <div
                    className="absolute top-2 left-2 w-4 h-4 rounded-[3px]"
                    style={{ backgroundColor: savedBranding.primaryColor, opacity: 0.2 }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Crown size={14} className="text-primary" />
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">Meu design padrão</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {savedBranding.fontFamily} • {savedBranding.primaryColor} • Aplicado a novos formulários
                  </p>
                </div>
                {config.primaryColor === savedBranding.primaryColor &&
                  config.fontFamily === savedBranding.fontFamily &&
                  config.backgroundValue === savedBranding.backgroundValue && (
                    <Check size={16} className="text-primary shrink-0" strokeWidth={3} />
                  )}
              </button>
            )}

            {/* Grid de presets */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isActive =
                  config.primaryColor === preset.config.primaryColor && config.fontFamily === preset.config.fontFamily;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset.config as Partial<BrandingConfig>)}
                    className={cn(
                      "relative flex flex-col items-start gap-3 p-4 rounded-[14px] transition-all duration-200 border text-left active:scale-[0.98]",
                      isActive
                        ? "bg-white dark:bg-zinc-800 shadow-sm border-primary ring-1 ring-primary"
                        : "bg-white dark:bg-[#111] border-zinc-200/60 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 hover:shadow-sm",
                    )}
                  >
                    <div
                      className="w-full h-14 rounded-md border border-black/5 dark:border-white/5 overflow-hidden relative shadow-inner"
                      style={{ background: preset.config.backgroundValue || "#fff" }}
                    >
                      <div
                        className="absolute bottom-2.5 left-2.5 w-1/2 h-2.5 rounded-full"
                        style={{ backgroundColor: preset.config.primaryColor }}
                      />
                      <div
                        className="absolute top-2.5 left-2.5 w-4 h-4 rounded-[4px]"
                        style={{ backgroundColor: preset.config.primaryColor, opacity: 0.2 }}
                      />
                    </div>
                    <div className="w-full flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{preset.name}</span>
                      {isActive && <Check size={14} className="text-blue-500" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. ESSENCIAL */}
        <section className="space-y-5 pt-6 border-t border-zinc-200/50 dark:border-white/5">
          <h3 className="text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2">
            <Star size={16} className="text-zinc-400" /> Essencial
          </h3>

          <AppleCard>
            <RowGroup title="Cabeçalho e Capa">
              <Row label="Estilo do Cabeçalho">
                <Segmented
                  value={config.headerStyle || "centered"}
                  onChange={(v) => {
                    const s = v as any;
                    if (s === "cover") {
                      u({ headerStyle: s, heroBackgroundType: "image" });
                    } else {
                      u({ headerStyle: s, heroBackgroundType: "none", heroBackgroundValue: "" });
                    }
                  }}
                  options={[
                    { value: "minimal", label: "Oculto" },
                    { value: "left", label: "Esquerda" },
                    { value: "centered", label: "Centro" },
                    { value: "cover", label: "Capa" },
                  ]}
                />
              </Row>

              {config.headerStyle === "cover" && (
                <>
                  <Divider />
                  <div className="py-4 px-4 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200/50 dark:border-white/5">
                    <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400 mb-3 block">
                      Imagem da Capa
                    </span>
                    {config.heroBackgroundValue ? (
                      <div className="space-y-3">
                        <img
                          src={config.heroBackgroundValue}
                          alt="Hero bg"
                          className="w-full h-32 rounded-xl object-cover border border-black/5 dark:border-white/5"
                          style={{
                            objectFit: config.heroBackgroundSize || "cover",
                            objectPosition: config.heroBackgroundPosition || "center",
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => heroInputRef.current?.click()}
                            className="text-[12px] font-medium text-blue-500 hover:text-primary transition-colors"
                          >
                            Trocar Capa
                          </button>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <button
                            onClick={() => u({ heroBackgroundValue: "", heroBackgroundType: "none" })}
                            className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="mt-3 bg-white dark:bg-[#111] border border-zinc-200/50 dark:border-white/5 rounded-lg p-3 space-y-3">
                          <Segmented
                            value={config.heroBackgroundSize || "cover"}
                            onChange={(v) => u({ heroBackgroundSize: v as any })}
                            options={[
                              { value: "cover", label: "Preencher" },
                              { value: "contain", label: "Conter" },
                            ]}
                          />
                          <div className="pt-1">
                            <Segmented
                              value={config.heroBackgroundPosition || "center"}
                              onChange={(v) => u({ heroBackgroundPosition: v as any })}
                              options={[
                                { value: "top", label: "Cima" },
                                { value: "center", label: "Meio" },
                                { value: "bottom", label: "Baixo" },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => heroInputRef.current?.click()}
                        disabled={uploadingHero}
                        className="w-full py-6 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-xl hover:bg-zinc-100/50 dark:hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingHero ? (
                          <>
                            <Loader2 size={20} className="text-zinc-400 animate-spin" />
                            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
                              Enviando imagem...
                            </span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={20} className="text-zinc-400" />
                            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
                              Clique para enviar imagem
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={heroInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleHeroUpload}
                    />

                    {/* Cores de Texto do Hero removidas, pois o texto agora se baseia automaticamente na cor de fundo do formulário */}
                  </div>
                </>
              )}
            </RowGroup>
          </AppleCard>
          <AppleCard>
            <RowGroup title="Identidade da Marca">
              <Row label="Nome da Marca">
                <InlineInput value={config.businessName || ""} onChange={(v) => u({ businessName: v })} />
              </Row>
              <Divider />
              <div className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 min-h-[56px] group">
                <span className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-200">Logo</span>
                <div className="flex items-center gap-3">
                  {config.logoUrl ? (
                    <div className="flex items-center p-1 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5">
                      <img
                        src={config.logoUrl}
                        alt="Logo"
                        className="w-8 h-8 rounded-md object-contain bg-white dark:bg-black/20"
                      />
                      <div className="flex flex-col ml-3 mr-2">
                        <Segmented
                          value={config.logoSize || "medium"}
                          onChange={(v) => u({ logoSize: v as any })}
                          options={[
                            { value: "small", label: "P" },
                            { value: "medium", label: "M" },
                            { value: "large", label: "G" },
                            { value: "xlarge", label: "GG" },
                            { value: "xxlarge", label: "XG" },
                          ]}
                        />
                      </div>
                      <div className="flex items-center border-l border-zinc-200/80 dark:border-white/10 pl-1">
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="text-[12px] font-medium h-7 px-2 text-primary hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-md transition-colors"
                        >
                          Trocar
                        </button>
                        <button
                          onClick={() => u({ logoUrl: undefined })}
                          className="h-7 w-7 flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-3 h-8 rounded-lg text-[12.5px] font-medium border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 flex items-center gap-1.5 shadow-sm hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Enviando...
                        </>
                      ) : (
                        <>
                          <Upload size={14} /> Fazer upload
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <Divider />
              <Row label="Posição da Logo">
                <Segmented
                  value={config.logoPosition || "center"}
                  onChange={(v) => u({ logoPosition: v as any })}
                  options={[
                    { value: "left", label: "Esq" },
                    { value: "center", label: "Centro" },
                    { value: "right", label: "Dir" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Formato da Logo">
                <Segmented
                  value={config.logoShape || "natural"}
                  onChange={(v) => u({ logoShape: v as any })}
                  options={[
                    { value: "natural", label: "Livre" },
                    { value: "square", label: "Quadrado" },
                    { value: "circle", label: "Círculo" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Borda na Logo">
                <Switch checked={config.logoBorder ?? false} onCheckedChange={(c) => u({ logoBorder: c })} />
              </Row>
            </RowGroup>

            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </AppleCard>

          <AppleCard>
            <RowGroup title="Cores e Fundo">
              <ColorRow
                label="Cor Primária"
                value={config.primaryColor || ""}
                onChange={(v) => u({ primaryColor: v })}
              />
              <Divider />
              <Row label="Tipo de Fundo">
                <Segmented
                  value={config.backgroundType || "solid"}
                  onChange={(v) => u({ backgroundType: v as any })}
                  options={[
                    { value: "solid", label: "Cor" },
                    { value: "gradient", label: "Gradiente" },
                    { value: "pattern", label: "Pattern" },
                  ]}
                />
              </Row>
              {config.backgroundType === "solid" && (
                <>
                  <Divider />
                  <ColorRow
                    label="Cor do Fundo"
                    value={config.backgroundValue || "#ffffff"}
                    onChange={(v) => u({ backgroundValue: v })}
                  />
                </>
              )}
              {config.backgroundType === "gradient" && (
                <div className="px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200/50 dark:border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)",
                      "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
                      "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
                      "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
                      "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
                      "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
                      "linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)",
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      "linear-gradient(135deg, #232526 0%, #414345 100%)",
                      "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
                    ].map((grad, i) => (
                      <button
                        key={i}
                        onClick={() => u({ backgroundValue: grad })}
                        style={{ background: grad }}
                        className={cn(
                          "w-10 h-10 rounded-full border-2 transition-transform hover:scale-105",
                          config.backgroundValue === grad
                            ? "border-black dark:border-white shadow-md scale-110"
                            : "border-transparent shadow-sm",
                        )}
                        title={`Gradiente ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {config.backgroundType === "pattern" && (
                <>
                  <Divider />
                  <Row label="URL do Pattern">
                    <InlineInput value={config.backgroundValue || ""} onChange={(v) => u({ backgroundValue: v })} />
                  </Row>
                  <p className="px-4 pb-3 text-[11px] text-zinc-500">
                    Cole a URL de uma imagem repetível (seamless) ou SVG data URI.
                  </p>
                </>
              )}
              <Divider />
              <Row label="Ruído de fundo (Grain) suave">
                <Switch checked={config.backgroundNoise ?? false} onCheckedChange={(c) => u({ backgroundNoise: c })} />
              </Row>
            </RowGroup>
          </AppleCard>

          <AppleCard>
            <RowGroup title="Cores Adicionais">
              <ColorRow
                label="Cor do Título (Hero e Capa)"
                value={config.heroTextColor || ""}
                onChange={(v) => u({ heroTextColor: v })}
              />
              <Divider />
              <ColorRow
                label="Cor do Subtítulo"
                value={config.heroSubColor || ""}
                onChange={(v) => u({ heroSubColor: v })}
              />
              <Divider />
              <ColorRow label="Fundo da Dica (✨)" value={config.tipColor || ""} onChange={(v) => u({ tipColor: v })} />
              <Divider />
              <ColorRow
                label="Texto da Dica (✨)"
                value={config.tipTextColor || ""}
                onChange={(v) => u({ tipTextColor: v })}
              />
              <Divider />
              <ColorRow
                label="Cor da Borda da Logo/Capa"
                value={config.logoBorderColor || ""}
                onChange={(v) => u({ logoBorderColor: v })}
              />
              <Divider />
              <ColorRow
                label="Cor de Fundo da Logo"
                value={config.logoBgColor || ""}
                onChange={(v) => u({ logoBgColor: v })}
              />
            </RowGroup>
          </AppleCard>

          <AppleCard>
            <RowGroup title="Geometria & Tipografia">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-200">Família da Fonte</span>
                <Select value={config.fontFamily || "Inter"} onValueChange={(v) => u({ fontFamily: v as any })}>
                  <SelectTrigger className="w-[180px] md:w-[220px] bg-zinc-50 dark:bg-white/5 border-zinc-200/50 dark:border-white/5 rounded-md h-9 text-[13px] font-medium focus:ring-1 focus:ring-primary/50 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    {FONT_PAIRINGS.map((f) => (
                      <SelectItem key={f.name} value={f.name} className="py-2.5">
                        <span style={{ fontFamily: f.name }} className="text-[14px]">
                          {f.name}
                        </span>
                        <span className="text-[11px] text-zinc-400 ml-2 hidden sm:inline-block">{f.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Divider />
              <Row label="Peso do Título">
                <Segmented
                  value={config.titleWeight || "bold"}
                  onChange={(v) => u({ titleWeight: v as any })}
                  options={[
                    { value: "semibold", label: "Semibold" },
                    { value: "bold", label: "Bold" },
                    { value: "extrabold", label: "Extra" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Arredondamento Global">
                <Segmented
                  value={config.borderRadius || "medium"}
                  onChange={(v) => u({ borderRadius: v as any })}
                  options={[
                    { value: "none", label: "Reto" },
                    { value: "small", label: "Suave" },
                    { value: "medium", label: "Médio" },
                    { value: "large", label: "Grande" },
                    { value: "full", label: "Pílula" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Estilo do Botão">
                <Segmented
                  value={config.buttonStyle || "filled"}
                  onChange={(v) => u({ buttonStyle: v as any })}
                  options={[
                    { value: "filled", label: "Sólido" },
                    { value: "soft", label: "Suave" },
                    { value: "outline", label: "Outline" },
                    { value: "gradient", label: "Gradiente" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Estilo do Campo">
                <Segmented
                  value={config.inputStyle || "outlined"}
                  onChange={(v) => u({ inputStyle: v as any })}
                  options={[
                    { value: "outlined", label: "Bordado" },
                    { value: "filled", label: "Preenchido" },
                    { value: "underline", label: "Linha" },
                  ]}
                />
              </Row>
            </RowGroup>
          </AppleCard>
        </section>

        {/* 3. LAYOUT E CONTEÚDO */}
        <section className="space-y-5 pt-6 border-t border-zinc-200/50 dark:border-white/5">
          <h3 className="text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2">
            <Layout size={16} className="text-zinc-400" /> Layout & Conteúdo
          </h3>

          <AppleCard>
            <RowGroup title="Textos Principais">
              <Row label="Boas-vindas">
                <InlineInput value={config.welcomeMessage || ""} onChange={(v) => u({ welcomeMessage: v })} />
              </Row>
              <Divider />
              <Row label="Mensagem Final">
                <InlineInput value={config.thankYouMessage || ""} onChange={(v) => u({ thankYouMessage: v })} />
              </Row>
              <Divider />
              <Row label="Texto do Botão">
                <InlineInput value={config.submitButtonText || ""} onChange={(v) => u({ submitButtonText: v })} />
              </Row>
            </RowGroup>
          </AppleCard>
        </section>

        {/* 4. AVANÇADO (Collapsible Sections) */}
        <section className="space-y-4 pt-6 border-t border-zinc-200/50 dark:border-white/5">
          <div className="flex items-center gap-2 pb-1">
            <BoxSelect size={16} className="text-zinc-400" />
            <h3 className="text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100">Avançado e Extras</h3>
          </div>

          <CollapsibleSection title="Efeitos Visuais" desc="Microinterações e animações" icon={<Sparkles size={16} />}>
            <AppleCard>
              <Row label="Animações">
                <Segmented
                  value={config.animationStyle || "subtle"}
                  onChange={(v) => u({ animationStyle: v as any })}
                  options={[
                    { value: "none", label: "Off" },
                    { value: "subtle", label: "Sutil" },
                    { value: "expressive", label: "Expressivo" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Glassmorphism (Blur)">
                <Switch checked={config.glassmorphism ?? false} onCheckedChange={(c) => u({ glassmorphism: c })} />
              </Row>
              <Divider />
              <Row label="Microinterações extras">
                <Switch
                  checked={config.microinteractions ?? true}
                  onCheckedChange={(c) => u({ microinteractions: c })}
                />
              </Row>
            </AppleCard>
          </CollapsibleSection>

          <CollapsibleSection title="Estrutura Fina" desc="Larguras, Sombras e Divisores" icon={<Layout size={16} />}>
            <AppleCard>
              <Row label="Largura">
                <Segmented
                  value={config.formWidth || "medium"}
                  onChange={(v) => u({ formWidth: v as any })}
                  options={[
                    { value: "narrow", label: "Compacta" },
                    { value: "medium", label: "Normal" },
                    { value: "wide", label: "Ampla" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Separador de Seções">
                <Segmented
                  value={config.sectionDivider || "space"}
                  onChange={(v) => u({ sectionDivider: v as any })}
                  options={[
                    { value: "space", label: "Espaço" },
                    { value: "line", label: "Linha" },
                    { value: "number", label: "Num" },
                    { value: "card", label: "Card" },
                    { value: "accordion", label: "Drop" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Espaçamento Interno">
                <Segmented
                  value={config.spacing || "comfortable"}
                  onChange={(v) => u({ spacing: v as any })}
                  options={[
                    { value: "compact", label: "P" },
                    { value: "comfortable", label: "M" },
                    { value: "spacious", label: "G" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Barra de Progresso">
                <Segmented
                  value={config.progressBarStyle || "none"}
                  onChange={(v) => u({ progressBarStyle: v as any })}
                  options={[
                    { value: "none", label: "Off" },
                    { value: "line", label: "Linha" },
                    { value: "percentage", label: "%" },
                    { value: "steps", label: "Passos" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Sombras Dinâmicas">
                <Segmented
                  value={config.boxShadow || "none"}
                  onChange={(v) => u({ boxShadow: v as any })}
                  options={[
                    { value: "none", label: "Off" },
                    { value: "soft", label: "Suave" },
                    { value: "sharp", label: "Forte" },
                    { value: "deep", label: "Profunda" },
                  ]}
                />
              </Row>
              <Divider />
              <Row label="Espaçamento Letras">
                <Segmented
                  value={config.letterSpacing || "normal"}
                  onChange={(v) => u({ letterSpacing: v as any })}
                  options={[
                    { value: "tight", label: "Apertado" },
                    { value: "normal", label: "Padrão" },
                    { value: "wide", label: "Largo" },
                  ]}
                />
              </Row>
            </AppleCard>
          </CollapsibleSection>

          <CollapsibleSection
            title="Cores Específicas"
            desc="Sobreescreva cores textuais/campos"
            icon={<Palette size={16} />}
          >
            <AppleCard>
              <ColorRow label="Cor do Texto" value={config.textColor || ""} onChange={(v) => u({ textColor: v })} />
              <Divider />
              <ColorRow label="Fundo do Campo" value={config.inputColor || ""} onChange={(v) => u({ inputColor: v })} />
              <Divider />
              <ColorRow
                label="Texto do Campo"
                value={config.inputTextColor || ""}
                onChange={(v) => u({ inputTextColor: v })}
              />
            </AppleCard>
          </CollapsibleSection>

          <CollapsibleSection
            title="Redes Sociais"
            desc="Mostrados na tela Obrigado"
            icon={<MessageSquare size={16} />}
          >
            <AppleCard>
              <Row label="WhatsApp (Número)">
                <InlineInput value={config.whatsappNumber || ""} onChange={(v) => u({ whatsappNumber: v })} />
              </Row>
              <Divider />
              <Row label="Instagram (@)">
                <InlineInput value={config.instagramHandle || ""} onChange={(v) => u({ instagramHandle: v })} />
              </Row>
              <Divider />
              <Row label="Website (URL)">
                <InlineInput value={config.websiteUrl || ""} onChange={(v) => u({ websiteUrl: v })} />
              </Row>
              <Divider />
              <Row label="Exibir na tela sucesso">
                <Switch
                  checked={config.showSocialOnSuccess ?? true}
                  onCheckedChange={(c) => u({ showSocialOnSuccess: c })}
                />
              </Row>
            </AppleCard>
          </CollapsibleSection>

          <CollapsibleSection
            title="Vídeo Promocional"
            desc="Exiba um vídeo Loom/Youtube"
            icon={<MonitorPlay size={16} />}
          >
            <AppleCard>
              <Row label="URL do Vídeo">
                <InlineInput value={config.welcomeVideoUrl || ""} onChange={(v) => u({ welcomeVideoUrl: v })} />
              </Row>
              <p className="px-4 pb-3 pt-1 text-[11px] text-zinc-500">Apenas links do Youtube, Vimeo ou Loom.</p>
              {config.welcomeVideoUrl && (
                <>
                  <Divider />
                  <Row label="Posição do Vídeo">
                    <Segmented
                      value={config.welcomeVideoPosition || "top"}
                      onChange={(v) => u({ welcomeVideoPosition: v as any })}
                      options={[
                        { value: "hero", label: "No Hero" },
                        { value: "top", label: "Início form" },
                      ]}
                    />
                  </Row>
                </>
              )}
            </AppleCard>
          </CollapsibleSection>

          <CollapsibleSection
            title="Inteligência Artificial"
            desc="Tom de voz caso use recursos IA"
            icon={<Star size={16} />}
          >
            <AppleCard>
              <Row label="Tom de Voz">
                <Segmented
                  value={config.aiTone || "friendly"}
                  onChange={(v) => u({ aiTone: v as any })}
                  options={[
                    { value: "executive", label: "Executivo" },
                    { value: "friendly", label: "Amigável" },
                    { value: "minimal", label: "Direto" },
                  ]}
                />
              </Row>
              <div className="px-4 pb-3">
                <p className="text-[11.5px] text-zinc-400 leading-snug">
                  Seu cliente receberá orientações geradas por IA. Escolha o tom que mais combina com sua marca.
                </p>
              </div>
            </AppleCard>
          </CollapsibleSection>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   APPLE-STYLE PRIMITIVES
   ═══════════════════════════════════════════ */

function CollapsibleSection({
  title,
  desc,
  icon,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-transparent border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100/50 dark:hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-zinc-500 shadow-sm shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-zinc-900 dark:text-锌-100 leading-tight">{title}</p>
            <p className="text-[11.5px] text-zinc-400 mt-0.5 leading-tight">{desc}</p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "text-zinc-400 transition-transform duration-200 shrink-0",
            isOpen ? "-rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={cn(
          "transition-all duration-300 overflow-hidden",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="p-4 pt-1">{children}</div>
      </div>
    </div>
  );
}

function RowGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{title}</p>
      </div>
      {children}
    </div>
  );
}

function AppleCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111111] rounded-[14px] border border-zinc-200/60 dark:border-white/5 overflow-hidden shadow-sm">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-zinc-100 dark:bg-white/5 mx-4" />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 min-h-[52px]">
      <span className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-200 shrink-0">{label}</span>
      <div className="flex justify-end items-center flex-1">{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[52px]">
      <span className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-200">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">{value}</span>
        <label className="relative cursor-pointer group">
          <div
            className="w-7 h-7 rounded-md border border-black/10 dark:border-white/10 shadow-sm transition-transform group-active:scale-95"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value || "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
    </div>
  );
}

function InlineInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-0 px-0 text-left md:text-right text-[14.5px] font-medium text-zinc-600 dark:text-zinc-400 focus-visible:ring-0 w-full md:max-w-[240px] h-auto shadow-none rounded-none placeholder:text-zinc-300"
      placeholder="Digite..."
    />
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center bg-zinc-100 dark:bg-white/5 rounded-lg p-0.5 w-full md:w-auto overflow-x-auto no-scrollbar border border-zinc-200/50 dark:border-transparent">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 md:flex-none px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 whitespace-nowrap",
            value === opt.value
              ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white border border-black/[0.04] dark:border-white/10"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
