from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BrandingConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    primaryColor: Optional[str] = None
    logoUrl: Optional[str] = None


class FieldSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    label: str
    type: str
    required: bool = False
    options: Optional[List[str]] = None
    meta: Optional[Dict[str, Any]] = None


class FieldGroup(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: Optional[str] = None
    fields: List[FieldSchema] = []


class FormBase(BaseModel):
    name: str
    slug: Optional[str] = None
    clientName: Optional[str] = None
    templateId: Optional[str] = None
    category: Optional[str] = None
    groups: Optional[List[FieldGroup]] = None
    branding: Optional[BrandingConfig] = None
    status: Literal["active", "draft", "archived"] = "draft"
    folderId: Optional[str] = None


class FormCreate(FormBase):
    workspaceId: Optional[str] = None
    ownerId: Optional[str] = None


class FormUpdate(BaseModel):
    name: Optional[str] = None
    groups: Optional[List[FieldGroup]] = None
    branding: Optional[BrandingConfig] = None
    status: Optional[Literal["active", "draft", "archived"]] = None
    folderId: Optional[str] = None


class FormOut(FormBase):
    id: str
    workspaceId: Optional[str] = None
    ownerId: Optional[str] = None
    submissionCount: int = 0
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
