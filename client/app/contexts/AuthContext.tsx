"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  AuthError,
} from "firebase/auth";
import { auth, googleProvider } from "@/app/lib/firebase";
import { getVisitorId } from "@/app/lib/services/fingerprintService";

// ─── Firebase error → Portuguese message ─────────────────────────────────────
function translateAuthError(error: AuthError): string {
  const code = error.code;
  if (process.env.NODE_ENV === "development") {
    console.error("[Auth error]", code, error.message);
  }
  const messages: Record<string, string> = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Usuário desativado.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/network-request-failed": "Erro de rede. Verifique sua conexão.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/cancelled-popup-request": "Login com Google cancelado.",
    "auth/invalid-credential": "Credenciais inválidas. Verifique e-mail e senha.",
    "auth/operation-not-allowed": "Login com e-mail e senha não está habilitado. Contate o suporte.",
    "auth/configuration-not-found": "Configuração de autenticação não encontrada.",
  };
  return messages[code] ?? `Ocorreu um erro (${code ?? "desconhecido"}). Tente novamente.`;
}

// ─── Context types ────────────────────────────────────────────────────────────
interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<"ok" | "account-disabled">;
  signInWithGoogle: () => Promise<"ok" | "popup-closed" | ["account-disabled", string]>;
  signOut: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);

      // Sync a __session cookie so Next.js middleware can read auth state.
      const isProd = process.env.NODE_ENV === "production";
      const secureFlag = isProd ? "; Secure" : "";
      if (user) {
        try {
          const token = await user.getIdToken();
          document.cookie = `__session=${token}; path=/; SameSite=Lax${secureFlag}`;
        } catch {
          // Non-fatal
        }
      } else {
        // Clear the session cookie on sign-out
        document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
      }
    });
    return unsubscribe;
  }, []);

  // Returns the current Firebase ID token (auto-refreshed by Firebase)
  async function getToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }

  async function signIn(email: string, password: string): Promise<"ok" | "account-disabled"> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return "ok";
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code === "auth/user-disabled") {
        return "account-disabled";
      }
      throw new Error(translateAuthError(authErr));
    }
  }

  async function signInWithGoogle(): Promise<"ok" | "popup-closed" | ["account-disabled", string]> {
    try {
      await signInWithPopup(auth, googleProvider);
      const user = auth.currentUser;
      if (user) {
        const fingerprint = await getVisitorId();
        await ensureBackendUser(user, undefined, fingerprint);
      }
      return "ok";
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.code === "auth/popup-closed-by-user" || authErr.code === "auth/cancelled-popup-request") {
        return "popup-closed"; // Distinguish from success
      }
      if (authErr.code === "auth/user-disabled") {
        const email = (authErr as any).customData?.email ?? "";
        return ["account-disabled", email];
      }
      throw new Error(translateAuthError(authErr));
    }
  }

  async function signOut(): Promise<void> {
    try {
      // Blacklist the current token on the server before signing out
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (token && apiUrl) {
        await fetch(`${apiUrl}/api/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {}); // Best-effort
      }
    } finally {
      // Clear the session cookie synchronously so the middleware doesn't
      // see it as authenticated when the caller navigates right after signOut.
      const isProd = process.env.NODE_ENV === "production";
      const secureFlag = isProd ? "; Secure" : "";
      document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
      await firebaseSignOut(auth);
    }
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    try {
      const fingerprint = await getVisitorId();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await ensureBackendUser(credential.user, name, fingerprint);
    } catch (err: any) {
      // If the backend rejected registration (403), delete the Firebase user
      // that was just created so the email is not "taken" in Firebase Auth.
      if (err?.status === 403 || err?.message?.includes("403")) {
        try {
          await auth.currentUser?.delete();
        } catch {
          // Best-effort cleanup
        }
      }
      throw err instanceof Error ? err : new Error(translateAuthError(err as AuthError));
    }
  }

  async function resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(translateAuthError(err as AuthError));
    }
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

// ─── Internal helper ──────────────────────────────────────────────────────────
async function ensureBackendUser(user: User, displayName?: string, fingerprint?: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firebase_uid: user.uid,
        email: user.email,
        display_name: displayName ?? user.displayName ?? undefined,
        fingerprint: fingerprint || undefined,
      }),
    });

    // Propagate 403 errors (disposable email, fingerprint reuse)
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      const detail = data.detail || "Registro bloqueado.";
      const error = new Error(detail);
      (error as any).status = 403;
      throw error;
    }
  } catch (err) {
    // Re-throw 403 errors; silently ignore others (non-fatal)
    if ((err as any)?.status === 403) throw err;
  }
}
