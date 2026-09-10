import { api } from "../api";
import type { Workspace, User, WorkspaceMember, Pendency, BrandingConfig, InviteLink, InviteInfo } from "../types";

/** Lista workspaces do usuário */
export async function getWorkspaces(): Promise<Workspace[]> {
  const res = await api.get<Workspace[]>("/api/workspaces");
  if (res.error) throw new Error(res.error);
  return res.data || [];
}

/** Busca workspace por ID */
export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  const res = await api.get<Workspace>(`/api/workspaces/${id}`);
  return res.data || undefined;
}

/** Obtém o usuário logado */
export async function getCurrentUser(): Promise<User | null> {
  const res = await api.get<User>("/api/v1/auth/me");
  return res.data || null;
}

/** Cria um novo workspace */
export async function createWorkspace(name: string, slug: string, brandColor?: string): Promise<Workspace> {
  const res = await api.post<Workspace>("/api/workspaces", { name, slug, plan: "free", brandColor });
  if (res.error) throw new Error(res.error);
  if (!res.data) throw new Error("Falha ao criar workspace");
  return res.data;
}

/** Lista pendências do dashboard */
export async function getPendencies(workspaceId: string): Promise<Pendency[]> {
  const res = await api.get<Pendency[]>(`/api/workspaces/${workspaceId}/pendencies`);
  return res.data || [];
}

/** Obtém branding padrão do workspace (extraído do objeto Workspace) */
export async function getDefaultBranding(workspaceId: string): Promise<Partial<BrandingConfig> | null> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return null;
  return {
    logoUrl: ws.logoUrl,
    primaryColor: ws.brandColor,
    businessName: ws.name,
  };
}

/** Salva branding padrão do workspace */
export async function saveDefaultBranding(workspaceId: string, config: Partial<BrandingConfig>): Promise<void> {
  const res = await api.patch(`/api/workspaces/${workspaceId}`, {
    logoUrl: config.logoUrl,
    brandColor: config.primaryColor,
    name: config.businessName,
  });
  if (res.error) throw new Error(res.error);
}

/** Lista membros de um workspace */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const res = await api.get<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`);
  return res.data || [];
}

/** Convida um membro por email (usa o novo endpoint de convites) */
export async function inviteMember(workspaceId: string, email: string, role: string): Promise<void> {
  const res = await api.post(`/api/workspaces/${workspaceId}/invites`, { email, role });
  if (res.error) throw new Error(res.error || "Falha ao enviar convite");
}

/** Atualiza o papel de um membro */
export async function updateMemberRole(workspaceId: string, uid: string, role: string): Promise<void> {
  const res = await api.patch(`/api/workspaces/${workspaceId}/members/${uid}`, { role });
  if (res.error) throw new Error(res.error);
}

/** Atualiza nome, logo e cor da marca do workspace */
export async function updateWorkspace(
  id: string,
  updates: { name?: string; logoUrl?: string; brandColor?: string },
): Promise<Workspace> {
  const res = await api.patch<Workspace>(`/api/workspaces/${id}`, updates);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao atualizar workspace");
  return res.data;
}

/** Remove um membro do workspace */
export async function removeMember(workspaceId: string, uid: string): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/members/${uid}`);
}

/** Exclui um workspace e todos os seus dados (ação irreversível) */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const res = await api.delete(`/api/workspaces/${workspaceId}`);
  if (res.error) throw new Error(res.error);
}

// ── Invite Links ──────────────────────────────────────

/** Cria um link de convite (opcionalmente envia por email via Resend) */
export async function createInviteLink(
  workspaceId: string,
  role: string = "member",
  expiresIn: string = "7d",
  maxUses: number = 0,
  email: string = "",
): Promise<InviteLink> {
  const res = await api.post<InviteLink>(`/api/workspaces/${workspaceId}/invites`, {
    role,
    expiresIn,
    maxUses,
    email,
  });
  if (res.error || !res.data) throw new Error(res.error || "Falha ao criar convite");
  return res.data;
}

/** Lista convites ativos de um workspace */
export async function listInviteLinks(workspaceId: string): Promise<InviteLink[]> {
  const res = await api.get<InviteLink[]>(`/api/workspaces/${workspaceId}/invites`);
  return res.data || [];
}

/** Busca informações públicas de um convite (sem auth) */
export async function getInviteInfo(code: string): Promise<InviteInfo> {
  const res = await api.get<InviteInfo>(`/api/invites/${code}`);
  if (res.error || !res.data) throw new Error(res.error || "Convite não encontrado");
  return res.data;
}

/** Revoga um convite */
export async function revokeInviteLink(workspaceId: string, inviteId: string): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/invites/${inviteId}`);
}
