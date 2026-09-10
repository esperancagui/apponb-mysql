"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/app/lib/socket";
import { useAuth } from "@/app/contexts/AuthContext";
import { getPendingInvites } from "@/app/lib/services/inviteService";
import type { AppNotification } from "@/app/lib/types";

const STORAGE_KEY_PREFIX = "onb-notifications";
const MAX_NOTIFICATIONS = 50;

function storageKey(uid: string | undefined): string {
  return uid ? `${STORAGE_KEY_PREFIX}-${uid}` : STORAGE_KEY_PREFIX;
}

// ── Context type ──────────────────────────────────────────────────────────────

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadFromStorage(key: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();

  // ── Persistence ────────────────────────────────────────────────────────────

  const currentKey = storageKey(currentUser?.uid);

  // Load notifications scoped to the current user
  useEffect(() => {
    if (currentUser?.uid) {
      setNotifications(loadFromStorage(currentKey));
    } else {
      setNotifications([]);
    }
  }, [currentUser?.uid, currentKey]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      localStorage.setItem(currentKey, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {}
  }, [notifications, currentKey, currentUser?.uid]);

  // ── Core actions ───────────────────────────────────────────────────────────

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const notification: AppNotification = {
      ...n,
      id: makeId(),
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notification, ...prev.slice(0, MAX_NOTIFICATIONS - 1)]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // ── Fetch pending invites on login ─────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    getPendingInvites()
      .then((invites) => {
        // Read from storage once to avoid stale closure
        const stored = loadFromStorage(storageKey(currentUser.uid));
        invites.forEach((inv) => {
          const alreadyExists = stored.some((n) => n.type === "member_invited" && n.meta?.inviteCode === inv.code);
          if (!alreadyExists) {
            addNotification({
              type: "member_invited",
              title: "Convite para workspace",
              message: `${inv.inviterName ? inv.inviterName : "Alguém"} convidou você para entrar em "${inv.workspaceName}"`,
              meta: {
                inviteCode: inv.code,
                workspaceName: inv.workspaceName,
                role: inv.role,
                inviterName: inv.inviterName,
                inviterPhotoUrl: inv.inviterPhotoUrl || undefined,
              },
            });
          }
        });
      })
      .catch(() => {});
  }, [currentUser?.uid, addNotification]);

  // ── Plan limit check — disabled for now ───────────────────────────────────

  // ── Socket.IO event listeners ──────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    let activeSocket: import("socket.io-client").Socket | null = null;

    const onNewSubmission = (data: any) => {
      addNotification({
        type: "new_submission",
        title: "Nova resposta recebida",
        message: `${data.clientName || "Alguém"} respondeu ao formulário${data.formName ? ` "${data.formName}"` : ""}`,
        link: data.submissionId ? `/dashboard/responses/${data.submissionId}` : "/dashboard/",
        meta: data,
      });
    };

    const onInsightCompleted = (data: any) => {
      const link = data.submissionId ? `/dashboard/responses/${data.submissionId}` : "/dashboard/";

      addNotification({
        type: "insight_completed",
        title: "Análise IA concluída",
        message: `O relatório de ${data.clientName || "um cliente"} está pronto para visualização`,
        link,
        meta: data,
      });

      // Extra high-risk alert
      if (data.aiRisk === "high") {
        addNotification({
          type: "high_risk",
          title: "Alerta de risco crítico",
          message: `A análise de ${data.clientName || "um cliente"} identificou fatores de risco crítico`,
          link,
          meta: data,
        });
      }
    };

    const STATUS_LABELS: Record<string, string> = {
      new: "Nova",
      reviewing: "Em revisão",
      reviewed: "Revisada",
      archived: "Arquivada",
      pending: "Pendente",
    };

    const onStatusUpdated = (data: any) => {
      // Don't notify the user about their own actions
      if (data.actorUid && currentUser?.uid === data.actorUid) return;

      const statusLabel = STATUS_LABELS[data.newStatus] ?? data.newStatus ?? "atualizada";
      const client = data.clientName || "cliente";
      const actor = data.actorName || "";
      addNotification({
        type: "status_updated",
        title: "Status atualizado",
        message: actor
          ? `${actor} marcou a resposta de ${client} como "${statusLabel}"`
          : `Resposta de ${client} foi marcada como "${statusLabel}"`,
        link: data.submissionId ? `/dashboard/responses/${data.submissionId}` : "/dashboard/",
        meta: data,
      });
    };

    const onInviteReceived = (data: any) => {
      addNotification({
        type: "member_invited",
        title: "Convite para workspace",
        message: `${data.inviterName || "Alguém"} convidou você para entrar em "${data.workspaceName}"`,
        meta: {
          inviteCode: data.inviteCode,
          workspaceName: data.workspaceName,
          role: data.role,
          inviterName: data.inviterName,
          inviterPhotoUrl: data.inviterPhotoUrl || undefined,
        },
      });
    };

    const onMemberJoined = (data: any) => {
      addNotification({
        type: "member_invited",
        title: "Novo membro no workspace",
        message: `${data.memberName || "Alguém"} entrou em "${data.workspaceName}"`,
        link: "/dashboard/settings",
        meta: { ...data, joined: true, memberPhotoUrl: data.memberPhotoUrl || undefined },
      });
    };

    getSocket()
      .then((socket) => {
        if (cancelled) return;
        activeSocket = socket;
        socket.on("inbox:new_submission", onNewSubmission);
        socket.on("insight:completed", onInsightCompleted);
        socket.on("inbox:status_updated", onStatusUpdated);
        socket.on("workspace:invite_received", onInviteReceived);
        socket.on("workspace:member_joined", onMemberJoined);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (activeSocket) {
        activeSocket.off("inbox:new_submission", onNewSubmission);
        activeSocket.off("insight:completed", onInsightCompleted);
        activeSocket.off("inbox:status_updated", onStatusUpdated);
        activeSocket.off("workspace:invite_received", onInviteReceived);
        activeSocket.off("workspace:member_joined", onMemberJoined);
      }
    };
  }, [currentUser?.uid, addNotification]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
        markAsRead,
        markAllAsRead,
        dismiss,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
