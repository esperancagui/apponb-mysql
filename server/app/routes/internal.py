"""
Internal routes — called by the ARQ worker only, not exposed in public Swagger docs.
Protected by X-Internal-Secret header.
"""

import os
import logging
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.sockets import broadcaster

logger = logging.getLogger(__name__)

router = APIRouter()


class InsightCompletedPayload(BaseModel):
    workspaceId: str
    submissionId: str
    insightId: str
    aiRisk: str = "low"
    clientName: str = ""


@router.post(
    "/emit/insight-completed",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
)
async def emit_insight_completed(
    payload: InsightCompletedPayload,
    x_internal_secret: str = Header(default=""),
):
    expected = os.getenv("INTERNAL_SECRET", "")
    if not expected or x_internal_secret != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        await broadcaster.emit_insight_completed(
            workspace_id=payload.workspaceId,
            submission_id=payload.submissionId,
            insight_id=payload.insightId,
            ai_risk=payload.aiRisk,
            client_name=payload.clientName,
        )
    except Exception:
        logger.warning(
            "emit_insight_completed broadcaster failed for submission %s", payload.submissionId
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
