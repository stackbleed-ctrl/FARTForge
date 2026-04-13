"""
fartforge — The world's first AI-agent fart analytics platform.

May the smelliest agent win.
"""

from fartforge.core import FartEmitter, EmitResult, INTENSITY_MAP, IntensityLevel
from fartforge.fingerprint import FartFingerprint, compute_fingerprint
from fartforge.odor_profiles import OdorProfiler
from fartforge.leaderboard import Leaderboard

__version__ = "2.0.0"
__all__ = [
    "FartEmitter",
    "EmitResult",
    "FartFingerprint",
    "OdorProfiler",
    "Leaderboard",
    "compute_fingerprint",
    "INTENSITY_MAP",
    "IntensityLevel",
]
