"""
Standalone API smoke test for /escrow endpoints.

Prerequisites:
    - Supabase migration applied (Phase 2)
    - backend/.env complete (CIRCLE, SUPABASE_*, GEMINI_API_KEY)
    - FastAPI server running in another terminal:
        cd backend && source .venv/bin/activate
        uvicorn main:app --reload --port 8000

Run:
    cd backend && source .venv/bin/activate
    python tests/test_03_api.py

What it does (does NOT touch the chain):
    1. GET /health
    2. POST /escrow/create with two test emails
    3. POST /escrow/{id}/check-funding (will report 'ready: false' since unfunded)
    4. (skip) submit/judge — those work but judge needs a funded escrow to make
       sense end-to-end. See test_05_integration.py for the full chain test.
    5. GET /escrow/{id} — pull back the row
    6. GET /escrow — list

Cleanup is manual; rows are left behind so you can inspect them.
"""
import sys
import time
import httpx

BASE = "http://localhost:8000"


def main():
    print("=" * 60)
    print("Phase 3 test: FastAPI escrow endpoints")
    print("=" * 60)

    print("\n[1/5] GET /health")
    r = httpx.get(f"{BASE}/health", timeout=10)
    r.raise_for_status()
    print(f"    ✓ {r.json()}")

    ts = int(time.time())
    buyer = f"agora-buyer-{ts}@example.com"
    seller = f"agora-seller-{ts}@example.com"

    print(f"\n[2/5] POST /escrow/create  buyer={buyer}  seller={seller}")
    r = httpx.post(
        f"{BASE}/escrow/create",
        json={
            "buyer_email": buyer,
            "seller_email": seller,
            "amount_usdc": "0.50",
            "title": "API smoke test escrow",
            "requirements_md": "Send a haiku about USDC. 3 lines.",
        },
        timeout=60,
    )
    if r.status_code != 200:
        print(f"    ✗ {r.status_code}: {r.text}")
        sys.exit(1)
    created = r.json()
    print(f"    ✓ escrow_id: {created['escrow_id']}")
    print(f"    ✓ status:    {created['status']}")
    print(f"    ✓ vault:     {created['escrow_wallet_address']}")
    escrow_id = created["escrow_id"]

    print(f"\n[3/5] POST /escrow/{escrow_id}/check-funding")
    r = httpx.post(f"{BASE}/escrow/{escrow_id}/check-funding", timeout=30)
    r.raise_for_status()
    print(f"    ✓ {r.json()}")

    print(f"\n[4/5] GET /escrow/{escrow_id}")
    r = httpx.get(f"{BASE}/escrow/{escrow_id}", timeout=10)
    r.raise_for_status()
    detail = r.json()
    print(f"    ✓ escrow.status: {detail['escrow']['status']}")
    print(f"    ✓ deliverables: {len(detail['deliverables'])}, judgments: {len(detail['judgments'])}")

    print("\n[5/5] GET /escrow (list)")
    r = httpx.get(f"{BASE}/escrow?limit=5", timeout=10)
    r.raise_for_status()
    print(f"    ✓ {len(r.json()['escrows'])} recent escrows")

    print("\n" + "=" * 60)
    print("SUCCESS. Endpoints reachable, escrow created with vault wallet.")
    print(f"Inspect on Arc explorer: https://testnet.arcscan.app/address/{created['escrow_wallet_address']}")
    print(f"Inspect in Supabase Studio: escrows table, id={escrow_id}")
    print("=" * 60)


if __name__ == "__main__":
    main()
