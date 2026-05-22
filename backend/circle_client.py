"""
Circle Developer-Controlled Wallets wrapper for Arc testnet.

Uses the Python SDK (`circle-developer-controlled-wallets`). The SDK auto-fills
`entity_secret_ciphertext` and `idempotency_key` on every request, so we only
pass business fields.

USDC on Arc uses 6 decimals on the ERC-20 contract (0x3600...0000).
"""
from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from typing import Optional

from circle.web3 import developer_controlled_wallets as dcw
from circle.web3 import utils as circle_utils

from config import get_settings


USDC_DECIMALS = 6


@lru_cache
def _api_client():
    s = get_settings()
    return circle_utils.init_developer_controlled_wallets_client(
        api_key=s.circle_api_key,
        entity_secret=s.circle_entity_secret,
    )


def usdc_to_atoms(amount: float | str | Decimal) -> str:
    """Convert human USDC (1.5) to atomic units string ('1500000') for ERC-20 transfer."""
    d = Decimal(str(amount))
    atoms = int(d * (Decimal(10) ** USDC_DECIMALS))
    return str(atoms)


def atoms_to_usdc(atoms: str | int) -> Decimal:
    return Decimal(str(atoms)) / (Decimal(10) ** USDC_DECIMALS)


def create_wallet_set(name: str) -> str:
    """Create a wallet set (logical grouping). Returns walletSetId.

    Note: SDK returns a list under data.wallet_sets, even though we created one.
    Each item is a oneOf union (DeveloperWalletSet | EndUserWalletSet) accessed
    via .actual_instance.
    """
    api = dcw.WalletSetsApi(_api_client())
    req = dcw.CreateWalletSetRequest(name=name)
    resp = api.create_wallet_set(req)
    ws = resp.data.wallet_set.actual_instance
    return ws.id


def create_wallet(wallet_set_id: str) -> dict:
    """Create a single Arc-testnet SCA wallet under a wallet set.

    Returns {'id': circle_wallet_id, 'address': '0x...', 'blockchain': 'ARC-TESTNET'}.
    SDK returns a oneOf union (SCAWallet | EOAWallet) via .actual_instance.
    """
    s = get_settings()
    api = dcw.WalletsApi(_api_client())
    req = dcw.CreateWalletRequest(
        account_type="SCA",
        blockchains=[s.arc_blockchain],
        count=1,
        wallet_set_id=wallet_set_id,
    )
    resp = api.create_wallet(req)
    w = resp.data.wallets[0].actual_instance
    return {
        "id": w.id,
        "address": w.address,
        "blockchain": w.blockchain,
    }


def get_balance(wallet_id: str) -> dict:
    """Get token balances. Returns {'usdc': Decimal, 'raw': [...]}."""
    api = dcw.WalletsApi(_api_client())
    resp = api.list_wallet_balance(id=wallet_id)
    balances = resp.data.token_balances or []
    usdc_amount = Decimal("0")
    raw = []
    for b in balances:
        b_dict = b.to_dict() if hasattr(b, "to_dict") else b.model_dump()
        raw.append(b_dict)
        token = b_dict.get("token") or {}
        if (token.get("symbol") or "").upper() == "USDC":
            usdc_amount = Decimal(str(b_dict.get("amount", "0")))
    return {"usdc": usdc_amount, "raw": raw}


def transfer_usdc(
    from_wallet_id: str,
    to_address: str,
    amount_usdc: float | str | Decimal,
) -> dict:
    """Transfer native USDC on Arc from a Circle wallet to any Arc address.

    Important: on Arc Testnet, USDC is the *native* token (18 decimals on chain,
    but the Circle API takes human amounts as strings — e.g. '0.10'). We do NOT
    pass token_address; passing it makes the API treat the transfer as an ERC-20
    of an arbitrary contract.

    Blockchain field is a oneOf union — must be wrapped, not passed as raw string.
    """
    api = dcw.TransactionsApi(_api_client())
    blockchain = dcw.CreateTransferTransactionForDeveloperRequestBlockchain(
        dcw.TransferBlockchain.ARC_MINUS_TESTNET
    )
    req = dcw.CreateTransferTransactionForDeveloperRequest(
        amounts=[str(amount_usdc)],
        destination_address=to_address,
        blockchain=blockchain,
        wallet_id=from_wallet_id,
        fee_level="MEDIUM",
    )
    resp = api.create_developer_transaction_transfer(req)
    return {"transaction_id": resp.data.id, "state": resp.data.state}


def get_transaction(transaction_id: str) -> dict:
    api = dcw.TransactionsApi(_api_client())
    resp = api.get_transaction(id=transaction_id)
    tx = resp.data.transaction
    return tx.to_dict() if hasattr(tx, "to_dict") else tx.model_dump()
