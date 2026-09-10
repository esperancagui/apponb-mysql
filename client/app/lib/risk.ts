/**
 * Risk levels and their associated UI properties (colors, labels, icons).
 */
export const RISK_MAP: Record<string, { label: string; color: string; icon: string }> = {
  high: {
    label: "Crítico",
    color: "text-red-600 bg-red-50 border-red-100",
    icon: "AlertTriangle",
  },
  medium: {
    label: "Médio",
    color: "text-amber-600 bg-amber-50 border-amber-100",
    icon: "AlertCircle",
  },
  low: {
    label: "Baixo",
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    icon: "CheckCircle2",
  },
};
