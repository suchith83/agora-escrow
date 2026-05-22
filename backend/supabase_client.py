"""
Supabase client (server-side, service_role).

Service role bypasses RLS — we use it because all writes go through the trusted
FastAPI backend. Never expose this key to the frontend.
"""
from __future__ import annotations

from supabase import create_client, Client

from config import get_settings


def get_supabase() -> Client:
    """Create a fresh Supabase client per call.

    We intentionally do NOT cache the client: the underlying httpx client uses
    HTTP/2 and can hit transient ReadErrors ([Errno 35] Resource temporarily
    unavailable) when a connection is reused after being idle. Recreating per
    call is cheap and avoids that whole class of error.
    """
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(s.supabase_url, s.supabase_service_key)
