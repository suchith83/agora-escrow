"""
Supabase JWT verification for the FastAPI backend.

Supabase now (2026) issues asymmetric JWTs (ES256) by default for new projects,
while older projects use HS256 with a shared secret. We support both:

  1. If the token header says HS256 → verify with SUPABASE_JWT_SECRET (env)
  2. Otherwise (ES256, RS256, etc.) → fetch the public JWKS from
     {SUPABASE_URL}/auth/v1/.well-known/jwks.json and verify with the matching key

Add to backend/.env:
    SUPABASE_URL=https://<ref>.supabase.co
    SUPABASE_JWT_SECRET=...   (only needed if your project still uses HS256)
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from fastapi import Depends, Header, HTTPException

from config import get_settings
from supabase_client import get_supabase

try:
    import jwt
    from jwt import PyJWKClient
except ImportError as e:
    raise RuntimeError(
        "Install PyJWT[crypto]: `uv pip install 'PyJWT[crypto]'`."
    ) from e


_JWT_AUD = "authenticated"


@lru_cache
def _jwks_client() -> PyJWKClient:
    s = get_settings()
    if not s.supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is not set")
    url = f"{s.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url)


def decode_jwt(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")

    alg = header.get("alg", "")

    try:
        if alg == "HS256":
            secret = os.environ.get("SUPABASE_JWT_SECRET", "")
            if not secret:
                raise HTTPException(
                    status_code=500,
                    detail="Token is HS256 but SUPABASE_JWT_SECRET is not set in backend/.env",
                )
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=_JWT_AUD,
            )
        else:
            # Asymmetric — fetch signing key from Supabase JWKS
            signing_key = _jwks_client().get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                audience=_JWT_AUD,
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    claims = decode_jwt(token)
    auth_user_id = claims.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub'")

    sb = get_supabase()
    rows = (
        sb.table("profiles").select("*").eq("auth_user_id", auth_user_id).limit(1).execute().data
    )
    if rows:
        return rows[0]

    # Trigger should have created it; if not, create from JWT claims
    email = claims.get("email", "")
    inserted = (
        sb.table("profiles")
        .insert({"auth_user_id": auth_user_id, "email": email})
        .execute()
    )
    return inserted.data[0]


def current_user_optional(
    authorization: Optional[str] = Header(default=None),
) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return current_user(authorization)
    except HTTPException:
        return None
