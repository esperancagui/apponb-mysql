from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, field_validator


class SubmissionCreate(BaseModel):
    formId: str
    data: Dict[str, Any]
    files: Optional[Dict[str, List[str]]] = None
    workspaceId: Optional[str] = None


class SubmissionOut(BaseModel):
    id: str
    formId: str
    workspaceId: Optional[str] = None
    data: Dict[str, Any]
    files: Optional[Dict[str, List[str]]] = None
    submittedAt: Optional[datetime] = None
    status: Optional[str] = "new"
    aiRisk: Optional[str] = None  # "low" | "medium" | "high"
    aiAnalysisStatus: Optional[str] = None  # "pending" | "processing" | "done" | "failed"
    vip: Optional[bool] = False
    # Display fields enriched by inbox route
    formName: Optional[str] = None
    clientName: Optional[str] = None
    summary: Optional[str] = None
    attachments: Optional[int] = 0
    attachmentsOk: Optional[int] = 0
    formGroups: Optional[List[Dict[str, Any]]] = None

    @field_validator("files", mode="before")
    @classmethod
    def coerce_files_to_lists(cls, v):
        """Coerce legacy string values (old CSV format) to single-element lists."""
        if not isinstance(v, dict):
            return v
        return {k: [val] if isinstance(val, str) else val for k, val in v.items()}

    class Config:
        populate_by_name = True


class SubmissionStatusUpdate(BaseModel):
    status: str
