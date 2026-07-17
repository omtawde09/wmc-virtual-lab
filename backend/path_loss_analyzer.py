"""
Practical 7 – Path Loss in an Indoor Environment (RSSI vs Obstacles)
===================================================================
Syllabus: MDL501.5

Log-distance path-loss model:

    RSSI(d) = RSSI(d0) - 10 * n * log10(d / d0)      with d0 = 1 m

    => RSSI = A - 10*n*log10(d)     (A = RSSI at the 1 m reference)

The user physically moves the phone / adds walls and captures the REAL RSSI at
each point (read live from the Wi-Fi adapter — no fabricated data). From the
logged (distance, RSSI) points we fit the path-loss exponent `n` by linear
regression, and from readings taken behind a growing number of obstacles we
measure the attenuation contributed per obstacle.
"""

import math
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Read the real, live Wi-Fi RSSI (shared with Practical 4).
from wifi_scanner import get_current_wifi

router = APIRouter()

# In-memory log of measurements for the current session.
measurements: List[dict] = []

# Free-space reference exponent, used only as a comparison line on the chart.
FREE_SPACE_N = 2.0


class MeasurementInput(BaseModel):
    distance_m: float
    obstacle_count: int = 0
    obstacle_desc: str = ""


def _linear_fit(xs: List[float], ys: List[float]):
    """Ordinary least-squares fit y = slope*x + intercept. Returns (slope, intercept, r2) or None."""
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    sxy = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    slope = sxy / sxx
    intercept = my - slope * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((ys[i] - (slope * xs[i] + intercept)) ** 2 for i in range(n))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return slope, intercept, r2


@router.get("/live")
def live_reading():
    """Current real RSSI snapshot (also available continuously via /api/wifi/ws)."""
    return get_current_wifi()


@router.get("/measurements")
def get_measurements():
    """Returns all logged path-loss measurements for this session."""
    return measurements


@router.post("/measurement")
def add_measurement(data: MeasurementInput):
    """
    Captures the current REAL RSSI and logs it against a distance and an
    obstacle count. Refuses to log if there is no active Wi-Fi connection.
    """
    if data.distance_m is None or data.distance_m <= 0:
        raise HTTPException(status_code=400, detail="Distance must be greater than 0 m.")

    wifi = get_current_wifi()
    if not wifi.get("connected"):
        raise HTTPException(status_code=409, detail="No active Wi-Fi connection to measure.")

    record = {
        "id": len(measurements) + 1,
        "distance_m": round(float(data.distance_m), 2),
        "obstacle_count": int(data.obstacle_count),
        "obstacle_desc": data.obstacle_desc.strip(),
        "rssi_dbm": wifi["rssi"],
        "signal_pct": wifi["signal_pct"],
        "ssid": wifi["ssid"],
        "channel": wifi["channel"],
        "timestamp": datetime.now().isoformat(),
    }
    measurements.append(record)
    return record


@router.delete("/measurements")
def clear_measurements():
    """Clears all logged measurements."""
    measurements.clear()
    return {"message": "All path-loss measurements cleared."}


@router.get("/analysis")
def get_analysis():
    """
    Fits the log-distance model to the logged points and summarises the
    obstacle attenuation. Everything is derived from the real logged RSSI.
    """
    result = {
        "count": len(measurements),
        "path_loss_exponent": None,
        "rssi_at_1m": None,
        "r_squared": None,
        "interpretation": None,
        "fit_points": [],
        "obstacle_attenuation": [],
        "per_obstacle_db": None,
    }

    # ── Distance fit → path-loss exponent n ──
    pts = [m for m in measurements if m["distance_m"] and m["distance_m"] > 0]
    distinct_d = {m["distance_m"] for m in pts}
    if len(pts) >= 2 and len(distinct_d) >= 2:
        xs = [math.log10(m["distance_m"]) for m in pts]
        ys = [m["rssi_dbm"] for m in pts]
        fit = _linear_fit(xs, ys)
        if fit:
            slope, intercept, r2 = fit
            n_exp = round(-slope / 10.0, 2)
            result["path_loss_exponent"] = n_exp
            result["rssi_at_1m"] = round(intercept, 1)
            result["r_squared"] = round(r2, 3)
            result["interpretation"] = _interpret_n(n_exp)

            # Fitted curve + free-space (n=2) reference, anchored at the same 1 m intercept.
            d_min = min(m["distance_m"] for m in pts)
            d_max = max(m["distance_m"] for m in pts)
            steps = 24
            curve = []
            for i in range(steps + 1):
                d = d_min + (d_max - d_min) * i / steps
                if d <= 0:
                    continue
                curve.append({
                    "distance_m": round(d, 2),
                    "rssi_fit": round(intercept + slope * math.log10(d), 1),
                    "rssi_freespace": round(intercept - 10 * FREE_SPACE_N * math.log10(d), 1),
                })
            result["fit_points"] = curve

    # ── Obstacle attenuation (group by obstacle count) ──
    groups: dict = {}
    for m in measurements:
        groups.setdefault(m.get("obstacle_count", 0), []).append(m["rssi_dbm"])

    if groups:
        baseline_key = min(groups)               # fewest obstacles = reference
        baseline_avg = sum(groups[baseline_key]) / len(groups[baseline_key])
        atten = []
        for oc in sorted(groups):
            avg = sum(groups[oc]) / len(groups[oc])
            atten.append({
                "obstacle_count": oc,
                "avg_rssi": round(avg, 1),
                "attenuation_db": round(baseline_avg - avg, 1),  # positive = extra loss
                "samples": len(groups[oc]),
            })
        result["obstacle_attenuation"] = atten

        # dB lost per added obstacle, via linear fit of RSSI vs obstacle count.
        if len(groups) >= 2:
            fit = _linear_fit(
                [m.get("obstacle_count", 0) for m in measurements],
                [m["rssi_dbm"] for m in measurements],
            )
            if fit:
                result["per_obstacle_db"] = round(-fit[0], 1)

    return result


def _interpret_n(n: float) -> str:
    """Human-readable meaning of a path-loss exponent."""
    if n < 2.0:
        return "Below free-space (n<2): waveguiding down a corridor / strong reflections."
    if n < 2.5:
        return "Near free-space (n≈2): mostly line-of-sight, few obstructions."
    if n < 3.5:
        return "Typical indoor (n≈2.5–3.5): furniture and light partitions."
    if n < 5.0:
        return "Obstructed indoor (n≈3.5–5): multiple walls / floors in the path."
    return "Heavily obstructed (n≥5): thick walls, metal, or many floors."
