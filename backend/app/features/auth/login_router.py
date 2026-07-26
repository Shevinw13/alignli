"""Simple username/password login endpoint.

Validates credentials against environment variables and returns a JWT token.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import Settings, get_settings

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


class LoginRequest(BaseModel):
    """Login request body."""

    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with JWT token."""

    token: str
    expires_in: int  # seconds


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    """Authenticate with username/password and receive a JWT token.

    The token is HS256-signed with AUTH_SECRET and expires in 7 days.
    """
    if not settings.auth_username or not settings.auth_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not configured on server",
        )

    # Validate credentials
    if body.username != settings.auth_username or body.password != settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Generate JWT
    expires_in_seconds = 7 * 24 * 60 * 60  # 7 days
    now = datetime.datetime.utcnow()
    payload: Dict[str, Any] = {
        "sub": settings.auth_username,
        "org_id": "00000000-0000-0000-0000-000000000001",
        "role": "Owner",
        "iat": now,
        "exp": now + datetime.timedelta(seconds=expires_in_seconds),
    }

    token = pyjwt.encode(payload, settings.auth_secret, algorithm="HS256")

    return LoginResponse(token=token, expires_in=expires_in_seconds)
