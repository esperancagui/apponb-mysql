from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    fingerprint: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


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


TokenResponse.model_rebuild()


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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
