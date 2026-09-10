"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Settings,
  FileText,
  FolderOpen,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  LogOut,
  Check,
  Plus,
  UserCircle,
  SlidersHorizontal,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Logo from "@/app/components/Logo";
import { useAuth, useWorkspace, useOnboarding } from "@/app/contexts";
import { userService } from "@/app/lib/services";
import { useRouter } from "next/navigation";
import { useAsyncAction } from "@/app/hooks/useAsyncAction";
import { OnboardingChecklist } from "@/app/components/onboarding/OnboardingChecklist";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/forms", label: "Formulários", icon: FileText },
  { href: "/dashboard/templates", label: "Templates", icon: FolderOpen },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { signOut, currentUser } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, openCreateDialog } = useWorkspace();
  const { steps, isOnboardingDismissed, dismissOnboarding, isOnboardingComplete } = useOnboarding();
  const router = useRouter();

  // Prevent hydration mismatch: activeWorkspace resolves client-side only
  const [mounted, setMounted] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
    userService.getUserProfile().then((p) => setUserPlan(p?.plan ?? null)).catch(() => {});
  }, []);
  const ws = mounted ? activeWorkspace : null;
  const wsUser = mounted ? currentUser : null;

  // Used for hex-based tint backgrounds (e.g. brandColor + "18")
  // Falls back to a neutral indigo that matches the default --primary
  const brandColor = ws?.brandColor || "#6366f1";

  const [handleSignOut, isSigningOut] = useAsyncAction(async () => {
    await signOut();
    router.push("/login");
  });

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out z-20",
        "bg-sidebar border-r border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {/* ─── Workspace Selector + Toggle ─── */}
      <div
        className={cn(
          "flex items-center h-14 shrink-0 border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-3 justify-between",
        )}
      >
        {collapsed ? (
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
            style={{ background: brandColor + "18", border: `1px solid ${brandColor}28` }}
            title={ws?.name || "Expandir"}
          >
            {ws?.logoUrl ? (
              <img src={ws.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[12px] font-bold" style={{ color: brandColor }}>
                {(ws?.name || "W")[0].toUpperCase()}
              </span>
            )}
          </button>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 h-9 px-2 rounded-lg hover:bg-sidebar-accent transition-colors text-[13.5px] font-semibold text-sidebar-foreground outline-none min-w-0">
                  {ws ? (
                    <>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: brandColor + "18", border: `1px solid ${brandColor}28` }}
                      >
                        {ws.logoUrl ? (
                          <img src={ws.logoUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[11px] font-bold" style={{ color: brandColor }}>
                            {ws.name[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="truncate">{ws.name}</span>
                    </>
                  ) : (
                    <div className="w-20 h-6 overflow-hidden shrink-0 flex items-center">
                      <Logo className="w-full h-full text-sidebar-foreground fill-current" />
                    </div>
                  )}
                  <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 rounded-xl shadow-lg border-sidebar-border bg-sidebar backdrop-blur-xl"
              >
                {workspaces.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    className="cursor-pointer text-[13px] rounded-lg gap-2.5"
                    onClick={() => { setActiveWorkspace(w); router.push("/dashboard"); }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: (w.brandColor || brandColor) + "18",
                        border: `1px solid ${w.brandColor || brandColor}28`,
                      }}
                    >
                      {w.logoUrl ? (
                        <img src={w.logoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[9px] font-bold" style={{ color: w.brandColor || brandColor }}>
                          {w.name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn("flex-1 truncate", w.id === ws?.id ? "font-semibold" : "font-medium")}
                    >
                      {w.name}
                    </span>
                    {w.id === ws?.id && <Check size={12} className="text-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer font-medium text-[13px] rounded-lg gap-2 text-sidebar-foreground/70"
                  onClick={() => router.push("/dashboard/settings")}
                >
                  <SlidersHorizontal size={13} />
                  Gerenciar workspace
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer font-medium text-[13px] rounded-lg gap-2 text-sidebar-foreground/60"
                  onClick={openCreateDialog}
                >
                  <Plus size={13} />
                  Criar workspace...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <PanelLeftClose size={16} strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {/* ─── Main Navigation ─── */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-[13.5px] font-medium transition-all duration-200 relative group",
                  collapsed ? "justify-center h-10 w-10 mx-auto" : "px-2.5 py-[7px]",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {/* Active indicator bar */}
                {isActive && !collapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full" />
                )}
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn("shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")}
                />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-[12px] font-semibold">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </nav>

      {/* ─── Onboarding Checklist ─── */}
      {!isOnboardingDismissed && !isOnboardingComplete && (
        <OnboardingChecklist
          steps={steps}
          onDismiss={dismissOnboarding}
          collapsed={collapsed}
        />
      )}

      {/* ─── Footer: User + Settings ─── */}
      <div className={cn("border-t border-sidebar-border shrink-0", collapsed ? "p-2" : "p-2.5")}>
        <TooltipProvider delayDuration={0}>
          {/* Settings */}
          {(() => {
            const isSettingsActive = pathname === "/dashboard/settings";
            const settingsLink = (
              <Link
                href="/dashboard/settings"
                className={cn(
                  "flex items-center gap-3 rounded-lg text-[13.5px] font-medium transition-all duration-200 mb-2",
                  collapsed ? "justify-center h-10 w-10 mx-auto" : "px-2.5 py-[7px]",
                  isSettingsActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Settings size={18} strokeWidth={1.8} className="shrink-0" />
                {!collapsed && "Ajustes"}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-[12px] font-semibold">
                    Ajustes
                  </TooltipContent>
                </Tooltip>
              );
            }
            return settingsLink;
          })()}

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2.5 rounded-lg transition-colors w-full outline-none",
                  collapsed ? "justify-center p-1.5" : "px-2.5 py-2 hover:bg-sidebar-accent",
                )}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-sidebar-border shrink-0 shadow-sm bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={
                      wsUser?.photoURL ||
                      `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(wsUser?.email ?? "user")}&backgroundColor=transparent`
                    }
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.style.display = "none";
                      const initial = (currentUser?.displayName ?? currentUser?.email ?? "U")[0].toUpperCase();
                      el.parentElement!.innerHTML = `<div class="w-full h-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-300">${initial}</div>`;
                    }}
                  />
                </div>
                {!collapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[12.5px] font-semibold text-sidebar-foreground truncate leading-tight flex items-center gap-1.5">
                      <span className="truncate">{wsUser?.displayName ?? wsUser?.email?.split("@")[0] ?? "Usuário"}</span>
                      {userPlan === "premium" && (
                        <Crown size={11} strokeWidth={2} className="shrink-0 text-amber-400" />
                      )}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/40 truncate leading-tight">
                      {wsUser?.email ?? ""}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={collapsed ? "center" : "start"}
              side={collapsed ? "right" : "top"}
              sideOffset={8}
              className="w-48 rounded-xl shadow-lg border-sidebar-border bg-sidebar backdrop-blur-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer font-medium text-[13px] rounded-lg gap-2"
                onClick={() => router.push("/dashboard/profile")}
              >
                <UserCircle size={14} className="opacity-60" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer font-medium text-[13px] rounded-lg gap-2 text-red-500 focus:text-red-600"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut
                  ? <span className="w-3.5 h-3.5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                  : <LogOut size={14} className="opacity-60" />}
                {isSigningOut ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </aside>
  );
}
