"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

export type OnboardingStepId =
  | "workspace_created"
  | "form_created"
  | "form_customized"
  | "form_shared"
  | "first_response";

const STEPS_CONFIG: { id: OnboardingStepId; label: string; description: string; href?: string }[] = [
  {
    id: "workspace_created",
    label: "Criar seu workspace",
    description: "Configure seu espaço de trabalho.",
  },
  {
    id: "form_created",
    label: "Criar seu primeiro formulário",
    description: "Crie um briefing para um cliente.",
    href: "/dashboard?new=1",
  },
  {
    id: "form_customized",
    label: "Personalizar o formulário",
    description: "Adicione campos e ajuste o visual.",
  },
  {
    id: "form_shared",
    label: "Compartilhar o link com o cliente",
    description: "Copie e envie o link do formulário.",
  },
  {
    id: "first_response",
    label: "Receber a primeira resposta",
    description: "Aguarde seu cliente preencher o briefing.",
  },
];

const STORAGE_KEY_PREFIX = "onb_onboarding_";
const WELCOME_SEEN_KEY = "onb_welcome_seen_";

interface OnboardingContextValue {
  steps: { id: OnboardingStepId; label: string; description: string; completed: boolean; href?: string }[];
  isWelcomeOpen: boolean;
  closeWelcome: () => void;
  completeStep: (id: OnboardingStepId) => void;
  isOnboardingDismissed: boolean;
  dismissOnboarding: () => void;
  isOnboardingComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? null;

  const storageKey = uid ? STORAGE_KEY_PREFIX + uid : null;
  const welcomeKey = uid ? WELCOME_SEEN_KEY + uid : null;

  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepId>>(new Set());
  const [isDismissed, setIsDismissed] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

  // Load state from localStorage once we have a uid
  useEffect(() => {
    if (!storageKey || !welcomeKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: OnboardingStepId[] = JSON.parse(raw);
        setCompletedSteps(new Set(parsed));
      } else {
        // First time for this user — auto-complete workspace step
        setCompletedSteps(new Set(["workspace_created"]));
      }

      const dismissed = localStorage.getItem(storageKey + "_dismissed");
      if (dismissed === "1") setIsDismissed(true);

      const welcomeSeen = localStorage.getItem(welcomeKey);
      if (!welcomeSeen) setIsWelcomeOpen(true);
    } catch {}
  }, [storageKey, welcomeKey]);

  const persist = useCallback(
    (steps: Set<OnboardingStepId>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify([...steps]));
      } catch {}
    },
    [storageKey],
  );

  const completeStep = useCallback(
    (id: OnboardingStepId) => {
      setCompletedSteps((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const closeWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    if (welcomeKey) {
      try {
        localStorage.setItem(welcomeKey, "1");
      } catch {}
    }
  }, [welcomeKey]);

  const dismissOnboarding = useCallback(() => {
    setIsDismissed(true);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey + "_dismissed", "1");
      } catch {}
    }
  }, [storageKey]);

  const steps = STEPS_CONFIG.map((s) => ({
    ...s,
    completed: completedSteps.has(s.id),
  }));

  const isOnboardingComplete = steps.every((s) => s.completed);

  return (
    <OnboardingContext.Provider
      value={{
        steps,
        isWelcomeOpen,
        closeWelcome,
        completeStep,
        isOnboardingDismissed: isDismissed,
        dismissOnboarding,
        isOnboardingComplete,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
