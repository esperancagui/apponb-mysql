"""
Billing — Stripe removed for this test port. Same four endpoints, same
contracts (`billingService.ts` on the client is untouched), backed by a
plan column update instead of a real checkout.
# ponytail: fake checkout, wire real Stripe back in if this ever needs to take money.
"""

import os
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import db

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", os.getenv("NEXT_PUBLIC_FRONTEND_URL", "http://localhost:3000"))


class CheckoutRequest(BaseModel):
    plan: str  # "basic" | "premium"


class SubscriptionResponse(BaseModel):
    plan: str
    subscription_status: Optional[str] = None
    trial_end: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    next_invoice_amount: Optional[int] = None
    next_invoice_currency: Optional[str] = None


class InvoiceOut(BaseModel):
    id: str
    date: int
    amount: int
    currency: str
    status: Optional[str] = None
    pdf_url: Optional[str] = None
    description: Optional[str] = None


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(current_user: dict = Depends(get_current_user)):
    user = await db.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return SubscriptionResponse(
        plan=user.get("plan", "free"),
        subscription_status=user.get("subscription_status"),
        trial_end=user.get("trial_end"),
        current_period_end=user.get("current_period_end"),
    )


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Dev-mode checkout: sets the plan directly instead of talking to Stripe."""
    if body.plan not in ("basic", "premium"):
        raise HTTPException(status_code=400, detail="Plano inválido.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.update_user_billing(
        current_user["id"],
        {
            "plan": body.plan,
            "subscription_status": "active",
            "current_period_end": now.replace(year=now.year + 1),
        },
    )
    return {"url": f"{FRONTEND_URL}/dashboard/profile?section=plano&upgraded=1"}


@router.post("/portal")
async def create_portal(current_user: dict = Depends(get_current_user)):
    return {"url": f"{FRONTEND_URL}/dashboard/profile?section=plano"}


@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(current_user: dict = Depends(get_current_user)):
    return []
