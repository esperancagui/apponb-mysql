"""
ARQ WorkerSettings — run with: uv run arq app.worker.settings.WorkerSettings
"""

import os
from urllib.parse import urlparse
from arq.connections import RedisSettings
from app.worker.tasks import run_analysis_job


def _clean_url(url: str) -> str:
    """Strip surrounding quotes and stray Railway template braces from env var values."""
    url = url.strip().strip("\"'")
    while url.endswith("}"):
        url = url[:-1]
    return url or "redis://localhost:6379"


def _build_redis_settings() -> RedisSettings:
    url = _clean_url(os.getenv("REDIS_URL") or "redis://localhost:6379")
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password or None,
        ssl=parsed.scheme == "rediss",
    )


class WorkerSettings:
    functions = [run_analysis_job]
    redis_settings = _build_redis_settings()
    max_jobs = 10
    job_timeout = 300   # 5 minutes
    max_tries = 3
    keep_result = 3600  # 1 hour
