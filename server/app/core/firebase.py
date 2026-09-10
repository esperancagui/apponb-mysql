import base64
import json
import os
import tempfile
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, credentials, firestore

from app.core.config import settings

# Carrega o .env da mesma forma que no main.py
base_dir = Path(__file__).resolve().parent
dotenv_path = base_dir.parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)


def init_firebase():
    """
    Inicializa o Firebase Admin SDK.

    Prioridade:
      1. FIREBASE_CREDENTIALS_BASE64 — credenciais em base64 (Railway/produção)
      2. FIREBASE_CREDENTIALS_PATH   — caminho para o arquivo JSON (local/Docker)
    """
    if firebase_admin._apps:
        return

    b64 = os.environ.get("FIREBASE_CREDENTIALS_BASE64", "").strip()
    if b64:
        cred_dict = json.loads(base64.b64decode(b64).decode("utf-8"))
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        print("Firebase Admin SDK inicializado via FIREBASE_CREDENTIALS_BASE64")
        return

    cred_path = settings.FIREBASE_CREDENTIALS_PATH
    project_root = Path(__file__).resolve().parents[3]
    cred_full_path = project_root / cred_path
    if not cred_full_path.exists():
        raise FileNotFoundError(
            f"Credenciais do Firebase não encontradas em: {cred_full_path}\n"
            "Defina FIREBASE_CREDENTIALS_BASE64 ou FIREBASE_CREDENTIALS_PATH."
        )
    cred = credentials.Certificate(str(cred_full_path))
    firebase_admin.initialize_app(cred)
    print(f"Firebase Admin SDK inicializado via arquivo ({cred_full_path})")

# Inicializa ao importar este módulo
init_firebase()

# Exporta as instâncias para uso nos services
db = firestore.client()
firebase_auth = auth
