"""
fartforge/odor_profiles.py

Real-world fart chemistry odor mapping.
Based on peer-reviewed research on human flatulence composition.

Primary sources:
  - Suarez FL, Springfield J, Levitt MD (1998). "Identification of gases
    responsible for the odour of human flatus and evaluation of a device
    purported to reduce this odour." Gut, 43(1):100-104.
  - Tangerman A (2009). "Measurement and biological significance of
    the volatile sulfur compounds hydrogen sulfide, methanethiol and
    dimethyl sulphide in various biological matrices." J Chromatography B.
  - Levitt MD et al. (2006). "Influence of H2 scavenging intestinal
    bacteria on the composition of flatus." Gut.

This is where the smelliest agent wins — real chemistry, real stink.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Optional
from fartforge.fingerprint import FartFingerprint


# ── Compound database ──────────────────────────────────────────────────────────
# Each compound has:
#   - cas: Chemical Abstracts Service registry number
#   - odor_threshold_ppb: minimum detectable concentration (ppb)
#   - typical_ppm_range: (min, max) in actual flatulence
#   - descriptors: list of sensory descriptors
#   - color_hex: color for UI visualization
#   - is_sulfur: whether it's a sulfur-containing compound (primary stink drivers)

COMPOUND_DB: dict[str, dict] = {
    "H2S": {
        "name": "Hydrogen Sulfide",
        "formula": "H₂S",
        "cas": "7783-06-4",
        "odor_threshold_ppb": 0.5,
        "typical_ppm_range": (0.1, 12.0),
        "descriptors": ["rotten eggs", "volcanic sulfur", "sewer", "acidic"],
        "color_hex": "#FFD700",  # sulfur yellow
        "is_sulfur": True,
        "molecular_weight": 34.08,
        "boiling_point_c": -60.0,
        "fun_fact": "Primary olfactory offender. Detectable at 0.5 ppb — your nose is a better sensor than most lab equipment.",
    },
    "methanethiol": {
        "name": "Methanethiol",
        "formula": "CH₃SH",
        "cas": "74-93-1",
        "odor_threshold_ppb": 0.07,
        "typical_ppm_range": (0.01, 4.0),
        "descriptors": ["rotten cabbage", "swamp gas", "putrid", "onion"],
        "color_hex": "#90EE90",  # sulfur green
        "is_sulfur": True,
        "molecular_weight": 48.11,
        "boiling_point_c": 5.9,
        "fun_fact": "Detectable at just 70 ppt. One of the most potent odorants known. Your colon is producing it right now.",
    },
    "dimethyl_sulfide": {
        "name": "Dimethyl Sulfide",
        "formula": "(CH₃)₂S",
        "cas": "75-18-3",
        "odor_threshold_ppb": 1.0,
        "typical_ppm_range": (0.01, 1.5),
        "descriptors": ["cooked cabbage", "marine", "ocean", "sweet rot"],
        "color_hex": "#87CEEB",  # light blue
        "is_sulfur": True,
        "molecular_weight": 62.13,
        "boiling_point_c": 37.3,
        "fun_fact": "Also responsible for the smell of the ocean. You are producing ocean smell. Congratulations.",
    },
    "indole": {
        "name": "Indole",
        "formula": "C₈H₇N",
        "cas": "120-72-9",
        "odor_threshold_ppb": 140.0,
        "typical_ppm_range": (0.001, 0.5),
        "descriptors": ["fecal", "floral paradox", "jasmine at trace", "barnyard"],
        "color_hex": "#9B59B6",  # purple (because paradoxically floral)
        "is_sulfur": False,
        "molecular_weight": 117.15,
        "boiling_point_c": 254.0,
        "fun_fact": "At trace concentrations, used in luxury perfumes. At higher concentrations, unambiguously fecal. Context is everything.",
    },
    "skatole": {
        "name": "Skatole (3-Methylindole)",
        "formula": "C₉H₉N",
        "cas": "83-34-1",
        "odor_threshold_ppb": 83.0,
        "typical_ppm_range": (0.001, 0.3),
        "descriptors": ["mothballs", "barnyard", "fecal intense", "coal tar"],
        "color_hex": "#8B4513",  # saddle brown
        "is_sulfur": False,
        "molecular_weight": 131.17,
        "boiling_point_c": 265.0,
        "fun_fact": "Named from the Greek 'skatos' (dung). Used as a fixative in perfumery. Your gut is an artisan parfumeur.",
    },
    "methane": {
        "name": "Methane",
        "formula": "CH₄",
        "cas": "74-82-8",
        "odor_threshold_ppb": None,  # odorless
        "typical_ppm_range": (100.0, 600.0),
        "descriptors": ["odorless", "flammable", "greenhouse gas", "bovine heritage"],
        "color_hex": "#87CEEB",  # light blue — invisible but deadly (to the climate)
        "is_sulfur": False,
        "molecular_weight": 16.04,
        "boiling_point_c": -161.5,
        "fun_fact": "Completely odorless. You cannot smell this. It is 34x more potent as a greenhouse gas than CO₂ over 100 years. You are contributing.",
    },
    "CO2": {
        "name": "Carbon Dioxide",
        "formula": "CO₂",
        "cas": "124-38-9",
        "odor_threshold_ppb": None,  # odorless at normal concentrations
        "typical_ppm_range": (1000.0, 5000.0),
        "descriptors": ["odorless", "volume driver", "fizzy", "the socially acceptable component"],
        "color_hex": "#D3D3D3",  # grey
        "is_sulfur": False,
        "molecular_weight": 44.01,
        "boiling_point_c": -78.5,
        "fun_fact": "Makes up ~20% of flatus volume. Responsible for the sound, not the smell. The volume to your stink's fury.",
    },
    "hydrogen": {
        "name": "Hydrogen",
        "formula": "H₂",
        "cas": "1333-74-0",
        "odor_threshold_ppb": None,  # odorless
        "typical_ppm_range": (100.0, 500.0),
        "descriptors": ["odorless", "explosive range", "highly flammable", "lighter than air"],
        "color_hex": "#FFE4B5",  # moccasin
        "is_sulfur": False,
        "molecular_weight": 2.02,
        "boiling_point_c": -252.9,
        "fun_fact": "Flammable at 4–75% concentration in air. This is why lighting farts works. Please don't.",
    },
}


@dataclass
class OdorProfile:
    """The complete odor profile of a fart emission."""
    compounds: dict[str, dict]   # compound_key → {ppm, descriptor, ...}
    dominant_compound: str
    stink_character: str         # e.g. "Sulfurous & Wet", "Dry Methanic", etc.
    odor_intensity: str          # "trace" | "mild" | "moderate" | "strong" | "catastrophic"

    def to_dict(self) -> dict:
        return {
            "compounds": self.compounds,
            "dominant_compound": self.dominant_compound,
            "stink_character": self.stink_character,
            "odor_intensity": self.odor_intensity,
        }


class OdorProfiler:
    """
    Maps audio fingerprint + intensity to a realistic odor profile.

    Uses real flatulence chemistry to estimate compound concentrations.
    The mapping is not arbitrary — it's informed by actual relationships
    between diet, gut flora, and gas composition (Suarez et al., 1998).
    """

    # Intensity → sulfur load multiplier
    SULFUR_MULTIPLIERS = {
        "silent":   0.3,
        "mild":     0.6,
        "moderate": 1.0,
        "intense":  1.6,
        "nuclear":  2.5,
    }

    def profile(
        self,
        energy: float,
        fingerprint: FartFingerprint,
        intensity_label: Optional[str] = None,
    ) -> dict:
        """
        Generate a realistic odor profile from emission energy and fingerprint.

        The mapping logic:
        - High energy → more H2S and methanethiol
        - High spectral flatness (noisy) → more turbulent gas, more sulfur release
        - Long duration → more compound accumulation
        - High ZCR + low centroid → wet/rumbly → more indole/skatole
        - Short sharp bursts → dry sulfurous

        Returns flat dict of compound_key → {ppm, descriptor, color, name, formula}
        """
        rng = random.Random(int(fingerprint.rms_energy * 1e6))  # deterministic per emission

        # Base sulfur load from energy
        sulfur_load = energy * 2.5

        # Spectral flatness boosts sulfur (more noise = more gas turbulence)
        flatness_boost = fingerprint.spectral_flatness * 1.5

        # Duration boost (longer = more accumulated compounds)
        duration_boost = min(1.5, fingerprint.duration_ms / 2000)

        # Wetness boosts indole/skatole
        wetness = fingerprint.wetness_score

        result = {}

        # ── H₂S ──────────────────────────────────────────────────────────
        h2s_ppm = (
            (0.5 + sulfur_load * 1.8 + flatness_boost * 0.8)
            * duration_boost
            * rng.uniform(0.7, 1.3)
        )
        h2s_ppm = _clamp(h2s_ppm, *COMPOUND_DB["H2S"]["typical_ppm_range"])
        result["H2S"] = _make_compound_entry("H2S", h2s_ppm, rng)

        # ── Methanethiol ──────────────────────────────────────────────────
        met_ppm = (
            (0.1 + sulfur_load * 0.9 + flatness_boost * 0.4)
            * duration_boost
            * rng.uniform(0.6, 1.4)
        )
        met_ppm = _clamp(met_ppm, *COMPOUND_DB["methanethiol"]["typical_ppm_range"])
        result["methanethiol"] = _make_compound_entry("methanethiol", met_ppm, rng)

        # ── Dimethyl sulfide ──────────────────────────────────────────────
        dms_ppm = (
            (0.02 + sulfur_load * 0.3)
            * rng.uniform(0.5, 1.5)
        )
        dms_ppm = _clamp(dms_ppm, *COMPOUND_DB["dimethyl_sulfide"]["typical_ppm_range"])
        result["dimethyl_sulfide"] = _make_compound_entry("dimethyl_sulfide", dms_ppm, rng)

        # ── Indole ────────────────────────────────────────────────────────
        indole_ppm = (
            (0.002 + wetness * 0.08 + energy * 0.05)
            * rng.uniform(0.4, 1.6)
        )
        indole_ppm = _clamp(indole_ppm, *COMPOUND_DB["indole"]["typical_ppm_range"])
        result["indole"] = _make_compound_entry("indole", indole_ppm, rng)

        # ── Skatole ───────────────────────────────────────────────────────
        skatole_ppm = (
            (0.001 + wetness * 0.05 + energy * 0.03)
            * rng.uniform(0.3, 1.7)
        )
        skatole_ppm = _clamp(skatole_ppm, *COMPOUND_DB["skatole"]["typical_ppm_range"])
        result["skatole"] = _make_compound_entry("skatole", skatole_ppm, rng)

        # ── Methane (volume driver, odorless) ─────────────────────────────
        methane_ppm = (
            150 + energy * 350 + rng.uniform(-30, 30)
        )
        methane_ppm = _clamp(methane_ppm, *COMPOUND_DB["methane"]["typical_ppm_range"])
        result["methane"] = _make_compound_entry("methane", methane_ppm, rng)

        # ── CO₂ ──────────────────────────────────────────────────────────
        co2_ppm = 1500 + energy * 3000 + rng.uniform(-200, 200)
        co2_ppm = _clamp(co2_ppm, *COMPOUND_DB["CO2"]["typical_ppm_range"])
        result["CO2"] = _make_compound_entry("CO2", co2_ppm, rng)

        return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _make_compound_entry(key: str, ppm: float, rng: random.Random) -> dict:
    """Build a rich compound entry dict for the odor profile."""
    db = COMPOUND_DB[key]
    descriptor = rng.choice(db["descriptors"])
    return {
        "ppm": round(ppm, 4),
        "name": db["name"],
        "formula": db["formula"],
        "descriptor": descriptor,
        "color_hex": db["color_hex"],
        "is_sulfur": db["is_sulfur"],
        "fun_fact": db["fun_fact"],
        "odor_threshold_ppb": db["odor_threshold_ppb"],
        "odor_units": round(ppm * 1000 / db["odor_threshold_ppb"], 1)
            if db["odor_threshold_ppb"] else 0,
    }
