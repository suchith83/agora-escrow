"""
Escrow lifecycle service.

Each function encapsulates one stage. State transitions:
    pending_funding → funded → submitted → judged_release|judged_refund → released|refunded
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

import circle_client
from judge_agent import judge
from supabase_client import get_supabase


# ---------------------------------------------------------------------------
# Profile helpers
# ---------------------------------------------------------------------------

def get_or_create_profile(email: str) -> dict:
    """Look up a profile by email, creating an auth user + profile if missing.

    Returns the full profile row (dict).
    """
    sb = get_supabase()
    existing = sb.table("profiles").select("*").eq("email", email).limit(1).execute()
    if existing.data:
        return existing.data[0]

    # Create auth user (trigger auto-creates profile row)
    auth_resp = sb.auth.admin.create_user({
        "email": email,
        "password": _temp_password_for(email),
        "email_confirm": True,
    })
    auth_user_id = auth_resp.user.id

    profile = (
        sb.table("profiles")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .single()
        .execute()
    )
    return profile.data


def _temp_password_for(email: str) -> str:
    """Deterministic temp password for backend-created accounts.

    These accounts are admin-created and won't be used for password login —
    users sign in via magic link.
    """
    import hashlib
    return "Tmp!" + hashlib.sha256(email.encode()).hexdigest()[:24]


def ensure_user_wallet(profile: dict) -> dict:
    """Lazily create a Circle wallet for a profile if one doesn't exist.

    Returns the updated profile dict.
    """
    if profile.get("circle_wallet_id"):
        return profile

    sb = get_supabase()
    wallet_set_id = circle_client.create_wallet_set(
        name=f"user-{profile['id']}"
    )
    wallet = circle_client.create_wallet(wallet_set_id)
    updated = (
        sb.table("profiles")
        .update({
            "circle_wallet_set_id": wallet_set_id,
            "circle_wallet_id": wallet["id"],
            "circle_wallet_address": wallet["address"],
        })
        .eq("id", profile["id"])
        .execute()
    )
    return updated.data[0]


# ---------------------------------------------------------------------------
# Escrow lifecycle
# ---------------------------------------------------------------------------

def create_escrow(
    buyer_email: str,
    seller_email: str,
    amount_usdc: Decimal,
    title: str,
    requirements_md: str,
    buyer_profile: Optional[dict] = None,
) -> dict:
    """Create an escrow record + an escrow Circle wallet (the vault).

    If buyer_profile is provided (from authenticated session), it's used
    directly. Otherwise we fall back to get_or_create_profile(buyer_email).
    """
    sb = get_supabase()

    buyer = (
        ensure_user_wallet(buyer_profile)
        if buyer_profile
        else ensure_user_wallet(get_or_create_profile(buyer_email))
    )
    seller = ensure_user_wallet(get_or_create_profile(seller_email))

    # Create the escrow vault wallet
    escrow_wallet_set_id = circle_client.create_wallet_set(
        name=f"escrow-{title[:30]}"
    )
    escrow_wallet = circle_client.create_wallet(escrow_wallet_set_id)

    # Insert escrow row
    resp = (
        sb.table("escrows")
        .insert({
            "buyer_profile_id": buyer["id"],
            "seller_profile_id": seller["id"],
            "amount_usdc": str(amount_usdc),
            "title": title,
            "requirements_md": requirements_md,
            "status": "pending_funding",
            "circle_escrow_wallet_set_id": escrow_wallet_set_id,
            "circle_escrow_wallet_id": escrow_wallet["id"],
            "circle_escrow_wallet_address": escrow_wallet["address"],
        })
        .execute()
    )
    return resp.data[0]


def fund_from_buyer(escrow_id: str, actor_profile_id: Optional[str] = None) -> dict:
    """Pull the escrow amount from the buyer's Circle wallet into the vault.

    Used by the 'Fund from my wallet' button on the frontend so the buyer
    doesn't have to copy-paste the vault address into the faucet.

    The buyer's wallet must already hold enough USDC (they top it up from
    the faucet once; subsequent escrows reuse the same wallet).
    """
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")
    if actor_profile_id and actor_profile_id != escrow["buyer_profile_id"]:
        raise PermissionError("Only the buyer can fund this escrow.")
    if escrow["status"] != "pending_funding":
        raise ValueError(
            f"escrow status is {escrow['status']}; can only fund when pending_funding"
        )

    buyer = (
        sb.table("profiles")
        .select("*")
        .eq("id", escrow["buyer_profile_id"])
        .single()
        .execute()
        .data
    )
    if not buyer.get("circle_wallet_id"):
        raise ValueError("buyer has no Circle wallet (this shouldn't happen)")

    # Check buyer balance first to give a friendlier error than a Circle 400.
    required = Decimal(str(escrow["amount_usdc"]))
    bal = circle_client.get_balance(buyer["circle_wallet_id"])
    if bal["usdc"] < required:
        raise ValueError(
            f"buyer wallet has {bal['usdc']} USDC but escrow needs {required}. "
            f"Top up your wallet ({buyer['circle_wallet_address']}) via "
            f"https://faucet.circle.com (Arc Testnet) first."
        )

    transfer = circle_client.transfer_usdc(
        from_wallet_id=buyer["circle_wallet_id"],
        to_address=escrow["circle_escrow_wallet_address"],
        amount_usdc=str(required),
    )
    return {
        "escrow_id": escrow_id,
        "buyer_wallet_address": buyer["circle_wallet_address"],
        "buyer_balance_before": str(bal["usdc"]),
        "transfer_tx_id": transfer["transaction_id"],
        "transfer_state": str(transfer["state"]),
    }


def mark_funded(escrow_id: str) -> dict:
    """Check the escrow wallet's USDC balance and flip to 'funded' if covered."""
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")

    bal = circle_client.get_balance(escrow["circle_escrow_wallet_id"])
    required = Decimal(str(escrow["amount_usdc"]))
    if bal["usdc"] < required:
        return {
            **escrow,
            "_check": {
                "required": str(required),
                "current_balance": str(bal["usdc"]),
                "ready": False,
            },
        }

    updated = (
        sb.table("escrows")
        .update({"status": "funded"})
        .eq("id", escrow_id)
        .execute()
    )
    return {**updated.data[0], "_check": {"ready": True}}


