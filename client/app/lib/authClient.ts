/**
 * Local auth client — replaces the Firebase Auth SDK (`app/lib/firebase.ts`).
 * Talks to the FastAPI server's JWT endpoints (`/api/v1/auth/login|register|refresh`)
 * instead of Firebase, but keeps the same shape other files already depend on
 * (`auth.currentUser`, `auth.authStateReady()`, `onAuthStateChanged`) so
 * api.ts / socket.ts / useSocket.ts only need their import line changed.
 *
 * Tokens live in localStorage; the access token is short-lived (1h) and
 * refreshed transparently via the refresh token when it's close to expiring.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const ACCESS_KEY = "onb_access_token";
const REFRESH_KEY = "onb_refresh_token";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerData: { providerId: string }[];
  getIdToken(forceRefresh?: boolean): Promise<string>;
  reload(): Promise<void>;
  delete(): Promise<void>;
}

export class AuthClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

function isExpiringSoon(token: string): boolean {
  try {
    const { exp } = decodeJwtPayload(token) as { exp?: number };
    if (!exp) return true;
    return exp * 1000 - Date.now() < 60_000; // refresh with <60s left
  } catch {
    return true;
  }
}

function buildUser(accessToken: string): AppUser {
  const claims = decodeJwtPayload(accessToken) as {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  return {
    uid: claims.uid,
    email: claims.email ?? null,
    displayName: claims.name ?? null,
    photoURL: claims.picture ?? null,
    providerData: [{ providerId: "password" }],
    async getIdToken(forceRefresh = false) {
      return authClient.getAccessToken(forceRefresh) as Promise<string>;
    },
    async reload() {
      await authClient.refreshUserData();
    },
    async delete() {
      await api_delete(`${API_URL}/api/v1/auth/account`);
      authClient.clearTokens();
    },
  };
}

async function api_delete(url: string) {
  const token = await authClient.getAccessToken();
  await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

type Listener = (user: AppUser | null) => void;

class AuthClient {
  currentUser: AppUser | null = null;
  private listeners = new Set<Listener>();
  private readyPromise: Promise<void> | null = null;

  private setUser(user: AppUser | null) {
    this.currentUser = user;
    this.writeSessionCookie(user !== null);
    for (const l of this.listeners) l(user);
  }

  private writeSessionCookie(authenticated: boolean) {
    if (typeof document === "undefined") return;
    const isProd = process.env.NODE_ENV === "production";
    const secureFlag = isProd ? "; Secure" : "";
    if (authenticated) {
      document.cookie = `__session=1; path=/; SameSite=Lax${secureFlag}`;
    } else {
      document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
    }
  }

  onAuthStateChanged(cb: Listener): () => void {
    this.listeners.add(cb);
    this.authStateReady().then(() => cb(this.currentUser));
    return () => this.listeners.delete(cb);
  }

  /** Resolves once the initial token restore (and refresh, if needed) is done. */
  authStateReady(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.restore();
    return this.readyPromise;
  }

  private async restore(): Promise<void> {
    if (typeof window === "undefined") return;
    const access = localStorage.getItem(ACCESS_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!access || !refresh) return;
    if (isExpiringSoon(access)) {
      try {
        await this.refresh();
      } catch {
        this.clearTokens();
      }
      return;
    }
    this.currentUser = buildUser(access);
    this.writeSessionCookie(true);
  }

  private storeTokens(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    this.setUser(buildUser(access));
  }

  clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.setUser(null);
  }

  private async refresh(): Promise<string> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw new AuthClientError("auth/no-session");
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new AuthClientError("auth/invalid-credential", "Sessão expirada.");
    const data = await res.json();
    this.storeTokens(data.access_token, data.refresh_token);
    return data.access_token;
  }

  async getAccessToken(forceRefresh = false): Promise<string | null> {
    await this.authStateReady();
    const access = localStorage.getItem(ACCESS_KEY);
    if (!access) return null;
    if (forceRefresh || isExpiringSoon(access)) {
      try {
        return await this.refresh();
      } catch {
        return null;
      }
    }
    return access;
  }

  async refreshUserData(): Promise<void> {
    const token = await this.getAccessToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    // /me returns the server profile, not a new token — the display fields
    // in the JWT are refreshed on next login/refresh. Nothing to reconcile
    // here beyond letting callers re-fetch via userService, so this is a
    // deliberate no-op kept only so `currentUser.reload()` callers don't break.
    await res.json();
  }

  async login(email: string, password: string): Promise<AppUser> {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 403) throw new AuthClientError("auth/user-disabled");
    if (!res.ok) throw new AuthClientError("auth/invalid-credential", "E-mail ou senha inválidos.");
    const data = await res.json();
    this.storeTokens(data.access_token, data.refresh_token);
    return this.currentUser!;
  }

  async register(
    email: string,
    password: string,
    displayName?: string,
    fingerprint?: string,
  ): Promise<AppUser> {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName, fingerprint }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const error = new AuthClientError(res.status === 409 ? "auth/email-already-in-use" : "auth/register-failed", body.detail);
      (error as any).status = res.status;
      throw error;
    }
    const data = await res.json();
    this.storeTokens(data.access_token, data.refresh_token);
    return this.currentUser!;
  }

  async logout(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      if (token) {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      this.clearTokens();
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Link de redefinição inválido ou expirado.");
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch(`${API_URL}/api/v1/auth/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Erro ao alterar senha.");
    }
  }
}

export const authClient = new AuthClient();

// ── Firebase-shaped shim: same names/signatures the 5 call sites already use ──

export const auth = {
  get currentUser() {
    return authClient.currentUser;
  },
  authStateReady: () => authClient.authStateReady(),
};

export function onAuthStateChanged(_auth: typeof auth, cb: Listener): () => void {
  return authClient.onAuthStateChanged(cb);
}
