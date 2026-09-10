"""
MySQL data layer — replaces the old Firestore `firestore_db.py`.

Same function names, same async signatures, same dict-shaped return values
(camelCase keys + `id`), on purpose: every route, permission check, and
plan-limit helper that imported `firestore_db` keeps working by only
swapping the import. Column names in `schema.sql` mirror the old Firestore
field names for exactly this reason.

Dropped on purpose (confirmed dead — zero callers in the Firestore version):
`get_or_create_user`, `get_forms_by_owner`, `get_user_by_stripe_subscription`.
`get_user_by_stripe_customer` is dropped too — it only served the Stripe
webhook, which this port replaces with a local billing stub.
"""

from __future__ import annotations

import re
import secrets
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.db.pool import dumps, execute, fetch_all, fetch_one, loads, transaction


def now_utc() -> datetime:
    """Naive UTC datetime — MySQL DATETIME has no tz, so every timestamp in this
    module is naive-but-UTC by convention (mirrors what Firestore's SERVER_TIMESTAMP
    resolved to when read back into a Python datetime)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _decode(row: Optional[dict], json_cols: tuple[str, ...]) -> Optional[dict]:
    if row is None:
        return None
    for col in json_cols:
        if col in row:
            row[col] = loads(row[col])
    return row


def _decode_all(rows: List[dict], json_cols: tuple[str, ...]) -> List[dict]:
    return [_decode(r, json_cols) for r in rows]


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:60]


# ── Forms ────────────────────────────────────────────────────────────────────

_FORM_JSON = ("groups", "branding")


async def get_forms(workspace_id: str) -> List[Dict[str, Any]]:
    rows = await fetch_all(
        "SELECT * FROM forms WHERE workspaceId=%s ORDER BY createdAt DESC", (workspace_id,)
    )
    return _decode_all(rows, _FORM_JSON)


async def get_form(form_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM forms WHERE id=%s", (form_id,))
    return _decode(row, _FORM_JSON)


async def get_form_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM forms WHERE slug=%s LIMIT 1", (slug,))
    return _decode(row, _FORM_JSON)


async def create_form(data: Dict[str, Any]) -> Dict[str, Any]:
    slug = data.get("slug")
    if not slug:
        name = data.get("name") or data.get("clientName") or ""
        base = _slugify(name) if name else "form"
        suffix = uuid.uuid4().hex[:6]
        slug = f"{base}-{suffix}" if base else suffix

    groups = data.get("groups") or []
    for group in groups:
        if not group.get("id"):
            group["id"] = str(uuid.uuid4())
        for field in group.get("fields") or []:
            if not field.get("id"):
                field["id"] = str(uuid.uuid4())

    form_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "id": form_id,
        "name": data.get("name"),
        "slug": slug,
        "clientName": data.get("clientName"),
        "templateId": data.get("templateId"),
        "category": data.get("category"),
        "groups": groups,
        "branding": data.get("branding") or {},
        "status": data.get("status", "draft"),
        "folderId": data.get("folderId"),
        "workspaceId": data.get("workspaceId"),
        "ownerId": data.get("ownerId"),
        "submissionCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    await execute(
        """INSERT INTO forms
           (id, name, slug, clientName, templateId, category, `groups`, branding,
            status, folderId, workspaceId, ownerId, submissionCount, createdAt, updatedAt)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            row["id"], row["name"], row["slug"], row["clientName"], row["templateId"],
            row["category"], dumps(row["groups"]), dumps(row["branding"]), row["status"],
            row["folderId"], row["workspaceId"], row["ownerId"], row["submissionCount"],
            row["createdAt"], row["updatedAt"],
        ),
    )
    return row


