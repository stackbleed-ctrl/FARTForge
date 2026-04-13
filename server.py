# fartforge/server.py
# FastAPI backend — serves /analyze and /mint (FOC) endpoints
# Run: uvicorn fartforge.server:app --host 0.0.0.0 --port 8000

import base64
import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional

from fartforge.human_analyzer import HumanAnalyzer
from fartforge.foc import FartOnChain

app = FastAPI(title="FartForge API", version="2.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://fartforge.xyz",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

analyzer = HumanAnalyzer()
foc      = FartOnChain(irys_token=os.getenv("IRYS_TOKEN"))


# ── /analyze ──────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze_fart(
    audio: UploadFile = File(..., description="WAV/MP3/OGG/WEBM fart audio"),
    intensity_boost: int = Form(0, ge=0, le=3),
):
    """Analyze fart audio. Returns sound profile, odor fingerprint, stink_score."""
    audio_bytes = await audio.read()
    suffix = "." + (audio.filename or "recording.webm").split(".")[-1]
    return analyzer.from_bytes(audio_bytes, suffix=suffix, intensity_boost=intensity_boost)


# ── /mint ─────────────────────────────────────────────────────────────────

class MintRequest(BaseModel):
    analysis:      Dict[str, Any]
    owner_address: str
    audio_base64:  Optional[str] = None
    emission_id:   Optional[str] = None


@app.post("/mint")
async def mint_foc_nft(req: MintRequest):
    """
    FOC — Fart On Chain.
    Uploads audio + metadata to Arweave, builds unsigned cNFT mint tx.
    Frontend signs + broadcasts mint_tx_base64 with Phantom/Solflare.
    """
    if not req.audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 required for Arweave upload.")
    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")
    try:
        return foc.process_bytes(
            audio_bytes=audio_bytes,
            analysis=req.analysis,
            owner_address=req.owner_address,
            suffix=".wav",
            emission_id=req.emission_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FOC pipeline error: {e}")


# ── /health ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "💨 operational",
        "arweave": "irys" if os.getenv("IRYS_TOKEN") else "free-tier only",
        "merkle_tree": os.getenv("FARTFORGE_MERKLE_TREE", "not configured"),
    }
