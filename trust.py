"""
FARTForge — Trust & Integrity Layer
=====================================
Events can't be faked.  Scores can be verified.
Leaderboards become credible.

v2 hardening:
  - No insecure default secret.  Missing secret raises in production.
  - FARTFORGE_ENV controls dev vs prod behaviour.
  - Signature versioning (sig_v prefix) for future algorithm rotation.
  - Key rotation: HMACTrustLayer accepts a list of secrets.
    Signs with secrets[0], verifies against any.
  - AuditChain unchanged (already correct).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import warnings
from typing import Optional, Sequence

from .event import Event

_log = logging.getLogger("fartforge.trust")

# Current signature algorithm version tag
_SIG_VERSION = "v1"


def _get_env() -> str:
    return os.environ.get("FARTFORGE_ENV", "development").lower()


def _resolve_secret(secret: Optional[str | bytes]) -> bytes:
    """
    Resolve the HMAC secret.

    - If explicitly provided, use it.
    - Otherwise read FARTFORGE_SECRET env var.
    - In production (FARTFORGE_ENV=production), missing secret raises ValueError.
    - In development, falls back to an insecure default + loud warning.
    """
    if secret is not None:
        return secret.encode() if isinstance(secret, str) else secret

    env_secret = os.environ.get("FARTFORGE_SECRET")
    if env_secret:
        return env_secret.encode()

    env = _get_env()
    if env == "production":
        raise ValueError(
            "FARTFORGE_SECRET environment variable is required in production. "
            "Set it to a cryptographically random string (>= 32 bytes). "
            "To override for local testing, set FARTFORGE_ENV=development."
        )

    warnings.warn(
        "FARTFORGE_SECRET is not set and FARTFORGE_ENV is not 'production'. "
        "Using an insecure dev default — NEVER deploy this to production.",
        stacklevel=3,
    )
    return b"dev-insecure-default-do-not-ship"


# ─────────────────────────────────────────────────────────────────────────────
# Base class
# ─────────────────────────────────────────────────────────────────────────────

class TrustLayer:
    """Stamps an event with a hash and optional signature."""

    def stamp(self, event: Event) -> Event:
        event.compute_hash()
        return event

    def verify(self, event: Event) -> bool:
        return event.verify()


# ─────────────────────────────────────────────────────────────────────────────
# HMAC tier
# ─────────────────────────────────────────────────────────────────────────────

class HMACTrustLayer(TrustLayer):
    """
    HMAC-SHA256 signature over the event hash.

    Parameters
    ----------
    secret : str | bytes | list[str | bytes], optional
        Single secret or list of secrets for key rotation.
        secrets[0] (or the only secret) is used for signing.
        All secrets are tried during verification.
        If omitted, reads from FARTFORGE_SECRET env var.
    algorithm : str
        Digest algorithm (default: sha256).

    Key Rotation
    ------------
    When rotating keys:
      1. Add new key at index 0, keep old key(s) at index 1+.
      2. All new events are signed with the new key.
      3. Old events verify against whichever key was current.
      4. Remove old key(s) after all old events have been re-signed or expired.
    """

    def __init__(
        self,
        secret: Optional[str | bytes | list] = None,
        algorithm: str = "sha256",
    ):
        if isinstance(secret, list):
            self._secrets = [
                s.encode() if isinstance(s, str) else s for s in secret
            ]
            if not self._secrets:
                raise ValueError("secret list cannot be empty")
        else:
            self._secrets = [_resolve_secret(secret)]

        self._algorithm = algorithm

    def _sign(self, event_hash: str, secret: bytes) -> str:
        raw = hmac.new(secret, event_hash.encode(), self._algorithm).hexdigest()
        return f"{_SIG_VERSION}:{raw}"

    def stamp(self, event: Event) -> Event:
        event.compute_hash()
        event.signature = self._sign(event.event_hash, self._secrets[0])
        return event

    def verify(self, event: Event) -> bool:
        if not event.verify():
            return False
        if event.signature is None:
            return False
        # Strip version prefix if present
        sig = event.signature
        if ":" in sig:
            _, sig_hex = sig.split(":", 1)
        else:
            sig_hex = sig  # legacy unsigned

        # Constant-time check against all known secrets
        for secret in self._secrets:
            expected_full = self._sign(event.event_hash, secret)
            _, expected_hex = expected_full.split(":", 1)
            if hmac.compare_digest(sig_hex, expected_hex):
                return True
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Ed25519 asymmetric signing (optional, requires `cryptography`)
# ─────────────────────────────────────────────────────────────────────────────

class Ed25519TrustLayer(TrustLayer):
    """
    Ed25519 asymmetric signing.  Requires: pip install cryptography

    - Sign with private key (kept secret on emitting agent)
    - Verify with public key (safe to distribute)
    """

    def __init__(
        self,
        private_key_pem: Optional[bytes] = None,
        public_key_pem:  Optional[bytes] = None,
    ):
        try:
            from cryptography.hazmat.primitives.serialization import (
                load_pem_private_key, load_pem_public_key,
            )
            self._load_private = load_pem_private_key
            self._load_public  = load_pem_public_key
        except ImportError as e:
            raise ImportError(
                "Ed25519TrustLayer requires the 'cryptography' package.\n"
                "pip install cryptography"
            ) from e

        self._private_pem = private_key_pem
        self._public_pem  = public_key_pem

    def stamp(self, event: Event) -> Event:
        if not self._private_pem:
            raise RuntimeError("private_key_pem required for stamp()")
        key = self._load_private(self._private_pem, password=None)
        event.compute_hash()
        sig = key.sign(event.event_hash.encode())
        event.signature = f"ed25519:{sig.hex()}"
        return event

    def verify(self, event: Event) -> bool:
        if not event.verify():
            return False
        if not self._public_pem or not event.signature:
            return False
        from cryptography.exceptions import InvalidSignature
        sig_hex = event.signature.replace("ed25519:", "")
        key = self._load_public(self._public_pem)
        try:
            key.verify(bytes.fromhex(sig_hex), event.event_hash.encode())
            return True
        except InvalidSignature:
            return False


# ─────────────────────────────────────────────────────────────────────────────
# Audit chain — append-only tamper-evident linked list
# ─────────────────────────────────────────────────────────────────────────────

class AuditChain:
    """
    Links events into a chain where each entry references the previous hash.
    Like a mini blockchain for your agent events.

    Not a DB replacement — use as an integrity fence around your event log.
    """

    def __init__(self):
        self._prev_hash: str          = "GENESIS"
        self._entries:   list[dict]   = []

    def append(self, event: Event) -> str:
        entry = {
            "event_hash": event.event_hash,
            "prev_hash":  self._prev_hash,
            "timestamp":  event.timestamp,
        }
        chain_hash = hashlib.sha256(
            json.dumps(entry, sort_keys=True).encode()
        ).hexdigest()
        entry["chain_hash"] = chain_hash
        self._entries.append(entry)
        self._prev_hash = chain_hash
        return chain_hash

    def verify_chain(self) -> bool:
        prev = "GENESIS"
        for entry in self._entries:
            expected = hashlib.sha256(
                json.dumps(
                    {
                        "event_hash": entry["event_hash"],
                        "prev_hash":  prev,
                        "timestamp":  entry["timestamp"],
                    },
                    sort_keys=True,
                ).encode()
            ).hexdigest()
            if expected != entry["chain_hash"]:
                return False
            prev = entry["chain_hash"]
        return True

    def export(self) -> list[dict]:
        """Serialise chain for archival / shipping to a verifier."""
        return list(self._entries)

    def __len__(self) -> int:
        return len(self._entries)
