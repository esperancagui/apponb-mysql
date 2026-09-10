"""
Plan-based feature limits.

Plans:
  - "free"    → trial expired, blocked from most actions
  - "basic"   → Pro plan (R$ 59,90/mês) or active trial
  - "premium" → Agency plan (R$ 149,90/mês)

The 15-day trial gives full "basic" (Pro) access via Stripe trialing status.
When the trial expires without payment, Stripe sets the plan back to "free".
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from app.services import db as firestore_db


# ── Limit definitions ─────────────────────────────────────────────────────────

PLAN_LIMITS: Dict[str, Dict[str, Optional[int]]] = {
    "free": {
        "workspaces": 0,
        "members_per_workspace": 0,
        "responses_per_month": 0,
    },
    "basic": {
        "workspaces": 3,
        "members_per_workspace": 5,
        "responses_per_month": 2_000,
    },
    "premium": {
        "workspaces": None,       # Unlimited
        "members_per_workspace": None,
        "responses_per_month": None,
    },
}


def get_plan_limits(plan: str) -> Dict[str, Optional[int]]:
    """Return the limits dict for a given plan, defaulting to free."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


# ── Resolution helpers ────────────────────────────────────────────────────────

def _resolve_effective_plan(user: Optional[Dict[str, Any]]) -> str:
    """Determine the effective plan for a user, considering trial status.

    New users are created with plan="free" + subscription_status="trialing".
    While the trial is active, they should have "basic" (Pro) access.
    """
    if not user:
        return "free"

    plan = user.get("plan", "free")

    # If user already has a paid plan, use it directly
    if plan in ("basic", "premium"):
        return plan

    # Check for active trial: subscription_status == "trialing" and trial not expired
    subscription_status = user.get("subscription_status", "")
    if subscription_status == "trialing":
        trial_end = user.get("trial_end")
        if trial_end is not None:
            # Handle both datetime objects and Firestore timestamps
            if hasattr(trial_end, "timestamp"):
                # Firestore DatetimeWithNanoseconds or Python datetime
                try:
                    if trial_end.tzinfo is None:
                        trial_end_aware = trial_end.replace(tzinfo=timezone.utc)
                    else:
                        trial_end_aware = trial_end
                    if trial_end_aware > datetime.now(timezone.utc):
                        return "basic"  # Trial is still active → Pro access
                except Exception:
                    return "basic"  # If we can't parse, err on the side of access
            else:
                # Unknown format — assume trial is valid
                return "basic"
        else:
            # trialing status but no trial_end → assume trial is active
            return "basic"

    return plan


async def get_owner_plan(firebase_uid: str) -> str:
    """Resolve the effective plan of a user by their Firebase UID."""
    try:
        user = await firestore_db.get_user_by_firebase_uid(firebase_uid)
        return _resolve_effective_plan(user)
    except Exception:
        return "free"


async def get_workspace_owner_plan(workspace_id: str) -> str:
    """Resolve the effective plan of the workspace owner."""
    try:
        workspace = await firestore_db.get_workspace(workspace_id)
        if not workspace:
            return "free"
        owner_uid = workspace.get("ownerId", "")
        if not owner_uid:
            return "free"
        user = await firestore_db.get_user_by_firebase_uid(owner_uid)
        return _resolve_effective_plan(user)
    except Exception:
        return "free"


# ── Enforcement helpers ───────────────────────────────────────────────────────

async def check_workspace_limit(firebase_uid: str) -> None:
    """Raise 403 if the user has reached their workspace creation limit."""
    plan = await get_owner_plan(firebase_uid)
    limits = get_plan_limits(plan)
    max_ws = limits["workspaces"]

    if max_ws == 0:
        raise HTTPException(
            status_code=403,
            detail="Seu plano expirou. Faça upgrade para criar workspaces.",
        )

    if max_ws is None:
        return  # unlimited

    owned = await firestore_db.get_workspaces_by_owner(firebase_uid)
    if len(owned) >= max_ws:
        raise HTTPException(
            status_code=403,
            detail=f"Limite de {max_ws} workspace(s) atingido. Faça upgrade para criar mais.",
        )


async def check_member_limit(workspace_id: str) -> None:
    """Raise 403 if the workspace has reached its member limit."""
    plan = await get_workspace_owner_plan(workspace_id)
    limits = get_plan_limits(plan)
    max_members = limits["members_per_workspace"]

    if max_members == 0:
        raise HTTPException(
            status_code=403,
            detail="Seu plano expirou. Faça upgrade para convidar membros.",
        )

    if max_members is None:
        return  # unlimited

    current_count = await firestore_db.count_workspace_members(workspace_id)
    if current_count >= max_members:
        raise HTTPException(
            status_code=403,
            detail=f"Limite de {max_members} membro(s) atingido. Faça upgrade para adicionar mais.",
        )


async def check_response_limit(workspace_id: str) -> None:
    """Raise 403 if the workspace has reached its monthly response limit."""
    plan = await get_workspace_owner_plan(workspace_id)
    limits = get_plan_limits(plan)
    max_responses = limits["responses_per_month"]

    if max_responses == 0:
        raise HTTPException(
            status_code=403,
            detail="Seu plano expirou. Faça upgrade para receber respostas.",
        )

    if max_responses is None:
        return  # unlimited

    monthly_count = await firestore_db.count_monthly_submissions(workspace_id)
    if monthly_count >= max_responses:
        raise HTTPException(
            status_code=403,
            detail=f"Limite de {max_responses} respostas/mês atingido. Faça upgrade para receber mais.",
        )