async def update_form(form_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    updates = {**updates, "updatedAt": now_utc()}
    cols, vals = [], []
    for key, value in updates.items():
        cols.append(f"`{key}`=%s" if key == "groups" else f"{key}=%s")
        vals.append(dumps(value) if key in _FORM_JSON else value)
    vals.append(form_id)
    await execute(f"UPDATE forms SET {', '.join(cols)} WHERE id=%s", tuple(vals))
    return await get_form(form_id)


async def deactivate_active_forms_by_owner(firebase_uid: str) -> None:
    """Set all 'active' forms owned by firebase_uid to 'draft' (plan expired)."""
    await execute(
        "UPDATE forms SET status='draft', updatedAt=%s WHERE ownerId=%s AND status='active'",
        (now_utc(), firebase_uid),
    )


async def delete_form(form_id: str) -> None:
    """Snapshot form metadata onto its submissions (so labels/client name survive),
    then delete the form. `formId` on those submissions is cleared automatically
    by the FK's ON DELETE SET NULL."""
    form = await get_form(form_id)
    if form:
        form_name = form.get("name") or "Formulário"
        client_name = form.get("clientName") or form_name
        await execute(
            """UPDATE submissions
               SET formName=%s, clientName=%s, workspaceId=COALESCE(%s, workspaceId), formGroups=%s
               WHERE formId=%s""",
            (form_name, client_name, form.get("workspaceId"), dumps(form.get("groups") or []), form_id),
        )
    await execute("DELETE FROM forms WHERE id=%s", (form_id,))


# ── Submissions ──────────────────────────────────────────────────────────────

_SUBMISSION_JSON = ("data", "files", "formGroups")


async def get_submissions(form_id: str) -> List[Dict[str, Any]]:
    rows = await fetch_all(
        "SELECT * FROM submissions WHERE formId=%s ORDER BY submittedAt DESC", (form_id,)
    )
    return _decode_all(rows, _SUBMISSION_JSON)


async def get_submissions_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    rows = await fetch_all(
        "SELECT * FROM submissions WHERE workspaceId=%s ORDER BY submittedAt DESC",
        (workspace_id,),
    )
    return _decode_all(rows, _SUBMISSION_JSON)


async def get_submission(submission_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM submissions WHERE id=%s", (submission_id,))
    return _decode(row, _SUBMISSION_JSON)


async def create_submission(data: Dict[str, Any]) -> Dict[str, Any]:
    submission_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "id": submission_id,
        "formId": data.get("formId"),
        "workspaceId": data.get("workspaceId"),
        "data": data.get("data") or {},
        "files": data.get("files") or {},
        "submittedAt": now,
        "status": data.get("status", "new"),
        "aiAnalysisStatus": None,
        "aiInsightId": None,
        "formName": None,
        "clientName": None,
        "formGroups": None,
    }
    await execute(
        """INSERT INTO submissions
           (id, formId, workspaceId, data, files, submittedAt, status)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (row["id"], row["formId"], row["workspaceId"], dumps(row["data"]),
         dumps(row["files"]), row["submittedAt"], row["status"]),
    )
    if row["formId"]:
        await execute(
            "UPDATE forms SET submissionCount = submissionCount + 1 WHERE id=%s",
            (row["formId"],),
        )
    return row


async def update_submission_status(submission_id: str, status: str) -> None:
    await execute("UPDATE submissions SET status=%s WHERE id=%s", (status, submission_id))


# Only these fields are ever patched one-at-a-time by callers (worker job status,
# insight linkage) — whitelisted since `field` reaches here as a raw string.
_PATCHABLE_SUBMISSION_FIELDS = {"aiAnalysisStatus", "aiInsightId", "status"}


async def update_submission_field(submission_id: str, field: str, value: Any) -> None:
    if field not in _PATCHABLE_SUBMISSION_FIELDS:
        raise ValueError(f"Campo não permitido para patch: {field}")
    await execute(f"UPDATE submissions SET {field}=%s WHERE id=%s", (value, submission_id))


# ── Workspaces ───────────────────────────────────────────────────────────────


async def get_workspace(workspace_id: str) -> Optional[Dict[str, Any]]:
    return await fetch_one("SELECT * FROM workspaces WHERE id=%s", (workspace_id,))


async def get_workspaces_by_owner(owner_uid: str) -> List[Dict[str, Any]]:
    return await fetch_all("SELECT * FROM workspaces WHERE ownerId=%s", (owner_uid,))


async def get_workspaces_for_user(uid: str) -> List[Dict[str, Any]]:
    """Workspaces the user owns OR is a member of, via the workspace_members join
    table (replaces the old owned ∪ users.workspaceIds fan-out)."""
    return await fetch_all(
        """SELECT DISTINCT w.* FROM workspaces w
           LEFT JOIN workspace_members m ON m.workspaceId = w.id AND m.uid = %s
           WHERE w.ownerId = %s OR m.uid IS NOT NULL""",
        (uid, uid),
    )


async def create_workspace(data: Dict[str, Any]) -> Dict[str, Any]:
    ws_id = str(uuid.uuid4())
    owner_id = data.get("ownerId")
    now = now_utc()
    row = {
        "id": ws_id,
        "name": data.get("name"),
        "slug": data.get("slug"),
        "ownerId": owner_id,
        "plan": data.get("plan", "free"),
        "brandColor": data.get("brandColor"),
        "logoUrl": None,
        "createdAt": now,
    }
    async with transaction() as cur:
        await cur.execute(
            """INSERT INTO workspaces (id, name, slug, ownerId, plan, brandColor, createdAt)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (row["id"], row["name"], row["slug"], row["ownerId"], row["plan"],
             row["brandColor"], row["createdAt"]),
        )
        await cur.execute(
            "INSERT INTO workspace_members (workspaceId, uid, role) VALUES (%s,%s,'owner')",
            (ws_id, owner_id),
        )
    return row


async def update_workspace(workspace_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    cols = ", ".join(f"{k}=%s" for k in updates)
    await execute(
        f"UPDATE workspaces SET {cols} WHERE id=%s", (*updates.values(), workspace_id)
    )
    return await get_workspace(workspace_id)


async def delete_workspace(workspace_id: str) -> None:
    """Every dependent row (forms, submissions, folders, invites, members) cascades
    via FK ON DELETE — see schema.sql. No hand-rolled fan-out needed anymore."""
    await execute("DELETE FROM workspaces WHERE id=%s", (workspace_id,))


# ── Templates ────────────────────────────────────────────────────────────────

_TEMPLATE_JSON = ("tags", "defaultGroups", "defaultBranding")


async def get_system_templates(category: Optional[str] = None) -> List[Dict[str, Any]]:
    if category:
        rows = await fetch_all(
            "SELECT * FROM system_templates WHERE category=%s ORDER BY name", (category,)
        )
    else:
        rows = await fetch_all("SELECT * FROM system_templates ORDER BY name")
    return _decode_all(rows, _TEMPLATE_JSON)


async def get_system_template(template_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM system_templates WHERE id=%s", (template_id,))
    return _decode(row, _TEMPLATE_JSON)


async def get_templates_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    rows = await fetch_all(
        "SELECT * FROM templates WHERE workspaceId=%s ORDER BY createdAt DESC", (workspace_id,)
    )
    return _decode_all(rows, _TEMPLATE_JSON)


async def get_templates_by_owner(owner_uid: str) -> List[Dict[str, Any]]:
    rows = await fetch_all(
        "SELECT * FROM templates WHERE ownerId=%s ORDER BY createdAt DESC", (owner_uid,)
    )
    return _decode_all(rows, _TEMPLATE_JSON)


async def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM templates WHERE id=%s", (template_id,))
    return _decode(row, _TEMPLATE_JSON)


async def create_template(data: Dict[str, Any]) -> Dict[str, Any]:
    tpl_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "id": tpl_id,
        "name": data.get("name"),
        "description": data.get("description"),
        "icon": data.get("icon"),
        "category": data.get("category"),
        "tags": data.get("tags") or [],
        "defaultGroups": data.get("defaultGroups") or [],
        "defaultBranding": data.get("defaultBranding") or {},
        "workspaceId": data.get("workspaceId"),
        "ownerId": data.get("ownerId"),
        "createdAt": now,
        "updatedAt": now,
    }
    await execute(
        """INSERT INTO templates
           (id, name, description, icon, category, tags, defaultGroups, defaultBranding,
            workspaceId, ownerId, createdAt, updatedAt)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (row["id"], row["name"], row["description"], row["icon"], row["category"],
         dumps(row["tags"]), dumps(row["defaultGroups"]), dumps(row["defaultBranding"]),
         row["workspaceId"], row["ownerId"], row["createdAt"], row["updatedAt"]),
    )
    return row


async def update_template(template_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    updates = {**updates, "updatedAt": now_utc()}
    cols, vals = [], []
    for key, value in updates.items():
        cols.append(f"{key}=%s")
        vals.append(dumps(value) if key in _TEMPLATE_JSON else value)
    vals.append(template_id)
    await execute(f"UPDATE templates SET {', '.join(cols)} WHERE id=%s", tuple(vals))
    return await get_template(template_id)


async def delete_template(template_id: str) -> None:
    await execute("DELETE FROM templates WHERE id=%s", (template_id,))


# ── Insights ─────────────────────────────────────────────────────────────────

_INSIGHT_JSON = (
    "headerImpacto", "diagnosticoEstrategico", "scoreONB", "redFlagsEstrategicas",
    "perfilPsicografico", "kickoffMasterlist", "auditVisual", "estrategiaDeProtecao",
)


async def create_insight(data: Dict[str, Any]) -> Dict[str, Any]:
    insight_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "id": insight_id,
        "submissionId": data.get("submissionId"),
        "formId": data.get("formId"),
        "headerImpacto": data.get("headerImpacto") or {},
        "diagnosticoEstrategico": data.get("diagnosticoEstrategico") or {},
        "scoreONB": data.get("scoreONB") or {},
        "redFlagsEstrategicas": data.get("redFlagsEstrategicas") or [],
        "perfilPsicografico": data.get("perfilPsicografico") or {},
        "kickoffMasterlist": data.get("kickoffMasterlist") or {},
        "auditVisual": data.get("auditVisual"),
        "estrategiaDeProtecao": data.get("estrategiaDeProtecao"),
        "rawPrompt": data.get("rawPrompt"),
        "rawResponse": data.get("rawResponse"),
        "modelUsed": data.get("modelUsed"),
        "generatedAt": now,
    }
    await execute(
        """INSERT INTO insights
           (id, submissionId, formId, headerImpacto, diagnosticoEstrategico, scoreONB,
            redFlagsEstrategicas, perfilPsicografico, kickoffMasterlist, auditVisual,
            estrategiaDeProtecao, rawPrompt, rawResponse, modelUsed, generatedAt)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            row["id"], row["submissionId"], row["formId"], dumps(row["headerImpacto"]),
            dumps(row["diagnosticoEstrategico"]), dumps(row["scoreONB"]),
            dumps(row["redFlagsEstrategicas"]), dumps(row["perfilPsicografico"]),
            dumps(row["kickoffMasterlist"]), dumps(row["auditVisual"]),
            dumps(row["estrategiaDeProtecao"]), row["rawPrompt"], row["rawResponse"],
            row["modelUsed"], row["generatedAt"],
        ),
    )
    return row


async def get_insight_by_submission(submission_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one(
        "SELECT * FROM insights WHERE submissionId=%s LIMIT 1", (submission_id,)
    )
    return _decode(row, _INSIGHT_JSON)


async def get_insights_for_submissions(submission_ids: List[str]) -> List[Dict[str, Any]]:
    if not submission_ids:
        return []
    placeholders = ",".join(["%s"] * len(submission_ids))
    rows = await fetch_all(
        f"SELECT * FROM insights WHERE submissionId IN ({placeholders})",
        tuple(submission_ids),
    )
    return _decode_all(rows, _INSIGHT_JSON)


async def get_insight(insight_id: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one("SELECT * FROM insights WHERE id=%s", (insight_id,))
    return _decode(row, _INSIGHT_JSON)


# ── Workspace Members ────────────────────────────────────────────────────────


async def get_workspace_members(workspace_id: str) -> List[Dict[str, Any]]:
    """Joined on users.firebase_uid (the old Firestore version joined on the
    user doc ID, which never matched the real UUID doc IDs and always fell
    through to a Firebase Auth fallback — fixed here)."""
    rows = await fetch_all(
        """SELECT m.uid AS uid, m.role AS role,
                  u.email AS email, u.display_name AS name, u.photo_url AS avatarUrl
           FROM workspace_members m
           LEFT JOIN users u ON u.firebase_uid = m.uid
           WHERE m.workspaceId = %s""",
        (workspace_id,),
    )
    return [
        {
            "uid": r["uid"],
            "role": r["role"],
            "email": r.get("email") or "",
            "name": r.get("name") or "",
            "avatarUrl": r.get("avatarUrl"),
        }
        for r in rows
    ]


async def add_workspace_member(workspace_id: str, uid: str, role: str) -> Dict[str, Any]:
    await execute(
        "INSERT INTO workspace_members (workspaceId, uid, role) VALUES (%s,%s,%s)",
        (workspace_id, uid, role),
    )
    return {"uid": uid, "role": role}


async def update_workspace_member_role(workspace_id: str, uid: str, role: str) -> None:
    await execute(
        "UPDATE workspace_members SET role=%s WHERE workspaceId=%s AND uid=%s",
        (role, workspace_id, uid),
    )


async def remove_workspace_member(workspace_id: str, uid: str) -> None:
    await execute(
        "DELETE FROM workspace_members WHERE workspaceId=%s AND uid=%s", (workspace_id, uid)
    )


async def count_workspace_members(workspace_id: str) -> int:
    row = await fetch_one(
        "SELECT COUNT(*) AS c FROM workspace_members WHERE workspaceId=%s", (workspace_id,)
    )
    return int(row["c"]) if row else 0


# ── Folders ──────────────────────────────────────────────────────────────────


async def get_folders_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM folders WHERE workspaceId=%s ORDER BY createdAt DESC", (workspace_id,)
    )


async def get_folder(folder_id: str) -> Optional[Dict[str, Any]]:
    return await fetch_one("SELECT * FROM folders WHERE id=%s", (folder_id,))


async def create_folder(data: Dict[str, Any]) -> Dict[str, Any]:
    folder_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "id": folder_id,
        "name": data.get("name"),
        "workspaceId": data.get("workspaceId"),
        "ownerId": data.get("ownerId"),
        "createdAt": now,
    }
    await execute(
        "INSERT INTO folders (id, name, workspaceId, ownerId, createdAt) VALUES (%s,%s,%s,%s,%s)",
        (row["id"], row["name"], row["workspaceId"], row["ownerId"], row["createdAt"]),
    )
    return row


async def delete_folder(folder_id: str) -> None:
    await execute("DELETE FROM folders WHERE id=%s", (folder_id,))


# ── Workspace Invites ────────────────────────────────────────────────────────


async def create_workspace_invite(data: Dict[str, Any]) -> Dict[str, Any]:
    invite_id = str(uuid.uuid4())
    code = secrets.token_urlsafe(9)
    now = now_utc()
    row = {
        "id": invite_id,
        "code": code,
        "workspaceId": data.get("workspaceId"),
        "role": data.get("role"),
        "createdBy": data.get("createdBy"),
        "invitedUid": data.get("invitedUid"),
        "expiresAt": data.get("expiresAt"),
        "maxUses": data.get("maxUses", 0),
        "useCount": 0,
        "active": True,
        "createdAt": now,
    }
    await execute(
        """INSERT INTO workspace_invites
           (id, code, workspaceId, role, createdBy, invitedUid, expiresAt, maxUses, useCount, active, createdAt)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (row["id"], row["code"], row["workspaceId"], row["role"], row["createdBy"],
         row["invitedUid"], row["expiresAt"], row["maxUses"], row["useCount"],
         row["active"], row["createdAt"]),
    )
    return row


async def get_invite_by_code(code: str) -> Optional[Dict[str, Any]]:
    return await fetch_one(
        "SELECT * FROM workspace_invites WHERE code=%s AND active=1 LIMIT 1", (code,)
    )


async def get_workspace_invites(workspace_id: str) -> List[Dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM workspace_invites WHERE workspaceId=%s AND active=1", (workspace_id,)
    )


async def increment_invite_use(invite_id: str) -> None:
    await execute(
        "UPDATE workspace_invites SET useCount = useCount + 1 WHERE id=%s", (invite_id,)
    )


async def revoke_invite(invite_id: str) -> None:
    await execute("UPDATE workspace_invites SET active=0 WHERE id=%s", (invite_id,))


async def delete_invite(invite_id: str) -> None:
    await execute("DELETE FROM workspace_invites WHERE id=%s", (invite_id,))


async def get_pending_invites_for_user(uid: str) -> List[Dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM workspace_invites WHERE invitedUid=%s AND active=1", (uid,)
    )


# ── Users / billing ──────────────────────────────────────────────────────────


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return await fetch_one("SELECT * FROM users WHERE id=%s", (user_id,))


async def get_user_by_firebase_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    return await fetch_one(
        "SELECT * FROM users WHERE firebase_uid=%s LIMIT 1", (firebase_uid,)
    )


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """New — replaces the Firebase Admin `get_user_by_email` calls in
    routes/workspace.py and routes/invite.py."""
    return await fetch_one(
        "SELECT * FROM users WHERE email=%s AND deleted=0 LIMIT 1", (email.lower().strip(),)
    )


_BILLING_COLUMNS = {
    "stripe_customer_id", "stripe_subscription_id", "subscription_status",
    "plan", "current_period_end", "trial_end",
}


async def update_user_billing(user_id: str, data: Dict[str, Any]) -> None:
    """Patch billing fields on a user row. Column names are whitelisted since
    this is the one function that takes an arbitrary field dict."""
    updates = {k: v for k, v in data.items() if k in _BILLING_COLUMNS}
    if not updates:
        return
    cols = ", ".join(f"{k}=%s" for k in updates)
    await execute(f"UPDATE users SET {cols} WHERE id=%s", (*updates.values(), user_id))


# ── Plan-limit counting helpers ──────────────────────────────────────────────


async def count_monthly_submissions(workspace_id: str) -> int:
    start_of_month = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    row = await fetch_one(
        "SELECT COUNT(*) AS c FROM submissions WHERE workspaceId=%s AND submittedAt >= %s",
        (workspace_id, start_of_month),
    )
    return int(row["c"]) if row else 0


# ── LGPD data export ─────────────────────────────────────────────────────────


async def export_user_data(firebase_uid: str) -> Dict[str, Any]:
    """Collect all personal data stored for a user (LGPD Art. 18, II).
    Same output shape as the Firestore version: {profile, workspaces, forms,
    submissions, templates}. Sensitive internal fields (fingerprint, stripe
    IDs, token blacklist) are intentionally excluded."""
    user = await fetch_one(
        "SELECT * FROM users WHERE firebase_uid=%s LIMIT 1", (firebase_uid,)
    )
    if not user:
        return {}

    profile = {
        "id": user["id"],
        "email": user.get("email"),
        "display_name": user.get("display_name"),
        "photo_url": user.get("photo_url"),
        "created_at": str(user.get("created_at", "")),
        "plan": user.get("plan"),
        "subscription_status": user.get("subscription_status"),
        "trial_end": str(user["trial_end"]) if user.get("trial_end") else None,
        "current_period_end": str(user["current_period_end"]) if user.get("current_period_end") else None,
        "email_notifications": user.get("email_notifications"),
        "language": user.get("language"),
    }

    ws_rows = await fetch_all(
        """SELECT w.*, IF(w.ownerId=%s, 'owner', m.role) AS role
           FROM workspaces w
           LEFT JOIN workspace_members m ON m.workspaceId = w.id AND m.uid = %s
           WHERE w.ownerId = %s OR m.uid IS NOT NULL""",
        (firebase_uid, firebase_uid, firebase_uid),
    )
    workspace_ids = [w["id"] for w in ws_rows]
    workspaces = [
        {
            "id": w["id"], "name": w.get("name"), "slug": w.get("slug"),
            "plan": w.get("plan"), "role": w.get("role") or "member",
            "created_at": str(w.get("createdAt", "")),
        }
        for w in ws_rows
    ]

    forms: List[Dict[str, Any]] = []
    form_ids: List[str] = []
    if workspace_ids:
        placeholders = ",".join(["%s"] * len(workspace_ids))
        form_rows = await fetch_all(
            f"SELECT * FROM forms WHERE workspaceId IN ({placeholders})", tuple(workspace_ids)
        )
        for f in form_rows:
            form_ids.append(f["id"])
            forms.append({
                "id": f["id"], "name": f.get("name"), "client_name": f.get("clientName"),
                "status": f.get("status"), "slug": f.get("slug"),
                "workspace_id": f.get("workspaceId"), "created_at": str(f.get("createdAt", "")),
                "updated_at": str(f.get("updatedAt", "")), "submission_count": f.get("submissionCount", 0),
            })

    submissions: List[Dict[str, Any]] = []
    if form_ids:
        placeholders = ",".join(["%s"] * len(form_ids))
        sub_rows = await fetch_all(
            f"SELECT * FROM submissions WHERE formId IN ({placeholders})", tuple(form_ids)
        )
        for s in sub_rows:
            submissions.append({
                "id": s["id"], "form_id": s.get("formId"), "form_name": s.get("formName"),
                "workspace_id": s.get("workspaceId"), "status": s.get("status"),
                "submitted_at": str(s.get("submittedAt", "")), "answers": loads(s.get("data")) or [],
            })

    tpl_rows = await fetch_all("SELECT * FROM templates WHERE ownerId=%s", (firebase_uid,))
    templates = [
        {"id": t["id"], "name": t.get("name"), "workspace_id": t.get("workspaceId"),
         "created_at": str(t.get("createdAt", ""))}
        for t in tpl_rows
    ]

    return {
        "exported_at": str(datetime.now(timezone.utc)),
        "profile": profile,
        "workspaces": workspaces,
        "forms": forms,
        "submissions": submissions,
        "templates": templates,
    }


# ── Cleanup ──────────────────────────────────────────────────────────────────


async def cleanup_inactive_draft_forms(
    max_age_days: int = 7,
    workspace_ids: Optional[List[str]] = None,
) -> int:
    """Delete draft forms not updated in `max_age_days` days. Scoped to
    `workspace_ids` when given (the HTTP endpoint); global otherwise
    (the background loop). Reuses delete_form so submissions still get
    their metadata snapshot."""
    cutoff = now_utc() - timedelta(days=max_age_days)
    rows = await fetch_all(
        "SELECT id, workspaceId FROM forms WHERE status='draft' AND updatedAt < %s", (cutoff,)
    )
    if workspace_ids is not None:
        allowed = set(workspace_ids)
        rows = [r for r in rows if r.get("workspaceId") in allowed]

    for row in rows:
        await delete_form(row["id"])

    return len(rows)
