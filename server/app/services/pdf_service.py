"""
PDF Service — generates styled PDF reports from AI insights.

Flow:
  1. Jinja2 renders the .md.j2 template with insight data
  2. Python-Markdown converts the rendered markdown to HTML
  3. WeasyPrint renders the HTML + CSS to PDF bytes
"""

import os
from datetime import datetime
from pathlib import Path

import markdown
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS

_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=False,
)

_css_path = _TEMPLATES_DIR / "report_styles.css"


def _score_level(score: int) -> str:
    if score >= 85:
        return "high"
    if score >= 65:
        return "medium"
    return "low"


def generate_report_pdf(
    insight: dict,
    client_name: str,
    form_name: str,
    submitted_at: str | None = None,
) -> bytes:
    """
    Render the markdown template with insight data, convert to HTML, then to PDF.

    Returns raw PDF bytes ready to stream as a response.
    """
    # ── 1. Prepare template context ──
    submitted_label = "—"
    if submitted_at:
        try:
            raw = submitted_at
            # Handle Firestore DatetimeWithNanoseconds or plain datetime objects
            if hasattr(raw, "strftime"):
                submitted_label = raw.strftime("%d/%m/%Y  %H:%M")
            else:
                # String: strip trailing Z, normalize offset
                raw_str = str(raw).replace("Z", "+00:00")
                dt = datetime.fromisoformat(raw_str)
                submitted_label = dt.strftime("%d/%m/%Y  %H:%M")
        except Exception:
            submitted_label = str(submitted_at)

    header = insight.get("headerImpacto", {})
    diagnostico = insight.get("diagnosticoEstrategico", {})
    score_onb = insight.get("scoreONB", {})
    perfil_psico = insight.get("perfilPsicografico", {})
    kickoff = insight.get("kickoffMasterlist", {})
    nota = score_onb.get("pontuacao", 0)

    context = {
        "client_name": client_name,
        "form_name": form_name,
        "submitted_at": submitted_label,
        "generated_at": datetime.now().strftime("%d/%m/%Y às %H:%M"),
        "headline": header.get("headline", ""),
        "header_status": header.get("status", ""),
        "visao_geral": diagnostico.get("visaoGeral", ""),
        "dor_do_cliente": diagnostico.get("dorDoCliente", ""),
        "potencial_de_lucro": diagnostico.get("potencialDeLucro", ""),
        "nota_clareza": nota,
        "score_level": _score_level(nota),
        "classificacao_onb": score_onb.get("classificacao", ""),
        "analise_tecnica": score_onb.get("analiseTecnica", ""),
        "red_flags": insight.get("redFlagsEstrategicas", []),
        "perfil_psicografico": perfil_psico.get("perfil", ""),
        "estratega_de_venda": perfil_psico.get("estrategaDeVenda", ""),
        "perguntas_kickoff": kickoff.get("perguntasDeOuro", []),
        "proximo_passo": kickoff.get("proximoPasso", ""),
    }

    # ── 2. Render Jinja2 → Markdown ──
    template = _jinja_env.get_template("report_template.md.j2")
    md_content = template.render(**context)

    # ── 3. Convert Markdown → HTML ──
    md_engine = markdown.Markdown(
        extensions=["tables", "fenced_code", "nl2br"],
        output_format="html",
    )
    body_html = md_engine.convert(md_content)

    full_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório — {client_name}</title>
</head>
<body>
{body_html}
</body>
</html>"""

    # ── 4. WeasyPrint HTML + CSS → PDF ──
    css = CSS(filename=str(_css_path))
    pdf_bytes = HTML(string=full_html, base_url=str(_TEMPLATES_DIR)).write_pdf(stylesheets=[css])

    return pdf_bytes
