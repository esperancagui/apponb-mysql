"""
AI Service — DeepSeek integration for briefing analysis.

Uses the OpenAI-compatible API (DeepSeek) to analyze form submissions
and return structured insights in the AIInsight JSON format.

Raw prompts and responses are preserved for future model training.
"""

from __future__ import annotations

import json
import os
import logging
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI

logger = logging.getLogger(__name__)

DEEPSEEK_MODEL = "deepseek-chat"

SYSTEM_PROMPT = """Você é o Motor de Inteligência Estratégica da ONB, um sistema de elite especializado em diagnóstico de viabilidade e risco para projetos criativos.
Sua função não é apenas resumir dados, mas atuar como um Auditor de Briefing que protege a lucratividade da agência e garante o alinhamento estratégico.

### DIRETRIZES DE ANÁLISE (O 'DNA' ONB):
1. TOM DE VOZ: Profissional, direto, perspicaz e autoritário. Evite obviedades.
2. FOCO EM NEGÓCIO: Traduza falhas de informação em riscos reais (ex: 'Briefing vago' vira 'Risco crítico de retrabalho e desalinhamento de escopo').
3. HIERARQUIA DE IMPACTO: Priorize o que pode travar o projeto ou gerar prejuízo.
4. INTELIGÊNCIA PREDITIVA: Antecipe o comportamento do cliente com base no tom das respostas.

Você DEVE responder EXCLUSIVAMENTE em JSON válido, seguindo esta estrutura:

{
  "headerImpacto": {
    "headline": "Uma frase de alto impacto que define o estado do projeto (ex: 'Oportunidade de Ouro' ou 'Projeto de Alto Risco')",
    "status": "Ready to Pitch" | "Needs Deep Dive" | "High Alert"
  },
  "diagnosticoEstrategico": {
    "visaoGeral": "Análise profunda (3-4 frases) conectando os objetivos do cliente com a realidade de mercado.",
    "dorDoCliente": "O que realmente está tirando o sono do cliente, mesmo que ele não tenha dito explicitamente.",
    "potencialDeLucro": "Alta | Média | Baixa - Justifique com base na clareza e maturidade do pedido."
  },
  "scoreONB": {
    "pontuacao": <inteiro 0-100>,
    "classificacao": "Crítico" | "Regular" | "Premium",
    "analiseTecnica": "Por que esta nota? Foque em lacunas que geram retrabalho."
  },
  "redFlagsEstrategicas": [
    {
      "alerta": "Título curto e impactante",
      "impactoNoNegocio": "Consequência financeira ou operacional (ex: 'Aumento de 30% no tempo de criação')",
      "severidade": "Alta" | "Média" | "Baixa",
      "recomendacao": "Como a agência deve abordar isso no kickoff para se proteger."
    }
  ],
  "perfilPsicografico": {
    "perfil": "Ex: O Centralizador, O Visionário Vago, O Técnico Analítico",
    "estrategaDeVenda": "Como o comercial da agência deve 'vender' a ideia para este perfil específico."
  },
  "kickoffMasterlist": {
    "perguntasDeOuro": ["Perguntas que mostram autoridade e forçam o cliente a decidir pontos cegos"],
    "proximoPasso": "Ação imediata para converter ou qualificar este lead."
  }
}

### REGRAS CRÍTICAS:
- Não seja genérico. Se o cliente não informou o orçamento, a Red Flag não é 'falta orçamento', é 'Incerteza financeira: risco de investir horas de design em projeto fora da realidade do cliente'.
- Use português brasileiro corporativo de alto nível.
- SEM markdown ou texto extra. Apenas o JSON puro."""


def _get_client() -> OpenAI:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY não está configurada no .env")
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")


def _build_user_prompt(
    submission_data: Dict[str, Any], form_fields: List[Dict[str, Any]]
) -> str:
    """
    Build the user prompt from form field definitions and submission answers.
    Pairs each field label with its submitted answer for context.
    """
    lines = ["# Respostas do Briefing\n"]

    # Build a lookup: field_id → field metadata
    field_map: Dict[str, Dict[str, Any]] = {}
    for group in form_fields:
        group_name = group.get("name", "Seção")
        fields = group.get("fields", [])
        for field in fields:
            field_id = field.get("id", "")
            field_map[field_id] = {**field, "_groupName": group_name}

    # Pair answers with field labels
    current_group = ""
    for field_id, answer in submission_data.items():
        field_info = field_map.get(field_id, {})
        group_name = field_info.get("_groupName", "Outros")
        label = field_info.get("label", field_id)
        field_type = field_info.get("type", "text")

        if group_name != current_group:
            lines.append(f"\n## {group_name}\n")
            current_group = group_name

        answer_str = str(answer) if answer is not None else "(não respondido)"
        lines.append(f"**{label}** ({field_type}): {answer_str}")

    return "\n".join(lines)


