from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.form import BrandingConfig, FieldGroup


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    defaultGroups: Optional[List[FieldGroup]] = None
    defaultBranding: Optional[BrandingConfig] = None


class TemplateCreate(TemplateBase):
    workspaceId: Optional[str] = None
    ownerId: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    defaultGroups: Optional[List[FieldGroup]] = None
    defaultBranding: Optional[BrandingConfig] = None


class TemplateGroupsUpdate(BaseModel):
    groups: List[FieldGroup]


class TemplateBrandingUpdate(BrandingConfig):
    pass


class TemplateOut(TemplateBase):
    id: str
    isSystem: bool = False
    workspaceId: Optional[str] = None
    ownerId: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
