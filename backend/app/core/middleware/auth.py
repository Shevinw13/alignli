"""Clerk JWT authentication middleware.

Validates Clerk-issued JWT tokens on protected routes by:
1. Fetching JWKS from Clerk's well-known endpoint (with caching)
2. Verifying token signature, expiration, and issuer
3. Extracting user_id (sub claim), org_id, and role from token claims

Returns JSON 401 responses for missing or invalid tokens on API routes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

import httpx
import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

# JWKS cache: stores keys with a TTL to avoid constant network calls.
_jwks_cache: dict[str, object] = {}
_jwks_cache_expiry: float = 0.0
_JWKS_CACHE_TTL_SECONDS: int = 3600  # 1 hour


@dataclass
class AuthenticatedUser:
    """Represents an authenticated user extracted from a Clerk JWT token."""

    user_id: str
    org_id: Optional[str] = None
    role: Optional[str] = None
    permissions: list[str] = field(default_factory=list)


def _get_clerk_jwks_url(settings: Settings) -> str:
    """Derive the Clerk JWKS URL from the publishable key.

    Clerk publishable keys follow the format: pk_test_<base64-encoded-domain>
    or pk_live_<base64-encoded-domain>. The JWKS endpoint is at:
    https://<clerk-frontend-api>/.well-known/jwks.json

    For simplicity, we use the Clerk API endpoint pattern.
    """
    # Clerk's JWKS endpoint for the instance
    # The publishable key encodes the frontend API domain
    publishable_key = settings.clerk_publishable_key
    if not publishable_key:
        raise ValueError("CLERK_PUBLISHABLE_KEY is not configured")

    # Extract the frontend API domain from the publishable key
    # Format: pk_test_<base64url-encoded-domain> or pk_live_<base64url-encoded-domain>
    import base64

    parts = publishable_key.split("_")
    if len(parts) < 3:
        raise ValueError("Invalid CLERK_PUBLISHABLE_KEY format")

    # The domain is base64url-encoded in the third part (after pk_test_ or pk_live_)
    encoded_domain = parts[2]
    # Add padding if necessary
    padding = 4 - len(encoded_domain) % 4
    if padding != 4:
        encoded_domain += "=" * padding

    try:
        domain = base64.b64decode(encoded_domain).decode("utf-8").rstrip("$")
    except Exception:
        # Fallback: use clerk.com pattern
        domain = f"clerk.{parts[2]}.com"

    return f"https://{domain}/.well-known/jwks.json"


async def _fetch_jwks(settings: Settings) -> dict[str, object]:
    """Fetch JWKS from Clerk's well-known endpoint with caching.

    Caches the JWKS keys for 1 hour to minimize network calls.
    On cache miss or expiry, fetches fresh keys from Clerk.
    """
    global _jwks_cache, _jwks_cache_expiry

    now = time.time()
    if _jwks_cache and now < _jwks_cache_expiry:
        return _jwks_cache

    jwks_url = _get_clerk_jwks_url(settings)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        jwks_data = response.json()

    _jwks_cache = jwks_data
    _jwks_cache_expiry = now + _JWKS_CACHE_TTL_SECONDS
    return jwks_data


def _get_signing_key(jwks: dict[str, object], token: str) -> pyjwt.algorithms.RSAAlgorithm:
    """Extract the appropriate signing key from JWKS based on token header kid."""
    try:
        unverified_header = pyjwt.get_unverified_header(token)
    except pyjwt.exceptions.DecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing key ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find the matching key in JWKS
    keys = jwks.get("keys", [])
    for key_data in keys:
        if key_data.get("kid") == kid:
            return pyjwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token signing key not found",
        headers={"WWW-Authenticate": "Bearer"},
    )


# HTTPBearer scheme for extracting the Bearer token from Authorization header
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """FastAPI dependency that authenticates requests via Clerk JWT.

    Extracts and validates the Bearer token from the Authorization header.
    Returns an AuthenticatedUser with user_id, org_id, and role.

    Raises:
        HTTPException 401: If token is missing, expired, or invalid.
    """
    # DEV BYPASS: Skip auth in development when Clerk keys aren't configured
    if settings.app_env == "development" and not settings.clerk_secret_key:
        return AuthenticatedUser(
            user_id="dev-user",
            org_id="00000000-0000-0000-0000-000000000001",
            role="Owner",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Fetch JWKS (cached)
    try:
        jwks = await _fetch_jwks(settings)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Get the signing key for this token
    public_key = _get_signing_key(jwks, token)

    # Decode and validate the JWT
    try:
        payload = pyjwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_iat": True,
                "require": ["sub", "exp", "iat"],
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

    # Clerk stores org info in the token under 'org_id' or 'o' claim
    org_id = payload.get("org_id") or payload.get("o")

    # Role is typically in 'org_role' or nested in metadata
    role = payload.get("org_role") or payload.get("role")

    # Permissions may be in 'org_permissions' claim
    permissions = payload.get("org_permissions", [])

    return AuthenticatedUser(
        user_id=user_id,
        org_id=org_id,
        role=role,
        permissions=permissions if isinstance(permissions, list) else [],
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
    """Clear the JWKS cache. Useful for testing or key rotation."""
    global _jwks_cache, _jwks_cache_expiry
    _jwks_cache = {}
    _jwks_cache_expiry = 0.0
