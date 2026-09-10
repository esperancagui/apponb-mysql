"use client";

import { useState, useEffect } from "react";
import { Cookie, ShieldCheck, BarChart2, Settings2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const COOKIE_KEY = "onb_cookie_consent";

type Preferences = {
  analytics: boolean;
  preferences: boolean;
};

type ConsentValue = {
  decision: "accepted" | "declined" | "custom";
  preferences: Preferences;
};

const DEFAULT_PREFS: Preferences = { analytics: false, preferences: false };

// ---------------------------------------------------------------------------
// Helpers — call these after consent is saved to enforce the user's choice
// ---------------------------------------------------------------------------
export function getCookieConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? (JSON.parse(raw) as ConsentValue) : null;
  } catch {
    return null;
  }
}

export function hasConsented(category: keyof Preferences): boolean {
  const consent = getCookieConsent();
  if (!consent) return false;
  if (consent.decision === "accepted") return true;
  if (consent.decision === "declined") return false;
  return consent.preferences[category];
}

// ---------------------------------------------------------------------------
// Category card
// ---------------------------------------------------------------------------
type Category = {
  key: keyof Preferences | "essential";
  icon: React.ReactNode;
  label: string;
  description: string;
  locked?: boolean;
};

const CATEGORIES: Category[] = [
  {
    key: "essential",
    icon: <Lock className="h-4 w-4" />,
    label: "Essenciais",
    description:
      "Necessários para o funcionamento da plataforma — autenticação, sessão e segurança. Não podem ser desativados.",
    locked: true,
  },
  {
    key: "analytics",
    icon: <BarChart2 className="h-4 w-4" />,
    label: "Analíticos",
    description:
      "Nos ajudam a entender como você usa a plataforma para melhorar a experiência. Nenhum dado é vendido a terceiros.",
  },
  {
    key: "preferences",
    icon: <Settings2 className="h-4 w-4" />,
    label: "Preferências",
    description:
      "Lembram suas configurações como tema, idioma e layout para que você não precise redefinir a cada visita.",
  },
];

// ---------------------------------------------------------------------------
// Customize dialog
// ---------------------------------------------------------------------------
function CustomizeDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (prefs: Preferences) => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  function toggle(key: keyof Preferences) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] gap-0 p-0 overflow-hidden rounded-2xl border-border dark:border-white/[0.08]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-5 dark:border-white/[0.08]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold leading-none">
              Preferências de cookies
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-muted-foreground">
              Escolha quais categorias deseja permitir.
            </DialogDescription>
          </div>
        </div>

        {/* Categories */}
        <div className="divide-y divide-border dark:divide-white/[0.06]">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-start gap-4 px-6 py-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{cat.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
              <div className="mt-0.5 shrink-0">
                {cat.locked ? (
                  <Switch checked disabled aria-label="Sempre ativo" />
                ) : (
                  <Switch
                    checked={prefs[cat.key as keyof Preferences]}
                    onCheckedChange={() => toggle(cat.key as keyof Preferences)}
                    aria-label={`Ativar cookies de ${cat.label}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4 dark:border-white/[0.08]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onSave(prefs)}>
            Salvar preferências
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main banner
// ---------------------------------------------------------------------------
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function save(value: ConsentValue) {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(value));
    setLeaving(true);
    setTimeout(() => setVisible(false), 300);
  }

  function acceptAll() {
    save({ decision: "accepted", preferences: { analytics: true, preferences: true } });
  }

  function declineAll() {
    save({ decision: "declined", preferences: DEFAULT_PREFS });
  }

  function saveCustom(prefs: Preferences) {
    setCustomizeOpen(false);
    save({ decision: "custom", preferences: prefs });
  }

  if (!visible) return null;

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-4 transition-all duration-300 ease-out ${
          leaving ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{
          animation: leaving
            ? undefined
            : "cookieSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        <div className="w-full max-w-2xl rounded-xl border border-border bg-background/90 px-5 py-4 shadow-lg backdrop-blur-md dark:border-white/[0.08] dark:bg-[#141414]/90">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Icon + text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Cookie className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Utilizamos cookies
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  Cookies essenciais são sempre ativos. Os demais nos ajudam a
                  melhorar a plataforma — você escolhe quais aceitar.{" "}
                  <a
                    href="/privacy"
                    className="underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    Saiba mais
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2 sm:ml-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={declineAll}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Recusar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCustomizeOpen(true)}
                className="h-8 text-xs"
              >
                Personalizar
              </Button>
              <Button size="sm" onClick={acceptAll} className="h-8 text-xs">
                Aceitar todos
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CustomizeDialog
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onSave={saveCustom}
      />

      <style jsx global>{`
        @keyframes cookieSlideUp {
          from {
            opacity: 0;
            transform: translateY(1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
