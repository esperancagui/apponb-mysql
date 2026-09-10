"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, authClient, onAuthStateChanged, type AppUser, AuthClientError } from "@/app/lib/authClient";
import { getVisitorId } from "@/app/lib/services/fingerprintService";

// ─── Auth error code → Portuguese message ────────────────────────────────────
function translateAuthError(error: AuthClientError): string {
  if (process.env.NODE_ENV === "development") {
    console.error("[Auth error]", error.code, error.message);
  }
  const messages: Record<string, string> = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/user-disabled": "Usuário desativado.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/no-session": "Sessão expirada. Faça login novamente.",
  };
  return messages[error.code] ?? error.message ?? `Ocorreu um erro (${error.code}). Tente novamente.`;
}

// ─── Context types ────────────────────────────────────────────────────────────
interface AuthContextValue {
  currentUser: AppUser | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<"ok" | "account-disabled">;
  // Google login didn't survive the move off Firebase Auth — kept in the
  // interface so LoginForm/RegisterForm's "Continuar com Google" button can
  // stay in place and fail gracefully instead of being ripped out.
  signInWithGoogle: () => Promise<"ok" | "popup-closed" | ["account-disabled", string]>;
  signOut: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function getToken(): Promise<string | null> {
    return authClient.getAccessToken();
  }

  async function signIn(email: string, password: string): Promise<"ok" | "account-disabled"> {
    try {
      await authClient.login(email, password);
      return "ok";
    } catch (err) {
      if (err instanceof AuthClientError && err.code === "auth/user-disabled") {
        return "account-disabled";
      }
      throw new Error(err instanceof AuthClientError ? translateAuthError(err) : "Erro ao entrar.");
    }
  }

  async function signInWithGoogle(): Promise<"ok" | "popup-closed" | ["account-disabled", string]> {
    // Not available in this port — there's no OAuth provider behind the
    // local JWT auth. Surfaced as a translated error so the button's
    // catch handler shows a real message instead of failing silently.
    throw new Error("Login com Google não está disponível nesta versão.");
  }

  async function signOut(): Promise<void> {
    await authClient.logout();
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    try {
      const fingerprint = await getVisitorId();
      await authClient.register(email, password, name, fingerprint);
    } catch (err) {
      if (err instanceof AuthClientError) throw new Error(err.message || translateAuthError(err));
      throw err instanceof Error ? err : new Error("Erro ao registrar.");
    }
  }

  async function resetPassword(email: string): Promise<void> {
    await authClient.requestPasswordReset(email);
  }

  const value: AuthContextValue = {
    currentUser,
    loading,
    getToken,
    signIn,
    signInWithGoogle,
    signOut,
    register,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
