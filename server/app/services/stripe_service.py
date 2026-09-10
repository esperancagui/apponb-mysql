import os
from typing import Any, Dict, List, Optional

import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


def get_or_create_customer(user_id: str, email: str, name: Optional[str] = None) -> Dict[str, Any]:
    """Return existing Stripe customer or create a new one. Attaches user_id as metadata."""
    existing = stripe.Customer.search(query=f'metadata["user_id"]:"{user_id}"', limit=1)
    if existing.data:
        return existing.data[0]

    customer = stripe.Customer.create(
        email=email,
        name=name or "",
        metadata={"user_id": user_id},
    )
    return customer  # type: ignore[return-value]


def create_checkout_session(
    customer_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout session and return its URL.

    No trial_period_days — the free trial is managed server-side (no card required).
    Users upgrade here only after deciding to subscribe.
    """
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        payment_method_types=["card", "boleto"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return session.url  # type: ignore[return-value]


def create_portal_session(customer_id: str, return_url: str) -> str:
    """Create a Stripe Customer Portal session and return its URL."""
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url  # type: ignore[return-value]


def get_subscription(subscription_id: str) -> Dict[str, Any]:
    """Fetch a subscription object from Stripe."""
    return stripe.Subscription.retrieve(subscription_id)  # type: ignore[return-value]


def list_invoices(customer_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Return a list of invoices for a customer."""
    invoices = stripe.Invoice.list(customer=customer_id, limit=limit)
    return [
        {
            "id": inv.id,
            "date": inv.created,
            "amount": inv.amount_paid,
            "currency": inv.currency,
            "status": inv.status,
            "pdf_url": inv.invoice_pdf,
            "description": inv.lines.data[0].description if inv.lines.data else None,
        }
        for inv in invoices.data
    ]


def construct_webhook_event(payload: bytes, sig_header: str, secret: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, secret)
