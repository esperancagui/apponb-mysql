from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    firebase_uid: str
    email: str
    display_name: Optional[str] = None
    fingerprint: Optional[str] = None


class UserResponse(BaseModel):
    id: str  # UUID
    email: str
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    firebase_uid: str
    created_at: datetime
    plan: str = "free"
    subscription_status: Optional[str] = None
    current_period_end: Optional[datetime] = None
    trial_end: Optional[datetime] = None


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


class UpdatePreferencesRequest(BaseModel):
    email_notifications: Optional[bool] = None
    language: Optional[str] = None


class PreferencesResponse(BaseModel):
    email_notifications: bool
    language: str


class ReactivateRequest(BaseModel):
    email: str
