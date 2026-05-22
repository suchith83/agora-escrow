"""
Standalone test for Supabase schema.

Prerequisite: run the migration first.
    Option A (Supabase Dashboard SQL editor):
      paste contents of supabase/migrations/20260520000001_initial_escrow_schema.sql

    Option B (Supabase CLI):
      cd /Users/suchithkoduru/Desktop/suchith/Agora
      npx supabase db push

Then run:
    cd backend && source .venv/bin/activate
    python tests/test_02_supabase.py

What it does:
    1. Connects with service-role key
    2. Reads each table (escrows, profiles, deliverables, judgments) — should not error
    3. Writes a test profile row, then deletes it
    4. Confirms the escrow_status / judge_verdict enums exist (indirectly via insert)
"""
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase_client import get_supabase


def main():
    print("=" * 60)
    print("Phase 2 test: Supabase schema reachability + write")
    print("=" * 60)

    sb = get_supabase()

    print("\n[1/4] Listing tables (each should return 0+ rows)")
    for table in ("profiles", "escrows", "deliverables", "judgments"):
        try:
            resp = sb.table(table).select("id").limit(1).execute()
            print(f"    ✓ {table}: ok ({len(resp.data)} row(s) sampled)")
        except Exception as e:
            print(f"    ✗ {table}: FAILED — {e}")
            sys.exit(1)

    print("\n[2/4] Inserting a fake auth user (via auth admin) + profile")
    fake_email = f"agora-test-{int(time.time())}@example.com"
    try:
        # Use auth admin (service role) to create a user. The trigger
        # handle_new_auth_user() should auto-create the profile row.
        auth_resp = sb.auth.admin.create_user({
            "email": fake_email,
            "password": "TestPassword123!",
            "email_confirm": True,
        })
        auth_user_id = auth_resp.user.id
        print(f"    ✓ auth user created: {auth_user_id}")
    except Exception as e:
        print(f"    ✗ auth.admin.create_user failed — {e}")
        sys.exit(1)

    print("\n[3/4] Verifying auto-created profile row")
    profile_resp = (
        sb.table("profiles")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .single()
        .execute()
    )
    if not profile_resp.data:
        print("    ✗ profile row was NOT auto-created — check handle_new_auth_user trigger")
        sys.exit(1)
    print(f"    ✓ profile auto-created: id={profile_resp.data['id']}, email={profile_resp.data['email']}")

    print("\n[4/4] Inserting + reading an escrow row")
    # Create a second profile to be the seller
    seller_email = f"agora-seller-{int(time.time())}@example.com"
    seller_auth = sb.auth.admin.create_user({
        "email": seller_email,
        "password": "TestPassword123!",
        "email_confirm": True,
    })
    seller_profile = (
        sb.table("profiles").select("id").eq("auth_user_id", seller_auth.user.id).single().execute()
    )
    escrow_resp = (
        sb.table("escrows")
        .insert(
            {
                "buyer_profile_id": profile_resp.data["id"],
                "seller_profile_id": seller_profile.data["id"],
                "amount_usdc": "1.50",
                "title": "Test escrow",
                "requirements_md": "Deliver a haiku about USDC.",
            }
        )
        .execute()
    )
    escrow_id = escrow_resp.data[0]["id"]
    print(f"    ✓ escrow inserted: {escrow_id} (status={escrow_resp.data[0]['status']})")

    print("\n[cleanup] Deleting test escrow + auth users")
    sb.table("escrows").delete().eq("id", escrow_id).execute()
    sb.auth.admin.delete_user(auth_user_id)
    sb.auth.admin.delete_user(seller_auth.user.id)
    print("    ✓ cleaned up")

    print("\n" + "=" * 60)
    print("SUCCESS — Supabase schema works end-to-end.")
    print("=" * 60)


if __name__ == "__main__":
    main()
