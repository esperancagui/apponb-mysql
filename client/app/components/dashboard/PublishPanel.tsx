"use client";

import React, { useState } from "react";
import { Form, BrandingConfig } from "@/app/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useOnboarding } from "@/app/contexts";
import { cn } from "@/lib/utils";
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Mail,
  Link as LinkIcon,
  Eye,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";

interface PublishPanelProps {
  form: Form;
  onUpdate: (updates: Partial<Form>) => void;
  onBrandingUpdate: (updates: Partial<BrandingConfig>) => void;
}

export default function PublishPanel({ form, onUpdate, onBrandingUpdate }: PublishPanelProps) {
  const [copied, setCopied] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const { completeStep } = useOnboarding();

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  const isPublished = form.status === "active";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    completeStep("form_shared");
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePublish = () => {
    const newStatus = isPublished ? "draft" : "active";
    onUpdate({ status: newStatus });
    toast.success(isPublished ? "Formulário despublicado" : "Formulário publicado! 🎉");
  };

  const handleSlugChange = (newSlug: string) => {
    // Sanitize slug
    const sanitized = newSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    onUpdate({ slug: sanitized });
  };

  const handleShareWhatsApp = () => {
    const text = `Preencha o formulário: ${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(form.name);
    const body = encodeURIComponent(`Olá!\n\nPreencha o formulário abaixo:\n${publicUrl}\n\nObrigado!`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8 lg:py-12">
      <div className="max-w-2xl mx-auto space-y-10 pb-36 md:pb-24">
        {/* Header */}
        <div>
          <h2 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Publicar Formulário
          </h2>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mt-1">
            Configure o link, compartilhe e controle a visibilidade.
          </p>
        </div>

        {/* ─── 1) STATUS ─── */}
        <section className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPublished ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-zinc-100 dark:bg-zinc-800/50",
                )}
              >
                <Globe size={20} className={isPublished ? "text-emerald-500" : "text-zinc-400"} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white">
                    {isPublished ? "Publicado" : "Rascunho"}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] uppercase tracking-wider px-1.5 h-4.5 font-bold border-transparent",
                      isPublished
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    {isPublished ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isPublished ? "Qualquer pessoa com o link pode responder." : "Só você pode ver este formulário."}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublished}
              onCheckedChange={handleTogglePublish}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </section>

        {/* ─── 2) LINK PÚBLICO (only when published) ─── */}
        {isPublished && (
        <section className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-[14.5px] font-bold text-zinc-900 dark:text-white mb-1">Link Público</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Envie este link para seus clientes preencherem.
            </p>
          </div>

          {/* Slug editor */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              URL personalizada
            </label>
            <div className="flex items-center gap-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <span className="px-3 py-2.5 text-[13px] text-zinc-400 dark:text-zinc-500 font-medium bg-zinc-100/80 dark:bg-zinc-800/50 border-r border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
                {typeof window !== "undefined" ? window.location.host : "onb.app"}/f/
              </span>
              {slugEditing ? (
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => setSlugEditing(false)}
                  onKeyDown={(e) => e.key === "Enter" && setSlugEditing(false)}
                  autoFocus
                  className="flex-1 px-3 py-2.5 text-[13px] font-semibold text-zinc-900 dark:text-white bg-transparent focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setSlugEditing(true)}
                  className="flex-1 px-3 py-2.5 text-[13px] font-semibold text-zinc-900 dark:text-white text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {form.slug || "sem-slug"}
                </button>
              )}
            </div>
          </div>

          {/* Copy link */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className={cn("flex-1 flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg min-w-0", !isPublished && "opacity-50")}>
              <LinkIcon size={14} className="text-zinc-400 shrink-0" />
              <span className="text-[13px] text-zinc-600 dark:text-zinc-300 font-medium truncate">{publicUrl}</span>
            </div>
            <Button
              onClick={handleCopyLink}
              disabled={!isPublished}
              className={cn(
                "h-10 px-4 rounded-lg text-[13px] font-semibold shadow-sm shrink-0 transition-all w-full sm:w-auto",
                copied ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-primary hover:bg-primary/85 text-white",
                !isPublished && "opacity-50 cursor-not-allowed",
              )}
            >
              {copied ? (
                <>
                  <Check size={14} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar
                </>
              )}
            </Button>
          </div>
          {!isPublished && (
            <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">Publique o formulário para ativar o link.</p>
          )}

          {/* Preview / published link */}
          <div className="flex items-center gap-3">
            {isPublished ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline underline-offset-4 transition-colors text-primary dark:text-blue-400"
              >
                <Eye size={14} />
                Ver formulário publicado
                <ExternalLink size={11} />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
                <Eye size={14} />
                Pré-visualizar
              </span>
            )}
            {!isPublished && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-medium">
                rascunho
              </span>
            )}
          </div>
        </section>
        )}

        {/* ─── 3) QR CODE (only when published) ─── */}
        {isPublished && (
        <section className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14.5px] font-bold text-zinc-900 dark:text-white mb-1">QR Code</h3>
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                Imprima ou compartilhe para acesso rápido.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6 relative">
            {!isPublished && (
              <div className="absolute inset-0 bg-white/60 dark:bg-[#111]/60 backdrop-blur-[1px] rounded-xl z-10 flex items-center justify-center">
                <span className="text-[12px] font-semibold text-zinc-400 dark:text-zinc-500">Disponível após publicação</span>
              </div>
            )}
            <div className={cn("w-32 h-32 bg-white border-2 border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0", !isPublished && "opacity-40")}>
              {/* QR Code via API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}&bgcolor=ffffff&color=18181b&margin=8`}
                alt="QR Code"
                className="w-full h-full"
                loading="lazy"
              />
            </div>
            <div className="space-y-3">
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Escaneie com a câmera do celular para abrir o formulário diretamente.
              </p>
              <Button
                variant="outline"
                disabled={!isPublished}
                className={cn("h-9 px-4 rounded-md text-[12.5px] font-semibold border-zinc-200 dark:border-zinc-700", !isPublished && "opacity-50 cursor-not-allowed")}
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(publicUrl)}&bgcolor=ffffff&color=18181b&margin=16`;
                  link.download = `qrcode-${form.slug}.png`;
                  link.click();
                  toast.success("QR Code baixado!");
                }}
              >
                Baixar QR Code
              </Button>
            </div>
          </div>
        </section>
        )}

        {/* ─── 4) COMPARTILHAR (only when published) ─── */}
        {isPublished && (
        <section className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-[14.5px] font-bold text-zinc-900 dark:text-white mb-1">Compartilhar</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Envie o formulário para seus clientes.</p>
          </div>
          <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", !isPublished && "opacity-50 pointer-events-none")}>
            <button
              onClick={handleShareWhatsApp}
              disabled={!isPublished}
              className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 bg-white dark:bg-[#0A0A0A] hover:bg-emerald-50 dark:hover:bg-emerald-950/10 hover:border-emerald-200 dark:hover:border-emerald-900/30 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">WhatsApp</p>
                <p className="text-[11px] text-zinc-500">Enviar link</p>
              </div>
            </button>

            <button
              onClick={handleShareEmail}
              disabled={!isPublished}
              className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 bg-white dark:bg-[#0A0A0A] hover:bg-blue-50 dark:hover:bg-blue-950/10 hover:border-blue-200 dark:hover:border-blue-900/30 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Mail size={18} className="text-primary dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">E-mail</p>
                <p className="text-[11px] text-zinc-500">Enviar por e-mail</p>
              </div>
            </button>

            <button
              onClick={handleCopyLink}
              disabled={!isPublished}
              className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 bg-white dark:bg-[#0A0A0A] hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Copy size={18} className="text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">Copiar Link</p>
                <p className="text-[11px] text-zinc-500">Área de transferência</p>
              </div>
            </button>
          </div>
          {!isPublished && (
            <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">Publique o formulário para compartilhar.</p>
          )}
        </section>
        )}

        {/* ─── 5) SEO (only when published) ─── */}
        {isPublished && (
        <section className="bg-white dark:bg-[#111] border border-zinc-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-[14.5px] font-bold text-zinc-900 dark:text-white">SEO e Preview do Link</h3>
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                Como aparece no WhatsApp, Google e redes sociais.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Título da página
              </label>
              <Input
                value={form.branding?.seoTitle || ""}
                onChange={(e) => onBrandingUpdate({ seoTitle: e.target.value })}
                placeholder={form.name}
                className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-[13.5px] h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Descrição curta
              </label>
              <Textarea
                value={form.branding?.seoDescription || ""}
                onChange={(e) => onBrandingUpdate({ seoDescription: e.target.value })}
                placeholder="Aparece ao compartilhar o link no WhatsApp, iMessage, etc."
                className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg resize-none min-h-[60px] text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={12} />
                Imagem de capa (og:image)
              </label>
              <Input
                value={form.branding?.seoThumbnailUrl || ""}
                onChange={(e) => onBrandingUpdate({ seoThumbnailUrl: e.target.value })}
                placeholder="https://..."
                className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-[13px] h-9 rounded-lg font-mono"
              />
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                Recomendado: 1200×630px. Aparece como thumbnail ao compartilhar.
              </p>
            </div>
          </div>

          {/* Live preview card */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 ml-1 uppercase tracking-wider">
                Preview
              </p>
            </div>
            {form.branding?.seoThumbnailUrl && (
              <div className="relative w-full aspect-[1200/630] overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <img
                  src={form.branding.seoThumbnailUrl}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="p-4 bg-white dark:bg-[#0A0A0A]">
              <p className="text-[13px] font-semibold text-primary dark:text-blue-400 truncate">
                {form.branding?.seoTitle || form.name}
              </p>
              <p className="text-[11.5px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                {form.branding?.seoDescription || "Preencha o formulário para enviar suas informações."}
              </p>
              <p className="text-[10.5px] text-emerald-600 dark:text-emerald-500 mt-1.5 truncate font-medium">
                {publicUrl}
              </p>
            </div>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
