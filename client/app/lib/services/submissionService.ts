import { api } from "../api";
import type { Submission, InboxItem, InboxFilters, DashboardStats } from "../types";

/** Lista submissões filtradas por formId */
export async function getSubmissions(formId?: string): Promise<Submission[]> {
  if (formId) {
    const res = await api.get<Submission[]>(`/api/forms/${formId}/submissions`);
    return res.data || [];
  }
  return [];
}

/** Busca uma submissão por ID */
export async function getSubmission(id: string): Promise<Submission | undefined> {
  const res = await api.get<Submission>(`/api/submissions/${id}`);
  return res.data || undefined;
}

/** Cria uma nova submissão */
export async function createSubmission(data: Omit<Submission, "id" | "submittedAt">): Promise<Submission> {
  const res = await api.post<Submission>("/api/submissions", data);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao enviar formulário");
  return res.data;
}

/** Lista itens do inbox. O servidor só filtra por workspace_id; demais filtros são aplicados no cliente. */
export async function getInboxItems(filters?: InboxFilters, workspaceId?: string): Promise<InboxItem[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace_id", workspaceId);
  const query = params.toString();
  const res = await api.get<InboxItem[]>(`/api/inbox${query ? `?${query}` : ""}`);
  let items = res.data || [];

  if (filters?.status) items = items.filter((i) => i.status === filters.status);
  if (filters?.risk) items = items.filter((i) => i.aiRisk === filters.risk);
  if (filters?.vipOnly) items = items.filter((i) => i.vip);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.formName?.toLowerCase().includes(q) ||
        i.clientName?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q),
    );
  }

  return items;
}

/** Busca um item do inbox por ID */
export async function getInboxItem(id: string): Promise<InboxItem | undefined> {
  const res = await api.get<InboxItem>(`/api/inbox/${id}`);
  return res.data || undefined;
}

/** Atualiza o status de um item do inbox */
export async function updateInboxStatus(id: string, status: InboxItem["status"]): Promise<void> {
  const res = await api.patch(`/api/inbox/${id}/status`, { status });
  if (res.error) throw new Error(res.error);
}

/** Obtém estatísticas do dashboard */
export async function getDashboardStats(workspaceId?: string): Promise<DashboardStats> {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : "";
  const res = await api.get<DashboardStats>(`/api/dashboard/stats${params}`);
  return (
    res.data || {
      newCount: 0,
      reviewingCount: 0,
      riskCount: 0,
      avgResponseTimeHours: 0,
    }
  );
}