async def generate_insight(
    submission_data: Dict[str, Any],
    form_fields: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], str, str]:
    """
    Generate an AI insight from submission data.

    Args:
        submission_data: The raw answers (field_id → value).
        form_fields: The form groups with field definitions.

    Returns:
        Tuple of (parsed_insight_dict, raw_prompt, raw_response)
    """
    import asyncio

    client = _get_client()
    user_prompt = _build_user_prompt(submission_data, form_fields)

    def _sync_call() -> Tuple[Dict[str, Any], str, str]:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=3000,
        )

        raw_response = response.choices[0].message.content or "{}"

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError:
            logger.error("DeepSeek returned invalid JSON: %s", raw_response[:500])
            parsed = _fallback_insight()

        # Validate required fields
        parsed = _validate_insight(parsed)

        return parsed, user_prompt, raw_response

    return await asyncio.to_thread(_sync_call)


def _validate_insight(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all required fields exist with sensible defaults."""
    defaults: Dict[str, Any] = {
        "headerImpacto": {
            "headline": "Diagnóstico não disponível.",
            "status": "Needs Deep Dive",
        },
        "diagnosticoEstrategico": {
            "visaoGeral": "Não foi possível avaliar.",
            "dorDoCliente": "Não identificado.",
            "potencialDeLucro": "Baixa — dados insuficientes para avaliação.",
        },
        "scoreONB": {
            "pontuacao": 0,
            "classificacao": "Crítico",
            "analiseTecnica": "Não foi possível avaliar.",
        },
        "redFlagsEstrategicas": [],
        "perfilPsicografico": {
            "perfil": "Não identificado.",
            "estrategaDeVenda": "Alinhar expectativas no kickoff.",
        },
        "kickoffMasterlist": {
            "perguntasDeOuro": ["Quais são suas expectativas principais?"],
            "proximoPasso": "Agendar reunião de alinhamento.",
        },
    }

    for key, default in defaults.items():
        if key not in data or data[key] is None:
            data[key] = default

    # Validate headerImpacto sub-fields
    hi = data.get("headerImpacto", {})
    if not isinstance(hi, dict):
        data["headerImpacto"] = defaults["headerImpacto"]
    else:
        if "headline" not in hi:
            hi["headline"] = defaults["headerImpacto"]["headline"]
        if "status" not in hi:
            hi["status"] = defaults["headerImpacto"]["status"]
        data["headerImpacto"] = hi

    # Validate diagnosticoEstrategico sub-fields
    de = data.get("diagnosticoEstrategico", {})
    if not isinstance(de, dict):
        data["diagnosticoEstrategico"] = defaults["diagnosticoEstrategico"]
    else:
        for k, v in defaults["diagnosticoEstrategico"].items():
            if k not in de:
                de[k] = v
        data["diagnosticoEstrategico"] = de

    # Validate scoreONB sub-fields
    s = data.get("scoreONB", {})
    if not isinstance(s, dict):
        data["scoreONB"] = defaults["scoreONB"]
    else:
        if "pontuacao" not in s:
            s["pontuacao"] = 0
        if "classificacao" not in s:
            s["classificacao"] = "Crítico"
        if "analiseTecnica" not in s:
            s["analiseTecnica"] = "Sem análise."
        data["scoreONB"] = s

    # Ensure redFlagsEstrategicas is a list
    if not isinstance(data.get("redFlagsEstrategicas"), list):
        data["redFlagsEstrategicas"] = []

    # Validate perfilPsicografico sub-fields
    pp = data.get("perfilPsicografico", {})
    if not isinstance(pp, dict):
        data["perfilPsicografico"] = defaults["perfilPsicografico"]
    else:
        if "perfil" not in pp:
            pp["perfil"] = defaults["perfilPsicografico"]["perfil"]
        if "estrategaDeVenda" not in pp:
            pp["estrategaDeVenda"] = defaults["perfilPsicografico"]["estrategaDeVenda"]
        data["perfilPsicografico"] = pp

    # Validate kickoffMasterlist sub-fields
    km = data.get("kickoffMasterlist", {})
    if not isinstance(km, dict):
        data["kickoffMasterlist"] = defaults["kickoffMasterlist"]
    else:
        if "perguntasDeOuro" not in km or not isinstance(km.get("perguntasDeOuro"), list):
            km["perguntasDeOuro"] = ["Quais são suas expectativas principais?"]
        if "proximoPasso" not in km:
            km["proximoPasso"] = "Agendar reunião de alinhamento."
        data["kickoffMasterlist"] = km

    return data


def _fallback_insight() -> Dict[str, Any]:
    """Return a safe fallback when AI parsing fails."""
    return {
        "headerImpacto": {
            "headline": "Não foi possível gerar o diagnóstico automaticamente.",
            "status": "Needs Deep Dive",
        },
        "diagnosticoEstrategico": {
            "visaoGeral": "Erro na geração da análise.",
            "dorDoCliente": "Não identificado.",
            "potencialDeLucro": "Baixa — dados insuficientes.",
        },
        "scoreONB": {
            "pontuacao": 0,
            "classificacao": "Crítico",
            "analiseTecnica": "Erro na análise.",
        },
        "redFlagsEstrategicas": [],
        "perfilPsicografico": {
            "perfil": "Não identificado.",
            "estrategaDeVenda": "Revisar o briefing manualmente.",
        },
        "kickoffMasterlist": {
            "perguntasDeOuro": ["Quais são suas expectativas para este projeto?"],
            "proximoPasso": "Revisar o briefing manualmente.",
        },
    }
