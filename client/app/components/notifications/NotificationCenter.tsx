"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  BellOff,
  CheckCheck,
  Inbox,
  BrainCircuit,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Layers,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/app/contexts";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/app/contexts/WorkspaceContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { acceptInvite, declineInvite } from "@/app/lib/services/inviteService";
import type { AppNotification, NotificationType } from "@/app/lib/types";

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  new_submission:    { icon: Inbox,         color: "#3b82f6", bg: "#eff6ff", label: "Resposta"   },
  insight_completed: { icon: BrainCircuit,  color: "#10b981", bg: "#f0fdf4", label: "Análise IA" },
  high_risk:         { icon: AlertTriangle, color: "#ef4444", bg: "#fef2f2", label: "Alto Risco"  },
  status_updated:    { icon: RefreshCw,     color: "#8b5cf6", bg: "#f5f3ff", label: "Status"      },
  member_invited:    { icon: UserPlus,      color: "#f59e0b", bg: "#fffbeb", label: "Membro"      },
  form_limit_reached:{ icon: Layers,        color: "#f97316", bg: "#fff7ed", label: "Limite"      },
};

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#ec4899","#0f766e",
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getActor(n: AppNotification): { name: string; url?: string; isSystem?: boolean } {
  const m = n.meta ?? {};
  switch (n.type) {
    case "new_submission":
    case "high_risk":
      return { name: m.clientName || "Cliente" };
    case "insight_completed":
      return { name: m.clientName || "Sistema", isSystem: !m.clientName };
    case "status_updated":
      if (m.actorName) return { name: m.actorName, url: m.actorPhotoUrl || undefined };
      return { name: "Sistema", isSystem: true };
    case "member_invited":
      if (m.joined) return { name: m.memberName || "Membro", url: m.memberPhotoUrl || undefined };
      return { name: m.inviterName || m.workspaceName || "Workspace", url: m.inviterPhotoUrl || undefined };
    default:
      return { name: "ONB", isSystem: true };
  }
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({
  actor,
  type,
  read,
}: {
  actor: ReturnType<typeof getActor>;
  type: NotificationType;
  read: boolean;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const bg = actor.isSystem ? meta.bg : hashColor(actor.name);

  return (
    <div className="relative shrink-0">
      {/* Main avatar circle */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white select-none transition-all duration-300",
          read && "opacity-60",
        )}
        style={actor.isSystem
          ? { background: meta.bg, border: `1.5px solid ${meta.color}22` }
          : { background: bg }
        }
      >
        {actor.isSystem ? (
          <Icon size={16} style={{ color: meta.color }} strokeWidth={2} />
        ) : actor.url ? (
          <img src={actor.url} alt={actor.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span style={actor.isSystem ? { color: meta.color } : undefined}>
            {initials(actor.name) || "?"}
          </span>
        )}
      </div>

      {/* Type badge */}
      {!actor.isSystem && (
        <div
          className="absolute -bottom-[3px] -right-[3px] w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-background"
          style={{ background: meta.color }}
        >
          <Icon size={9} color="white" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

// ── Time grouping ─────────────────────────────────────────────────────────────

function groupByTime(items: AppNotification[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const groups: Record<string, AppNotification[]> = { hoje: [], ontem: [], anteriores: [] };
  for (const n of items) {
    const d = new Date(n.timestamp);
    if (d >= today) groups.hoje.push(n);
    else if (d >= yesterday) groups.ontem.push(n);
    else groups.anteriores.push(n);
  }
  return [
    { label: "Hoje",       items: groups.hoje       },
    { label: "Ontem",      items: groups.ontem      },
    { label: "Anteriores", items: groups.anteriores },
  ].filter((g) => g.items.length > 0);
}

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onAcceptInvite,
  onDeclineInvite,
  inviteActionPending,
}: {
  notification: AppNotification;
  onRead: () => void;
  onDismiss: (e: React.MouseEvent) => void;
  onAcceptInvite?: (e: React.MouseEvent) => void;
  onDeclineInvite?: (e: React.MouseEvent) => void;
  inviteActionPending?: string | null;
}) {
  const actor        = getActor(notification);
  const meta         = TYPE_META[notification.type];
  const isInvite     = notification.type === "member_invited" && !notification.meta?.joined;
  const isAccepting  = inviteActionPending?.endsWith(":accept");
  const isDeclining  = inviteActionPending?.endsWith(":decline");
  const isActing     = !!inviteActionPending;

  const timeAgo = formatDistanceToNow(new Date(notification.timestamp), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={isInvite ? undefined : onRead}
      className={cn(
        "group relative flex gap-3 pl-4 pr-10 py-3.5 transition-colors duration-150 rounded-xl mx-2",
        !isInvite && "cursor-pointer",
        !notification.read
          ? "bg-muted/50 dark:bg-muted/20 hover:bg-muted/70 dark:hover:bg-muted/30"
          : "hover:bg-muted/40 dark:hover:bg-muted/15",
      )}
    >
      {/* Unread stripe */}
      {!notification.read && (
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ background: meta.color }}
        />
      )}

      <Avatar actor={actor} type={notification.type} read={notification.read} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className={cn(
            "text-[13px] leading-[1.35]",
            notification.read ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
          )}>
            {notification.title}
          </p>
          <span className="text-[10.5px] text-muted-foreground/50 font-medium tabular-nums shrink-0 mt-px">
            {timeAgo}
          </span>
        </div>

        {/* Message */}
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
          {notification.message}
        </p>

        {/* Type label */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: meta.color, background: meta.bg + "cc" }}
          >
            {meta.label}
          </span>
          {!notification.read && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          )}
        </div>

        {/* Invite action buttons */}
        {isInvite && onAcceptInvite && onDeclineInvite && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={onAcceptInvite}
              disabled={isActing}
              className={cn(
                "flex-1 h-7 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 text-white",
                isActing ? "opacity-60 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.98]",
              )}
              style={{ background: meta.color }}
            >
              {isAccepting ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Check size={12} strokeWidth={2.5} />
              )}
              Aceitar
            </button>
            <button
              onClick={onDeclineInvite}
              disabled={isActing}
              className={cn(
                "flex-1 h-7 rounded-lg text-[12px] font-semibold transition-all bg-muted text-muted-foreground",
                isActing ? "opacity-60 cursor-not-allowed" : "hover:bg-destructive/10 hover:text-destructive active:scale-[0.98]",
              )}
            >
              {isDeclining ? (
                <span className="inline-block w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              ) : "Recusar"}
            </button>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {!isInvite && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-background/80 border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 flex items-center justify-center text-muted-foreground shadow-sm"
          aria-label="Remover"
        >
          <X size={10} />
        </button>
      )}
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ isUnreadFilter }: { isUnreadFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-10 text-center">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 dark:bg-muted/20 flex items-center justify-center">
          {isUnreadFilter
            ? <BellOff size={20} className="text-muted-foreground/30" strokeWidth={1.5} />
            : <Bell    size={20} className="text-muted-foreground/30" strokeWidth={1.5} />
          }
        </div>
        {!isUnreadFilter && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles size={10} className="text-primary/60" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[13.5px] font-semibold text-foreground">
          {isUnreadFilter ? "Tudo em dia" : "Sem notificações"}
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          {isUnreadFilter
            ? "Você leu tudo por aqui."
            : "Novas respostas, análises e\nconvites aparecerão aqui."}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const { notifications, unreadCount, isOpen, close, markAsRead, markAllAsRead, dismiss } = useNotifications();
  const router = useRouter();
  const { refreshWorkspaces } = useWorkspace();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pendingInviteAction, setPendingInviteAction] = useState<string | null>(null);

  const filtered = useMemo(
    () => filter === "unread" ? notifications.filter((n) => !n.read) : notifications,
    [notifications, filter],
  );
  const groups = useMemo(() => groupByTime(filtered), [filtered]);

  const handleClick = (n: AppNotification) => {
    if (n.type === "member_invited") return;
    markAsRead(n.id);
    if (n.link) { router.push(n.link); close(); }
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dismiss(id);
  };

  const handleAcceptInvite = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    const code = n.meta?.inviteCode;
    if (!code) return;
    setPendingInviteAction(n.id + ":accept");
    try {
      await acceptInvite(code);
      dismiss(n.id);
      await refreshWorkspaces();
      toast.success(`Você entrou no workspace "${n.meta?.workspaceName}"!`);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível aceitar o convite.");
    } finally {
      setPendingInviteAction(null);
    }
  };

  const handleDeclineInvite = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    const code = n.meta?.inviteCode;
    if (!code) return;
    setPendingInviteAction(n.id + ":decline");
    try {
      await declineInvite(code);
      dismiss(n.id);
      toast.info("Convite recusado.");
    } catch {
      dismiss(n.id);
    } finally {
      setPendingInviteAction(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30"
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            key="nc-panel"
            initial={{ x: "100%", opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.85 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[390px] flex flex-col"
            style={{
              background: "var(--background)",
              borderLeft: "1px solid color-mix(in oklch, var(--border) 80%, transparent)",
              boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.12), -4px 0 12px -4px rgba(0,0,0,0.06)",
            }}
          >
            {/* ── Header ── */}
            <div className="px-5 pt-5 pb-4 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[16px] font-bold text-foreground tracking-tight">Notificações</h2>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-5 min-w-[20px] px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center text-white"
                      style={{ background: "var(--destructive)" }}
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="h-7 px-2.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <CheckCheck size={12} />
                      Marcar todas
                    </button>
                  )}
                  <button
                    onClick={close}
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-1.5">
                {([
                  { key: "all",    label: "Todas",     count: notifications.length },
                  { key: "unread", label: "Não lidas", count: unreadCount          },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "h-7 px-3 rounded-full text-[12px] font-semibold transition-all duration-150 flex items-center gap-1.5",
                      filter === tab.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn(
                        "text-[10px] font-bold leading-none transition-opacity",
                        filter === tab.key ? "opacity-60" : "opacity-40",
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border mx-4 shrink-0" />

            {/* ── Notification list ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain py-2">
              <AnimatePresence mode="wait">
                {groups.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[300px]"
                  >
                    <EmptyState isUnreadFilter={filter === "unread"} />
                  </motion.div>
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {groups.map((group, gi) => (
                      <div key={group.label} className={cn(gi > 0 && "mt-3")}>
                        {/* Group label */}
                        <div className="px-6 py-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                            {group.label}
                          </span>
                        </div>

                        {/* Items */}
                        <AnimatePresence initial={false}>
                          {group.items.map((n) => (
                            <NotificationItem
                              key={n.id}
                              notification={n}
                              onRead={() => handleClick(n)}
                              onDismiss={(e) => handleDismiss(e, n.id)}
                              onAcceptInvite={(e) => handleAcceptInvite(e, n)}
                              onDeclineInvite={(e) => handleDeclineInvite(e, n)}
                              inviteActionPending={
                                pendingInviteAction?.startsWith(n.id) ? pendingInviteAction : null
                              }
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ))}
                    <div className="h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
