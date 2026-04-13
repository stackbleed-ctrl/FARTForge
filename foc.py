# fartforge/foc.py
"""
FOC — Fart On Chain
====================
Orchestrates the full pipeline:
  1. Accept analysis result from HumanAnalyzer or FartEmitter
  2. Upload raw audio permanently to Arweave
  3. Upload JSON metadata to Arweave
  4. Mint a Compressed NFT on Solana via Metaplex Bubblegum
  5. Return mint address + Arweave URLs

Dependencies (pip install fartforge[foc]):
  - requests
  - solders
  - solana
  - anchorpy (for Bubblegum CPI)
  OR use the lighter helper that builds the transaction
  and asks the frontend wallet to sign it.

Design principle: FOC never holds private keys.
All transactions are built server-side and signed by the user's
Phantom/Solflare wallet via the Next.js frontend (WalletProviders.tsx).
The Python backend builds + serialises the tx, returns base64,
frontend signs + sends.
"""

from __future__ import annotations

import json
import os
import tempfile
from typing import Any, Dict, Optional

import requests


# ── Arweave ────────────────────────────────────────────────────────────────

ARWEAVE_GATEWAY   = "https://arweave.net"
ARWEAVE_UPLOAD_URL = "https://node2.bundlr.network"   # Bundlr/Irys node (no wallet needed for < 100KB with free tier)
IRYS_UPLOAD_URL    = "https://uploader.irys.xyz/upload" # Irys v2 (preferred)


class ArweaveUploader:
    """
    Upload files to Arweave via Irys (formerly Bundlr).
    For audio files < ~5MB: free with Irys free tier (no SOL needed).
    For larger files: requires funded Irys node.
    """

    def __init__(self, irys_token: Optional[str] = None):
        # irys_token: JWT from Irys auth (optional for free tier)
        self.token = irys_token or os.getenv("IRYS_TOKEN")

    def upload_bytes(self, data: bytes, content_type: str, tags: Dict[str, str] = {}) -> str:
        """
        Upload raw bytes to Arweave via Irys.
        Returns the Arweave transaction ID (arweave.net/<tx_id>).
        """
        headers = {"Content-Type": content_type}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        # Build Irys tags
        tag_list = [{"name": k, "value": v} for k, v in {
            "Content-Type": content_type,
            "App-Name": "FARTForge",
            "App-Version": "2.0",
            **tags,
        }.items()]

        # Try Irys v2
        try:
            res = requests.post(
                IRYS_UPLOAD_URL,
                data=data,
                headers={
                    **headers,
                    "x-irys-tags": json.dumps(tag_list),
                },
                timeout=30,
            )
            if res.status_code in (200, 201):
                tx_id = res.json().get("id") or res.json().get("txId")
                if tx_id:
                    return f"{ARWEAVE_GATEWAY}/{tx_id}"
        except Exception as e:
            print(f"[FOC] Irys upload failed: {e}, trying fallback...")

        # Fallback: Arweave gateway direct (requires AR wallet — skip in free mode)
        raise RuntimeError(
            "Arweave upload failed. Set IRYS_TOKEN env var or fund your Irys node. "
            "See: https://docs.irys.xyz/build/d/irys-in-3-minutes"
        )

    def upload_audio(self, audio_path: str) -> str:
        """Upload a local audio file. Returns permanent Arweave URL."""
        with open(audio_path, "rb") as f:
            data = f.read()
        ext = audio_path.rsplit(".", 1)[-1].lower()
        mime = {"wav": "audio/wav", "mp3": "audio/mpeg", "webm": "audio/webm", "ogg": "audio/ogg"}.get(ext, "audio/wav")
        return self.upload_bytes(data, mime, {"Fart-Source": "human", "File-Extension": ext})

    def upload_audio_bytes(self, data: bytes, suffix: str = ".wav") -> str:
        """Upload audio from raw bytes. Returns permanent Arweave URL."""
        ext = suffix.lstrip(".").lower()
        mime = {"wav": "audio/wav", "mp3": "audio/mpeg", "webm": "audio/webm", "ogg": "audio/ogg"}.get(ext, "audio/wav")
        return self.upload_bytes(data, mime, {"Fart-Source": "human"})

    def upload_metadata(self, metadata: Dict[str, Any]) -> str:
        """Upload NFT JSON metadata. Returns permanent Arweave URL."""
        data = json.dumps(metadata, indent=2).encode("utf-8")
        return self.upload_bytes(data, "application/json", {"Metadata-Standard": "Metaplex"})


# ── NFT Metadata Builder ───────────────────────────────────────────────────

