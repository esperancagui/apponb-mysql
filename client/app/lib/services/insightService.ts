import { api } from "../api";
import type { AIInsight } from "../types";

/** Busca o insight de IA de uma submissão */
export async function getInsight(submissionId: string): Promise<AIInsight | undefined> {
  const res = await api.get<AIInsight>(`/api/insights/${submissionId}`);
  return res.data || undefined;
}

/** Dispara análise de IA para uma submissão */
export async function analyzeSubmission(submissionId: string): Promise<AIInsight> {
  const res = await api.post<AIInsight>(`/api/submissions/${submissionId}/analyze`);
  if (res.error || !res.data) throw new Error(res.error || "Falha ao gerar análise");
  return res.data;
}

/** Retorna a URL para download do ZIP de arquivos de uma submissão */
export function getFilesZipUrl(submissionId: string): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  return `${API_URL}/api/submissions/${submissionId}/files/zip`;
}
