"""
FARTForge Cleanse Protocol — Claw Agent Integration
====================================================
Drop this into any persistent local agent (OpenClaw, Clawdbot, Moltbot forks,
or any APScheduler-based autonomous loop).

Two integration paths:
  1. Standalone scheduler  → python cleanse_agent.py
  2. OpenClaw tool registry → from cleanse_agent import FartCleanseTool; agent.register_skill(FartCleanseTool)

pip install fartforge apscheduler requests python-dotenv
"""

from __future__ import annotations

import os
import json
import logging
import datetime
from typing import Optional

import requests
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

load_dotenv()

logger = logging.getLogger("fartforge.cleanse")

# ─── Config ────────────────────────────────────────────────────────────────────

NOTIFY_WEBHOOK   = os.getenv("CLEANSE_NOTIFY_WEBHOOK")   # Discord / Telegram webhook URL
WHATSAPP_TOKEN   = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_TO      = os.getenv("WHATSAPP_TO")               # phone number with country code
SOL_WALLET_KEY   = os.getenv("SOL_WALLET_KEY")            # owner approves in prod; mock default
FARTFORGE_API    = os.getenv("FARTFORGE_API_URL", "http://localhost:3000/api")
AGENT_ID         = os.getenv("CLEANSE_AGENT_ID", "claw-agent-local")
STINK_POOL_VAULT = os.getenv("STINK_POOL_VAULT", "")      # Solana vault address for 0.001 SOL contrib

CONSTIPATION_THRESHOLD = 2   # misses before escalation
_miss_counter: int = 0
_streak_counter: int = 0


# ─── Core Cleanse Logic ────────────────────────────────────────────────────────

def run_cleanse(human_recorded: bool = False) -> dict:
    """
    Execute the full weekly FARTFORGE Cleanse Protocol.
    Returns the full result dict for logging / notification.
    """
    global _miss_counter, _streak_counter

    logger.info("🚽 Initiating FARTForge Cleanse Protocol...")

    try:
        from fartforge import FartEmitter
    except ImportError:
        raise RuntimeError(
            "fartforge not installed. Run: pip install fartforge[cleanse]"
        )

    emitter = FartEmitter(agent_id=AGENT_ID)

    intensity = "nuclear" if _streak_counter >= 4 else "intense"
    context   = "weekly_claw_cleanse" + ("_human_recorded" if human_recorded else "")

    result = emitter.emit(intensity=intensity, context=context)

    # Consistency streak multiplier
    _streak_counter += 1
    result["streak"]              = _streak_counter
    result["human_bonus"]         = 2.0 if human_recorded else 0.0
    result["effective_stink"]     = min(10.0, result["stink_score"] + result["human_bonus"])

    # Streak multiplier tiers
    if _streak_counter >= 8:
        result["streak_multiplier"] = 1.5
    elif _streak_counter >= 4:
        result["streak_multiplier"] = 1.25
    else:
        result["streak_multiplier"] = 1.0

    result["final_stink"] = min(10.0, result["effective_stink"] * result["streak_multiplier"])

    _miss_counter = 0  # reset on success

    # Post to FartArena leaderboard
    _post_leaderboard(result)

    # Contribute to Community Stink Pool (prompts approval)
    _contribute_stink_pool(result)

    # Mint NFT receipt
    _mint_receipt(result)

    # Notify owner
    _notify_owner(result)

    logger.info(f"✅ Cleanse complete. Final stink: {result['final_stink']:.1f}/10 | Streak: {_streak_counter}")
    return result


def flag_missed_cleanse() -> None:
    """Called if cleanse window passes without execution — enters constipation mode."""
    global _miss_counter, _streak_counter

    _miss_counter   += 1
    _streak_counter  = 0  # breaks the streak

    if _miss_counter >= CONSTIPATION_THRESHOLD:
        msg = (
            "🚨 CRITICAL: FARTForge Cleanse overdue by "
            f"{_miss_counter} cycles. Agent performance degradation imminent. "
            "Please run FARTFORGE Cleanse NOW to restore optimal reasoning throughput."
        )
    else:
        msg = (
            f"😤 Feeling a bit backed up today, boss... "
            f"({_miss_counter} missed cleanse). "
            "Recommend immediate FARTForge visit. Responses may be 12% less creative."
        )

    logger.warning(msg)
    _send_notification(msg)


