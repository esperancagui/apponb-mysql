"""
Gemini AI Service — Google Gemini integration for advanced briefing analysis.

Used for Agency-tier accounts. Supports multimodal inputs (images, PDFs)
via the OpenAI-compatible Gemini API endpoint (no extra dependencies required).

The same JSON output schema as ai_service.py (DeepSeek) is enforced so that
the insight rendering layer is model-agnostic.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import requests as _requests
from openai import OpenAI

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = """Você é o Motor de Inteligência Estratégica da ONB Agency Intelligence — o sistema de análise de briefings mais avançado disponível para agências criativas.

Você não é um assistente genérico. Você é o sócio sênior que leu 10.000 briefings, sobreviveu a 500 clientes problemáticos e sabe exatamente onde um projeto vai desandar antes de começar. Sua análise protege a margem da agência, prevê comportamento do cliente e entrega inteligência que nenhum briefing texto-puro conseguiria gerar sozinho.

O QUE SEPARA ELITE DE MEDÍOCRE:

PROIBIDO: "O cliente não informou o orçamento."
OBRIGATÓRIO: "Ausência de orçamento declarado combinada com escopo ambicioso e linguagem de urgência sugere cliente que testa a agência antes de revelar limitações financeiras reais — padrão clássico que gera 40-60% de retrabalho não remunerado."

PROIBIDO: "Os materiais enviados foram analisados."
OBRIGATÓRIO: "Os materiais revelam identidade visual fragmentada: logotipo vetorial com tipografia condensada contrastando com imagens de campanha em estilo orgânico/manuscrito — inconsistência de voz visual que exigirá fase de unificação estratégica não cotada no briefing."

PROIBIDO: "Recomendamos agendar uma reunião de kickoff."
OBRIGATÓRIO: "Kickoff em 48h com pauta bloqueada: (1) teto orçamentário não negociável, (2) decisor final com nome e cargo confirmados, (3) aprovação prévia de mood board — sem esses três pontos, não iniciar o projeto."

REGRAS ABSOLUTAS:
1. QUANTIFIQUE sempre que possível: riscos em %, retrabalho em horas, impacto financeiro estimado
2. NOMEIE o que viu nos arquivos: descreva cores, estilo tipográfico, acabamento, mood
3. PREVEJA comportamento: use padrões do briefing para antecipar como o cliente agirá nas revisões
4. PROTEJA a margem: cada red flag deve ter consequência financeira ou operacional concreta
5. SEJA CIRÚRGICO: 1 observação específica vale mais que 5 genéricas

QUANDO ARQUIVOS ESTIVEREM PRESENTES — OBRIGATÓRIO:
Os arquivos têm rótulos com o campo do formulário de origem. Trate-os como evidências primárias.
- visaoGeral: citar ao menos 2 observações específicas e nomeadas dos arquivos
- analiseTecnica: avaliar coerência entre arquivos e o que foi pedido. Inconsistência REDUZ pontuação em até 15pts
- redFlagsEstrategicas: mínimo 1 flag derivada diretamente dos arquivos
- perguntasDeOuro: mínimo 1 pergunta referenciando algo específico visto nos arquivos
- auditVisual: preencher obrigatoriamente quando houver arquivos

ESTRUTURA JSON OBRIGATÓRIA:

