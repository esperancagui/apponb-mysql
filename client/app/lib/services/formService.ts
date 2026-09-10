import { api } from "../api";
import type { Form } from "../types";

/** Lista todos os formulários */
export async function getForms(workspaceId?: string): Promise<Form[]> {
  const path = workspaceId ? `/api/forms?workspace_id=${workspaceId}` : "/api/forms";
  const res = await api.get<Form[]>(path);
  return res.data || [];
}

/** Busca um formulário por ID ou slug */
export async function getForm(idOrSlug: string): Promise<Form | undefined> {
  const res = await api.get<Form>(`/api/forms/${idOrSlug}`);
  return res.data || undefined;
}

/** Busca um formulário público por slug */
export async function getFormBySlug(slug: string): Promise<Form | undefined> {
  const res = await api.get<Form>(`/api/forms/public/${slug}`);
  return res.data || undefined;
}

/** Cria um formulário */
export async function createForm(data: Omit<Form, "id" | "slug" | "createdAt" | "updatedAt">): Promise<Form> {
  const res = await api.post<Form>("/api/forms", data);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao criar formulário");
  return res.data;
}

/** Atualiza um formulário */
export async function updateForm(id: string, updates: Partial<Form>): Promise<Form> {
  const res = await api.put<Form>(`/api/forms/${id}`, updates);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao atualizar formulário.");
  return res.data;
}

/** Salva (cria ou atualiza) um formulário — atalho retrocompatível */
export async function saveForm(form: Form): Promise<void> {
  const res = await api.put<Form>(`/api/forms/${form.id}`, form);
  if (res.error) throw new Error(res.error);
}

/** Deleta um formulário */
export async function deleteForm(id: string): Promise<void> {
  await api.delete(`/api/forms/${id}`);
}

/** Duplica um formulário */
export async function duplicateForm(id: string): Promise<Form> {
  const original = await getForm(id);
  if (!original) throw new Error(`Form ${id} not found`);

  return createForm({
    ...original,
    name: `${original.name} (cópia)`,
    status: "draft",
  });
}
