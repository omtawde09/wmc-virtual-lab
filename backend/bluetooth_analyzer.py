"""
Bluetooth Range & Path Loss Analyzer (Practical 8, Phase 4 - extended)
=========================================================================
Fits the log-distance path loss model AND analyzes obstacle attenuation,
using the same statistical approach as the existing Wi-Fi
path_loss_analyzer.py (Practical 7) - kept consistent deliberately so a
reader who understands one immediately understands the other.

TWO SEPARATE QUESTIONS, TWO SEPARATE ANALYSES
-----------------------------------------------------------------------
"How does RSSI change with distance?" and "how much does one more wall
cost me in dB?" are different questions and get different fits:

  1. Distance fit (log-distance path loss model):
         RSSI = RSSI0 - 10*n*log10(d)
     Fit across ALL logged readings regardless of obstacle count - this
     estimates the overall exponent n, which itself rises with more
     obstruction (open air n~2, heavily obstructed indoor n~4-6).

  2. Obstacle attenuation (grouped comparison):
     Group readings by obstacle_count, average RSSI within each group,
     and compare against the fewest-obstacle group as a baseline. This
     isolates "how many dB does a wall cost me" independent of exact
     distance, which the pure distance fit above cannot answer on its
     own - two readings at different obstacle counts but different
     distances would otherwise confound the two effects.

WHY THE SAME LINEAR-REGRESSION APPROACH AS PRACTICAL 7
-----------------------------------------------------------------------
Both the distance-vs-log(d) relationship and the RSSI-vs-obstacle-count
relationship are linear once correctly transformed, so ordinary least
squares (not a nonlinear solver) is the right, simplest tool for both -
same reasoning as before, kept consistent across the whole lab suite.
"""

import math
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from bluetooth_scanner import range_readings

router = APIRouter()

# Free-space reference exponent (n=2), used only as a comparison line -
# matches Practical 7's FREE_SPACE_N convention exactly.
FREE_SPACE_N = 2.0


class PathLossFit(BaseModel):
    rssi_at_1m: float
    path_loss_exponent: float
    r_squared: float
    sample_count: int
    interpretation: str
    predicted_range_m: Optional[dict]


class ObstacleGroup(BaseModel):
    obstacle_count: int
    avg_rssi: float
    attenuation_db: float   # extra loss vs the fewest-obstacle baseline group
    samples: int


class ObstacleAnalysis(BaseModel):
    groups: List[ObstacleGroup]
    per_obstacle_db: Optional[float]   # average dB lost per +1 obstacle
    interpretation: Optional[str]


class PredictionRequest(BaseModel):
    rssi: float


