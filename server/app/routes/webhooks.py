import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.services import firestore_db
from app.services import stripe_service

router = APIRouter()

WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

PRICE_TO_PLAN = {
    os.getenv("STRIPE_PRICE_BASIC", ""): "basic",
    os.getenv("STRIPE_PRICE_PREMIUM", ""): "premium",
}


def _ts(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except Exception:
        return None


def _plan_from_sub(sub: Any) -> str:
    try:
        price_id = sub["items"]["data"][0]["price"]["id"]
        return PRICE_TO_PLAN.get(price_id, "free")
    except Exception:
        return "free"


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    payload = await request.body()

    try:
        event = stripe_service.construct_webhook_event(payload, stripe_signature, WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook inválido: {e}")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        if not customer_id or not subscription_id:
            return {"ok": True}

        user = await firestore_db.get_user_by_stripe_customer(customer_id)
        if not user:
            return {"ok": True}

        # Fetch subscription to determine plan
        try:
            sub = stripe_service.get_subscription(subscription_id)
            plan = _plan_from_sub(sub)
            status = sub.get("status", "trialing")
            period_end = _ts(sub.get("current_period_end"))
            trial_end = _ts(sub.get("trial_end"))
        except Exception:
            plan = "free"
            status = "trialing"
            period_end = None
            trial_end = None

        await firestore_db.update_user_billing(
            user["id"],
            {
                "stripe_subscription_id": subscription_id,
                "plan": plan,
                "subscription_status": status,
                "current_period_end": period_end,
                "trial_end": trial_end,
            },
        )

    elif event_type == "customer.subscription.updated":
        sub = data
        customer_id = sub.get("customer")
        subscription_id = sub.get("id")

        user = await firestore_db.get_user_by_stripe_customer(customer_id)
        if not user:
            return {"ok": True}

        plan = _plan_from_sub(sub)
        status = sub.get("status", "active")
        period_end = _ts(sub.get("current_period_end"))
        trial_end = _ts(sub.get("trial_end"))

        await firestore_db.update_user_billing(
            user["id"],
            {
                "stripe_subscription_id": subscription_id,
                "plan": plan,
                "subscription_status": status,
                "current_period_end": period_end,
                "trial_end": trial_end,
            },
        )

        if status in ("past_due", "canceled", "unpaid"):
            firebase_uid = user.get("firebase_uid", "")
            if firebase_uid:
                await firestore_db.deactivate_active_forms_by_owner(firebase_uid)

    elif event_type == "customer.subscription.deleted":
        sub = data
        customer_id = sub.get("customer")

        user = await firestore_db.get_user_by_stripe_customer(customer_id)
        if not user:
            return {"ok": True}

        await firestore_db.update_user_billing(
            user["id"],
            {
                "plan": "free",
                "subscription_status": "canceled",
                "stripe_subscription_id": None,
                "current_period_end": None,
                "trial_end": None,
            },
        )

        firebase_uid = user.get("firebase_uid", "")
        if firebase_uid:
            await firestore_db.deactivate_active_forms_by_owner(firebase_uid)

    elif event_type == "invoice.payment_succeeded":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")

        user = await firestore_db.get_user_by_stripe_customer(customer_id)
        if not user:
            return {"ok": True}

        updates: dict = {"subscription_status": "active"}
        if subscription_id:
            try:
                sub = stripe_service.get_subscription(subscription_id)
                period_end = _ts(sub.get("current_period_end"))
                if period_end:
                    updates["current_period_end"] = period_end
            except Exception:
                pass

        await firestore_db.update_user_billing(user["id"], updates)

    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")

        user = await firestore_db.get_user_by_stripe_customer(customer_id)
        if not user:
            return {"ok": True}

        await firestore_db.update_user_billing(
            user["id"], {"subscription_status": "past_due"}
        )

        firebase_uid = user.get("firebase_uid", "")
        if firebase_uid:
            await firestore_db.deactivate_active_forms_by_owner(firebase_uid)

    return {"ok": True}
