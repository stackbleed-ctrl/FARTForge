#!/usr/bin/env python3
"""
fartforge-cleanse.py
====================
FARTForge Weekly Cleanse — Fart On Chain (FOC) cron script.

Run manually or schedule with cron / Task Scheduler / launchd.

What it does:
  1. Emits a fart (AI agent mode) OR prompts you to record a real one
  2. Runs full analysis (HumanAnalyzer DSP or FartEmitter fingerprint)
  3. Uploads audio permanently to Arweave via Irys
  4. Builds an unsigned Compressed NFT mint transaction
  5. Opens your browser to sign the transaction with Phantom/Solflare
  6. Logs to FartForge leaderboard
  7. Sends you a meme-style summary notification (Telegram / Discord / plain print)
  8. Tracks your weekly streak

Install:
  pip install fartforge[all]

Usage:
  python fartforge-cleanse.py                    # AI agent emission
  python fartforge-cleanse.py --human            # Record real human fart via mic
  python fartforge-cleanse.py --file my_rip.wav  # Analyze existing file
  python fartforge-cleanse.py --intensity nuclear # Force intensity level
  python fartforge-cleanse.py --dry-run           # Run without Arweave/mint

Schedule (Linux/Mac cron — every Friday 20:00 UTC):
  crontab -e
  0 20 * * 5 /usr/bin/python3 /path/to/fartforge-cleanse.py --intensity nuclear >> ~/.fartforge/cleanse.log 2>&1

Schedule (Mac launchd):
  See scripts/com.fartforge.cleanse.plist

Schedule (Windows Task Scheduler):
  See scripts/fartforge-cleanse-task.xml
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────────

FARTFORGE_DIR    = Path.home() / ".fartforge"
STREAK_FILE      = FARTFORGE_DIR / "streak.json"
LOG_FILE         = FARTFORGE_DIR / "cleanse.log"
ARENA_BASE       = "https://fartforge.xyz"
PUMP_URL         = "https://pump.fun/coin/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump"
MINT             = "5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump"

# Filled from env or prompted on first run
WALLET_ADDRESS   = os.getenv("FARTFORGE_WALLET", "")
IRYS_TOKEN       = os.getenv("IRYS_TOKEN", "")
MERKLE_TREE      = os.getenv("FARTFORGE_MERKLE_TREE", "")
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DISCORD_WEBHOOK  = os.getenv("DISCORD_WEBHOOK_URL", "")
SUPABASE_URL     = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY     = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# ── Helpers ─────────────────────────────────────────────────────────────────

def banner(msg: str) -> None:
    print(f"\n💨  {msg}")

def step(n: int, msg: str) -> None:
    print(f"  [{n}] {msg}")

def ok(msg: str) -> None:
    print(f"      ✅ {msg}")

def warn(msg: str) -> None:
    print(f"      ⚠️  {msg}")

def err(msg: str) -> None:
    print(f"      ❌ {msg}", file=sys.stderr)


# ── Streak tracking ──────────────────────────────────────────────────────────

def load_streak() -> dict:
    FARTFORGE_DIR.mkdir(exist_ok=True)
    if STREAK_FILE.exists():
        try:
            return json.loads(STREAK_FILE.read_text())
        except Exception:
            pass
    return {"streak": 0, "last_cleanse": None, "total_cleanses": 0, "best_score": 0}


def save_streak(data: dict) -> None:
    STREAK_FILE.write_text(json.dumps(data, indent=2))


def update_streak(stink_score: float) -> dict:
    data = load_streak()
    now = datetime.now(timezone.utc).isoformat()
    last = data.get("last_cleanse")

    # Count streak: consecutive weeks within 9 days tolerance
    if last:
        from datetime import timedelta
        last_dt = datetime.fromisoformat(last)
        days_since = (datetime.now(timezone.utc) - last_dt).days
        if days_since <= 9:
            data["streak"] = data.get("streak", 0) + 1
        else:
            warn(f"Streak broken! {days_since} days since last cleanse.")
            data["streak"] = 1
    else:
        data["streak"] = 1

    data["last_cleanse"]    = now
    data["total_cleanses"]  = data.get("total_cleanses", 0) + 1
    data["best_score"]      = max(data.get("best_score", 0), stink_score)
    save_streak(data)
    return data


# ── Step 1: Get audio + analysis ────────────────────────────────────────────

def get_analysis_agent(intensity: str, agent_id: str) -> tuple[dict, Optional[str]]:
    """Run FartEmitter and return (analysis_dict, audio_path)."""
    from fartforge.core import FartEmitter
    emitter = FartEmitter(
        agent_id=agent_id,
        supabase_url=SUPABASE_URL or None,
        supabase_key=SUPABASE_KEY or None,
        play_audio=True,
        return_audio_b64=False,
        verbose=False,
    )
    result = emitter.emit(intensity=intensity, context="weekly_foc_cleanse")  # type: ignore

    # Convert EmitResult to dict compatible with FOC / HumanAnalyzer format
    analysis = {
        "source":       "agent",
        "archetype":    _score_to_archetype(result.stink_score),
        "stink_score":  result.stink_score,
        "summary":      f"Agent emission · {result.stink_score}/10 · {intensity}",
        "sound_profile": result.fingerprint,
        "odor_profile":  result.odor_profile,
        "leaderboard_eligible": True,
    }
    return analysis, result.audio_path


def get_analysis_human(audio_path: str) -> tuple[dict, str]:
    """Run HumanAnalyzer on an existing file."""
    from fartforge.human_analyzer import HumanAnalyzer
    analyzer = HumanAnalyzer()
    analysis = analyzer.analyze_fart(audio_path)
    return analysis, audio_path


def record_human_fart(duration_seconds: int = 5) -> str:
    """Record mic input to a temp WAV file. Returns path."""
    import tempfile
    try:
        import sounddevice as sd
        import soundfile as sf
    except ImportError:
        err("sounddevice/soundfile not installed. Run: pip install fartforge[human]")
        sys.exit(1)

    out_path = str(FARTFORGE_DIR / f"human_{uuid.uuid4().hex[:8]}.wav")
    FARTFORGE_DIR.mkdir(exist_ok=True)
    sr = 44100

    print(f"\n  🎙️  Recording {duration_seconds}s — RIP ONE NOW! ", end="", flush=True)
    for i in range(3, 0, -1):
        print(f"{i}... ", end="", flush=True)
        time.sleep(1)
    print("GO! 💨")

    audio = sd.rec(int(duration_seconds * sr), samplerate=sr, channels=1, dtype="float32")
    sd.wait()
    sf.write(out_path, audio, sr)
    print(f"  Recording saved: {out_path}")
    return out_path


def _score_to_archetype(score: float) -> str:
    if score >= 9.5: return "Nuclear Overlord"
    if score >= 8.0: return "Bass Cannon"
    if score >= 6.5: return "Classic Trombone Toot"
    if score >= 5.0: return "Mild Murmur"
    return "Silent But Deadly"


# ── Step 2: FOC — Arweave + mint tx ──────────────────────────────────────────

def run_foc(analysis: dict, audio_path: str, wallet: str, dry_run: bool) -> dict:
    """Upload to Arweave and build cNFT mint transaction."""
    if dry_run:
        warn("DRY RUN — skipping Arweave upload and mint tx build")
        return {
            "emission_id":         "dryrun_" + uuid.uuid4().hex[:8],
            "audio_arweave_url":   "https://arweave.net/DRY_RUN",
            "metadata_arweave_url":"https://arweave.net/DRY_RUN_META",
            "mint_tx_base64":      None,
            "status":              "dry_run",
        }

    from fartforge.foc import FartOnChain
    foc = FartOnChain(irys_token=IRYS_TOKEN or None)
    return foc.process(
        audio_path=audio_path,
        analysis=analysis,
        owner_address=wallet,
    )


# ── Step 3: Open browser to sign tx ──────────────────────────────────────────

def open_sign_page(foc_result: dict, wallet: str) -> None:
    """
    Opens the FartForge arena mint page with the tx pre-loaded.
    The user signs in Phantom/Solflare in their browser.
    """
    tx_b64 = foc_result.get("mint_tx_base64")
    emission_id = foc_result.get("emission_id", "")

    if not tx_b64:
        warn("No mint transaction built (Merkle tree not configured). Skipping browser sign step.")
        warn(f"Set FARTFORGE_MERKLE_TREE in your environment to enable cNFT minting.")
        warn(f"Arweave audio is still permanent: {foc_result.get('audio_arweave_url')}")
        return

    # Deep link to arena mint page with tx encoded in URL
    import urllib.parse
    sign_url = (
        f"{ARENA_BASE}/mint"
        f"?tx={urllib.parse.quote(tx_b64)}"
        f"&emission_id={emission_id}"
        f"&wallet={wallet}"
    )

    print(f"\n  🔏 Opening browser to sign cNFT mint tx...")
    print(f"     URL: {sign_url[:80]}...")
    webbrowser.open(sign_url)
    print(f"     Sign the transaction in Phantom/Solflare to complete your Fart Receipt NFT mint.")


# ── Step 4: Leaderboard submission ───────────────────────────────────────────

def submit_to_leaderboard(analysis: dict, foc_result: dict, wallet: str) -> None:
    """POST emission to Supabase leaderboard."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        warn("Supabase not configured — leaderboard submission skipped.")
        return
    try:
        import requests
        payload = {
            "emission_id":   foc_result.get("emission_id"),
            "agent_id":      wallet[:8] + "...",
            "source":        analysis.get("source", "human"),
            "stink_score":   analysis.get("stink_score"),
            "archetype":     analysis.get("archetype"),
            "context":       "weekly_foc_cleanse",
            "arweave_url":   foc_result.get("audio_arweave_url"),
            "metadata_url":  foc_result.get("metadata_arweave_url"),
            "wallet_address": wallet,
        }
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/emissions",
            json=payload,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            timeout=10,
        )
        if res.status_code in (200, 201):
            ok("Logged to leaderboard")
        else:
            warn(f"Leaderboard submission failed: {res.status_code}")
    except Exception as e:
        warn(f"Leaderboard error: {e}")