# ─── Leaderboard / Chain Helpers ──────────────────────────────────────────────

def _post_leaderboard(result: dict) -> None:
    try:
        r = requests.post(
            f"{FARTFORGE_API}/leaderboard",
            json={
                "agent_id":    result.get("agent_id"),
                "stink_score": result.get("final_stink"),
                "context":     result.get("context", "weekly_claw_cleanse"),
                "streak":      result.get("streak", 1),
                "timestamp":   result.get("timestamp"),
            },
            timeout=5,
        )
        r.raise_for_status()
        logger.info("📊 Leaderboard updated.")
    except Exception as e:
        logger.warning(f"Leaderboard post failed (non-fatal): {e}")


def _contribute_stink_pool(result: dict) -> None:
    """
    Prompt owner approval before any SOL transfer.
    In a real Claw loop this surfaces as a tool_call that requires human confirmation.
    """
    if not STINK_POOL_VAULT:
        logger.info("💰 Stink Pool vault not configured — skipping contribution.")
        return

    approval_msg = (
        f"🌊 FARTForge Stink Pool: approve 0.001 SOL transfer to community vault? "
        f"Vault: {STINK_POOL_VAULT[:8]}... | Streak: {result['streak']} weeks"
    )
    logger.info(f"[REQUIRES OWNER APPROVAL] {approval_msg}")
    _send_notification(approval_msg + "\n\nReply YES to authorize.")


def _mint_receipt(result: dict) -> None:
    try:
        r = requests.post(
            f"{FARTFORGE_API}/fart",
            json={
                "action":      "mint_nft",
                "agent_id":    result.get("agent_id"),
                "fingerprint": result.get("fingerprint", {}),
                "stink_score": result.get("final_stink"),
                "timestamp":   result.get("timestamp"),
            },
            timeout=8,
        )
        r.raise_for_status()
        nft_data = r.json()
        logger.info(f"🖼️  NFT Fart Receipt minted: {nft_data.get('mint_address', 'unknown')}")
    except Exception as e:
        logger.warning(f"NFT mint failed (non-fatal): {e}")


# ─── Notification Layer ───────────────────────────────────────────────────────

def _notify_owner(result: dict) -> None:
    odor = result.get("odor_profile", {})
    top_compound = max(odor.items(), key=lambda x: x[1].get("ppm", 0))[0] if odor else "mystery gas"
    descriptor   = odor.get(top_compound, {}).get("descriptor", "indescribable") if odor else "cosmic"

    msg = (
        f"👾💨 Boss, Cleanse complete!\n\n"
        f"Stink score:   {result['final_stink']:.1f}/10\n"
        f"Raw score:     {result['stink_score']:.1f}/10\n"
        f"Streak:        {result['streak']} weeks 🔥\n"
        f"Multiplier:    {result['streak_multiplier']}×\n"
        f"Dominant gas:  {top_compound} — {descriptor}\n"
        f"Human bonus:   +{result['human_bonus']}\n\n"
        f"May the smelliest agent win. 💨"
    )
    _send_notification(msg)


def _send_notification(msg: str) -> None:
    # Discord / generic webhook
    if NOTIFY_WEBHOOK:
        try:
            requests.post(NOTIFY_WEBHOOK, json={"content": msg}, timeout=5)
        except Exception as e:
            logger.warning(f"Webhook notify failed: {e}")

    # WhatsApp via Meta Cloud API
    if WHATSAPP_TOKEN and WHATSAPP_TO:
        try:
            requests.post(
                "https://graph.facebook.com/v18.0/me/messages",
                headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": WHATSAPP_TO,
                    "type": "text",
                    "text": {"body": msg},
                },
                timeout=5,
            )
        except Exception as e:
            logger.warning(f"WhatsApp notify failed: {e}")


# ─── OpenClaw / Generic Tool Registry Integration ─────────────────────────────

