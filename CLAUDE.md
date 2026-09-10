# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**onb.** is a briefing platform for creative professionals. This is the **MySQL test port** of the
main `apponb` project — same product, same UI, same API contracts, but Firebase (Auth, Firestore,
Cloud Storage) is fully replaced so the whole stack runs offline in Docker with no external
project to configure. It has two components:
- `client/` — Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- `server/` — FastAPI (Python 3.13) + Pydantic v2 + MySQL (aiomysql) + MinIO (S3-compatible storage)

## Development Commands

### Client (Next.js)
```bash
cd client
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

### Server (FastAPI)
```bash
cd server
uv sync              # install dependencies (uses uv, not pip)
uv run uvicorn main:socket_app --reload --port 8000   # dev server at http://localhost:8000
```

> The server entry point is `main:socket_app` (not `main:app`) because Socket.IO wraps the FastAPI app.
> The MySQL pool and Redis/arq pool are opened in `main.py`'s lifespan, not at import time — running
> the server outside Docker needs a real `DATABASE_URL` and `REDIS_URL` pointing at reachable instances.

### Running everything with Docker (recommended)
```bash
# Requires a .env file at repo root (see Environment Variables below) — .env.example has the shape.
docker compose -f docker-compose.dev.yml up
```
This brings up `client`, `server`, `worker` (ARQ), `mysql`, `redis`, and `minio`. MySQL's schema is
loaded once from `server/schema.sql` on first boot (mounted into
`/docker-entrypoint-initdb.d/`) — it is the single source of truth for the DB shape, not a migration
chain. MinIO's console is at `http://localhost:9001` (default creds `minioadmin`/`minioadmin`).

### Tests (server only)
```bash
cd server
uv run pytest                           # all tests, fully mocked — no MySQL needed
uv run pytest tests/routes/test_form.py # single file
uv run pytest -k "test_name"            # single test by name
```

## Environment Variables

Required in a `.env` file at the repo root (also used by Docker Compose) — see `.env.example` for
the full annotated list. The essentials:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
MYSQL_PASSWORD=          # shared by the mysql container and the server's DATABASE_URL
JWT_SECRET=              # signs access/refresh tokens issued by /api/v1/auth/login|register
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_PUBLIC_URL=http://localhost:9000   # browser-facing URL for uploaded files
CORS_ORIGINS=http://localhost:3000
INTERNAL_SECRET=         # worker -> API Socket.IO bridge
```

The client services fall back to mock data (from `client/app/lib/mocks/`) when `NEXT_PUBLIC_API_URL` is not set.

## Architecture

### Server

```
server/
  schema.sql                     # single-file MySQL schema, loaded once by the mysql container
  main.py                        # FastAPI app, Socket.IO wrapper, lifespan (opens MySQL/Redis/MinIO)
  app/
    core/
      auth.py                    # get_current_user dependency (verifies the local JWT)
      permissions.py             # require_form_owner, require_workspace_owner, etc.
      security.py                # JWT issuing/decoding + scrypt password hashing
    routes/                      # one file per domain (form, submission, inbox, workspace, upload, ...)
    schemas/                     # Pydantic v2 models (In/Out pairs per domain)
    services/
      db.py                      # all MySQL operations (async, aiomysql) — same function names/
                                  # signatures as the original firestore_db.py, so routes and
                                  # permission checks import it unchanged (aliased `as firestore_db`)
      auth_service.py            # user CRUD, password reset, token blacklist (async, MySQL)
      storage_service.py         # MinIO (boto3) upload/delete helpers
      ai_service.py               # DeepSeek AI analysis via OpenAI-compatible API
      pdf_service.py             # WeasyPrint PDF generation
      email_service.py           # Resend email service (invites, password reset, LGPD export)
    sockets/
      events.py                  # Socket.IO connect/disconnect handlers (local JWT auth)
      broadcaster.py             # helpers to emit events to workspace/user rooms
    db/
      pool.py                    # aiomysql connection pool + fetch/execute/transaction helpers
