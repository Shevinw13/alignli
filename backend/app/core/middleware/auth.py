"""Simple JWT authentication middleware.

Validates HS256 JWT tokens signed with AUTH_SECRET on protected routes.
Replaces the previous Clerk-based authentication.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings


@dataclass
class AuthenticatedUser:
    """Represents an authenticated user extracted from a JWT token."""

    user_id: str
    org_id: Optional[str] = None
    role: Optional[str] = None
    permissions: list[str] = field(default_factory=list)


# HTTPBearer scheme for extracting the Bearer token from Authorization header
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """FastAPI dependency that authenticates requests via JWT.

    Extracts and validates the Bearer token from the Authorization header.
    Returns an AuthenticatedUser with user_id, org_id, and role.

    Raises:
        HTTPException 401: If token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    if not settings.auth_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication not configured",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode and validate the JWT
    try:
        payload = pyjwt.decode(
            token,
            settings.auth_secret,
            algorithms=["HS256"],
            options={
                "verify_exp": True,
                "require": ["sub", "exp"],
            },
        )
    except pyjwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Extract claims
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    org_id = payload.get("org_id")
    role = payload.get("role")

    return AuthenticatedUser(
        user_id=user_id,
        org_id=org_id or "00000000-0000-0000-0000-000000000001",
        role=role or "Owner",
        permissions=[],
    )


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> Optional[AuthenticatedUser]:
    """FastAPI dependency for optionally authenticated routes.

    Returns the authenticated user if a valid token is present,
    or None if no token is provided. Still raises 401 if a token
    is present but invalid.
    """
    if credentials is None:
        return None

    return await get_current_user(request, credentials, settings)


def clear_jwks_cache() -> None:
    """No-op kept for test compatibility."""
    pass