def build_nft_metadata(
    analysis: Dict[str, Any],
    audio_arweave_url: str,
    owner_address: str,
    emission_id: str,
) -> Dict[str, Any]:
    """
    Build Metaplex-compatible NFT metadata for a Fart Receipt cNFT.
    Follows the Metaplex Token Metadata standard.
    """
    sp = analysis.get("sound_profile", {})
    op = analysis.get("odor_profile", {})
    score = analysis.get("stink_score", 0)
    archetype = analysis.get("archetype", "Unknown")
    source = analysis.get("source", "human")
    summary = analysis.get("summary", "")

    # Trait helpers
    def score_tier(s: float) -> str:
        if s >= 9.5: return "Nuclear"
        if s >= 8.0: return "Intense"
        if s >= 6.0: return "Moderate"
        if s >= 4.0: return "Mild"
        return "Silent"

    attributes = [
        {"trait_type": "Stink Score",         "value": score},
        {"trait_type": "Score Tier",           "value": score_tier(score)},
        {"trait_type": "Archetype",            "value": archetype},
        {"trait_type": "Source",               "value": "Human" if source == "human" else "AI Agent"},
        {"trait_type": "Duration (s)",         "value": round(sp.get("duration_seconds", 0), 2)},
        {"trait_type": "Spectral Centroid Hz", "value": round(sp.get("spectral_centroid_hz", 0), 1)},
        {"trait_type": "Wetness Score",        "value": round(sp.get("wetness_score", 0), 3)},
        {"trait_type": "H2S ppm",              "value": round(op.get("H2S", {}).get("ppm", 0), 4)},
        {"trait_type": "Methanethiol ppm",     "value": round(op.get("methanethiol", {}).get("ppm", 0), 4)},
        {"trait_type": "Indole ppm",           "value": round(op.get("indole", {}).get("ppm", 0), 5)},
        {"trait_type": "Emission ID",          "value": emission_id},
        {"trait_type": "On-Chain Standard",    "value": "FOC-1"},  # Fart On Chain v1
    ]

    return {
        "name": f"Fart Receipt #{emission_id[:8].upper()}",
        "symbol": "FART",
        "description": summary or f"A scientifically analysed fart emission. Stink score: {score}/10. Archetype: {archetype}. Permanently on Arweave.",
        "image": "https://arweave.net/fartforge-nft-image-placeholder",  # Replace with generated image URL
        "animation_url": audio_arweave_url,
        "external_url": f"https://fartforge.xyz/receipt/{emission_id}",
        "attributes": attributes,
        "properties": {
            "files": [
                {"uri": audio_arweave_url, "type": "audio/wav"},
            ],
            "category": "audio",
            "creators": [
                {"address": owner_address, "share": 100},
            ],
        },
        "foc_version": "1.0",
        "emission_id": emission_id,
        "full_analysis": analysis,
    }


# ── FOC Pipeline ───────────────────────────────────────────────────────────

