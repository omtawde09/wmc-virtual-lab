"""
Bluetooth Range & Path Loss Analyzer (Practical 8, Phase 4)
===============================================================
Fits the log-distance path loss model to logged distance/RSSI readings:

    RSSI(d) = RSSI0 - 10 * n * log10(d / d0)

where:
    RSSI0 = signal strength at the reference distance d0 (usually 1m)
    n     = path loss exponent (~2 in free space/open air, higher indoors
            with walls, furniture, and human bodies attenuating the signal)
    d     = measured distance in metres

WHY THIS BELONGS IN THE BACKEND, NOT JUST "PLOT IT IN THE FRONTEND"
-----------------------------------------------------------------------
Curve fitting is a numeric operation best done once, server-side, on the
canonical dataset (bluetooth_scanner.range_readings) - not recomputed
ad-hoc in JS from whatever the client happens to have cached. This also
matches the pattern of path_loss_analyzer.py already in this codebase.

WHY numpy.polyfit AND NOT scipy.optimize.curve_fit
-----------------------------------------------------------------------
The model is linear in log-distance once you substitute x = log10(d/d0):
RSSI = RSSI0 - 10*n*x, i.e. a straight line in (x, RSSI) space. A 1st
degree polyfit is the exact right tool - no need for the extra scipy
dependency or nonlinear solver overhead for what is fundamentally a
linear regression.
"""

import math
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from bluetooth_scanner import range_readings

router = APIRouter()


class PathLossFit(BaseModel):
    rssi_at_1m: float
    path_loss_exponent: float
    r_squared: float
    sample_count: int
    predicted_range_m: Optional[dict]  # estimated distance at a few RSSI thresholds


class PredictionRequest(BaseModel):
    rssi: float


def _fit_log_distance_model(readings: List[dict]) -> Optional[dict]:
    """
    Fits RSSI = RSSI0 - 10*n*log10(d) using linear regression over
    log-transformed distance. Requires at least 2 distinct distances -
    below that there's nothing to fit, and we say so rather than
    returning a meaningless number.
    """
    valid = [r for r in readings if r.get("distance", 0) > 0 and r.get("rssi") is not None]
    if len(valid) < 2:
        return None

    distances = np.array([r["distance"] for r in valid], dtype=float)
    rssi_values = np.array([r["rssi"] for r in valid], dtype=float)

    log_d = np.log10(distances)  # d0 = 1m reference, so log10(d/1) = log10(d)

    # RSSI = RSSI0 - 10*n*log_d  ->  linear fit: RSSI = a*log_d + b
    # slope a = -10*n  =>  n = -a/10 ; intercept b = RSSI0
    coeffs = np.polyfit(log_d, rssi_values, 1)
    slope, intercept = coeffs[0], coeffs[1]
    n = -slope / 10.0
    rssi0 = intercept

    # R^2 goodness of fit - tells you how noisy your own measurements were,
    # which is itself a useful experimental result to report, not hide.
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
    """
    Inverts the model to estimate distance from an RSSI reading:
        d = d0 * 10 ^ ((RSSI0 - RSSI) / (10 * n))
    This is the classic (and famously noisy) basis for BLE "proximity"
    features - useful to demonstrate, worth being honest about its error
    margin, which is typically +/- 2-4x at longer ranges.
    """
    if n <= 0:
        raise ValueError("path loss exponent must be positive for distance prediction")
    return 10 ** ((rssi0 - rssi) / (10 * n))


@router.get("/fit", response_model=PathLossFit)
def get_path_loss_fit():
    """
    Fits the log-distance path loss model to all currently logged readings
    and returns the model parameters plus a few example distance
    predictions, so the frontend can plot both the raw points and the
    fitted curve together.
    """
    fit = _fit_log_distance_model(range_readings)
    if fit is None:
        raise HTTPException(
            status_code=409,
            detail="Need readings at 2+ distinct distances to fit a model. "
                   "Log more readings via POST /api/bluetooth/reading first.",
        )

    example_rssi_points = [-50, -60, -70, -80, -90]
    predicted_range_m = {}
    for r in example_rssi_points:
        try:
            predicted_range_m[str(r)] = round(
                _predict_distance(r, fit["rssi_at_1m"], fit["path_loss_exponent"]), 2
            )
        except ValueError:
            predicted_range_m[str(r)] = None

    return PathLossFit(**fit, predicted_range_m=predicted_range_m)


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