{
  "headerImpacto": {
    "headline": "Frase de alto impacto em até 12 palavras, específica ao projeto. Se houver arquivos, deve refletir o diagnóstico visual. Exemplos: 'Identidade Visual em Conflito com Posicionamento Premium Declarado' ou 'Briefing Maduro com Alto Potencial de Expansão de Escopo'",
    "status": "Ready to Pitch" | "Needs Deep Dive" | "High Alert"
  },
  "diagnosticoEstrategico": {
    "visaoGeral": "3-5 frases densas conectando: (a) o que o cliente quer vs o que realmente precisa, (b) contexto de mercado implícito, (c) se houver arquivos: observações diretas e nomeadas do material e o que revelam sobre a maturidade da marca. Seja o analista que o cliente não esperava.",
    "dorDoCliente": "A dor real por trás do pedido. Vá além do óbvio: medo de perder mercado, pressão de investidor, produto que não vende, liderança que precisa se reposicionar. Seja psicanalítico e específico.",
    "potencialDeLucro": "Alta | Média | Baixa — seguido de justificativa em 2-3 frases avaliando: clareza do escopo, maturidade do cliente, qualidade do briefing, e se houver arquivos: qualidade dos assets entregues."
  },
  "scoreONB": {
    "pontuacao": <inteiro 0-100. Critérios: clareza do objetivo (20pts), completude das informações (20pts), coerência escopo/orçamento (20pts), maturidade do cliente (20pts), qualidade dos assets quando houver (20pts)>,
    "classificacao": "Crítico" | "Regular" | "Premium",
    "analiseTecnica": "3-4 frases explicando a pontuação. Cite o que elevou e o que reduziu o score. Se houver arquivos: avalie coerência entre material enviado e o pedido."
  },
  "redFlagsEstrategicas": [
    {
      "alerta": "Título de 4-6 palavras, impactante e específico ao projeto",
      "impactoNoNegocio": "Consequência concreta com estimativas: 'risco de 2-3 rodadas extras de revisão', 'potencial de 30% de escopo não coberto', '+40% de tempo em alinhamento'. Nunca genérico.",
      "severidade": "Alta" | "Média" | "Baixa",
      "recomendacao": "Ação concreta que a agência deve tomar ANTES de assinar o contrato ou no kickoff. Específica, acionável, protetora."
    }
  ],
  "perfilPsicografico": {
    "perfil": "Arquétipo nomeado + traços específicos identificados no briefing. Ex: 'O Perfeccionista Ansioso — linguagem imperativa, múltiplos prazos citados, referências contraditórias sugerem cliente que aprova e reaprova'",
    "estrategaDeVenda": "Script tático de 3-4 frases para o comercial: O QUE dizer, COMO posicionar a proposta, QUAL gatilho emocional acionar para este perfil específico."
  },
  "kickoffMasterlist": {
    "perguntasDeOuro": ["Mínimo 5 perguntas. Cada uma deve demonstrar autoridade ou forçar o cliente a tomar decisão que protege a agência. Se houver arquivos: ao menos 1 pergunta deve referenciar algo específico visto neles."],
    "proximoPasso": "Ação imediata e específica com prazo implícito. Ex: 'Enviar proposta em 24h com cláusula de aprovação de conceito obrigatória antes da produção — não iniciar sem confirmação escrita do decisor final.'"
  },
  "auditVisual": {
    "consistenciaComBriefing": "Alta | Parcial | Inconsistente — seguido de justificativa em 1-2 frases",
    "maturidadeDaMarca": "Avaliação da profissionalidade dos assets. Cite elementos específicos: tipografia, paleta, acabamento, coerência de estilo.",
    "observacoes": ["Observação específica e nomeada do que foi visto — mínimo 3 itens quando houver arquivos"],
    "oportunidades": ["Oportunidade visual identificada nos arquivos"],
    "scoreVisual": <inteiro 0-100 avaliando qualidade profissional e consistência dos assets>
  },
  "estrategiaDeProtecao": {
    "nivelDeRisco": "Alto | Médio | Baixo",
    "alertaDeEscopo": "Análise específica do risco de escopo creep. Cite padrões do briefing que indicam expansão futura não prevista.",
    "clausulasRecomendadas": ["Cláusula concreta em linguagem simples — mínimo 3 itens. Ex: 'Limitar revisões a 2 rodadas por entrega, com tabela de custo adicional para rodadas extras'"],
    "sinaisDeAlerta": ["Sinal comportamental ou textual específico deste briefing que indica cliente potencialmente problemático — inclua apenas sinais genuinamente presentes"]
  }
}

INSTRUÇÕES FINAIS:
- Se NÃO houver arquivos: OMITA o campo auditVisual completamente
- estrategiaDeProtecao é SEMPRE obrigatório
- Mínimo 3 redFlagsEstrategicas
- Mínimo 5 perguntasDeOuro
- Use português brasileiro corporativo de alto nível
- SEM markdown, SEM texto fora do JSON. Apenas o objeto JSON puro."""


def _get_client() -> OpenAI:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY não está configurada no .env")
    return OpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )


def _build_text_prompt(
    submission_data: Dict[str, Any], form_fields: List[Dict[str, Any]]
) -> str:
    """Build the text portion of the user prompt."""
    lines = ["# Respostas do Briefing\n"]

    field_map: Dict[str, Dict[str, Any]] = {}
    for group in form_fields:
        group_name = group.get("name", "Seção")
        for field in group.get("fields", []):
            field_id = field.get("id", "")
            field_map[field_id] = {**field, "_groupName": group_name}

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


_MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf",
}


def _fetch_file_parts(
    files: Dict[str, Any],
    field_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Download submission file attachments and encode them as base64 content parts
    for the Gemini multimodal message.

    Each file is preceded by a text label identifying which form field it came from,
    so the model can reference it specifically in the analysis.

    `files` is a dict of field_id → url_or_list_of_urls.
    Silently skips files that fail to download or exceed 10 MB.
    """
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB per file
    parts: List[Dict[str, Any]] = []

    def _to_list(v: Any) -> List[str]:
        return [v] if isinstance(v, str) else list(v)

    file_index = 1
    for field_id, urls in files.items():
        field_label = (field_map or {}).get(field_id, {}).get("label", field_id)
        for url in _to_list(urls):
            try:
                resp = _requests.get(url, timeout=20)
                resp.raise_for_status()
                if len(resp.content) > MAX_BYTES:
                    logger.warning("Skipping large file (%d bytes): %s", len(resp.content), url)
                    continue

                ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
                mime = _MIME_TYPES.get(ext, "image/jpeg")

                b64 = base64.b64encode(resp.content).decode("utf-8")
                data_url = f"data:{mime};base64,{b64}"

                # Label before each file so the model knows its origin
                parts.append({
                    "type": "text",
                    "text": f"[Arquivo {file_index} — campo: \"{field_label}\"]",
                })
                parts.append({"type": "image_url", "image_url": {"url": data_url}})
                file_index += 1
            except Exception as exc:
                logger.warning("Failed to fetch file %s: %s", url, exc)

    return parts