```

**Key server patterns:**
- All protected routes use `Depends(get_current_user)` which returns a user dict with `id` (UUID) and `firebase_uid` (kept as a field name from the Firebase days — it's now just a locally-generated opaque id, the join key across every other table).
- Ownership checks are centralized in `app/core/permissions.py` — always use these helpers rather than ad-hoc checks.
- `app/services/db.py` is async; every write builds and returns the row dict directly rather than reading it back, so there is no post-write SELECT round trip.
- Cascading deletes (deleting a workspace removes its forms/submissions/folders/invites/members) are handled by `ON DELETE CASCADE`/`SET NULL` foreign keys in `schema.sql`, not hand-rolled fan-out code.
- Billing is a local stub (`app/routes/billing.py`) — no Stripe. `POST /checkout` just sets the plan column directly.
- Background task in `main.py` cleans up stale draft forms and expired blacklisted tokens every 6 hours.

### Client

```
client/
  app/
    lib/
      authClient.ts              # local JWT auth client — replaces the Firebase Auth SDK, exposes
                                  # the same `auth.currentUser` / `auth.authStateReady()` /
                                  # `onAuthStateChanged` shape so most call sites only change an import
      api.ts                     # fetch-based HTTP client (attaches the access token, retries once on 401)
      types.ts                   # shared TypeScript domain types
      services/                  # service layer: formService, submissionService, workspaceService,
                                  # folderService, insightService, storageService (MinIO uploads via API)
      mocks/                     # mock data used when API_URL is unset
    dashboard/
      layout.tsx                 # sidebar + topbar + command palette (Ctrl+K)
      page.tsx                   # inbox (responses + forms tabs)
      forms/[id]/page.tsx        # form editor (fields + branding tabs)
      responses/[id]/page.tsx    # submission detail + AI insights
      templates/                 # template gallery and editor
    reset-password/              # password reset confirmation page (Firebase used to host this)
    f/[slug]/page.tsx            # public form renderer (no auth required)
  components/ui/                 # shadcn/ui primitives
```

**Key client patterns:**
- Services in `app/lib/services/` are the only place that calls the API — components call services, not `api.ts` directly.
- Query params use `snake_case` (e.g., `workspace_id`), matching the server.
- The public form route `/f/[slug]` and the Next.js API route `/api/forms/[slug]/meta` are unauthenticated.
- Google sign-in did not survive the move off Firebase Auth — `AuthContext.signInWithGoogle` throws a translated error so the existing button fails gracefully instead of being removed from the UI.

### Real-time (Socket.IO)
- Server: `python-socketio` wraps the FastAPI ASGI app (`main:socket_app`). Runs with `--workers 1` in production — room membership (`_uid_sids`) is in-process state, not shared across workers.
- Client: `socket.io-client` connects with the local access token as auth (`authClient`'s `getIdToken(true)` forces a refresh before each reconnect attempt).
- On connect, the server joins the socket to rooms: `user:{uid}` and `workspace:{id}` for each of the user's workspaces.
- Use `app/sockets/broadcaster.py` to emit events from route handlers.

## Testing Conventions

Tests use `pytest-asyncio` with `asyncio_mode = "auto"`. Three shared fixtures in `conftest.py`:
- `async_client` — ASGI test client (no real network, no real MySQL)
- `override_auth` — overrides `get_current_user` dependency with a fake user
- `mock_firestore` — patches the MySQL data layer (`app/services/db.py`, still referenced as
  `firestore_db` at each import site) in every route/service module with an `AsyncMock`

A typical test uses all three:
```python
async def test_something(async_client, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {...}
    response = await async_client.get("/api/forms/123")
    assert response.status_code == 200
```

There is also one smoke path exercised against real infrastructure: bring up
`docker compose -f docker-compose.dev.yml up` and hit the API directly (register → login → create
workspace → create form → public submission → inbox) to verify the MySQL/MinIO/Redis wiring end to
end — the mocked pytest suite intentionally never touches a real database.