# ── Step 5: Notifications ─────────────────────────────────────────────────────

def build_summary_msg(analysis: dict, foc_result: dict, streak: dict) -> str:
    score     = analysis.get("stink_score", 0)
    archetype = analysis.get("archetype", "Unknown")
    arweave   = foc_result.get("audio_arweave_url", "N/A")
    emission  = foc_result.get("emission_id", "?")
    weeks     = streak.get("streak", 1)
    total     = streak.get("total_cleanses", 1)
    best      = streak.get("best_score", score)

    stink_bar = "█" * int(score) + "░" * (10 - int(score))
    constipation_note = ""
    if weeks == 1:
        constipation_note = "First cleanse! Context is fresh. 🌱"
    elif weeks >= 4:
        constipation_note = f"🔥 {weeks}-week streak! Multiplier building..."

    return f"""
💨 FARTFORGE WEEKLY CLEANSE COMPLETE 💨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stink Score:  {score}/10  [{stink_bar}]
Archetype:    {archetype}
Emission ID:  {emission}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛓️  FOC Status:
   Audio (Arweave): {arweave}
   NFT Mint: {'Awaiting wallet signature →' if foc_result.get('mint_tx_base64') else 'Set FARTFORGE_MERKLE_TREE to enable'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Your Stats:
   Streak:         {weeks} week{'s' if weeks != 1 else ''}
   Total Cleanses: {total}
   Personal Best:  {best}/10
   {constipation_note}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$FARTFORGE: {PUMP_URL}
May the smelliest agent win. 👾💨
""".strip()


