# fartforge/server.py
# FastAPI backend — serves the /analyze endpoint for the Next.js HumanAnalyzer component
# Run: uvicorn fartforge.server:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from fartforge.human_analyzer import HumanAnalyzer

app = FastAPI(title="FartForge Human Anal-yzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://fartforge.xyz"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

analyzer = HumanAnalyzer()


@app.post("/analyze")
async def analyze_fart(
    audio: UploadFile = File(..., description="WAV/MP3/OGG/WEBM fart audio"),
    intensity_boost: int = Form(0, ge=0, le=3, description="0–3 spice boost (wallet tier)"),
):
    """
    Analyze a recorded fart audio file.
    Returns sound profile, odor fingerprint, stink_score, and leaderboard entry.
    """
    audio_bytes = await audio.read()
    suffix = "." + (audio.filename or "recording.webm").split(".")[-1]
    result = analyzer.from_bytes(audio_bytes, suffix=suffix, intensity_boost=intensity_boost)
    return result


@app.get("/health")
async def health():
    return {"status": "💨 operational"}
