import { api } from "../api";
import type { Folder } from "../types";

/** Lista as pastas de um workspace */
export async function getFolders(workspaceId: string): Promise<Folder[]> {
  const res = await api.get<Folder[]>(`/api/workspaces/${workspaceId}/folders`);
  if (res.error) throw new Error(res.error);
  return res.data || [];
}

/** Cria uma pasta */
export async function createFolder(workspaceId: string, name: string): Promise<Folder> {
  const res = await api.post<Folder>(`/api/workspaces/${workspaceId}/folders`, { name });
  if (res.error || !res.data) throw new Error(res.error || "Falha ao criar pasta");
  return res.data;
}

/** Deleta uma pasta */
export async function deleteFolder(folderId: string): Promise<void> {
  await api.delete(`/api/folders/${folderId}`);
}

/** Atribui um formulário a uma pasta (null remove da pasta) */
export async function assignFormToFolder(formId: string, folderId: string | null): Promise<void> {
  await api.patch(`/api/forms/${formId}/folder`, { folderId });
}
