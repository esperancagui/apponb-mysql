"""
Module-level accessor for the ARQ Redis pool.
Set once at startup via set_pool(); retrieved anywhere via get_pool().
"""

from typing import Optional

try:
    from arq import ArqRedis
except ImportError:
    ArqRedis = None  # type: ignore

_pool: Optional[object] = None


def set_pool(pool) -> None:
    global _pool
    _pool = pool


def get_pool():
    if _pool is None:
        raise RuntimeError("ARQ pool not initialised — call set_pool() first")
    return _pool
