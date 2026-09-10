from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import asyncio
import socketio
from dotenv import load_dotenv
from pathlib import Path

from app.routes.auth import router as auth_router
from app.routes import form as form_routes
from app.routes import submission as submission_routes
from app.routes import inbox as inbox_routes
from app.routes import workspace as workspace_routes
from app.routes import template as template_routes
from app.routes import insight as insight_routes
from app.routes import folder as folder_routes
from app.routes import invite as invite_routes
from app.routes import billing as billing_routes
from app.routes import upload as upload_routes
from app.routes import internal as internal_routes
from app.sockets import sio
from app.sockets.events import register_handlers
from app.db.pool import init_pool, close_pool
from app.services import db as firestore_db, auth_service, storage_service
from app.services import queue as queue_service

base_dir = Path(__file__).resolve().parent
dotenv_path = base_dir.parent / ".env"

load_dotenv(dotenv_path=dotenv_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from urllib.parse import urlparse
    from arq.connections import create_pool, RedisSettings

    def _clean_url(url: str) -> str:
        url = url.strip().strip("\"'")
        while url.endswith("}"):
            url = url[:-1]
        return url or "redis://localhost:6379"

    redis_url = _clean_url(os.getenv("REDIS_URL") or "redis://localhost:6379")
    parsed = urlparse(redis_url)
    redis_settings = RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password or None,
        ssl=parsed.scheme == "rediss",
    )
    arq_pool = await create_pool(redis_settings)
    queue_service.set_pool(arq_pool)
    await init_pool()
    await asyncio.to_thread(storage_service.ensure_bucket)
    task = asyncio.create_task(_draft_cleanup_loop())
    yield
    task.cancel()
    await arq_pool.aclose()
    await close_pool()


app = FastAPI(
    title="onb. API",
    description="Backend para a plataforma onb.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(form_routes.router, prefix="/api", tags=["forms"])
app.include_router(submission_routes.router, prefix="/api", tags=["submissions"])
app.include_router(inbox_routes.router, prefix="/api", tags=["inbox"])
app.include_router(workspace_routes.router, prefix="/api", tags=["workspaces"])
app.include_router(template_routes.router, prefix="/api", tags=["templates"])
app.include_router(insight_routes.router, prefix="/api", tags=["insights"])
app.include_router(folder_routes.router, prefix="/api", tags=["folders"])
app.include_router(invite_routes.router, prefix="/api", tags=["invites"])
app.include_router(billing_routes.router, prefix="/api/billing", tags=["billing"])
app.include_router(upload_routes.router, prefix="/api", tags=["uploads"])
app.include_router(internal_routes.router, prefix="/internal", include_in_schema=False)

register_handlers()
socket_app = socketio.ASGIApp(sio, app)

CLEANUP_INTERVAL_HOURS = 6


async def _draft_cleanup_loop():
    """Background task: delete stale draft forms and expired blocked tokens every CLEANUP_INTERVAL_HOURS."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)
        try:
            # 1. Clean up inactive drafts
            deleted_drafts = await firestore_db.cleanup_inactive_draft_forms()
            if deleted_drafts:
                print(f"[cleanup] Removed {deleted_drafts} inactive draft form(s)")

            # 2. Clean up expired tokens in blacklist
            deleted_tokens = await auth_service.cleanup_expired_tokens()
            if deleted_tokens:
                print(
                    f"[cleanup] Removed {deleted_tokens} expired token(s) from blacklist"
                )
        except Exception as e:
            print(f"[cleanup] Error: {e}")


@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do onb.!"}
