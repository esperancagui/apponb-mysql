import { api } from "../api";
import type { UserProfile } from "../types";

export interface PreferencesPayload {
  email_notifications?: boolean;
  language?: string;
}

export interface PreferencesResponse {
  email_notifications: boolean;
  language: string;
}

/** GET /api/v1/auth/me — retorna o perfil do usuário atual */
export async function getUserProfile(): Promise<UserProfile | null> {
  const res = await api.get<UserProfile>("/api/v1/auth/me");
  return res.data || null;
}

/** PATCH /api/v1/auth/profile — atualiza display_name e/ou photo_url */
export async function updateProfile(data: { display_name?: string; photo_url?: string }): Promise<UserProfile> {
  const res = await api.patch<UserProfile>("/api/v1/auth/profile", data);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao atualizar perfil.");
  return res.data;
}

/** PATCH /api/v1/auth/preferences — atualiza notificações e idioma */
export async function updatePreferences(data: PreferencesPayload): Promise<PreferencesResponse> {
  const res = await api.patch<PreferencesResponse>("/api/v1/auth/preferences", data);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao atualizar preferências.");
  return res.data;
}

/** POST /api/v1/auth/pause — desabilita a conta no Firebase */
export async function pauseAccount(): Promise<void> {
  const res = await api.post("/api/v1/auth/pause");
  if (res.error) throw new Error(res.error);
}

/** POST /api/v1/auth/reactivate — reativa uma conta pausada (público, sem auth) */
export async function reactivateAccount(email: string): Promise<void> {
  const res = await api.post("/api/v1/auth/reactivate", { email });
  if (res.error) throw new Error(res.error);
}

/** DELETE /api/v1/auth/account — exclui permanentemente a conta */
export async function deleteAccount(): Promise<void> {
  const res = await api.delete("/api/v1/auth/account");
  if (res.error) throw new Error(res.error);
}

/**
 * POST /api/v1/auth/request-export — solicita exportação de dados (LGPD Art. 18, V).
 * O servidor gera JSON + CSV e envia por e-mail em background.
 */
export async function requestDataExport(): Promise<void> {
  const res = await api.post("/api/v1/auth/request-export");
  if (res.error) throw new Error(res.error);
}