def submit_deliverable(
    escrow_id: str,
    content_text: Optional[str] = None,
    content_url: Optional[str] = None,
    actor_profile_id: Optional[str] = None,
) -> dict:
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")
    if actor_profile_id and actor_profile_id != escrow["seller_profile_id"]:
        raise PermissionError("Only the seller can submit a deliverable for this escrow.")
    if escrow["status"] not in ("funded", "submitted"):
        raise ValueError(
            f"escrow status is {escrow['status']}; must be 'funded' before submitting"
        )

    delivery = (
        sb.table("deliverables")
        .insert({
            "escrow_id": escrow_id,
            "content_text": content_text,
            "content_url": content_url,
        })
        .execute()
    )
    sb.table("escrows").update({"status": "submitted"}).eq("id", escrow_id).execute()
    return delivery.data[0]


def run_judge(escrow_id: str) -> dict:
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")
    if escrow["status"] != "submitted":
        raise ValueError(
            f"escrow status is {escrow['status']}; need 'submitted' before judging"
        )

    # Get latest deliverable
    delivery_resp = (
        sb.table("deliverables")
        .select("*")
        .eq("escrow_id", escrow_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    if not delivery_resp.data:
        raise ValueError("no deliverable found for this escrow")
    delivery = delivery_resp.data[0]

    result = judge(
        requirements_md=escrow["requirements_md"],
        deliverable_text=delivery.get("content_text"),
        deliverable_url=delivery.get("content_url"),
    )

    # Map verdict to escrow status
    if result["verdict"] == "release":
        new_status = "judged_release"
    elif result["verdict"] == "refund":
        new_status = "judged_refund"
    else:
        new_status = "submitted"  # stay in submitted, awaiting human

    judgment = (
        sb.table("judgments")
        .insert({
            "escrow_id": escrow_id,
            "deliverable_id": delivery["id"],
            "verdict": result["verdict"],
            "reasoning": result["reasoning"],
            "confidence": result["confidence"],
            "model": result["model"],
        })
        .execute()
    )
    sb.table("escrows").update({"status": new_status}).eq("id", escrow_id).execute()
    return judgment.data[0]


def settle(escrow_id: str) -> dict:
    """Execute the on-chain transfer based on the latest judgment.

    judged_release → transfer to seller, status=released
    judged_refund  → transfer back to buyer, status=refunded
    """
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")
    if escrow["status"] not in ("judged_release", "judged_refund"):
        raise ValueError(
            f"escrow status is {escrow['status']}; need a judged_* state to settle"
        )

    judgment = (
        sb.table("judgments")
        .select("*")
        .eq("escrow_id", escrow_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data[0]
    )

    if escrow["status"] == "judged_release":
        seller = (
            sb.table("profiles")
            .select("*")
            .eq("id", escrow["seller_profile_id"])
            .single()
            .execute()
            .data
        )
        destination = seller["circle_wallet_address"]
        next_status = "released"
    else:  # judged_refund
        buyer = (
            sb.table("profiles")
            .select("*")
            .eq("id", escrow["buyer_profile_id"])
            .single()
            .execute()
            .data
        )
        destination = buyer["circle_wallet_address"]
        next_status = "refunded"

    transfer = circle_client.transfer_usdc(
        from_wallet_id=escrow["circle_escrow_wallet_id"],
        to_address=destination,
        amount_usdc=escrow["amount_usdc"],
    )

    sb.table("judgments").update({
        "transfer_tx_id": transfer["transaction_id"],
        "transfer_state": str(transfer["state"]),
    }).eq("id", judgment["id"]).execute()
    sb.table("escrows").update({"status": next_status}).eq("id", escrow_id).execute()

    return {
        "escrow_id": escrow_id,
        "status": next_status,
        "transfer_tx_id": transfer["transaction_id"],
        "transfer_state": str(transfer["state"]),
        "destination": destination,
    }


def get_escrow_detail(escrow_id: str) -> dict:
    sb = get_supabase()
    escrow = sb.table("escrows").select("*").eq("id", escrow_id).single().execute().data
    if not escrow:
        raise ValueError(f"escrow {escrow_id} not found")
    deliverables = (
        sb.table("deliverables").select("*").eq("escrow_id", escrow_id).execute().data
    )
    judgments = (
        sb.table("judgments")
        .select("*")
        .eq("escrow_id", escrow_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    # Surface counterparty emails for the UI
    buyer = (
        sb.table("profiles")
        .select("email")
        .eq("id", escrow["buyer_profile_id"])
        .single()
        .execute()
        .data
    )
    seller = (
        sb.table("profiles")
        .select("email")
        .eq("id", escrow["seller_profile_id"])
        .single()
        .execute()
        .data
    )
    return {
        "escrow": escrow,
        "deliverables": deliverables,
        "judgments": judgments,
        "buyer_email": buyer.get("email") if buyer else None,
        "seller_email": seller.get("email") if seller else None,
    }


def get_profile_by_email(email: str) -> dict:
    """Fetch profile + live wallet balance. Returns null fields if no wallet yet."""
    sb = get_supabase()
    rows = sb.table("profiles").select("*").eq("email", email).limit(1).execute().data
    if not rows:
        return {"email": email, "exists": False}
    p = rows[0]
    out = {
        "email": email,
        "exists": True,
        "id": p["id"],
        "circle_wallet_address": p.get("circle_wallet_address"),
        "circle_wallet_id": p.get("circle_wallet_id"),
        "usdc_balance": None,
    }
    if p.get("circle_wallet_id"):
        try:
            bal = circle_client.get_balance(p["circle_wallet_id"])
            out["usdc_balance"] = str(bal["usdc"])
        except Exception:
            out["usdc_balance"] = None
    return out


def list_for_profile(profile_id: str) -> dict:
    """Return escrows where this profile is buyer OR seller, split by role."""
    sb = get_supabase()
    as_buyer = (
        sb.table("escrows")
        .select("*")
        .eq("buyer_profile_id", profile_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    as_seller = (
        sb.table("escrows")
        .select("*")
        .eq("seller_profile_id", profile_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"as_buyer": as_buyer, "as_seller": as_seller}


def list_recent_escrows(limit: int = 20) -> list:
    sb = get_supabase()
    return (
        sb.table("escrows")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def count_profiles() -> int:
    sb = get_supabase()
    resp = sb.table("profiles").select("id", count="exact").limit(1).execute()
    return int(resp.count or 0)


_TEST_EMAIL_MARKERS = (
    "@example.com",
    "agora-int-",
    "agora-seller-",
    "agora-buyer-",
)


def list_profiles_for_picker(limit: int = 200) -> list[dict]:
    """Returns [{email, display_name}] for the seller-email autocomplete.

    NOTE: hackathon-only. Exposing all emails publicly is not production-safe.
    Filters out test/system profiles seeded by integration tests so they
    don't surface on the live demo.
    """
    sb = get_supabase()
    rows = (
        sb.table("profiles")
        .select("email, display_name")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    ) or []
    return [
        r for r in rows
        if not any(marker in (r.get("email") or "").lower() for marker in _TEST_EMAIL_MARKERS)
    ]
