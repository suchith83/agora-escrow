"""
Standalone test for circle_client.py.

Run:
    cd backend && source .venv/bin/activate
    python tests/test_01_circle.py

What it does:
    1. Creates a wallet set named 'agora-test-<timestamp>'
    2. Creates an Arc-testnet wallet under it
    3. Reads the wallet's balance (should be 0 USDC)
    4. Prints the wallet address — you can fund it from https://faucet.circle.com
       and re-run to see the balance update.

What it does NOT do:
    Transfer — requires a funded wallet. See test_02_transfer.py for that.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from circle_client import (
    create_wallet_set,
    create_wallet,
    get_balance,
    atoms_to_usdc,
)


def main():
    print("=" * 60)
    print("Phase 1 test: Circle wallet creation + balance read")
    print("=" * 60)

    set_name = f"agora-test-{int(time.time())}"
    print(f"\n[1/3] Creating wallet set: {set_name}")
    wallet_set_id = create_wallet_set(set_name)
    print(f"    ✓ wallet_set_id: {wallet_set_id}")

    print(f"\n[2/3] Creating Arc-testnet wallet")
    wallet = create_wallet(wallet_set_id)
    print(f"    ✓ wallet_id:      {wallet['id']}")
    print(f"    ✓ address:        {wallet['address']}")
    print(f"    ✓ blockchain:     {wallet['blockchain']}")

    print(f"\n[3/3] Reading wallet balance")
    bal = get_balance(wallet["id"])
    print(f"    ✓ USDC: {bal['usdc']}")
    print(f"    ✓ raw token balances: {bal['raw']}")

    print("\n" + "=" * 60)
    print("SUCCESS. Next steps:")
    print(f"  1. Fund this address with testnet USDC: {wallet['address']}")
    print(f"     Faucet: https://faucet.circle.com  (chain: Arc Testnet)")
    print(f"  2. Save these IDs for test_02_transfer.py:")
    print(f"     export TEST_WALLET_SET_ID={wallet_set_id}")
    print(f"     export TEST_WALLET_ID={wallet['id']}")
    print(f"     export TEST_WALLET_ADDRESS={wallet['address']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
