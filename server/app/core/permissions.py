"""
Ownership and role-based permission helpers.

Role hierarchy (highest to lowest):
  owner > admin > member > viewer

Each helper fetches the resource, checks the caller's effective role, and
returns the resource dict (saving routes from a second Firestore read).
Raises HTTP 404 when not found, HTTP 403 when the role is insufficient.

Permission matrix
-----------------
Action                          | owner | admin | member | viewer
--------------------------------|-------|-------|--------|-------
View submission / download      |  ✅   |  ✅   |   ✅   |   ✅
Change status / trigger AI      |  ✅   |  ✅   |   ✅   |   ❌
Edit / delete form, move folder |  ✅   |  ✅   |   ❌   |   ❌
Manage workspace / members      |  ✅   |  ❌   |   ❌   |   ❌
"""

from fastapi import HTTPException, status

from app.services import db as firestore_db

# Lower index = lower privilege
ROLE_WEIGHTS: dict[str, int] = {
    "viewer": 0,
    "member": 1,
    "admin": 2,
    "owner": 3,
}


async def _workspace_role(workspace_id: str, uid: str) -> str | None:
    """Return the effective role of *uid* in *workspace_id*, or None if not a member."""
    ws = await firestore_db.get_workspace(workspace_id)
    if not ws:
        return None
    if ws.get("ownerId") == uid:
        return "owner"
    members = await firestore_db.get_workspace_members(workspace_id)
    for m in members:
        if m["uid"] == uid:
            return m.get("role", "member")
    return None


def _role_gte(role: str | None, min_role: str) -> bool:
    if role is None:
        return False
    return ROLE_WEIGHTS.get(role, -1) >= ROLE_WEIGHTS.get(min_role, 0)


# ── Submission access ─────────────────────────────────────────────────────────

async def require_submission_access(
    submission_id: str,
    current_user: dict,
    min_role: str = "viewer",
) -> dict:
    """
    Return the submission if the caller's workspace role is >= *min_role*.

    Use min_role="viewer"  for read-only actions (view, download).
    Use min_role="member"  for write actions (status change, AI analysis).
    """
    sub = await firestore_db.get_submission(submission_id)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submissão não encontrada")
    workspace_id = sub.get("workspaceId")
    if not workspace_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    uid = current_user.get("firebase_uid")
    role = await _workspace_role(workspace_id, uid)
    if not _role_gte(role, min_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return sub


# Keep old name as alias so existing imports don't break
async def require_submission_owner(submission_id: str, current_user: dict) -> dict:
    return await require_submission_access(submission_id, current_user, min_role="viewer")


# ── Form access ───────────────────────────────────────────────────────────────

async def require_form_write(
    form_id: str,
    current_user: dict,
    min_role: str = "admin",
) -> dict:
    """
    Return the form if the caller is the form owner or has workspace role >= *min_role*.

    Use min_role="admin"  for edit / delete / folder operations.
    Use min_role="member" for lighter write operations if ever needed.
    """
    form = await firestore_db.get_form(form_id)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formulário não encontrado")
    uid = current_user.get("firebase_uid")
    # Form creator always retains write access regardless of workspace role
    if form.get("ownerId") == uid:
        return form
    workspace_id = form.get("workspaceId")
    if workspace_id:
        role = await _workspace_role(workspace_id, uid)
        if _role_gte(role, min_role):
            return form
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")


# Keep old name as alias
async def require_form_owner(form_id: str, current_user: dict) -> dict:
    return await require_form_write(form_id, current_user, min_role="admin")


# ── Template access ───────────────────────────────────────────────────────────

async def require_template_owner(
    template_id: str, current_user: dict
) -> tuple[dict, bool]:
    """
    Returns (template_dict, is_system).
    System templates are readable by any authenticated user (is_system=True).
    User templates enforce ownership.
    """
    system = await firestore_db.get_system_template(template_id)
    if system:
        return system, True

    user = await firestore_db.get_template(template_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template não encontrado",
        )
    if user.get("ownerId") != current_user.get("firebase_uid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado",
        )
    return user, False


# ── Workspace access ──────────────────────────────────────────────────────────

async def require_workspace_owner(workspace_id: str, current_user: dict) -> dict:
    ws = await firestore_db.get_workspace(workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace não encontrado",
        )
    if ws.get("ownerId") != current_user.get("firebase_uid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado",
        )
    return ws


async def require_workspace_member(workspace_id: str, current_user: dict) -> dict:
    """Allow workspace owner OR any workspace member (any role) to access."""
    ws = await firestore_db.get_workspace(workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace não encontrado",
        )
    uid = current_user.get("firebase_uid")
    role = await _workspace_role(workspace_id, uid)
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return ws


async def require_form_member_access(form_id: str, current_user: dict) -> dict:
    """Allow form owner OR any workspace member to read the form."""
    form = await firestore_db.get_form(form_id)
    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formulário não encontrado",
        )
    uid = current_user.get("firebase_uid")
    if form.get("ownerId") == uid:
        return form
    workspace_id = form.get("workspaceId")
    if workspace_id:
        role = await _workspace_role(workspace_id, uid)
        if role is not None:
            return form
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
