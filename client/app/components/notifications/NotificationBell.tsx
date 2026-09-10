"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/app/contexts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { AppNotification } from "@/app/lib/types";

// Deterministic avatar color (same palette as NotificationCenter)
const PALETTE = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#0f766e"];

function avatarColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function actorMeta(n: AppNotification): { name: string; photoUrl?: string } {
  const m = n.meta ?? {};
  // status_updated carries actorName/actorPhotoUrl (the workspace user who acted)
  if (m.actorName) return { name: m.actorName, photoUrl: m.actorPhotoUrl || undefined };
  // member_joined carries memberName/memberPhotoUrl
  if (m.joined) return { name: m.memberName || m.memberEmail || "Membro", photoUrl: m.memberPhotoUrl || undefined };
  // invites carry inviterName/inviterPhotoUrl
  if (m.inviterName) return { name: m.inviterName, photoUrl: m.inviterPhotoUrl || undefined };
  const name = m.clientName ?? m.workspaceName ?? "?";
  return { name };
}

function actorInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("") || "?";
}

// Stacked mini-avatars shown beside the bell when there are unread notifications
function UnreadAvatarStack({ notifications }: { notifications: AppNotification[] }) {
  const shown = notifications.filter((n) => !n.read).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 4 }}
      className="flex items-center"
    >
      {shown.map((n, i) => {
        const { name, photoUrl } = actorMeta(n);
        return (
          <motion.div
            key={n.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 500, damping: 30 }}
            className="w-4 h-4 rounded-full ring-[1.5px] ring-background flex items-center justify-center text-[7px] font-bold text-white shrink-0 overflow-hidden"
            style={{
              background: photoUrl ? "transparent" : avatarColor(name),
              marginLeft: i === 0 ? 0 : -5,
              zIndex: shown.length - i,
            }}
          >
            {photoUrl
              ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
              : actorInitials(name)
            }
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, toggle, isOpen } = useNotifications();
  const prevUnread = useRef(unreadCount);
  const [ring, setRing] = useState(false);

  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 650);
      return () => clearTimeout(t);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="flex items-center gap-1.5">
      {/* Stacked avatars — only when panel is closed */}
      <AnimatePresence>
        {!isOpen && unreadCount > 0 && (
          <UnreadAvatarStack notifications={notifications} />
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted relative transition-colors",
          isOpen && "bg-muted text-foreground",
        )}
        onClick={toggle}
        aria-label="Notificações"
      >
        <motion.div
          animate={ring
            ? { rotate: [0, -20, 20, -14, 14, -8, 8, 0], scale: [1, 1.1, 1] }
            : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.55, ease: "easeInOut" }}
        >
          <Bell size={17} strokeWidth={isOpen ? 2.2 : 1.9} />
        </motion.div>

        {/* Unread count badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8.5px] font-bold leading-none px-[3px] text-white"
              style={{ background: "var(--destructive)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </div>
  );
}
