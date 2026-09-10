"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Crown,
  Shield,
  Eye,
  Check,
  Palette,
  Link2,
  Building2,
  Copy,
  Clock,
  Loader2,
  X,
  Camera,
  ImagePlus,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { workspaceService } from "@/app/lib/services";
import { uploadBrandingImage } from "@/app/lib/services/storageService";
import ImageCropModal from "@/app/components/ui/ImageCropModal";
import type { InviteLink, WorkspaceMember } from "@/app/lib/types";
import { useWorkspace } from "@/app/contexts";
import { useUpgradeModal, handlePlanLimitError } from "@/app/contexts";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────

const PRESET_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0f172a"];

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown size={10} />,
  admin: <Shield size={10} />,
  member: <Users size={10} />,
  viewer: <Eye size={10} />,
};

const ROLE_COLORS: Record<string, string> = {
  owner:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
  admin:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30",
  member: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700",
  viewer: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-500 dark:border-zinc-700",
};

const NAV_ITEMS = [
  { id: "identidade", label: "Identidade", sub: "Logo · Nome · Cor" },
  { id: "membros", label: "Membros", sub: "Equipe · Papéis" },
  { id: "convites", label: "Convites", sub: "Links · Acesso" },
];

// ─── Shared components ────────────────────────────────────────

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
      {children}
    </p>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[148px_1fr] gap-2 md:gap-6 items-start py-4 border-b border-zinc-100 dark:border-white/[0.05] last:border-0">
      <div className="pt-[3px]">
        <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
        {hint && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 pb-4 border-b border-zinc-100 dark:border-white/[0.05]">
      <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function MemberAvatarGroup({ members, max = 5 }: { members: WorkspaceMember[]; max?: number }) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  return (
    <div className="flex items-center">
      {visible.map((member, i) => (
        <div
          key={member.uid}
          title={member.name || member.email}
          className="relative w-7 h-7 rounded-full overflow-hidden ring-2 ring-white dark:ring-[#111] shrink-0"
          style={{ marginLeft: i === 0 ? 0 : -9, zIndex: visible.length - i }}
        >
          <img
            src={
              member.avatarUrl ||
              `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(member.email || member.uid)}&backgroundColor=transparent`
            }
            alt={member.name || member.email}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-[#111] flex items-center justify-center text-[9px] font-bold text-zinc-600 dark:text-zinc-300 shrink-0"
          style={{ marginLeft: -9 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { activeWorkspace, updateActiveWorkspace } = useWorkspace();
  const { showUpgradeModal } = useUpgradeModal();

  const [activeSection, setActiveSection] = useState("identidade");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Identity form
  const [wsName, setWsName] = useState("");
  const [wsLogoUrl, setWsLogoUrl] = useState("");
  const [wsBrandColor, setWsBrandColor] = useState("#6366f1");
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  // Logo file upload
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Crop modal state
  const [cropSrc, setCropSrc] = useState("");
  const [showCropModal, setShowCropModal] = useState(false);

  // Invite form
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  // Per-row state
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Invite links
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [linkRole, setLinkRole] = useState("member");
  const [linkExpiry, setLinkExpiry] = useState("7d");
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");

  // Delete workspace
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  // Sync identity from active workspace
  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name);
      setWsLogoUrl(activeWorkspace.logoUrl || "");
      setWsBrandColor(activeWorkspace.brandColor || "#6366f1");
    }
  }, [activeWorkspace?.id]);

  // Load members
  useEffect(() => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    workspaceService
      .getWorkspaceMembers(activeWorkspace.id)
      .then(setMembers)
      .catch(() => toast.error("Erro ao carregar membros"))
      .finally(() => setIsLoading(false));
  }, [activeWorkspace?.id]);

  // Load invite links
  useEffect(() => {
    if (!activeWorkspace) return;
    setIsLoadingLinks(true);
    workspaceService
      .listInviteLinks(activeWorkspace.id)
      .then(setInviteLinks)
      .catch(() => {})
      .finally(() => setIsLoadingLinks(false));
  }, [activeWorkspace?.id]);

  const hasIdentityChanges =
    wsName.trim() !== (activeWorkspace?.name ?? "") ||
    wsLogoUrl !== (activeWorkspace?.logoUrl ?? "") ||
    wsBrandColor !== (activeWorkspace?.brandColor ?? "#6366f1") ||
    logoFile !== null;

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setShowCropModal(true);
    e.target.value = "";
  }

  function handleCropConfirm(croppedFile: File) {
    setLogoPreview(URL.createObjectURL(croppedFile));
    setLogoFile(croppedFile);
    setShowCropModal(false);
    setCropSrc("");
  }

  function handleCropCancel() {
    setShowCropModal(false);
    setCropSrc("");
  }

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !wsName.trim()) return;
    setIsSavingIdentity(true);
    try {
      let logoUrl = wsLogoUrl;
      if (logoFile) {
        logoUrl = await uploadBrandingImage(logoFile, "logo", activeWorkspace.id);
        setWsLogoUrl(logoUrl);
        setLogoFile(null);
        setLogoPreview("");
      }
      const updated = await workspaceService.updateWorkspace(activeWorkspace.id, {
        name: wsName.trim(),
        logoUrl: logoUrl || undefined,
        brandColor: wsBrandColor,
      });
      updateActiveWorkspace(updated);
      toast.success("Workspace atualizado");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar workspace");
    } finally {
      setIsSavingIdentity(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !email.trim()) return;
    setIsInviting(true);
    try {
      await workspaceService.inviteMember(activeWorkspace.id, email.trim(), inviteRole);
      setEmail("");
      toast.success(`Convite enviado para ${email.trim()}. O usuário precisará aceitar para entrar no workspace.`);
    } catch (err: any) {
      const msg = err?.message || "Erro ao enviar convite";
      if (!handlePlanLimitError(msg, showUpgradeModal)) {
        toast.error(msg);
      }
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(uid: string, role: string) {
    if (!activeWorkspace) return;
    setUpdatingUid(uid);
    try {
      await workspaceService.updateMemberRole(activeWorkspace.id, uid, role);
      setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, role: role as any } : m)));
      toast.success("Papel atualizado");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar papel");
    } finally {
      setUpdatingUid(null);
    }
  }

  async function handleRemove(uid: string) {
    if (!activeWorkspace) return;
    setRemovingUid(uid);
    try {
      await workspaceService.removeMember(activeWorkspace.id, uid);
      setMembers((prev) => prev.filter((m) => m.uid !== uid));
      toast.success("Membro removido");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover membro");
    } finally {
      setRemovingUid(null);
    }
  }

  async function handleCreateLink() {
    if (!activeWorkspace) return;
    setIsCreatingLink(true);
    try {
      const link = await workspaceService.createInviteLink(
        activeWorkspace.id,
        linkRole,
        linkExpiry,
        0,
        linkEmail.trim(),
      );
      setInviteLinks((prev) => [link, ...prev]);
      const url = `${window.location.origin}/invite/${link.code}`;
      await navigator.clipboard.writeText(url);
      toast.success(
        linkEmail.trim() ? `Link criado, copiado e enviado para ${linkEmail.trim()}!` : "Link criado e copiado!",
      );
      setLinkEmail("");
    } catch (err: any) {
      const msg = err?.message || "Erro ao criar link";
      if (!handlePlanLimitError(msg, showUpgradeModal)) {
        toast.error(msg);
      }
    } finally {
      setIsCreatingLink(false);
    }
  }

  async function handleRevokeLink(inviteId: string) {
    if (!activeWorkspace) return;
    try {
      await workspaceService.revokeInviteLink(activeWorkspace.id, inviteId);
      setInviteLinks((prev) => prev.filter((l) => l.id !== inviteId));
      toast.success("Link revogado");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao revogar link");
    }
  }

  async function handleDeleteWorkspace() {
    if (!activeWorkspace) return;
    setIsDeletingWorkspace(true);
    try {
      await workspaceService.deleteWorkspace(activeWorkspace.id);
      toast.success("Workspace excluído com sucesso");
      window.location.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir workspace");
      setIsDeletingWorkspace(false);
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function formatExpiry(expiresAt: string): string {
    try {
      const d = new Date(expiresAt);
      const now = new Date();
      if (d < now) return "Expirado";
      const diff = d.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return "< 1h";
      if (hours < 24) return `${hours}h`;
      return `${Math.floor(hours / 24)}d`;
    } catch {
      return "-";
    }
  }

  const brandHex = wsBrandColor.startsWith("#") ? wsBrandColor : "#6366f1";
  const displayLogo = logoPreview || wsLogoUrl;
  const wsInitial = (wsName || activeWorkspace?.name || "W")[0]?.toUpperCase();

  // ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-5 md:px-8 py-8 max-w-[860px] mx-auto">
      {/* ── Hero card ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-5">
          {/* Logo — uploadable */}
          <div className="relative group shrink-0">
            <div
              className="w-[56px] h-[56px] rounded-2xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08] flex items-center justify-center"
              style={{ background: brandHex + "18" }}
            >
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-[20px] font-bold" style={{ color: brandHex }}>
                  {wsInitial}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
            >
              <Camera size={14} className="text-white" strokeWidth={2} />
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
            {logoFile && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111] flex items-center justify-center">
                <Check size={8} className="text-white" strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate leading-tight">
              {wsName || activeWorkspace?.name || "Meu Workspace"}
            </p>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{activeWorkspace?.slug}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {members.length} membro{members.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-zinc-300 dark:text-zinc-700">·</span>
              {/* Brand color swatch */}
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ background: brandHex }} />
                {brandHex}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Split layout ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Mobile tab strip ── */}
        <div className="md:hidden -mx-5 px-5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 w-max pb-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* ── Sidebar nav ── */}
        <nav className="shrink-0 w-[148px] sticky top-8 hidden md:block">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "relative w-full text-left pl-3 pr-3 py-2.5 rounded-xl transition-all duration-150",
                    isActive
                      ? "bg-primary/[0.06] dark:bg-primary/[0.08]"
                      : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
                  )}
                >
                  {/* Small centered pip */}
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full transition-all duration-200",
                      isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                    )}
                  />
                  <p
                    className={cn(
                      "text-[13px] font-semibold transition-colors",
                      isActive ? "text-primary" : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-[10.5px] mt-0.5 transition-colors",
                      isActive ? "text-primary/60" : "text-zinc-400 dark:text-zinc-600",
                    )}
                  >
                    {item.sub}
                  </p>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 w-full min-w-0 animate-in fade-in duration-150" key={activeSection}>
          <div className="bg-white dark:bg-[#111] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm overflow-hidden">
            {/* ════════════ SECTION 1 — IDENTIDADE ════════════ */}
            {activeSection === "identidade" && (
              <form onSubmit={handleSaveIdentity}>
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SectionHead title="Identidade" subtitle="Nome, logo e cor da marca do workspace." />

                  {/* Logo upload */}
                  <FieldRow label="Logo" hint="PNG ou SVG recomendado · máx. 5 MB">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 shrink-0 flex items-center justify-center"
                        style={{ background: brandHex + "18" }}
                      >
                        {displayLogo ? (
                          <img
                            src={displayLogo}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-[13px] font-bold" style={{ color: brandHex }}>
                            {wsInitial}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="text-[12px] font-semibold text-primary hover:opacity-75 transition-opacity flex items-center gap-1.5"
                      >
                        <ImagePlus size={12} />
                        {displayLogo ? "Trocar logo" : "Fazer upload"}
                      </button>
                      {logoFile && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check size={10} strokeWidth={2.5} />
                          Nova logo selecionada
                        </span>
                      )}
                    </div>
                  </FieldRow>

                  {/* Name */}
                  <FieldRow label="Nome">
                    <Input
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      placeholder="Meu Workspace"
                      required
                      className="h-9 text-[13px] rounded-lg"
                    />
                  </FieldRow>

                  {/* Brand color */}
                  <FieldRow label="Cor da marca">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Native color picker */}
                        <input
                          type="color"
                          value={brandHex}
                          onChange={(e) => setWsBrandColor(e.target.value)}
                          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent shrink-0"
                          style={{
                            boxShadow: `0 0 0 1.5px ${brandHex}50, 0 2px 8px ${brandHex}20`,
                          }}
                        />
                        {/* Hex input */}
                        <Input
                          value={wsBrandColor}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setWsBrandColor(v);
                          }}
                          placeholder="#6366f1"
                          className="h-9 text-[12.5px] rounded-lg w-[100px] font-mono"
                        />
                        {/* Swatches */}
                        <div className="flex items-center gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setWsBrandColor(c)}
                              title={c}
                              className="w-5 h-5 rounded-full shrink-0 transition-transform duration-150 hover:scale-110"
                              style={{
                                background: c,
                                outline: wsBrandColor === c ? `2.5px solid ${c}` : "2.5px solid transparent",
                                outlineOffset: 2,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Live preview */}
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-100 dark:border-white/[0.05] bg-zinc-50/60 dark:bg-white/[0.02]">
                        <div
                          className="px-3 py-1.5 rounded-lg text-white text-[11.5px] font-semibold shrink-0"
                          style={{ background: brandHex }}
                        >
                          Primário
                        </div>
                        <div
                          className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold border shrink-0"
                          style={{
                            color: brandHex,
                            borderColor: brandHex + "40",
                            background: brandHex + "12",
                          }}
                        >
                          Suave
                        </div>
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ background: brandHex }} />
                        <span className="text-[11px] text-zinc-400 ml-auto shrink-0">Prévia</span>
                      </div>
                    </div>
                  </FieldRow>
                </div>

                <div className="px-6 py-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmName("");
                      setShowDeleteDialog(true);
                    }}
                    className="text-[11.5px] text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-500 transition-colors"
                  >
                    Excluir workspace
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingIdentity || !hasIdentityChanges || !wsName.trim()}
                    className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: brandHex }}
                  >
                    {isSavingIdentity ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Salvar
                  </button>
                </div>
              </form>
            )}

            {/* Crop modal */}
            <ImageCropModal
              open={showCropModal}
              imageSrc={cropSrc}
              title="Ajustar logo do workspace"
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />

            {/* ════════════ SECTION 2 — MEMBROS ════════════ */}
            {activeSection === "membros" && (
              <div>
                {/* Member list */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-zinc-100 dark:border-white/[0.05]">
                    <div>
                      <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-white">Membros</h2>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Gerencie os papéis da equipe.
                      </p>
                    </div>
                    {!isLoading && members.length > 0 && <MemberAvatarGroup members={members} max={6} />}
                  </div>

                  {isLoading ? (
                    <div className="py-10 flex flex-col items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-primary animate-spin" />
                      <p className="text-[12px] text-zinc-400">Carregando membros…</p>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center mx-auto mb-3">
                        <Users size={18} className="text-zinc-400" />
                      </div>
                      <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                        Nenhum membro encontrado.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50 dark:divide-white/[0.03] -mx-6 px-0">
                      {members.map((member) => {
                        const isOwner = member.role === "owner";
                        const seed = encodeURIComponent(member.email || member.uid);
                        return (
                          <div key={member.uid} className="flex items-center gap-3 px-6 py-3.5 group">
                            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-zinc-100 dark:ring-white/[0.07] shrink-0">
                              <img
                                src={
                                  member.avatarUrl ||
                                  `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=transparent`
                                }
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                                {member.name || member.email}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{member.email}</p>
                            </div>
                            {isOwner ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0",
                                  ROLE_COLORS.owner,
                                )}
                              >
                                {ROLE_ICONS.owner}
                                {ROLE_LABELS.owner}
                              </span>
                            ) : (
                              <Select
                                value={member.role}
                                onValueChange={(val) => handleRoleChange(member.uid, val)}
                                disabled={updatingUid === member.uid}
                              >
                                <SelectTrigger className="h-7 w-[120px] text-[11.5px] rounded-lg border-zinc-200 dark:border-white/10 shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin" className="text-[12px]">
                                    Admin
                                  </SelectItem>
                                  <SelectItem value="member" className="text-[12px]">
                                    Membro
                                  </SelectItem>
                                  <SelectItem value="viewer" className="text-[12px]">
                                    Visualizador
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemove(member.uid)}
                                disabled={removingUid === member.uid}
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Invite by email */}
                <div className="px-6 py-4">
                  <SubLabel>Convidar por e-mail</SubLabel>
                  <form onSubmit={handleInvite}>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                          E-mail
                        </Label>
                        <Input
                          type="email"
                          placeholder="nome@empresa.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-9 text-[13px] rounded-lg"
                        />
                      </div>
                      <div className="w-full sm:w-[130px] shrink-0 space-y-1.5">
                        <Label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                          Papel
                        </Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger className="h-9 text-[12.5px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin" className="text-[12.5px]">
                              Admin
                            </SelectItem>
                            <SelectItem value="member" className="text-[12.5px]">
                              Membro
                            </SelectItem>
                            <SelectItem value="viewer" className="text-[12.5px]">
                              Visualizador
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        type="submit"
                        disabled={isInviting || !email.trim()}
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-semibold text-white w-full sm:w-auto shrink-0 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: brandHex }}
                      >
                        <UserPlus size={13} />
                        {isInviting ? "Convidando…" : "Convidar"}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2.5">
                      O usuário precisa ter uma conta ativa para ser adicionado.
                    </p>
                  </form>
                </div>
              </div>
            )}

            {/* ════════════ SECTION 3 — CONVITES ════════════ */}
            {activeSection === "convites" && (
              <div>
                {/* Create link */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.05]">
                  <SectionHead
                    title="Links de convite"
                    subtitle="Gere um link para compartilhar com qualquer pessoa."
                  />

                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="w-full sm:w-[130px] shrink-0 space-y-1.5">
                      <Label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Papel
                      </Label>
                      <Select value={linkRole} onValueChange={setLinkRole}>
                        <SelectTrigger className="h-9 text-[12.5px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="text-[12.5px]">
                            Admin
                          </SelectItem>
                          <SelectItem value="member" className="text-[12.5px]">
                            Membro
                          </SelectItem>
                          <SelectItem value="viewer" className="text-[12.5px]">
                            Visualizador
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-[130px] shrink-0 space-y-1.5">
                      <Label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Expira em
                      </Label>
                      <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                        <SelectTrigger className="h-9 text-[12.5px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1h" className="text-[12.5px]">
                            1 hora
                          </SelectItem>
                          <SelectItem value="24h" className="text-[12.5px]">
                            24 horas
                          </SelectItem>
                          <SelectItem value="7d" className="text-[12.5px]">
                            7 dias
                          </SelectItem>
                          <SelectItem value="30d" className="text-[12.5px]">
                            30 dias
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        E-mail <span className="normal-case font-normal">(opcional)</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        className="h-9 text-[12.5px] rounded-lg"
                      />
                    </div>
                    <button
                      onClick={handleCreateLink}
                      disabled={isCreatingLink}
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-semibold text-white w-full sm:w-auto shrink-0 transition-opacity disabled:opacity-50"
                      style={{ background: brandHex }}
                    >
                      {isCreatingLink ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                      {isCreatingLink ? "Gerando…" : "Gerar link"}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2.5">
                    Qualquer pessoa com uma conta pode usar o link para entrar no workspace.
                  </p>
                </div>

                {/* Active links list */}
                {isLoadingLinks ? (
                  <div className="px-6 py-10 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-primary animate-spin" />
                  </div>
                ) : inviteLinks.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-[12px] text-zinc-400">Nenhum link ativo.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50 dark:divide-white/[0.03]">
                    {inviteLinks.map((link) => {
                      const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                      return (
                        <div key={link.id} className="flex items-center gap-3 px-6 py-3.5 group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-[11.5px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                                /invite/{link.code}
                              </code>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold shrink-0",
                                  ROLE_COLORS[link.role] || ROLE_COLORS.member,
                                )}
                              >
                                {ROLE_ICONS[link.role]}
                                {ROLE_LABELS[link.role] || link.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock size={10} className="text-zinc-300" />
                              <span
                                className={cn(
                                  "text-[10px]",
                                  isExpired ? "text-red-500 font-semibold" : "text-zinc-400",
                                )}
                              >
                                {isExpired ? "Expirado" : `Expira em ${formatExpiry(link.expiresAt)}`}
                              </span>
                              {link.useCount > 0 && (
                                <span className="text-[10px] text-zinc-400">
                                  · {link.useCount} uso
                                  {link.useCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-zinc-400 hover:text-primary shrink-0"
                            onClick={() => copyLink(link.code)}
                            title="Copiar link"
                          >
                            <Copy size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRevokeLink(link.id)}
                            title="Revogar link"
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete workspace dialog ──────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[420px] p-0 overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-white/[0.06] bg-white dark:bg-[#111]">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <DialogTitle className="text-[14px] font-semibold text-zinc-900 dark:text-white">
                Excluir workspace
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            {/* Warning box */}
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <p className="text-[12px] font-semibold text-red-700 dark:text-red-400 mb-1">Esta ação é irreversível</p>
              <p className="text-[11.5px] text-red-600/80 dark:text-red-400/70 leading-relaxed">
                Todos os formulários, respostas, membros e dados associados a{" "}
                <span className="font-semibold">{activeWorkspace?.name}</span> serão permanentemente excluídos. Não é
                possível desfazer.
              </p>
            </div>

            {/* Confirm by typing name */}
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block">
                Digite o nome do workspace para confirmar
              </label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={activeWorkspace?.name}
                className="h-9 text-[13px] rounded-lg"
                autoComplete="off"
              />
              {deleteConfirmName.length > 0 && deleteConfirmName !== activeWorkspace?.name && (
                <p className="text-[11px] text-red-500">O nome não corresponde.</p>
              )}
            </div>
          </div>

          <div className="px-6 pb-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className="h-8 px-4 rounded-lg text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteWorkspace}
              disabled={isDeletingWorkspace || deleteConfirmName !== activeWorkspace?.name}
              className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeletingWorkspace ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {isDeletingWorkspace ? "Excluindo…" : "Excluir workspace"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
