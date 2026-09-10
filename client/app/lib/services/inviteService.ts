/**
 * Invite Service — Convites para workspaces.
 */

import { api } from "../api";

export interface PendingInvite {
  id: string;
  code: string;
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string;
  brandColor?: string;
  role: string;
  inviterName?: string;
  inviterPhotoUrl?: string;
  expiresAt?: string;
}

/** Lista convites pendentes direcionados ao usuário atual */
export async function getPendingInvites(): Promise<PendingInvite[]> {
  const res = await api.get<PendingInvite[]>("/api/invites/pending");
  if (res.error) throw new Error(res.error);
  return res.data || [];
}

/** Aceita um convite pelo código */
export async function acceptInvite(code: string): Promise<{ workspaceId: string; role: string }> {
  const res = await api.post<{ workspaceId: string; role: string }>(`/api/invites/${code}/accept`);
  if (res.error) throw new Error(res.error);
  return res.data!;
}

/** Recusa um convite pelo código */
export async function declineInvite(code: string): Promise<void> {
  await api.post(`/api/invites/${code}/decline`);
}
