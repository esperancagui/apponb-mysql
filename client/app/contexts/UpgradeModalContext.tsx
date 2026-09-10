"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { UpgradeModal } from "@/app/components/ui/UpgradeBanner";

interface UpgradeModalContextValue {
  /** Show the upgrade modal with an optional message */
  showUpgradeModal: (message?: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const showUpgradeModal = useCallback((msg?: string) => {
    setMessage(msg);
    setOpen(true);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ showUpgradeModal }}>
      {children}
      <UpgradeModal open={open} onOpenChange={setOpen} message={message} />
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be used inside <UpgradeModalProvider>");
  return ctx;
}

/**
 * Helper: checks if an error message is plan-limit related and opens the upgrade modal.
 * Returns `true` if the modal was shown, `false` otherwise.
 */
export function handlePlanLimitError(
  error: string,
  showUpgradeModal: (msg?: string) => void,
): boolean {
  if (error.includes("Faça upgrade") || error.includes("Limite de") || error.includes("plano expirou")) {
    showUpgradeModal(error);
    return true;
  }
  return false;
}
