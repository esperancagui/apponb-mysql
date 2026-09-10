import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import firestore_db
from app.services import stripe_service

router = APIRouter()

PRICE_MAP = {
    "basic": os.getenv("STRIPE_PRICE_BASIC", ""),
    "premium": os.getenv("STRIPE_PRICE_PREMIUM", ""),
}

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


def _ts_to_dt(ts: Any) -> Optional[datetime]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except Exception:
        return None


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(current_user: dict = Depends(get_current_user)):
    user = await firestore_db.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    plan = user.get("plan", "free")
    status = user.get("subscription_status")
    trial_end = _ts_to_dt(user.get("trial_end"))
    period_end = _ts_to_dt(user.get("current_period_end"))

    next_amount = None
    next_currency = None
    sub_id = user.get("stripe_subscription_id")
    if sub_id:
        try:
            sub = stripe_service.get_subscription(sub_id)
            upcoming = sub.get("latest_invoice") if isinstance(sub, dict) else None
        except Exception:
            pass

    return SubscriptionResponse(
        plan=plan,
        subscription_status=status,
        trial_end=trial_end,
        current_period_end=period_end,
        next_invoice_amount=next_amount,
        next_invoice_currency=next_currency,
    )


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    price_id = PRICE_MAP.get(body.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Plano inválido.")

    user = await firestore_db.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    email = user.get("email", "")
    name = user.get("display_name") or ""
    customer_id = user.get("stripe_customer_id")

    if not customer_id:
        try:
            customer = stripe_service.get_or_create_customer(current_user["id"], email, name)
            customer_id = customer["id"]
            await firestore_db.update_user_billing(
                current_user["id"], {"stripe_customer_id": customer_id}
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erro ao criar cliente Stripe: {e}")

    success_url = f"{FRONTEND_URL}/dashboard/profile?section=plano&upgraded=1"
    cancel_url = f"{FRONTEND_URL}/dashboard/profile?section=plano"

    try:
        url = stripe_service.create_checkout_session(
            customer_id=customer_id,
            price_id=price_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar sessão de checkout: {e}")

    return {"url": url}


@router.post("/portal")
async def create_portal(current_user: dict = Depends(get_current_user)):
    user = await firestore_db.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="Nenhuma assinatura encontrada.")

    return_url = f"{FRONTEND_URL}/dashboard/profile?section=plano"
    try:
        url = stripe_service.create_portal_session(customer_id, return_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao abrir portal: {e}")

    return {"url": url}


@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(current_user: dict = Depends(get_current_user)):
    user = await firestore_db.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        return []

    try:
        invoices = stripe_service.list_invoices(customer_id, limit=20)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar faturas: {e}")

    return invoices
