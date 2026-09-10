import { api } from "../api";
import type { FormTemplate, BrandingConfig, FieldGroup } from "../types";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

/** Lista todos os templates (sistema + do usuário) */
export async function getTemplates(category?: string, workspaceId?: string): Promise<FormTemplate[]> {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (workspaceId) params.append("workspace_id", workspaceId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await api.get<FormTemplate[]>(`/api/templates${qs}`);
  return res.data || [];
}

/** Busca um template por ID */
export async function getTemplate(id: string): Promise<FormTemplate | undefined> {
  const res = await api.get<FormTemplate>(`/api/templates/${id}`);
  return res.data || undefined;
}

/** Busca um template por ID aplicando overrides de branding do usuário */
export async function getTemplateEffective(id: string): Promise<FormTemplate | undefined> {
  const res = await api.get<FormTemplate>(`/api/templates/${id}`);
  return res.data || undefined;
}

/** Salva os campos/grupos de um template */
export async function updateTemplateGroups(id: string, groups: FormTemplate["defaultGroups"]): Promise<void> {
  const res = await api.patch(`/api/templates/${id}/groups`, { groups });
  if (res.error) throw new Error(res.error);
}

/** Salva customização de branding de um template */
export async function updateTemplateBranding(id: string, branding: BrandingConfig): Promise<void> {
  const res = await api.patch(`/api/templates/${id}/branding`, branding);
  if (res.error) throw new Error(res.error);
}

/** Atualiza campos gerais de um template (somente templates do usuário) */
export async function updateTemplate(
  id: string,
  data: Partial<Pick<FormTemplate, "name" | "description" | "icon" | "category" | "tags">>,
): Promise<FormTemplate | undefined> {
  const res = await api.patch<FormTemplate>(`/api/templates/${id}`, data);
  return res.data || undefined;
}

/** Cria um novo template personalizado */
export async function createTemplate(data: {
  name: string;
  description: string;
  icon: string;
  category: string;
  defaultBranding: BrandingConfig;
  defaultGroups?: FieldGroup[];
  tags?: string[];
}): Promise<FormTemplate> {
  const res = await api.post<FormTemplate>("/api/templates", data);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao criar template");
  return res.data;
}

/** Clona um template (sistema ou do usuário) criando uma cópia editável */
export async function cloneTemplate(source: FormTemplate): Promise<FormTemplate> {
  return createTemplate({
    name: `Cópia de ${source.name}`,
    description: source.description,
    icon: source.icon,
    category: source.category,
    defaultBranding: source.defaultBranding,
    defaultGroups: source.defaultGroups,
    tags: source.tags,
  });
}

/** Remove um template personalizado (não pode remover templates do sistema) */
export async function deleteTemplate(id: string): Promise<void> {
  const res = await api.delete(`/api/templates/${id}`);
  if (res.error) throw new Error(res.error);
}

/** Lista resumos de templates (para modal de criação) */
export async function getTemplateSummaries(): Promise<TemplateSummary[]> {
  const templates = await getTemplates();
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
  }));
}
