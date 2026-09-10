"""
MinIO (S3-compatible) storage — replaces the client-side Firebase Cloud
Storage uploads. Files now go through the API instead of straight from the
browser to the bucket, since there's no Firebase Storage security-rules
layer to lean on anymore.

Bucket layout mirrors the old Firebase Storage paths so the URL-parsing code
in submission.py / gemini_service.py keeps working unchanged:
  workspaces/{workspaceId}/branding/{logo|hero}/{timestamp}_{name}
  avatars/{uid}/{timestamp}_{name}
  submissions/{formId}/{fieldId}/{timestamp}_{name}
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Optional

import boto3
from botocore.client import Config

BUCKET = os.getenv("S3_BUCKET", "onb")
ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
PUBLIC_URL_BASE = os.getenv("S3_PUBLIC_URL", ENDPOINT).rstrip("/")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=ENDPOINT,
            aws_access_key_id=os.getenv("S3_ACCESS_KEY", "minioadmin"),
            aws_secret_access_key=os.getenv("S3_SECRET_KEY", "minioadmin"),
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _client


def _safe_name(filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", filename or "file")


def _key_for(prefix: str, filename: str) -> str:
    return f"{prefix}/{int(time.time() * 1000)}_{_safe_name(filename)}"


async def upload_bytes(key: str, content: bytes, content_type: str) -> str:
    """Uploads to MinIO and returns the public URL. Runs in a thread since
    boto3's S3 client is sync."""
    def _sync():
        _get_client().put_object(
            Bucket=BUCKET, Key=key, Body=content, ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )

    await asyncio.to_thread(_sync)
    return f"{PUBLIC_URL_BASE}/{BUCKET}/{key}"


async def upload_branding_image(content: bytes, content_type: str, workspace_id: str, kind: str, filename: str) -> str:
    key = _key_for(f"workspaces/{workspace_id}/branding/{kind}", filename)
    return await upload_bytes(key, content, content_type)


async def upload_avatar_image(content: bytes, content_type: str, uid: str, filename: str) -> str:
    key = _key_for(f"avatars/{uid}", filename)
    return await upload_bytes(key, content, content_type)


async def upload_submission_file(content: bytes, content_type: str, form_id: str, field_id: str, filename: str) -> str:
    key = _key_for(f"submissions/{form_id}/{field_id}", filename)
    return await upload_bytes(key, content, content_type)


def is_upload_url(url: Optional[str]) -> bool:
    """Replaces the old `startsWith("https://firebasestorage")` host sniff."""
    if not url:
        return False
    return url.startswith(PUBLIC_URL_BASE) or "/onb/" in url


async def delete_by_url(url: str) -> None:
    if not is_upload_url(url):
        return
    key = url.split(f"/{BUCKET}/", 1)[-1].split("?")[0]
    if not key or key == url:
        return

    def _sync():
        try:
            _get_client().delete_object(Bucket=BUCKET, Key=key)
        except Exception:
            pass

    await asyncio.to_thread(_sync)


def ensure_bucket() -> None:
    """Idempotent bucket + public-read policy setup, called once at API startup
    (mirrors what storage.rules used to declare)."""
    client = _get_client()
    try:
        client.head_bucket(Bucket=BUCKET)
    except Exception:
        client.create_bucket(Bucket=BUCKET)

    import json
    policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{BUCKET}/*",
        }],
    }
    try:
        client.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps(policy))
    except Exception:
        pass
