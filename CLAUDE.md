# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**onb.** is a briefing platform for creative professionals. It has two components:
- `client/` — Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- `server/` — FastAPI (Python 3.13) + Pydantic v2 + Firebase Admin + Firestore

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

### Running both with Docker
```bash
# Requires a .env file at repo root (see Environment Variables below)
docker compose -f docker-compose.dev.yml up
```

### Tests (server only)
```bash
cd server
uv run pytest                           # all tests
uv run pytest tests/routes/test_form.py # single file
uv run pytest -k "test_name"            # single test by name
```

## Environment Variables

Required in a `.env` file at the repo root (also used by Docker Compose):

```
# Client (NEXT_PUBLIC_ prefix exposes to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_URL=http://localhost:8000

# Server
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
CORS_ORIGINS=http://localhost:3000
```

The client services fall back to mock data (from `client/app/lib/mocks/`) when `NEXT_PUBLIC_API_URL` is not set.

## Architecture

### Server

```
server/
  main.py                        # FastAPI app, Socket.IO wrapper, lifespan/cleanup tasks
  app/
    core/
      auth.py                    # get_current_user dependency (verifies Firebase ID token)
      permissions.py             # require_form_owner, require_workspace_owner, etc.
      firebase.py                # firebase_admin initialization
    routes/                      # one file per domain (form, submission, inbox, workspace, ...)
    schemas/                     # Pydantic v2 models (In/Out pairs per domain)
    services/
      firestore_db.py            # all Firestore operations (async)
      auth_service.py            # user CRUD + token blacklist (sync, uses Firestore)
      ai_service.py              # DeepSeek AI analysis via OpenAI-compatible API
      pdf_service.py             # WeasyPrint PDF generation
      email_service.py           # Resend email service
    sockets/
      events.py                  # Socket.IO connect/disconnect handlers (Firebase auth)
      broadcaster.py             # helpers to emit events to workspace/user rooms
```

**Key server patterns:**
- All protected routes use `Depends(get_current_user)` which returns a user dict with `id` (UUID) and `firebase_uid`.
- Ownership checks are centralized in `app/core/permissions.py` — always use these helpers rather than ad-hoc checks.
- `firestore_db.py` is async; `auth_service.py` is sync (uses `asyncio.to_thread` when called from async context).
- Background task in `main.py` cleans up stale draft forms and expired blacklisted tokens every 6 hours.

### Client

```
client/
  app/
    lib/
      api.ts                     # axios/fetch HTTP client (attaches Firebase ID token)
      types.ts                   # shared TypeScript domain types
      services/                  # service layer: formService, submissionService, workspaceService, folderService, insightService
      mocks/                     # mock data used when API_URL is unset
    dashboard/
      layout.tsx                 # sidebar + topbar + command palette (Ctrl+K)
      page.tsx                   # inbox (responses + forms tabs)
      forms/[id]/page.tsx        # form editor (fields + branding tabs)
      responses/[id]/page.tsx    # submission detail + AI insights
      templates/                 # template gallery and editor
    f/[slug]/page.tsx            # public form renderer (no auth required)
  components/ui/                 # shadcn/ui primitives
```

**Key client patterns:**
- Services in `app/lib/services/` are the only place that calls the API — components call services, not `api.ts` directly.
- Query params use `snake_case` (e.g., `workspace_id`), matching the server.
- The public form route `/f/[slug]` and the Next.js API route `/api/forms/[slug]/meta` are unauthenticated.

### Real-time (Socket.IO)
- Server: `python-socketio` wraps the FastAPI ASGI app (`main:socket_app`).
- Client: `socket.io-client` connects with a Firebase ID token as auth.
- On connect, the server joins the socket to rooms: `user:{uid}` and `workspace:{id}` for each of the user's workspaces.
- Use `app/sockets/broadcaster.py` to emit events from route handlers.

## Testing Conventions

Tests use `pytest-asyncio` with `asyncio_mode = "auto"`. Three shared fixtures in `conftest.py`:
- `async_client` — ASGI test client (no real network)
- `override_auth` — overrides `get_current_user` dependency with a fake user
- `mock_firestore` — patches `firestore_db` in all route modules with an `AsyncMock`

A typical test uses all three:
```python
async def test_something(async_client, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {...}
    response = await async_client.get("/api/forms/123")
    assert response.status_code == 200
```