class FartOnChain:
    """
    Main FOC orchestrator.

    Usage:
        foc = FartOnChain()

        # From a file path:
        result = foc.process(
            audio_path="recording.wav",
            analysis=analyzer.analyze_fart("recording.wav"),
            owner_address="YourSolanaWalletAddress",
        )
        print(result["metadata_arweave_url"])
        print(result["mint_tx_base64"])  # send to frontend to sign

        # From bytes (FastAPI upload):
        result = foc.process_bytes(
            audio_bytes=raw_bytes,
            analysis=analysis_dict,
            owner_address="...",
        )
    """

    def __init__(self, irys_token: Optional[str] = None):
        self.arweave = ArweaveUploader(irys_token=irys_token)

    def process(
        self,
        audio_path: str,
        analysis: Dict[str, Any],
        owner_address: str,
        emission_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full FOC pipeline from a local audio file.
        Returns dict with arweave URLs + unsigned mint transaction.
        """
        import uuid
        eid = emission_id or uuid.uuid4().hex[:12]

        # 1. Upload audio to Arweave
        print(f"[FOC] Uploading audio to Arweave...")
        audio_url = self.arweave.upload_audio(audio_path)
        print(f"[FOC] Audio permanent URL: {audio_url}")

        # 2. Build + upload metadata
        metadata = build_nft_metadata(analysis, audio_url, owner_address, eid)
        print(f"[FOC] Uploading metadata to Arweave...")
        metadata_url = self.arweave.upload_metadata(metadata)
        print(f"[FOC] Metadata permanent URL: {metadata_url}")

        # 3. Build unsigned Bubblegum cNFT mint transaction
        mint_tx_b64 = build_cnft_mint_transaction(
            owner_address=owner_address,
            metadata_uri=metadata_url,
            name=metadata["name"],
            symbol=metadata["symbol"],
        )

        return {
            "emission_id": eid,
            "audio_arweave_url": audio_url,
            "metadata_arweave_url": metadata_url,
            "nft_name": metadata["name"],
            "stink_score": analysis.get("stink_score"),
            "archetype": analysis.get("archetype"),
            "mint_tx_base64": mint_tx_b64,   # frontend signs this with Phantom/Solflare
            "status": "awaiting_wallet_signature",
        }

    def process_bytes(
        self,
        audio_bytes: bytes,
        analysis: Dict[str, Any],
        owner_address: str,
        suffix: str = ".wav",
        emission_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Full FOC pipeline from raw audio bytes."""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name
        try:
            return self.process(tmp_path, analysis, owner_address, emission_id)
        finally:
            os.unlink(tmp_path)


# ── Metaplex Bubblegum cNFT transaction builder ────────────────────────────

def build_cnft_mint_transaction(
    owner_address: str,
    metadata_uri: str,
    name: str,
    symbol: str,
    tree_address: Optional[str] = None,
) -> Optional[str]:
    """
    Build a serialised (base64) Metaplex Bubblegum mintToCollectionV1 transaction.
    Returns base64 string for the frontend wallet to sign.

    Requires:
        pip install solana solders

    Tree address: your pre-created Merkle tree for compressed NFTs.
    Set FARTFORGE_MERKLE_TREE env var or pass tree_address directly.
    If not set, returns None and logs instructions to create one.
    """
    tree = tree_address or os.getenv("FARTFORGE_MERKLE_TREE")
    rpc  = os.getenv("NEXT_PUBLIC_SOLANA_RPC", "https://api.mainnet-beta.solana.com")

    if not tree:
        print(
            "[FOC] No Merkle tree configured. Create one with:\n"
            "  npx ts-node scripts/create-merkle-tree.ts\n"
            "Then set FARTFORGE_MERKLE_TREE=<address> in your .env"
        )
        return None

    try:
        from solana.rpc.api import Client
        from solders.pubkey import Pubkey
        from solders.transaction import Transaction

        # Build Bubblegum mintToCollectionV1 instruction
        # This is the minimal instruction set — full implementation
        # uses anchorpy with the Bubblegum IDL.
        # For now: returns a placeholder that the frontend
        # can replace with its own @metaplex-foundation/mpl-bubblegum call.
        print(f"[FOC] Building cNFT mint tx for tree {tree[:8]}...")
        return _build_bubblegum_tx(owner_address, metadata_uri, name, symbol, tree, rpc)

    except ImportError:
        print("[FOC] solana/solders not installed. Run: pip install fartforge[foc]")
        return None
    except Exception as e:
        print(f"[FOC] Transaction build failed: {e}")
        return None


def _build_bubblegum_tx(
    owner: str,
    uri: str,
    name: str,
    symbol: str,
    tree: str,
    rpc_url: str,
) -> str:
    """
    Build the actual Bubblegum cNFT mint transaction.
    Returns base64-encoded transaction for wallet signing.
    """
    from solana.rpc.api import Client
    from solders.pubkey import Pubkey
    from solders.instruction import Instruction, AccountMeta
    from solders.message import Message
    from solders.transaction import Transaction
    from solders.hash import Hash
    import struct
    import base64

    client = Client(rpc_url)
    blockhash_resp = client.get_latest_blockhash()
    blockhash = blockhash_resp.value.blockhash

    BUBBLEGUM_PROGRAM = Pubkey.from_string("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY")
    owner_pk = Pubkey.from_string(owner)
    tree_pk  = Pubkey.from_string(tree)

    # Bubblegum mintV1 discriminator
    discriminator = bytes([145, 98, 192, 118, 184, 147, 118, 104])

    # Encode metadata args (simplified — full Borsh encoding)
    name_bytes   = name.encode("utf-8")
    symbol_bytes = symbol.encode("utf-8")
    uri_bytes    = uri.encode("utf-8")

    data = (
        discriminator
        + struct.pack("<I", len(name_bytes))   + name_bytes
        + struct.pack("<I", len(symbol_bytes)) + symbol_bytes
        + struct.pack("<I", len(uri_bytes))    + uri_bytes
        + struct.pack("<H", 500)               # seller_fee_basis_points (5%)
        + b'\x00'                              # primary_sale_happened = false
        + b'\x01'                              # is_mutable = true
    )

    ix = Instruction(
        program_id=BUBBLEGUM_PROGRAM,
        accounts=[
            AccountMeta(pubkey=tree_pk,  is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner_pk, is_signer=True,  is_writable=True),
            AccountMeta(pubkey=owner_pk, is_signer=False, is_writable=False),  # leaf_owner
        ],
        data=data,
    )

    msg = Message.new_with_blockhash([ix], owner_pk, blockhash)
    tx  = Transaction.new_unsigned(msg)

    return base64.b64encode(bytes(tx)).decode("utf-8")