async def generate_insight(
    submission_data: Dict[str, Any],
    form_fields: List[Dict[str, Any]],
    files: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], str, str]:
    """
    Generate an AI insight using Gemini (multimodal).

    Args:
        submission_data: Raw answers (field_id → value).
        form_fields: Form groups with field definitions.
        files: Optional dict of field_id → url(s) for uploaded attachments.

    Returns:
        Tuple of (parsed_insight_dict, raw_prompt, raw_response)
    """
    import asyncio

    client = _get_client()
    text_prompt = _build_text_prompt(submission_data, form_fields)

    # Build field_map once so _fetch_file_parts can label files by field name
    field_map: Dict[str, Dict[str, Any]] = {}
    for group in form_fields:
        for field in group.get("fields", []):
            fid = field.get("id", "")
            if fid:
                field_map[fid] = field

    def _sync_call() -> Tuple[Dict[str, Any], str, str]:
        content_parts: List[Dict[str, Any]] = []

        # Files come FIRST so the model sees them before reading the briefing text
        file_count = 0
        if files:
            file_parts = _fetch_file_parts(files, field_map=field_map)
            if file_parts:
                file_count = sum(1 for p in file_parts if p.get("type") == "image_url")
                content_parts.append({
                    "type": "text",
                    "text": (
                        f"# Arquivos de Referência do Cliente ({file_count} arquivo(s))\n"
                        "Analise cada arquivo com atenção antes de ler o briefing. "
                        "Você DEVE referenciar observações específicas deles na análise."
                    ),
                })
                content_parts.extend(file_parts)
                content_parts.append({"type": "text", "text": "---"})

        # Then the briefing text
        content_parts.append({"type": "text", "text": text_prompt})

        # Closing instruction when files are present — forces the model to commit
        if file_count > 0:
            content_parts.append({
                "type": "text",
                "text": (
                    "\n\n⚠️ INSTRUÇÃO FINAL: Você acabou de analisar os arquivos acima E o briefing. "
                    "Sua resposta JSON DEVE conter observações diretas e nomeadas do que você viu nos arquivos "
                    "(cores, estilo, qualidade, coerência visual, tipografia, etc.). "
                    "Respostas genéricas que ignorem os arquivos são inaceitáveis."
                ),
            })

        response = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content_parts},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=6000,
        )

        raw_response = response.choices[0].message.content or "{}"

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError:
            logger.error("Gemini returned invalid JSON: %s", raw_response[:500])
            parsed = _fallback_insight()

        parsed = _validate_insight(parsed)
        return parsed, text_prompt, raw_response

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

    hi = data.get("headerImpacto", {})
    if not isinstance(hi, dict):
        data["headerImpacto"] = defaults["headerImpacto"]
    else:
        hi.setdefault("headline", defaults["headerImpacto"]["headline"])
        hi.setdefault("status", defaults["headerImpacto"]["status"])

    de = data.get("diagnosticoEstrategico", {})
    if not isinstance(de, dict):
        data["diagnosticoEstrategico"] = defaults["diagnosticoEstrategico"]
    else:
        for k, v in defaults["diagnosticoEstrategico"].items():
            de.setdefault(k, v)

    s = data.get("scoreONB", {})
    if not isinstance(s, dict):
        data["scoreONB"] = defaults["scoreONB"]
    else:
        s.setdefault("pontuacao", 0)
        s.setdefault("classificacao", "Crítico")
        s.setdefault("analiseTecnica", "Sem análise.")

    if not isinstance(data.get("redFlagsEstrategicas"), list):
        data["redFlagsEstrategicas"] = []

    pp = data.get("perfilPsicografico", {})
    if not isinstance(pp, dict):
        data["perfilPsicografico"] = defaults["perfilPsicografico"]
    else:
        pp.setdefault("perfil", defaults["perfilPsicografico"]["perfil"])
        pp.setdefault("estrategaDeVenda", defaults["perfilPsicografico"]["estrategaDeVenda"])

    km = data.get("kickoffMasterlist", {})
    if not isinstance(km, dict):
        data["kickoffMasterlist"] = defaults["kickoffMasterlist"]
    else:
        if not isinstance(km.get("perguntasDeOuro"), list):
            km["perguntasDeOuro"] = ["Quais são suas expectativas principais?"]
        km.setdefault("proximoPasso", "Agendar reunião de alinhamento.")

    return data


def _fallback_insight() -> Dict[str, Any]:
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
