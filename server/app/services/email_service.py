"""
Email Service — Resend integration for sending invite emails.
Requires RESEND_API_KEY environment variable.
"""

import base64
import os
import resend


def _get_client() -> bool:
    """Initialize Resend with API key. Returns True if configured."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return False
    resend.api_key = api_key
    return True


SENDER = os.getenv("RESEND_FROM_EMAIL", "onb. <onboarding@resend.dev>")


def send_invite_email(
    to_email: str,
    workspace_name: str,
    invite_url: str,
    role: str,
    inviter_name: str = "",
    brand_color: str = "#6366f1",
) -> bool:
    """
    Send an invite email via Resend.
    Returns True if sent successfully, False otherwise.
    """
    if not _get_client():
        return False

    role_labels = {"admin": "Admin", "member": "Membro", "viewer": "Visualizador"}
    role_label = role_labels.get(role, role)

    if inviter_name:
        invite_line = f"{inviter_name} convidou você para o workspace <strong>{workspace_name}</strong> como <strong>{role_label}</strong>."
    else:
        invite_line = f"Você foi convidado para o workspace <strong>{workspace_name}</strong> como <strong>{role_label}</strong>."

    html = f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:20px;font-weight:800;color:#18181b;">onb.</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px 24px;text-align:center;">
    <h2 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 12px;">Você recebeu um convite!</h2>
    <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px;">{invite_line}</p>
    <a href="{invite_url}"
       style="display:inline-block;padding:12px 32px;background:{brand_color};color:#ffffff;
              border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
      Aceitar Convite
    </a>
    <p style="color:#a1a1aa;font-size:12px;margin-top:20px;">
      Se você não esperava este convite, pode ignorá-lo com segurança.
    </p>
  </div>
  <p style="text-align:center;color:#d4d4d8;font-size:10px;margin-top:20px;">
    Powered by onb.
  </p>
</div>
"""

    try:
        resend.Emails.send({
            "from": SENDER,
            "to": [to_email],
            "subject": f"Convite para {workspace_name} — onb.",
            "html": html,
        })
        return True
    except Exception:
        return False


def send_data_export_email(
    to_email: str,
    display_name: str,
    json_bytes: bytes,
    csv_bytes: bytes,
    date_str: str,
) -> bool:
    """
    Envia o arquivo de exportação de dados (LGPD) por e-mail com dois anexos:
    - dados-onb-{date}.json  — exportação completa
    - respostas-onb-{date}.csv — submissões em formato tabular
    """
    if not _get_client():
        return False

    greeting = f"Olá, {display_name}!" if display_name else "Olá!"

    html = f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:20px;font-weight:800;color:#18181b;">onb.</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px 24px;">
    <h2 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 12px;">Seus dados estão prontos</h2>
    <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">{greeting}</p>
    <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Conforme solicitado, seus dados pessoais e de uso da plataforma <strong>onb.</strong>
      estão nos anexos deste e-mail, em atendimento à <strong>LGPD (Art. 18, V)</strong>.
    </p>
    <div style="background:#f4f4f5;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 8px;">Arquivos anexados:</p>
      <p style="font-size:13px;color:#52525b;margin:0;">
        📄 <strong>dados-onb-{date_str}.json</strong> — exportação completa (perfil, workspaces, formulários, respostas, templates)<br>
        📊 <strong>respostas-onb-{date_str}.csv</strong> — respostas dos formulários em formato tabular
      </p>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin:16px 0 0;">
      Se você não solicitou esta exportação, entre em contato com o suporte imediatamente.
    </p>
  </div>
  <p style="text-align:center;color:#d4d4d8;font-size:10px;margin-top:20px;">
    Powered by onb.
  </p>
</div>
"""

    try:
        resend.Emails.send({
            "from": SENDER,
            "to": [to_email],
            "subject": "Seus dados — Exportação LGPD · onb.",
            "html": html,
            "attachments": [
                {
                    "filename": f"dados-onb-{date_str}.json",
                    "content": list(json_bytes),
                },
                {
                    "filename": f"respostas-onb-{date_str}.csv",
                    "content": list(csv_bytes),
                },
            ],
        })
        return True
    except Exception:
        return False