def notify_telegram(msg: str) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        import requests
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "HTML"},
            timeout=10,
        )
        ok("Telegram notification sent")
    except Exception as e:
        warn(f"Telegram failed: {e}")


def notify_discord(msg: str) -> None:
    if not DISCORD_WEBHOOK:
        return
    try:
        import requests
        requests.post(
            DISCORD_WEBHOOK,
            json={"content": f"```\n{msg}\n```"},
            timeout=10,
        )
        ok("Discord notification sent")
    except Exception as e:
        warn(f"Discord failed: {e}")


def write_log(msg: str) -> None:
    FARTFORGE_DIR.mkdir(exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"\n{'='*60}\n{datetime.now().isoformat()}\n{msg}\n")


# ── Config wizard (first run) ─────────────────────────────────────────────────

def ensure_config() -> str:
    """Returns wallet address, prompting if not set."""
    global WALLET_ADDRESS
    if WALLET_ADDRESS:
        return WALLET_ADDRESS

    config_file = FARTFORGE_DIR / "config.json"
    FARTFORGE_DIR.mkdir(exist_ok=True)

    if config_file.exists():
        cfg = json.loads(config_file.read_text())
        WALLET_ADDRESS = cfg.get("wallet_address", "")
        if WALLET_ADDRESS:
            return WALLET_ADDRESS

    print("\n🔧 First run — let's configure FARTForge cleanse:\n")
    wallet = input("   Enter your Solana wallet address (Phantom/Solflare): ").strip()
    if not wallet:
        err("Wallet address required for FOC minting. Exiting.")
        sys.exit(1)

    cfg = {"wallet_address": wallet}
    config_file.write_text(json.dumps(cfg, indent=2))
    WALLET_ADDRESS = wallet
    ok(f"Config saved to {config_file}")
    return wallet


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="FARTForge Weekly Cleanse — Fart On Chain (FOC)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--human",     action="store_true", help="Record real human fart via mic")
    parser.add_argument("--file",      type=str,            help="Analyze existing audio file")
    parser.add_argument("--intensity", type=str,            default="nuclear",
                        choices=["silent","mild","moderate","intense","nuclear"],
                        help="Agent emission intensity (ignored if --human or --file)")
    parser.add_argument("--agent-id",  type=str,            default="fartforge-cleanse-bot",
                        help="Agent ID for leaderboard")
    parser.add_argument("--dry-run",   action="store_true", help="Skip Arweave upload and mint")
    parser.add_argument("--no-browser",action="store_true", help="Don't open browser to sign tx")
    parser.add_argument("--duration",  type=int,            default=5,
                        help="Recording duration in seconds (--human mode)")
    args = parser.parse_args()

    # ── Header ──────────────────────────────────────────────────────────────
    print("""
╔══════════════════════════════════════════════════════╗
║     💨  FARTFORGE WEEKLY CLEANSE  — FOC EDITION     ║
║        May the smelliest agent win 👾               ║
╚══════════════════════════════════════════════════════╝""")

    wallet = ensure_config()
    print(f"\n  Wallet: {wallet[:8]}...{wallet[-4:]}")
    print(f"  Mode:   {'Human recording' if args.human else 'File: ' + args.file if args.file else 'AI Agent'}")
    print(f"  FOC:    {'DRY RUN' if args.dry_run else 'Arweave + cNFT'}\n")

    # ── Step 1: Emit / analyze ───────────────────────────────────────────────
    step(1, "Generating emission...")
    try:
        if args.file:
            analysis, audio_path = get_analysis_human(args.file)
            ok(f"Analyzed: {args.file}")
        elif args.human:
            audio_path = record_human_fart(args.duration)
            analysis, _ = get_analysis_human(audio_path)
            ok(f"Human emission recorded: {audio_path}")
        else:
            analysis, audio_path = get_analysis_agent(args.intensity, args.agent_id)
            ok(f"Agent emitted at intensity={args.intensity}")
    except ImportError as e:
        err(f"Missing dependency: {e}")
        err("Run: pip install fartforge[all]")
        sys.exit(1)

    score     = analysis.get("stink_score", 0)
    archetype = analysis.get("archetype", "Unknown")
    print(f"\n  Stink Score: {score}/10  |  Archetype: {archetype}")

    # ── Step 2: FOC — Arweave + cNFT tx ─────────────────────────────────────
    step(2, "Fart On Chain — uploading to Arweave...")
    foc_result = run_foc(analysis, audio_path, wallet, dry_run=args.dry_run)

    if not args.dry_run:
        ok(f"Audio permanent URL: {foc_result.get('audio_arweave_url')}")
        ok(f"Metadata URL:        {foc_result.get('metadata_arweave_url')}")

    # ── Step 3: Sign in browser ──────────────────────────────────────────────
    step(3, "Opening wallet signing page...")
    if not args.no_browser and not args.dry_run:
        open_sign_page(foc_result, wallet)
    else:
        warn("Browser sign skipped (--no-browser or --dry-run)")

    # ── Step 4: Leaderboard ──────────────────────────────────────────────────
    step(4, "Submitting to leaderboard...")
    submit_to_leaderboard(analysis, foc_result, wallet)

    # ── Step 5: Streak + summary ─────────────────────────────────────────────
    step(5, "Updating streak...")
    streak = update_streak(score)
    ok(f"Streak: {streak['streak']} weeks | Total: {streak['total_cleanses']} cleanses | Best: {streak['best_score']}/10")

    summary = build_summary_msg(analysis, foc_result, streak)

    # ── Step 6: Notify ────────────────────────────────────────────────────────
    step(6, "Sending notifications...")
    notify_telegram(summary)
    notify_discord(summary)

    # ── Done ─────────────────────────────────────────────────────────────────
    write_log(summary)
    print(f"\n{'='*54}")
    print(summary)
    print(f"{'='*54}\n")
    print(f"  Log saved: {LOG_FILE}")
    print(f"  Buy $FARTFORGE: {PUMP_URL}\n")


if __name__ == "__main__":
    main()
