"""
FARTForge — Solana On-Chain Event Anchoring
=============================================
Write event hashes to Solana as Memo transactions.
Creates an immutable, timestamped, publicly-verifiable proof that an
evaluation event existed at a specific slot — without storing raw data on-chain.

How it works
------------
1. Agent emits an event → gets back event_hash (SHA-256).
2. anchor_event(event) sends a Memo tx with the hash as the message.
3. The tx signature is stored in event.metadata["solana_tx"].
4. Anyone can verify: fetch the tx, check the memo matches the hash.

Requirements
------------
    pip install solders solana

Environment variables
---------------------
    SOLANA_RPC_URL        — Solana RPC endpoint (default: mainnet-beta)
    SOLANA_PAYER_KEYPAIR  — Base58-encoded keypair JSON for the payer account
                            (the wallet that pays for Memo tx fees ~0.000005 SOL each)

Usage
-----
    from fartforge.solana.anchor import SolanaAnchor, anchor_event_hook

    anchor = SolanaAnchor()

    # Manual
    tx_sig = anchor.anchor_event(event)

    # As an EmitHook
    emitter = EventEmitter(..., hooks=[anchor_event_hook(anchor)])
"""

from __future__ import annotations

import json
import logging
import os
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ..emitter.event import Event
    from ..emitter.core import EmitResult, EmitHook

_log = logging.getLogger("fartforge.solana.anchor")

# Solana Memo Program v2
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"

# Mainnet-beta default — override with SOLANA_RPC_URL for devnet/testnet
DEFAULT_RPC = "https://api.mainnet-beta.solana.com"


class SolanaAnchor:
    """
    Anchors FARTForge event hashes on Solana via Memo transactions.

    Each call to anchor_event() costs ~0.000005 SOL in transaction fees.
    Batch with anchor_batch() for efficiency.

    Parameters
    ----------
    rpc_url : str, optional
        Solana RPC endpoint.  Reads SOLANA_RPC_URL env var or mainnet-beta.
    keypair_json : str, optional
        Base58 keypair JSON string.  Reads SOLANA_PAYER_KEYPAIR env var.
    commitment : str
        Transaction commitment level. "confirmed" is safe for most uses.
    """

    def __init__(
        self,
        rpc_url:      Optional[str] = None,
        keypair_json: Optional[str] = None,
        commitment:   str           = "confirmed",
    ):
        try:
            from solders.keypair import Keypair
            from solders.pubkey import Pubkey
            from solana.rpc.api import Client
            from solana.transaction import Transaction
        except ImportError as e:
            raise ImportError(
                "SolanaAnchor requires solders and solana-py.\n"
                "pip install solders solana"
            ) from e

        self._rpc_url   = rpc_url or os.environ.get("SOLANA_RPC_URL", DEFAULT_RPC)
        self._commitment = commitment

        # Load payer keypair
        kp_raw = keypair_json or os.environ.get("SOLANA_PAYER_KEYPAIR")
        if not kp_raw:
            raise ValueError(
                "SOLANA_PAYER_KEYPAIR env var is required for SolanaAnchor. "
                "Set it to your base58 keypair JSON."
            )
        try:
            self._keypair = Keypair.from_json(kp_raw)
        except Exception as e:
            raise ValueError(f"Invalid SOLANA_PAYER_KEYPAIR: {e}") from e

        self._client = Client(self._rpc_url)
        _log.info("SolanaAnchor initialised. Payer: %s", self._keypair.pubkey())

    # ── Public API ────────────────────────────────────────────────────────────

    def anchor_event(self, event: "Event") -> str:
        """
        Send a Memo transaction containing the event hash.

        Returns
        -------
        str
            Solana transaction signature (base58).

        Side effects
        ------------
        Sets event.metadata["solana_tx"] to the tx signature.
        Sets event.metadata["solana_slot"] if available.
        """
        if not event.event_hash:
            raise ValueError("Event must have a computed hash before anchoring.")

        memo_data = json.dumps({
            "ff":  "fartforge",     # namespace prefix
            "h":   event.event_hash,
            "a":   event.agent_id,
            "ts":  event.timestamp,
        }, separators=(",", ":"))

        tx_sig = self._send_memo(memo_data)
        event.metadata["solana_tx"]   = tx_sig
        event.metadata["solana_rpc"]  = self._rpc_url
        _log.info("Anchored event %s → tx %s", event.event_id, tx_sig)
        return tx_sig

    def anchor_batch(self, events: list["Event"]) -> list[str]:
        """Anchor multiple events.  Returns list of tx signatures."""
        return [self.anchor_event(e) for e in events]

    def verify_anchor(self, event: "Event") -> bool:
        """
        Fetch the stored Solana tx and verify the memo matches the event hash.

        Returns True if the on-chain record matches the event hash.
        """
        tx_sig = event.metadata.get("solana_tx")
        if not tx_sig:
            _log.warning("Event %s has no solana_tx in metadata", event.event_id)
            return False

        try:
            resp = self._client.get_transaction(tx_sig, encoding="jsonParsed")
            tx_data = resp.value
            if tx_data is None:
                return False
            # Parse memo from instruction data
            for ix in tx_data.transaction.message.instructions:
                if hasattr(ix, "parsed") and isinstance(ix.parsed, str):
                    memo = ix.parsed
                    try:
                        payload = json.loads(memo)
                        return payload.get("h") == event.event_hash
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            _log.error("Failed to verify anchor for %s: %s", event.event_id, e)

        return False

    # ── Private ───────────────────────────────────────────────────────────────

    def _send_memo(self, memo_text: str) -> str:
        from solders.pubkey import Pubkey
        from solders.transaction import Transaction as SoldersTransaction
        from solders.message import Message
        from solders.instruction import Instruction, AccountMeta
        from solders.hash import Hash
        from solana.rpc.types import TxOpts

        memo_prog = Pubkey.from_string(MEMO_PROGRAM_ID)
        ix = Instruction(
            program_id = memo_prog,
            accounts   = [AccountMeta(pubkey=self._keypair.pubkey(), is_signer=True, is_writable=False)],
            data       = memo_text.encode("utf-8"),
        )

        # Get latest blockhash
        blockhash_resp = self._client.get_latest_blockhash(commitment=self._commitment)
        blockhash = blockhash_resp.value.blockhash

        msg = Message.new_with_blockhash(
            [ix],
            self._keypair.pubkey(),
            blockhash,
        )
        tx = SoldersTransaction([self._keypair], msg, blockhash)

        resp = self._client.send_transaction(
            tx,
            opts=TxOpts(skip_confirmation=False, preflight_commitment=self._commitment),
        )
        return str(resp.value)


# ─────────────────────────────────────────────────────────────────────────────
# EmitHook factory
# ─────────────────────────────────────────────────────────────────────────────

def anchor_event_hook(anchor: SolanaAnchor, only_accepted: bool = True) -> "EmitHook":
    """
    Factory: returns an EmitHook that anchors every accepted event on Solana.

    Parameters
    ----------
    anchor : SolanaAnchor
    only_accepted : bool
        If True (default), only anchor events that passed validation.
        Set to False to anchor everything including rejected events.
    """
    from ..emitter.core import EmitHook, EmitResult
    from ..emitter.event import Event

    class _AnchorHook(EmitHook):
        def on_emit(self, result: EmitResult) -> None:
            if only_accepted and not result.accepted:
                return
            try:
                anchor.anchor_event(result.event)
            except Exception as e:
                _log.warning("anchor_event_hook failed: %s", e)

        def on_error(self, error: Exception, event: Event) -> None:
            pass

    return _AnchorHook()
