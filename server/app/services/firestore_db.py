from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone

from firebase_admin import firestore as fa_firestore

from app.core.firebase import db


def _doc_to_dict(doc: fa_firestore.DocumentSnapshot) -> Dict[str, Any]:
    data = doc.to_dict() or {}
    data_id = doc.id
    data["id"] = data_id
    return data


async def get_forms(workspace_id: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("forms")
            .where("workspaceId", "==", workspace_id)
            .order_by("createdAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_forms_by_owner(owner_uid: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("forms")
            .where("ownerId", "==", owner_uid)
            .order_by("createdAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_form(form_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("forms").document(form_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def create_form(data: Dict[str, Any]) -> Dict[str, Any]:
    import uuid
    import re
    import unicodedata

    def _slugify(text: str) -> str:
        """Convert text to a URL-friendly slug."""
        text = unicodedata.normalize("NFKD", text)
        text = text.encode("ascii", "ignore").decode("ascii")
        text = text.lower()
        text = re.sub(r"[^a-z0-9]+", "-", text)
        return text.strip("-")[:60]

    def _sync():
        now = fa_firestore.SERVER_TIMESTAMP
        payload = {**data, "createdAt": now, "updatedAt": now}

        # Auto-generate slug if not provided
        if not payload.get("slug"):
            name = payload.get("name") or payload.get("clientName") or ""
            base = _slugify(name) if name else "form"
            suffix = uuid.uuid4().hex[:6]
            payload["slug"] = f"{base}-{suffix}" if base else suffix

        # Ensure Groups and Fields have IDs
        for group in payload.get("groups") or []:
            if not group.get("id"):
                group["id"] = str(uuid.uuid4())
            for field in group.get("fields") or []:
                if not field.get("id"):
                    field["id"] = str(uuid.uuid4())

        doc_ref = db.collection("forms").document()
        doc_ref.set(payload)
        doc = doc_ref.get()
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def update_form(form_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        payload = {**updates, "updatedAt": fa_firestore.SERVER_TIMESTAMP}
        doc_ref = db.collection("forms").document(form_id)
        doc_ref.update(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def deactivate_active_forms_by_owner(firebase_uid: str) -> None:
    """Set all 'active' forms owned by firebase_uid to 'draft' (plan expired)."""
    def _sync():
        q = (
            db.collection("forms")
            .where("ownerId", "==", firebase_uid)
            .where("status", "==", "active")
        )
        docs = list(q.stream())
        if not docs:
            return
        batch = db.batch()
        for doc in docs:
            batch.update(doc.reference, {"status": "draft", "updatedAt": fa_firestore.SERVER_TIMESTAMP})
        batch.commit()

    await asyncio.to_thread(_sync)


async def delete_form(form_id: str) -> None:
    def _sync():
        # Snapshot form metadata onto submissions before deleting
        form_doc = db.collection("forms").document(form_id).get()
        if form_doc.exists:
            form_data = form_doc.to_dict() or {}
            form_name = form_data.get("name", "Formulário")
            client_name = form_data.get("clientName") or form_name
            workspace_id = form_data.get("workspaceId")

            subs = db.collection("submissions").where("formId", "==", form_id).stream()
            for sub in subs:
                update_payload = {
                    "formName": form_name,
                    "clientName": client_name,
                }
                if workspace_id:
                    update_payload["workspaceId"] = workspace_id
                # Snapshot form field definitions so question labels survive deletion
                groups = form_data.get("groups")
                if groups:
                    update_payload["formGroups"] = groups
                sub.reference.update(update_payload)

        db.collection("forms").document(form_id).delete()

    await asyncio.to_thread(_sync)


async def get_submissions(form_id: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("submissions")
            .where("formId", "==", form_id)
            .order_by("submittedAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_submissions_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("submissions")
            .where("workspaceId", "==", workspace_id)
            .order_by("submittedAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def create_submission(data: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        now = fa_firestore.SERVER_TIMESTAMP
        doc_ref = db.collection("submissions").document()
        payload = {**data, "submittedAt": now, "status": data.get("status", "new")}
        doc_ref.set(payload)

        # Increment submissionCount on form (best-effort)
        form_id = data.get("formId")
        if form_id:
            try:
                db.collection("forms").document(form_id).update(
                    {"submissionCount": fa_firestore.Increment(1)}
                )
            except Exception:
                pass

        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def update_submission_status(submission_id: str, status: str) -> None:
    def _sync():
        db.collection("submissions").document(submission_id).update({"status": status})

    await asyncio.to_thread(_sync)


async def update_submission_field(submission_id: str, field: str, value: Any) -> None:
    def _sync():
        db.collection("submissions").document(submission_id).update({field: value})

    await asyncio.to_thread(_sync)


async def get_or_create_user(
    uid: str, email: str, name: Optional[str] = None
) -> Dict[str, Any]:
    def _sync():
        doc_ref = db.collection("users").document(uid)
        doc = doc_ref.get()
        if doc.exists:
            return _doc_to_dict(doc)

        payload = {
            "email": email,
            "name": name or "",
            "createdAt": fa_firestore.SERVER_TIMESTAMP,
        }
        doc_ref.set(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def get_workspace(workspace_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("workspaces").document(workspace_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def get_form_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    def _sync():
        docs = db.collection("forms").where("slug", "==", slug).limit(1).stream()
        for d in docs:
            return _doc_to_dict(d)
        return None

    return await asyncio.to_thread(_sync)


async def get_workspaces_by_owner(owner_uid: str) -> List[Dict[str, Any]]:
    def _sync():
        q = db.collection("workspaces").where("ownerId", "==", owner_uid)
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_workspaces_for_user(uid: str) -> List[Dict[str, Any]]:
    """Return all workspaces the user owns OR is a member of.

    Member workspace IDs are stored in the user's `workspaceIds` array field,
    updated via ArrayUnion/ArrayRemove whenever members are added or removed.
    This avoids the need for a Firestore collection group index.
    """

    def _sync():
        # 1. Workspaces owned by the user
        owned = db.collection("workspaces").where("ownerId", "==", uid).stream()
        workspaces: Dict[str, Any] = {doc.id: _doc_to_dict(doc) for doc in owned}

        # 2. Workspaces stored in the user's workspaceIds array
        user_docs = (
            db.collection("users").where("firebase_uid", "==", uid).limit(1).stream()
        )
        workspace_ids: List[str] = []
        for user_doc in user_docs:
            workspace_ids = (user_doc.to_dict() or {}).get("workspaceIds", [])
            break

        for ws_id in workspace_ids:
            if ws_id not in workspaces:
                ws_doc = db.collection("workspaces").document(ws_id).get()
                if ws_doc.exists:
                    workspaces[ws_id] = _doc_to_dict(ws_doc)

        return list(workspaces.values())

    return await asyncio.to_thread(_sync)


async def create_workspace(data: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        doc_ref = db.collection("workspaces").document()
        payload = {
            "name": data.get("name"),
            "slug": data.get("slug"),
            "ownerId": data.get("ownerId"),
            "plan": data.get("plan", "free"),
            "brandColor": data.get("brandColor"),
            "createdAt": fa_firestore.SERVER_TIMESTAMP,
        }
        doc_ref.set(payload)

        # create owner in members subcollection
        try:
            owner_id = data.get("ownerId")
            member_ref = doc_ref.collection("members").document(owner_id)
            member_ref.set({"role": "owner", "uid": owner_id})
        except Exception:
            pass

        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def update_workspace(
    workspace_id: str, updates: Dict[str, Any]
) -> Dict[str, Any]:
    def _sync():
        doc_ref = db.collection("workspaces").document(workspace_id)
        doc_ref.update(updates)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def get_submission(submission_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("submissions").document(submission_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def get_system_templates(category: Optional[str] = None) -> List[Dict[str, Any]]:
    def _sync():
        q = db.collection("system_templates").order_by("name")
        docs = [_doc_to_dict(d) for d in q.stream()]
        if category:
            docs = [d for d in docs if d.get("category") == category]
        return docs

    return await asyncio.to_thread(_sync)


async def get_system_template(template_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("system_templates").document(template_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def get_templates_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("templates")
            .where("workspaceId", "==", workspace_id)
            .order_by("createdAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_templates_by_owner(owner_uid: str) -> List[Dict[str, Any]]:
    def _sync():
        q = (
            db.collection("templates")
            .where("ownerId", "==", owner_uid)
            .order_by("createdAt", direction=fa_firestore.Query.DESCENDING)
        )
        return [_doc_to_dict(d) for d in q.stream()]

    return await asyncio.to_thread(_sync)


async def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("templates").document(template_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def create_template(data: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        now = fa_firestore.SERVER_TIMESTAMP
        doc_ref = db.collection("templates").document()
        payload = {**data, "createdAt": now, "updatedAt": now}
        doc_ref.set(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def update_template(template_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        payload = {**updates, "updatedAt": fa_firestore.SERVER_TIMESTAMP}
        doc_ref = db.collection("templates").document(template_id)
        doc_ref.update(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def delete_template(template_id: str) -> None:
    def _sync():
        db.collection("templates").document(template_id).delete()

    await asyncio.to_thread(_sync)


# ── Insights ──────────────────────────────────────────────────────────────────


async def create_insight(data: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        doc_ref = db.collection("insights").document()
        payload = {**data, "generatedAt": fa_firestore.SERVER_TIMESTAMP}
        doc_ref.set(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def get_insight_by_submission(submission_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        docs = (
            db.collection("insights")
            .where("submissionId", "==", submission_id)
            .limit(1)
            .stream()
        )
        for d in docs:
            return _doc_to_dict(d)
        return None

    return await asyncio.to_thread(_sync)


async def get_insights_for_submissions(
    submission_ids: List[str],
) -> List[Dict[str, Any]]:
    if not submission_ids:
        return []

    def _sync():
        insights = []
        for i in range(0, len(submission_ids), 10):
            chunk = submission_ids[i : i + 10]
            docs = db.collection("insights").where("submissionId", "in", chunk).stream()
            insights.extend([_doc_to_dict(d) for d in docs])
        return insights

    return await asyncio.to_thread(_sync)


async def get_insight(insight_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("insights").document(insight_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


# ── Workspace Members ──────────────────────────────────────────────────────────


async def get_workspace_members(workspace_id: str) -> List[Dict[str, Any]]:
    from firebase_admin import auth as firebase_auth_admin

    def _sync():
        member_docs = (
            db.collection("workspaces")
            .document(workspace_id)
            .collection("members")
            .stream()
        )
        results = []
        for doc in member_docs:
            uid = doc.id
            role = (doc.to_dict() or {}).get("role", "member")
            # Try users collection first
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                user_data = user_doc.to_dict() or {}
                results.append(
                    {
                        "uid": uid,
                        "role": role,
                        "email": user_data.get("email", ""),
                        "name": user_data.get("display_name") or user_data.get("name", ""),
                        "avatarUrl": user_data.get("photo_url"),
                    }
                )
            else:
                # Fallback to Firebase Auth
                try:
                    fb_user = firebase_auth_admin.get_user(uid)
                    results.append(
                        {
                            "uid": uid,
                            "role": role,
                            "email": fb_user.email or "",
                            "name": fb_user.display_name or "",
                            "avatarUrl": fb_user.photo_url,
                        }
                    )
                except Exception:
                    results.append({"uid": uid, "role": role, "email": "", "name": uid})
        return results

    return await asyncio.to_thread(_sync)


async def add_workspace_member(
    workspace_id: str, uid: str, role: str
) -> Dict[str, Any]:
    def _sync():
        # Add to workspace members subcollection
        doc_ref = (
            db.collection("workspaces")
            .document(workspace_id)
            .collection("members")
            .document(uid)
        )
        doc_ref.set({"role": role, "uid": uid})

        # Also track on the user document so get_workspaces_for_user can find it
        user_docs = (
            db.collection("users").where("firebase_uid", "==", uid).limit(1).stream()
        )
        for user_doc in user_docs:
            user_doc.reference.update(
                {"workspaceIds": fa_firestore.ArrayUnion([workspace_id])}
            )
            break

        return {"uid": uid, "role": role}

    return await asyncio.to_thread(_sync)


async def update_workspace_member_role(workspace_id: str, uid: str, role: str) -> None:
    def _sync():
        db.collection("workspaces").document(workspace_id).collection(
            "members"
        ).document(uid).update({"role": role})

    await asyncio.to_thread(_sync)


async def remove_workspace_member(workspace_id: str, uid: str) -> None:
    def _sync():
        # Remove from workspace members subcollection
        db.collection("workspaces").document(workspace_id).collection(
            "members"
        ).document(uid).delete()

        # Remove from user's workspaceIds array
        user_docs = (
            db.collection("users").where("firebase_uid", "==", uid).limit(1).stream()
        )
        for user_doc in user_docs:
            user_doc.reference.update(
                {"workspaceIds": fa_firestore.ArrayRemove([workspace_id])}
            )
            break

    await asyncio.to_thread(_sync)


# ── Folders ────────────────────────────────────────────────────────────────────


async def get_folders_by_workspace(workspace_id: str) -> List[Dict[str, Any]]:
    def _sync():
        q = db.collection("folders").where("workspaceId", "==", workspace_id)
        docs = [_doc_to_dict(d) for d in q.stream()]
        docs.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
        return docs

    return await asyncio.to_thread(_sync)


async def get_folder(folder_id: str) -> Optional[Dict[str, Any]]:
    def _sync():
        doc = db.collection("folders").document(folder_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def create_folder(data: Dict[str, Any]) -> Dict[str, Any]:
    def _sync():
        doc_ref = db.collection("folders").document()
        payload = {**data, "createdAt": fa_firestore.SERVER_TIMESTAMP}
        doc_ref.set(payload)
        return _doc_to_dict(doc_ref.get())

    return await asyncio.to_thread(_sync)


async def delete_folder(folder_id: str) -> None:
    def _sync():
        db.collection("folders").document(folder_id).delete()

    await asyncio.to_thread(_sync)


# ── Workspace Invites ──────────────────────────────────────────────────────────


async def create_workspace_invite(data: Dict[str, Any]) -> Dict[str, Any]:
    import secrets

    def _sync():
        code = secrets.token_urlsafe(9)  # ~12 chars, URL-safe
        doc_ref = db.collection("workspace_invites").document()
        payload = {
            **data,
            "code": code,
            "useCount": 0,
            "active": True,
            "createdAt": fa_firestore.SERVER_TIMESTAMP,
        }
        doc_ref.set(payload)
        result = _doc_to_dict(doc_ref.get())
        return result

    return await asyncio.to_thread(_sync)


async def get_invite_by_code(code: str) -> Optional[Dict[str, Any]]:
    def _sync():
        docs = (
            db.collection("workspace_invites")
            .where("code", "==", code)
            .where("active", "==", True)
            .limit(1)
            .stream()
        )
        for d in docs:
            return _doc_to_dict(d)
        return None

    return await asyncio.to_thread(_sync)


async def get_workspace_invites(workspace_id: str) -> List[Dict[str, Any]]:
    def _sync():
        docs = (
            db.collection("workspace_invites")
            .where("workspaceId", "==", workspace_id)
            .where("active", "==", True)
            .stream()
        )
        return [_doc_to_dict(d) for d in docs]

    return await asyncio.to_thread(_sync)


async def increment_invite_use(invite_id: str) -> None:
    def _sync():
        db.collection("workspace_invites").document(invite_id).update(
            {"useCount": fa_firestore.Increment(1)}
        )

    await asyncio.to_thread(_sync)


async def revoke_invite(invite_id: str) -> None:
    def _sync():
        db.collection("workspace_invites").document(invite_id).update({"active": False})

    await asyncio.to_thread(_sync)


async def delete_invite(invite_id: str) -> None:
    def _sync():
        db.collection("workspace_invites").document(invite_id).delete()

    await asyncio.to_thread(_sync)


async def get_pending_invites_for_user(uid: str) -> List[Dict[str, Any]]:
    """Return active targeted invites where invitedUid matches the given user."""

    def _sync():
        docs = (
            db.collection("workspace_invites")
            .where("invitedUid", "==", uid)
            .where("active", "==", True)
            .stream()
        )
        return [_doc_to_dict(d) for d in docs]

    return await asyncio.to_thread(_sync)


async def delete_workspace(workspace_id: str) -> None:
    """
    Cascade-delete a workspace and all related data:
    forms, submissions (for those forms), folders, invite links, members subcollection.
    """

    def _sync():
        # 1. Forms + their submissions
        forms = db.collection("forms").where("workspaceId", "==", workspace_id).stream()
        form_ids = []
        for form_doc in forms:
            form_ids.append(form_doc.id)
            form_doc.reference.delete()

        for form_id in form_ids:
            subs = db.collection("submissions").where("formId", "==", form_id).stream()
            for sub in subs:
                sub.reference.delete()

        # 2. Folders
        folders = (
            db.collection("folders").where("workspaceId", "==", workspace_id).stream()
        )
        for folder in folders:
            folder.reference.delete()

        # 3. Invite links
        invites = (
            db.collection("workspace_invites")
            .where("workspaceId", "==", workspace_id)
            .stream()
        )
        for invite in invites:
            invite.reference.delete()

        # 4. Members subcollection + clean up workspaceIds on each user doc
        ws_ref = db.collection("workspaces").document(workspace_id)
        member_uids: List[str] = []
        for member in ws_ref.collection("members").stream():
            member_uids.append(member.id)
            member.reference.delete()

        for member_uid in member_uids:
            user_docs = (
                db.collection("users")
                .where("firebase_uid", "==", member_uid)
                .limit(1)
                .stream()
            )
            for user_doc in user_docs:
                user_doc.reference.update(
                    {"workspaceIds": fa_firestore.ArrayRemove([workspace_id])}
                )
                break

        # 5. Workspace document
        ws_ref.delete()

    await asyncio.to_thread(_sync)


# ── Billing ────────────────────────────────────────────────────────────────────


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a user doc by Firestore document ID (UUID)."""
    def _sync():
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)

    return await asyncio.to_thread(_sync)


async def update_user_billing(user_id: str, data: Dict[str, Any]) -> None:
    """Patch billing fields on a user document identified by its Firestore doc ID."""
    def _sync():
        db.collection("users").document(user_id).update(data)

    await asyncio.to_thread(_sync)


async def get_user_by_firebase_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    """Fetch a user doc by firebase_uid field."""
    def _sync():
        docs = (
            db.collection("users")
            .where("firebase_uid", "==", firebase_uid)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _doc_to_dict(doc)
        return None

    return await asyncio.to_thread(_sync)


async def get_user_by_stripe_customer(customer_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a user doc by stripe_customer_id field."""
    def _sync():
        docs = (
            db.collection("users")
            .where("stripe_customer_id", "==", customer_id)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _doc_to_dict(doc)
        return None

    return await asyncio.to_thread(_sync)


async def get_user_by_stripe_subscription(subscription_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a user doc by stripe_subscription_id field."""
    def _sync():
        docs = (
            db.collection("users")
            .where("stripe_subscription_id", "==", subscription_id)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _doc_to_dict(doc)
        return None

    return await asyncio.to_thread(_sync)


# ── Plan limit counting helpers ────────────────────────────────────────────────


async def count_workspace_members(workspace_id: str) -> int:
    """Count documents in the workspace members subcollection."""
    def _sync():
        members = (
            db.collection("workspaces")
            .document(workspace_id)
            .collection("members")
            .stream()
        )
        return sum(1 for _ in members)

    return await asyncio.to_thread(_sync)


async def count_monthly_submissions(workspace_id: str) -> int:
    """Count submissions for a workspace in the current calendar month."""
    def _sync():
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        q = (
            db.collection("submissions")
            .where("workspaceId", "==", workspace_id)
            .where("submittedAt", ">=", start_of_month)
        )
        return sum(1 for _ in q.stream())

    return await asyncio.to_thread(_sync)


# ── LGPD Data Export ───────────────────────────────────────────────────────────


async def export_user_data(firebase_uid: str) -> Dict[str, Any]:
    """Collect all personal data stored for a user (LGPD Art. 18, II).

    Returns a dict with: profile, workspaces, forms, submissions, templates.
    Sensitive internal fields (fingerprint, stripe IDs, token blacklist) are
    intentionally excluded — they are not personal data under LGPD scope.
    """

    def _sync() -> Dict[str, Any]:
        # ── 1. Profile ─────────────────────────────────────────────────────────
        user_docs = (
            db.collection("users")
            .where("firebase_uid", "==", firebase_uid)
            .limit(1)
            .stream()
        )
        profile: Dict[str, Any] = {}
        user_doc_id: str = ""
        for doc in user_docs:
            data = doc.to_dict() or {}
            user_doc_id = doc.id
            profile = {
                "id": doc.id,
                "email": data.get("email"),
                "display_name": data.get("display_name"),
                "photo_url": data.get("photo_url"),
                "created_at": str(data.get("created_at", "")),
                "plan": data.get("plan"),
                "subscription_status": data.get("subscription_status"),
                "trial_end": str(data.get("trial_end", "")) if data.get("trial_end") else None,
                "current_period_end": str(data.get("current_period_end", "")) if data.get("current_period_end") else None,
                "email_notifications": data.get("email_notifications"),
                "language": data.get("language"),
            }
            break

        if not profile:
            return {}

        # ── 2. Workspaces (owned + member) ────────────────────────────────────
        ws_docs = (
            db.collection("workspaces").where("ownerId", "==", firebase_uid).stream()
        )
        workspace_ids: List[str] = []
        workspaces: List[Dict[str, Any]] = []
        for doc in ws_docs:
            data = doc.to_dict() or {}
            workspace_ids.append(doc.id)
            workspaces.append(
                {
                    "id": doc.id,
                    "name": data.get("name"),
                    "slug": data.get("slug"),
                    "plan": data.get("plan"),
                    "role": "owner",
                    "created_at": str(data.get("createdAt", "")),
                }
            )

        # Workspaces where user is a member (not owner)
        member_ws_ids: List[str] = []
        for user_doc in db.collection("users").where("firebase_uid", "==", firebase_uid).limit(1).stream():
            member_ws_ids = (user_doc.to_dict() or {}).get("workspaceIds", [])
            break
        for ws_id in member_ws_ids:
            if ws_id in workspace_ids:
                continue
            ws_doc = db.collection("workspaces").document(ws_id).get()
            if not ws_doc.exists:
                continue
            ws_data = ws_doc.to_dict() or {}
            # Get user's role from members subcollection
            member_doc = ws_doc.reference.collection("members").document(firebase_uid).get()
            role = (member_doc.to_dict() or {}).get("role", "member") if member_doc.exists else "member"
            workspaces.append(
                {
                    "id": ws_id,
                    "name": ws_data.get("name"),
                    "slug": ws_data.get("slug"),
                    "plan": ws_data.get("plan"),
                    "role": role,
                    "created_at": str(ws_data.get("createdAt", "")),
                }
            )

        # ── 3. Forms ───────────────────────────────────────────────────────────
        form_ids: List[str] = []
        forms: List[Dict[str, Any]] = []
        for ws_id in workspace_ids:
            form_docs = (
                db.collection("forms").where("workspaceId", "==", ws_id).stream()
            )
            for doc in form_docs:
                data = doc.to_dict() or {}
                form_ids.append(doc.id)
                forms.append(
                    {
                        "id": doc.id,
                        "name": data.get("name"),
                        "client_name": data.get("clientName"),
                        "status": data.get("status"),
                        "slug": data.get("slug"),
                        "workspace_id": data.get("workspaceId"),
                        "created_at": str(data.get("createdAt", "")),
                        "updated_at": str(data.get("updatedAt", "")),
                        "submission_count": data.get("submissionCount", 0),
                    }
                )

        # ── 4. Submissions ─────────────────────────────────────────────────────
        submissions: List[Dict[str, Any]] = []
        for i in range(0, len(form_ids), 10):
            chunk = form_ids[i : i + 10]
            sub_docs = (
                db.collection("submissions").where("formId", "in", chunk).stream()
            )
            for doc in sub_docs:
                data = doc.to_dict() or {}
                submissions.append(
                    {
                        "id": doc.id,
                        "form_id": data.get("formId"),
                        "form_name": data.get("formName"),
                        "workspace_id": data.get("workspaceId"),
                        "status": data.get("status"),
                        "submitted_at": str(data.get("submittedAt", "")),
                        "answers": data.get("answers", []),
                    }
                )

        # ── 5. Templates ───────────────────────────────────────────────────────
        template_docs = (
            db.collection("templates").where("ownerId", "==", firebase_uid).stream()
        )
        templates: List[Dict[str, Any]] = []
        for doc in template_docs:
            data = doc.to_dict() or {}
            templates.append(
                {
                    "id": doc.id,
                    "name": data.get("name"),
                    "workspace_id": data.get("workspaceId"),
                    "created_at": str(data.get("createdAt", "")),
                }
            )

        return {
            "exported_at": str(datetime.now(timezone.utc)),
            "profile": profile,
            "workspaces": workspaces,
            "forms": forms,
            "submissions": submissions,
            "templates": templates,
        }

    return await asyncio.to_thread(_sync)


# ── Cleanup ────────────────────────────────────────────────────────────────────


async def cleanup_inactive_draft_forms(
    max_age_days: int = 7,
    workspace_ids: Optional[List[str]] = None,
) -> int:
    """Delete draft forms not updated in `max_age_days` days.

    If `workspace_ids` is provided, only drafts belonging to those workspaces
    are considered (used by the HTTP endpoint to scope to the user's workspaces).
    When called without `workspace_ids` (background loop), cleans globally.

    Uses the existing `delete_form` which snapshots metadata onto submissions.
    Returns the count of deleted forms.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

    def _get_stale_ids() -> List[str]:
        q = (
            db.collection("forms")
            .where("status", "==", "draft")
            .where("updatedAt", "<", cutoff)
        )
        stale = []
        for doc in q.stream():
            if workspace_ids is not None:
                doc_ws = (doc.to_dict() or {}).get("workspaceId")
                if doc_ws not in workspace_ids:
                    continue
            stale.append(doc.id)
        return stale

    stale_ids = await asyncio.to_thread(_get_stale_ids)

    for form_id in stale_ids:
        await delete_form(form_id)

    return len(stale_ids)
