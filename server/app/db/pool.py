"""
aiomysql connection pool — one per process (API, worker, tests).

Opened explicitly in `main.py`'s lifespan and in the worker's `on_startup` hook
(there's no import-time side effect like the old `app.core.firebase` had, since
the pool needs an event loop to connect).
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Any, Optional
from urllib.parse import urlparse

import aiomysql

_pool: Optional[aiomysql.Pool] = None


def _parse_database_url(url: str) -> dict:
    """DATABASE_URL=mysql://user:pass@host:port/dbname → aiomysql kwargs."""
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 3306,
        "user": parsed.username or "root",
        "password": parsed.password or "",
        "db": (parsed.path or "/onb").lstrip("/"),
    }


async def init_pool() -> aiomysql.Pool:
    global _pool
    if _pool is not None:
        return _pool
    kwargs = _parse_database_url(os.getenv("DATABASE_URL", "mysql://root:root@localhost:3306/onb"))
    _pool = await aiomysql.create_pool(
        autocommit=True,
        cursorclass=aiomysql.cursors.DictCursor,
        minsize=1,
        maxsize=10,
        **kwargs,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


def get_pool() -> aiomysql.Pool:
    if _pool is None:
        raise RuntimeError("MySQL pool not initialised — call init_pool() first")
    return _pool


async def fetch_one(sql: str, args: tuple = ()) -> Optional[dict]:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, args)
            return await cur.fetchone()


async def fetch_all(sql: str, args: tuple = ()) -> list[dict]:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, args)
            return list(await cur.fetchall())


async def execute(sql: str, args: tuple = ()) -> int:
    """Run an INSERT/UPDATE/DELETE. Returns the cursor's rowcount."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, args)
            return cur.rowcount


@asynccontextmanager
async def transaction():
    """Async context manager yielding a cursor inside a single transaction.

    Used only by the handful of multi-statement writes (cascading deletes,
    the workspace-create + owner-membership pair). Everything else is a
    single autocommit statement.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.begin()
        try:
            async with conn.cursor() as cur:
                yield cur
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise


def dumps(value: Any) -> Optional[str]:
    """JSON-encode a value for a JSON column, passing None through."""
    if value is None:
        return None
    return json.dumps(value)


def loads(value: Any) -> Any:
    """Decode a JSON column value. aiomysql/PyMySQL already returns dict/list
    for JSON columns in recent versions, so this only handles the str case."""
    if isinstance(value, (str, bytes)):
        return json.loads(value)
    return value
