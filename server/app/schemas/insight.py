from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel


class HeaderImpacto(BaseModel):
    headline: str
    status: str  # "Ready to Pitch" | "Needs Deep Dive" | "High Alert"


class DiagnosticoEstrategico(BaseModel):
    visaoGeral: str
    dorDoCliente: str
    potencialDeLucro: str


class ScoreONB(BaseModel):
    pontuacao: int
    classificacao: str  # "Crítico" | "Regular" | "Premium"
    analiseTecnica: str


class RedFlagEstrategica(BaseModel):
    alerta: str
    impactoNoNegocio: str
    severidade: str  # "Alta" | "Média" | "Baixa"
    recomendacao: str


class PerfilPsicografico(BaseModel):
    perfil: str
    estrategaDeVenda: str


class KickoffMasterlist(BaseModel):
    perguntasDeOuro: List[str]
    proximoPasso: str


# ── Agency-only sections ──────────────────────────────────────────────────────

class AuditVisual(BaseModel):
    """Visual audit of uploaded reference files. Only present for Agency accounts."""
    consistenciaComBriefing: str  # "Alta" | "Parcial" | "Inconsistente" + justification
    maturidadeDaMarca: str
    observacoes: List[str]
    oportunidades: List[str]
    scoreVisual: int  # 0-100


class EstrategiaDeProtecao(BaseModel):
    """Scope protection strategy. Always present for Agency accounts."""
    nivelDeRisco: str  # "Alto" | "Médio" | "Baixo"
    alertaDeEscopo: str
    clausulasRecomendadas: List[str]
    sinaisDeAlerta: List[str]


# ─────────────────────────────────────────────────────────────────────────────

class InsightOut(BaseModel):
    id: str
    submissionId: str
    formId: Optional[str] = None
    headerImpacto: HeaderImpacto
    diagnosticoEstrategico: DiagnosticoEstrategico
    scoreONB: ScoreONB
    redFlagsEstrategicas: List[RedFlagEstrategica]
    perfilPsicografico: PerfilPsicografico
    kickoffMasterlist: KickoffMasterlist
    auditVisual: Optional[AuditVisual] = None
    estrategiaDeProtecao: Optional[EstrategiaDeProtecao] = None
    modelUsed: Optional[str] = None
    generatedAt: Optional[Any] = None

    class Config:
        populate_by_name = True
