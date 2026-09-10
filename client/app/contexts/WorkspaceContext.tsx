"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Workspace } from "@/app/lib/types";
import { getWorkspaces } from "@/app/lib/services/workspaceService";
import { useAuth } from "./AuthContext";
import CreateWorkspaceDialog from "@/app/components/workspace/CreateWorkspaceDialog";
import { WelcomeModal } from "@/app/components/onboarding/WelcomeModal";

const LAST_WORKSPACE_KEY = "revisy_last_workspace";

function getSavedWorkspace(): Workspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_WORKSPACE_KEY);
    if (raw) return JSON.parse(raw) as Workspace;
  } catch {}
  return null;
}

function saveWorkspace(ws: Workspace) {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify(ws));
  } catch {}
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  updateActiveWorkspace: (updates: Partial<Workspace>) => void;
  refreshWorkspaces: () => Promise<void>;
  openCreateDialog: () => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  // Track whether this is the first load after sign-in to auto-show dialog
  const didAutoPrompt = useRef(false);

  // Restore saved workspace from localStorage after hydration (client-only)
  useEffect(() => {
    const saved = getSavedWorkspace();
    if (saved) setActiveWorkspaceState(saved);
  }, []);

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws);
    saveWorkspace(ws);
  }, []);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getWorkspaces();
      setWorkspaces(list);
      if (list.length > 0) {
        setActiveWorkspaceState((prev) => {
          // If we already have an active workspace (from localStorage), update it
          // with fresh data from the API in case it changed
          if (prev) {
            const fresh = list.find((ws) => ws.id === prev.id);
            if (fresh) {
              saveWorkspace(fresh);
              return fresh;
            }
            // Workspace no longer exists or user lost access — fall through
          }
          const fallback = list[0];
          saveWorkspace(fallback);
          return fallback;
        });
      } else if (!didAutoPrompt.current) {
        // No workspaces on first load — prompt creation (first login scenario)
        didAutoPrompt.current = true;
        setShowCreateDialog(true);
      }
    } catch {
      // API error — don't open the create dialog; user may already have workspaces
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser) {
      loadWorkspaces();
    } else if (!authLoading && !currentUser) {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      didAutoPrompt.current = false;
      // Clear persisted workspace to prevent flash of previous user's data
      try {
        localStorage.removeItem(LAST_WORKSPACE_KEY);
      } catch {}
    }
  }, [authLoading, currentUser, loadWorkspaces]);

  const updateActiveWorkspace = useCallback((updates: Partial<Workspace>) => {
    setActiveWorkspaceState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveWorkspace(updated);

      // Atualiza a lista dependendo do ID confiável (prev.id) do próprio state
      setWorkspaces((prevList) => prevList.map((ws) => (ws.id === prev.id ? { ...ws, ...updates } : ws)));

      return updated;
    });
  }, []);

  const handleCreated = (workspace: Workspace) => {
    setWorkspaces((prev) => {
      const isFirst = prev.length === 0;
      if (isFirst) setShowWelcome(true);
      return [...prev, workspace];
    });
    setActiveWorkspace(workspace);
    setShowCreateDialog(false);
  };

  const openCreateDialog = () => setShowCreateDialog(true);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        updateActiveWorkspace,
        refreshWorkspaces: loadWorkspaces,
        openCreateDialog,
        loading,
      }}
    >
      {children}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
        required={workspaces.length === 0}
      />
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
