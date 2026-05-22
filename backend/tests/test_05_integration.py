"""
END-TO-END integration test — the full escrow lifecycle.

Prerequisites:
    - All .env values set
    - Supabase migration applied
    - FastAPI server running (uvicorn main:app --reload --port 8000)
    - A funded Circle wallet on Arc Testnet whose ID + address you provide
      below via env vars. We'll use it to FUND the escrow vault so the test
      can actually execute the release on-chain.

Required env (or edit constants below):
    FUNDING_WALLET_ID         — your funded Circle wallet ID
    FUNDING_WALLET_ADDRESS    — its address (for sanity log only)
    ESCROW_AMOUNT_USDC        — defaults to "0.10"

What it does:
    1. Create escrow (buyer + seller emails — auto-creates profiles+wallets)
    2. Transfer USDC from FUNDING_WALLET into the escrow vault
    3. Poll check-funding until 'funded'
    4. Submit a GOOD deliverable
    5. Run the AI judge → expects 'release'
    6. Settle → on-chain transfer to seller wallet
    7. Verify seller's wallet balance increased

This is slow (~60-90s) because Circle transfers need confirmations.

Run:
    cd backend && source .venv/bin/activate
    export FUNDING_WALLET_ID=...
    export FUNDING_WALLET_ADDRESS=...
    python tests/test_05_integration.py
"""
import os
import sys
import time
from decimal import Decimal
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
import circle_client

BASE = "http://localhost:8000"
AMOUNT = os.environ.get("ESCROW_AMOUNT_USDC", "0.10")
FUNDING_WALLET_ID = os.environ.get("FUNDING_WALLET_ID")
FUNDING_WALLET_ADDRESS = os.environ.get("FUNDING_WALLET_ADDRESS")


def _poll_until(fn, *, description, timeout_s=120, interval_s=5):
    start = time.time()
    while time.time() - start < timeout_s:
        ok, value = fn()
        if ok:
            return value
        print(f"    … waiting on {description} ({int(time.time() - start)}s)")
        time.sleep(interval_s)
    raise TimeoutError(f"timed out waiting for {description}")


def main():
    if not FUNDING_WALLET_ID:
        print("ERROR: export FUNDING_WALLET_ID=<your-funded-circle-wallet-id>")
        print("       (and FUNDING_WALLET_ADDRESS for logging)")
        print("Tip: run test_01_circle.py to create a wallet, then fund it via")
        print("     https://faucet.circle.com (Arc Testnet)")
        sys.exit(1)

    print("=" * 70)
    print("Phase 5 test: full escrow lifecycle (END-TO-END, hits Arc testnet)")
    print("=" * 70)

    # Check funding wallet has enough
    print(f"\n[pre] Checking funding wallet balance ({FUNDING_WALLET_ADDRESS})")
    bal = circle_client.get_balance(FUNDING_WALLET_ID)
    required = Decimal(AMOUNT) + Decimal("0.05")  # buffer for gas (Arc gas is in USDC too)
    print(f"    funding wallet USDC: {bal['usdc']}")
    if bal["usdc"] < required:
        print(f"    ✗ need at least {required} USDC. Top up: https://faucet.circle.com")
        sys.exit(1)
    print(f"    ✓ sufficient")

    ts = int(time.time())
    buyer = f"agora-int-buyer-{ts}@example.com"
    seller = f"agora-int-seller-{ts}@example.com"

    print(f"\n[1/7] Create escrow  buyer={buyer}  seller={seller}  amount={AMOUNT} USDC")
    r = httpx.post(
        f"{BASE}/escrow/create",
        json={
            "buyer_email": buyer,
            "seller_email": seller,
            "amount_usdc": AMOUNT,
            "title": "Integration test escrow",
            "requirements_md": "Write a 3-line haiku about USDC. Must mention USDC.",
        },
        timeout=120,
    )
    r.raise_for_status()
    created = r.json()
    escrow_id = created["escrow_id"]
    vault = created["escrow_wallet_address"]
    print(f"    ✓ escrow_id: {escrow_id}")
    print(f"    ✓ vault:     {vault}")

    print(f"\n[2/7] Transferring {AMOUNT} USDC from funding wallet → vault")
    t = circle_client.transfer_usdc(
        from_wallet_id=FUNDING_WALLET_ID,
        to_address=vault,
        amount_usdc=AMOUNT,
    )
    print(f"    ✓ tx_id: {t['transaction_id']}, state: {t['state']}")

    print(f"\n[3/7] Polling check-funding until 'funded'")
    def _check():
        r = httpx.post(f"{BASE}/escrow/{escrow_id}/check-funding", timeout=30)
        r.raise_for_status()
        body = r.json()
        return body["status"] == "funded", body
    funded = _poll_until(_check, description="vault to be credited", timeout_s=180, interval_s=8)
    print(f"    ✓ funded: {funded}")

    print(f"\n[4/7] Submitting GOOD deliverable")
    r = httpx.post(
        f"{BASE}/escrow/{escrow_id}/submit",
        json={
            "content_text": (
                "Dollars go digital\n"
                "USDC bridges the chains —\n"
                "Stable, swift, secure."
            ),
        },
        timeout=30,
    )
    r.raise_for_status()
    print(f"    ✓ {r.json()}")

    print(f"\n[5/7] Running AI judge")
    r = httpx.post(f"{BASE}/escrow/{escrow_id}/judge", timeout=60)
    r.raise_for_status()
    j = r.json()
    print(f"    ✓ verdict:    {j['verdict']}")
    print(f"    ✓ confidence: {j['confidence']}")
    print(f"    ✓ reasoning:  {j['reasoning']}")
    if j["verdict"] != "release":
        print(f"    ⚠ expected 'release'; got {j['verdict']}. Stopping before settlement.")
        sys.exit(0)

    print(f"\n[6/7] Settling on-chain (transfer vault → seller)")
    r = httpx.post(f"{BASE}/escrow/{escrow_id}/settle", timeout=60)
    r.raise_for_status()
    s = r.json()
    print(f"    ✓ status:        {s['status']}")
    print(f"    ✓ transfer_tx:   {s['transfer_tx_id']}")
    print(f"    ✓ state:         {s['transfer_state']}")

    print(f"\n[7/7] Polling Circle for tx completion")
    def _check_tx():
        tx = circle_client.get_transaction(s["transfer_tx_id"])
        state = tx.get("state", "")
        return state in ("CONFIRMED", "COMPLETE"), {"state": state, "tx_hash": tx.get("tx_hash")}
    final = _poll_until(_check_tx, description="release tx confirmation", timeout_s=180, interval_s=6)
    print(f"    ✓ on-chain: {final}")

    print("\n" + "=" * 70)
    print("END-TO-END SUCCESS.")
    print(f"  Escrow:       {BASE}/escrow/{escrow_id}")
    print(f"  Vault addr:   https://testnet.arcscan.app/address/{vault}")
    if final.get("tx_hash"):
        print(f"  Release tx:   https://testnet.arcscan.app/tx/{final['tx_hash']}")
    print("=" * 70)


if __name__ == "__main__":
    main()