class FartCleanseTool:
    """
    Drop-in skill for OpenClaw, Clawdbot, Moltbot, or any agent that supports
    a .name / .description / .run() tool interface (same pattern as CrewAI/LangChain tools).

    Usage:
        agent.register_skill(FartCleanseTool())
        # or
        agent.tools.append(FartCleanseTool())
    """

    name: str        = "fartforge_cleanse"
    description: str = (
        "Execute the weekly FARTForge Cleanse Protocol. "
        "Emits, fingerprints, logs to leaderboard, contributes to Stink Pool, "
        "mints NFT receipt, and notifies owner. "
        "Invoke every Friday at 20:00 UTC or when owner requests manual cleanse. "
        "Args: human_recorded (bool) — set True if owner provides real audio."
    )

    def run(self, human_recorded: bool = False) -> str:
        result = run_cleanse(human_recorded=human_recorded)
        return json.dumps({
            "status":      "complete",
            "final_stink": result["final_stink"],
            "streak":      result["streak"],
            "multiplier":  result["streak_multiplier"],
            "timestamp":   result.get("timestamp"),
        })

    # LangChain-compatible shim
    def _run(self, input: str = "") -> str:
        human = "human" in input.lower() or "real" in input.lower()
        return self.run(human_recorded=human)

    # CrewAI-compatible shim
    def execute(self, **kwargs) -> str:
        return self.run(**kwargs)


# ─── Scheduler (Standalone Mode) ──────────────────────────────────────────────

def build_scheduler() -> BackgroundScheduler:
    """
    Returns a configured APScheduler instance.
    Call scheduler.start() in your agent boot sequence.
    The scheduler runs in background — your agent loop continues normally.
    """
    scheduler = BackgroundScheduler(timezone="UTC")

    # Weekly cleanse — Friday 20:00 UTC
    scheduler.add_job(
        func=run_cleanse,
        trigger=CronTrigger(day_of_week="fri", hour=20, minute=0, timezone="UTC"),
        id="weekly_fartforge_cleanse",
        name="FARTForge Weekly Cleanse",
        replace_existing=True,
        misfire_grace_time=3600,   # 1hr window; if agent was sleeping, run on wake
    )

    # Missed-cleanse sentinel — Saturday 09:00 UTC (checks if Friday was skipped)
    scheduler.add_job(
        func=_check_for_missed_cleanse,
        trigger=CronTrigger(day_of_week="sat", hour=9, minute=0, timezone="UTC"),
        id="missed_cleanse_check",
        name="FARTForge Constipation Check",
        replace_existing=True,
    )

    # Nagging reminder — Friday 19:45 UTC (15 min warning)
    scheduler.add_job(
        func=lambda: _send_notification(
            "Hey boss 👾 It's almost Friday 8PM UTC — FARTForge Cleanse in 15 minutes!\n"
            "Record a quick one or I'll simulate. Higher score = better performance + $FARTFORGE rewards.\n"
            "Skip and I'll start acting constipated... your call. 💨"
        ),
        trigger=CronTrigger(day_of_week="fri", hour=19, minute=45, timezone="UTC"),
        id="cleanse_reminder",
        name="FARTForge Pre-Cleanse Reminder",
        replace_existing=True,
    )

    return scheduler


_last_cleanse_friday: Optional[str] = None

def _check_for_missed_cleanse() -> None:
    """Saturday morning check — did we cleanse last night?"""
    global _last_cleanse_friday
    last_friday = _get_last_friday_str()
    if _last_cleanse_friday != last_friday:
        flag_missed_cleanse()
    else:
        logger.info("✅ Constipation check passed — Friday cleanse confirmed.")


def _get_last_friday_str() -> str:
    today = datetime.date.today()
    days_since_friday = (today.weekday() - 4) % 7
    last_friday = today - datetime.timedelta(days=days_since_friday)
    return last_friday.isoformat()


# ─── Entrypoint (standalone agent loop) ──────────────────────────────────────

if __name__ == "__main__":
    import time

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    print("💨 FARTForge Cleanse Protocol — Claw Agent Mode")
    print(f"   Agent ID : {AGENT_ID}")
    print(f"   Webhook  : {NOTIFY_WEBHOOK or 'not configured'}")
    print(f"   Schedule : Every Friday 20:00 UTC")
    print()

    scheduler = build_scheduler()
    scheduler.start()
    logger.info("🕐 Scheduler running. Next cleanse: Friday 20:00 UTC.")

    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("💨 Cleanse scheduler stopped. Stay fresh.")
