import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.core.firebase import db, firebase_auth

TRIAL_DAYS = 15


def create_user(
    firebase_uid: str,
    email: str,
    display_name: Optional[str] = None,
    fingerprint: Optional[str] = None,
) -> dict:
    """Create a user document in Firestore with a UUID as the document ID.

    New users automatically receive a free trial (no card required).
    After TRIAL_DAYS they are prompted to subscribe.
    """
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    
    clean_email = email.lower().strip()
    
    user_data = {
        "firebase_uid": firebase_uid,
        "email": clean_email,
        "display_name": display_name,
        "created_at": now,
        # Billing — trial starts immediately, no card required
        "plan": "free",
        "subscription_status": "trialing",
        "trial_end": trial_end,
    }
    db.collection("users").document(user_id).set(user_data)

    # Store browser fingerprint to prevent trial abuse
    if fingerprint:
        store_trial_fingerprint(fingerprint, firebase_uid)

    return {"id": user_id, **user_data}


def check_fingerprint_used(fingerprint: str) -> bool:
    """Check if a browser fingerprint has already been used for a trial."""
    if not fingerprint:
        return False
    docs = (
        db.collection("trial_fingerprints")
        .where("fingerprint", "==", fingerprint)
        .limit(1)
        .stream()
    )
    for _ in docs:
        return True
    return False


def store_trial_fingerprint(fingerprint: str, firebase_uid: str) -> None:
    """Store a browser fingerprint after successful trial registration."""
    if not fingerprint:
        return
    db.collection("trial_fingerprints").document().set(
        {
            "fingerprint": fingerprint,
            "firebase_uid": firebase_uid,
            "created_at": datetime.now(timezone.utc),
        }
    )


_BILLING_FIELDS = (
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_status",
    "plan",
    "current_period_end",
    "trial_end",
)


def get_user_by_firebase_uid(firebase_uid: str) -> Optional[dict]:
    """Fetch a user document from Firestore by Firebase UID (includes billing fields)."""
    docs = (
        db.collection("users")
        .where("firebase_uid", "==", firebase_uid)
        .limit(1)
        .stream()
    )
    for doc in docs:
        data = doc.to_dict()
        return {"id": doc.id, **data}
    return None


def blacklist_token(jti: str, expires_at: datetime) -> None:
    """Add a token JTI to the blacklist collection."""
    db.collection("token_blacklist").document(jti).set({"expires_at": expires_at})


def is_token_blacklisted(jti: str) -> bool:
    """Check whether a token JTI is in the blacklist."""
    doc = db.collection("token_blacklist").document(jti).get()
    return doc.exists


def cleanup_expired_tokens() -> int:
    """Remove expired tokens from the blacklist. Returns the count of deleted tokens."""
    now = datetime.now(timezone.utc)
    docs = db.collection("token_blacklist").where("expires_at", "<", now).stream()

    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1

    return deleted


def update_user_profile(
    firebase_uid: str,
    display_name: Optional[str],
    photo_url: Optional[str],
) -> dict:
    """Updates Firebase Auth profile and Firestore user document. Returns the updated user dict."""
    firebase_kwargs = {}
    if display_name is not None:
        firebase_kwargs["display_name"] = display_name
    if photo_url is not None:
        firebase_kwargs["photo_url"] = photo_url

    if firebase_kwargs:
        firebase_auth.update_user(firebase_uid, **firebase_kwargs)

    firestore_updates = {}
    if display_name is not None:
        firestore_updates["display_name"] = display_name
    if photo_url is not None:
        firestore_updates["photo_url"] = photo_url

    if firestore_updates:
        docs = (
            db.collection("users")
            .where("firebase_uid", "==", firebase_uid)
            .limit(1)
            .stream()
        )
        for doc in docs:
            db.collection("users").document(doc.id).update(firestore_updates)
            data = doc.to_dict()
            data.update(firestore_updates)
            return {"id": doc.id, **data}

    return get_user_by_firebase_uid(firebase_uid)


def update_user_preferences(
    firebase_uid: str,
    email_notifications: Optional[bool],
    language: Optional[str],
) -> dict:
    """Updates user notification and language preferences in Firestore."""
    updates = {}
    if email_notifications is not None:
        updates["email_notifications"] = email_notifications
    if language is not None:
        updates["language"] = language

    if updates:
        docs = (
            db.collection("users")
            .where("firebase_uid", "==", firebase_uid)
            .limit(1)
            .stream()
        )
        for doc in docs:
            db.collection("users").document(doc.id).update(updates)
            data = doc.to_dict()
            data.update(updates)
            return {
                "email_notifications": data.get("email_notifications", True),
                "language": data.get("language", "pt-BR"),
            }

    user = get_user_by_firebase_uid(firebase_uid)
    if not user:
        return {"email_notifications": True, "language": "pt-BR"}
    return {
        "email_notifications": user.get("email_notifications", True),
        "language": user.get("language", "pt-BR"),
    }


def pause_account(firebase_uid: str) -> None:
    """Disables the Firebase user account (pauses it)."""
    firebase_auth.update_user(firebase_uid, disabled=True)


def reactivate_account(email: str) -> None:
    """Re-enables a disabled Firebase user account by email.

    Raises ValueError if the email is not registered.
    Does nothing if the account is already active.
    """
    try:
        user = firebase_auth.get_user_by_email(email)
    except Exception:
        raise ValueError("Email não encontrado.")

    if user.disabled:
        firebase_auth.update_user(user.uid, disabled=False)


def delete_account(firebase_uid: str) -> None:
    """Deletes the user: remove do Firebase Auth e marca o doc do Firestore como deletado.

    O documento Firestore é mantido com `deleted: True` para detectar abuso de trial
    quando o mesmo e-mail tentar se registrar novamente. O firebase_uid é ofuscado
    para impedir qualquer reutilização.
    """
    # Disable the Firebase Auth account (stops login)
    try:
        firebase_auth.delete_user(firebase_uid)
    except Exception:
        pass  # May already be deleted from Firebase Auth

    # Soft-delete in Firestore
    docs = (
        db.collection("users")
        .where("firebase_uid", "==", firebase_uid)
        .limit(1)
        .stream()
    )
    now = datetime.now(timezone.utc)
    for doc in docs:
        db.collection("users").document(doc.id).update(
            {
                "deleted": True,
                "deleted_at": now,
                # Clear personal data but keep email for abuse detection
                "display_name": None,
                "photo_url": None,
                "firebase_uid": f"deleted_{firebase_uid}",
            }
        )


def check_email_previously_used(email: str) -> bool:
    """Check if an email was used before by a soft-deleted account."""
    clean_email = email.lower().strip()
    docs = (
        db.collection("users")
        .where("email", "==", clean_email)
        .where("deleted", "==", True)
        .limit(1)
        .stream()
    )
    for _ in docs:
        return True
    return False
