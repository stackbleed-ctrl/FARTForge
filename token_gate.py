"""
FARTForge — $FARTFORGE Token Gate
====================================
Gate API access and feature tiers based on $FARTFORGE SPL token balance.

Tiers
-----
    FREE     :     0 $FARTFORGE — public leaderboard read-only
    BASIC    :   100 $FARTFORGE — submit events (rate-limited)
    PRO      : 1,000 $FARTFORGE — full API + higher rate limits
    ELITE    :10,000 $FARTFORGE — replay engine + Solana anchoring + firehose

Requirements
------------
    pip install solders solana

Environment variables
---------------------
    FARTFORGE_TOKEN_MINT — SPL token mint address for $FARTFORGE
    SOLANA_RPC_URL       — Solana RPC endpoint

Usage (FastAPI)
---------------
    from fartforge.solana.token_gate import TokenGate, tier_required

    gate    = TokenGate()
    require = tier_required(gate)

    @app.post("/events")
    def submit(wallet: str = Header(..., alias="X-Wallet"), _=Depends(require("BASIC"))):
        ...

Usage (standalone)
------------------
    gate  = TokenGate()
    tier  = gate.get_tier("YourWalletBase58...")
    print(tier)   # "PRO"
"""

from __future__ import annotations

import logging
import os
from enum import IntEnum
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    pass

_log = logging.getLogger("fartforge.solana.token_gate")

# Token mint address for $FARTFORGE — set via env or at construction
DEFAULT_TOKEN_MINT = os.environ.get(
    "FARTFORGE_TOKEN_MINT",
    "FARTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",   # replace with real mint
)


class Tier(IntEnum):
    FREE  = 0
    BASIC = 1
    PRO   = 2
    ELITE = 3


TIER_THRESHOLDS: dict[Tier, int] = {
    Tier.ELITE: 10_000,
    Tier.PRO:    1_000,
    Tier.BASIC:    100,
    Tier.FREE:       0,
}

TIER_NAMES = {v: k for k, v in Tier.__members__.items()}


def _balance_to_tier(balance: float) -> Tier:
    for tier, threshold in TIER_THRESHOLDS.items():
        if balance >= threshold:
            return tier
    return Tier.FREE


class TokenGate:
    """
    Checks $FARTFORGE SPL token balance for a given wallet address
    and returns the corresponding access tier.

    Parameters
    ----------
    token_mint : str, optional
        SPL mint address for $FARTFORGE.  Reads FARTFORGE_TOKEN_MINT env var.
    rpc_url : str, optional
        Solana RPC endpoint.  Reads SOLANA_RPC_URL env var.
    cache_ttl_seconds : int
        How long to cache balance lookups (default: 60s).
        Prevents hammering the RPC on every request.
    """

    def __init__(
        self,
        token_mint:         Optional[str] = None,
        rpc_url:            Optional[str] = None,
        cache_ttl_seconds:  int           = 60,
    ):
        try:
            from solana.rpc.api import Client
            from solders.pubkey import Pubkey
        except ImportError as e:
            raise ImportError(
                "TokenGate requires solders and solana-py.\n"
                "pip install solders solana"
            ) from e

        self._mint   = token_mint or DEFAULT_TOKEN_MINT
        self._rpc    = rpc_url or os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
        self._client = Client(self._rpc)
        self._ttl    = cache_ttl_seconds
        self._cache: dict[str, tuple[float, float]] = {}   # wallet → (fetched_at, balance)

        _log.info("TokenGate initialised. Mint: %s", self._mint)

    # ── Public API ────────────────────────────────────────────────────────────

    def get_balance(self, wallet: str) -> float:
        """
        Return the $FARTFORGE token balance for a wallet address.
        Result is cached for `cache_ttl_seconds`.
        """
        import time
        now = time.monotonic()
        if wallet in self._cache:
            fetched_at, balance = self._cache[wallet]
            if now - fetched_at < self._ttl:
                return balance

        balance = self._fetch_balance(wallet)
        self._cache[wallet] = (now, balance)
        return balance

    def get_tier(self, wallet: str) -> str:
        """Return tier name ('FREE', 'BASIC', 'PRO', 'ELITE') for a wallet."""
        balance = self.get_balance(wallet)
        tier    = _balance_to_tier(balance)
        return Tier(tier).name

    def requires(self, wallet: str, minimum_tier: str | Tier) -> bool:
        """Return True if wallet meets the minimum tier."""
        if isinstance(minimum_tier, str):
            minimum_tier = Tier[minimum_tier.upper()]
        balance = self.get_balance(wallet)
        return _balance_to_tier(balance) >= minimum_tier

    def invalidate(self, wallet: str) -> None:
        """Force cache invalidation for a wallet (e.g. after a purchase)."""
        self._cache.pop(wallet, None)

    # ── Private ───────────────────────────────────────────────────────────────

    def _fetch_balance(self, wallet: str) -> float:
        from solders.pubkey import Pubkey
        try:
            owner = Pubkey.from_string(wallet)
            mint  = Pubkey.from_string(self._mint)
            resp  = self._client.get_token_accounts_by_owner_json_parsed(
                owner,
                {"mint": mint},
            )
            accounts = resp.value
            if not accounts:
                return 0.0
            for account in accounts:
                info = account.account.data.parsed.get("info", {})
                amount = info.get("tokenAmount", {}).get("uiAmount", 0.0)
                if amount:
                    return float(amount)
        except Exception as e:
            _log.warning("Failed to fetch balance for %s: %s", wallet, e)
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency factory
# ─────────────────────────────────────────────────────────────────────────────

def tier_required(gate: TokenGate):
    """
    Returns a FastAPI dependency factory.

    Usage
    -----
        require = tier_required(gate)

        @app.post("/events")
        def submit(_=Depends(require("BASIC"))):
            ...

        @app.post("/events/{id}/replay")
        def replay(_=Depends(require("ELITE"))):
            ...
    """
    def _factory(minimum_tier: str):
        try:
            from fastapi import HTTPException, Header
        except ImportError:
            raise ImportError("tier_required requires FastAPI. pip install fastapi")

        def _dependency(x_wallet: Optional[str] = Header(None)):
            if not x_wallet:
                raise HTTPException(
                    status_code=401,
                    detail=f"X-Wallet header required. Minimum tier: {minimum_tier}.",
                )
            if not gate.requires(x_wallet, minimum_tier):
                balance = gate.get_balance(x_wallet)
                needed  = TIER_THRESHOLDS[Tier[minimum_tier.upper()]]
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"Insufficient $FARTFORGE balance. "
                        f"Tier '{minimum_tier}' requires {needed} tokens. "
                        f"Your balance: {balance:.2f}. "
                        "Buy $FARTFORGE to unlock this tier."
                    ),
                )
        return _dependency
    return _factory