def _fit_log_distance_model(readings: List[dict]) -> Optional[dict]:
    """Fits RSSI = RSSI0 - 10*n*log10(d) via linear regression on log10(distance)."""
    valid = [r for r in readings if r.get("distance", 0) > 0 and r.get("rssi") is not None]
    if len(valid) < 2:
        return None

    distances = np.array([r["distance"] for r in valid], dtype=float)
    rssi_values = np.array([r["rssi"] for r in valid], dtype=float)
    log_d = np.log10(distances)

    coeffs = np.polyfit(log_d, rssi_values, 1)
    slope, intercept = coeffs[0], coeffs[1]
    n = -slope / 10.0
    rssi0 = intercept

    predicted = slope * log_d + intercept
    ss_res = np.sum((rssi_values - predicted) ** 2)
    ss_tot = np.sum((rssi_values - np.mean(rssi_values)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return {
        "rssi_at_1m": round(float(rssi0), 2),
        "path_loss_exponent": round(float(n), 3),
        "r_squared": round(float(r_squared), 4),
        "sample_count": len(valid),
    }


def _predict_distance(rssi: float, rssi0: float, n: float) -> float:
    """Inverts the model: d = d0 * 10 ^ ((RSSI0 - RSSI) / (10 * n))."""
    if n <= 0:
        raise ValueError("path loss exponent must be positive for distance prediction")
    return 10 ** ((rssi0 - rssi) / (10 * n))


def _interpret_n(n: float) -> str:
    """
    Human-readable meaning of the fitted exponent. BLE typically shows
    HIGHER exponents than Wi-Fi at equivalent obstruction levels, because
    BLE commonly runs at 2.4GHz with lower transmit power and simpler
    antennas than a Wi-Fi router - so the thresholds here are shifted
    slightly up from Practical 7's Wi-Fi version to reflect that.
    """
    if n < 2.0:
        return "Below free-space (n<2): corridor waveguiding or reflective surroundings."
    if n < 2.5:
        return "Near free-space (n~2-2.5): clear line-of-sight, minimal obstruction."
    if n < 3.5:
        return "Typical indoor (n~2.5-3.5): normal room, some furniture."
    if n < 5.0:
        return "Obstructed indoor (n~3.5-5): walls, doors, or body blocking the path."
    return "Heavily obstructed (n>=5): multiple walls, metal, or floors between devices."


def _interpret_per_obstacle(db: float) -> str:
    """Rough guide for per-obstacle attenuation in typical indoor BLE links."""
    if db < 2:
        return "Minimal impact - thin partitions or glass."
    if db < 6:
        return "Typical drywall/interior door - noticeable but usable."
    if db < 12:
        return "Significant loss - concrete, brick, or a closed metal door."
    return "Severe attenuation - likely metal, multiple walls, or a Faraday-like effect."


def build_path_loss_fit(readings: List[dict]) -> PathLossFit:
    """
    Fits the log-distance path loss model to any list of readings and returns
    the model parameters + example distance predictions. Store-agnostic so both
    Practical 6 (range) and Practical 7 (obstacles) reuse it on their own data.
    """
    fit = _fit_log_distance_model(readings)
    if fit is None:
        raise HTTPException(
            status_code=409,
            detail="Need readings at 2+ distinct distances to fit a model.",
        )

    predicted_range_m = {}
    for r in (-50, -60, -70, -80, -90):
        try:
            predicted_range_m[str(r)] = round(
                _predict_distance(r, fit["rssi_at_1m"], fit["path_loss_exponent"]), 2
            )
        except ValueError:
            predicted_range_m[str(r)] = None

    return PathLossFit(
        **fit,
        interpretation=_interpret_n(fit["path_loss_exponent"]),
        predicted_range_m=predicted_range_m,
    )


@router.get("/fit", response_model=PathLossFit)
def get_path_loss_fit():
    """Fits the log-distance path loss model to the Practical 6 range readings."""
    return build_path_loss_fit(range_readings)


def analyze_obstacles(readings: List[dict]) -> ObstacleAnalysis:
    """
    Pure obstacle-attenuation analysis over any list of readings. Groups by
    obstacle_count, reports average RSSI and attenuation (dB) relative to the
    fewest-obstacle baseline group, plus a dB-per-obstacle estimate via linear
    regression. Isolates the obstacle effect from the distance effect.

    Kept as a store-agnostic function so Practical 6 (range) and Practical 7
    (path loss vs obstacles) can each run it on their OWN readings, never
    confounding one experiment's data with the other's.
    """
    if not readings:
        raise HTTPException(
            status_code=409,
            detail="No readings logged yet. Log readings with an obstacle_count first.",
        )

    groups: dict = {}
    for r in readings:
        groups.setdefault(r.get("obstacle_count", 0), []).append(r["rssi"])

    baseline_key = min(groups)
    baseline_avg = sum(groups[baseline_key]) / len(groups[baseline_key])

    result_groups = []
    for oc in sorted(groups):
        avg = sum(groups[oc]) / len(groups[oc])
        result_groups.append(ObstacleGroup(
            obstacle_count=oc,
            avg_rssi=round(avg, 1),
            attenuation_db=round(baseline_avg - avg, 1),
            samples=len(groups[oc]),
        ))

    per_obstacle_db = None
    if len(groups) >= 2:
        xs = np.array([r.get("obstacle_count", 0) for r in readings], dtype=float)
        ys = np.array([r["rssi"] for r in readings], dtype=float)
        slope = np.polyfit(xs, ys, 1)[0]
        per_obstacle_db = round(float(-slope), 2)
        interpretation = _interpret_per_obstacle(per_obstacle_db)
    else:
        interpretation = (
            "Only one obstacle-count group logged so far - log readings at "
            "2+ different obstacle counts (e.g. 0 walls and 1 wall) to see "
            "per-obstacle attenuation."
        )

    return ObstacleAnalysis(
        groups=result_groups,
        per_obstacle_db=per_obstacle_db,
        interpretation=interpretation,
    )


@router.post("/predict-distance")
def predict_distance(req: PredictionRequest):
    """Estimates distance for an arbitrary RSSI value using the current fit."""
    fit = _fit_log_distance_model(range_readings)
    if fit is None:
        raise HTTPException(status_code=409, detail="No fitted model available yet.")

    try:
        distance = _predict_distance(req.rssi, fit["rssi_at_1m"], fit["path_loss_exponent"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {
        "rssi": req.rssi,
        "estimated_distance_m": round(distance, 2),
        "note": "BLE RSSI-based distance estimation typically has 2-4x error "
                "at longer ranges due to multipath and body/obstacle "
                "attenuation - treat this as a rough estimate, not a measurement.",
    }