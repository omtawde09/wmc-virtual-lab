"""
Practical 8 – Analysis of Multipath Effects (Signal Fluctuation Observation)
============================================================================
Syllabus: MDL501.5

Multipath propagation makes the received signal fluctuate (fade) over time as
reflected copies add constructively/destructively. The user records the REAL
live RSSI over a short window under a chosen movement scenario; from those real
samples we compute fading statistics and compare the measured amplitude
distribution to a Rayleigh model FITTED to the same real data (no random /
synthetic traces are generated).
"""

import math
import statistics
from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# In-memory session store.
sessions: List[dict] = []


class MultipathInput(BaseModel):
    scenario: str
    samples: List[float]           # real RSSI samples in dBm
    sample_rate_ms: float = 250.0


def calculate_fading_stats(samples: List[float], sample_rate_ms: float) -> dict:
    """Fading statistics derived entirely from the real RSSI samples."""
    n = len(samples)
    if n == 0:
        return {}

    mean_val = sum(samples) / n
    std_dev = statistics.stdev(samples) if n >= 2 else 0.0
    peak_to_peak = max(samples) - min(samples)

    # A fade = signal dropping 10 dB below its own mean.
    fade_threshold = mean_val - 10.0
    duration_s = (n * sample_rate_ms) / 1000.0

    # Level Crossing Rate (downward crossings of the fade threshold).
    crossings = sum(
        1 for i in range(1, n)
        if samples[i - 1] >= fade_threshold and samples[i] < fade_threshold
    )
    lcr = crossings / duration_s if duration_s > 0 else 0.0

    # Average Fade Duration.
    time_below_ms = sum(sample_rate_ms for s in samples if s < fade_threshold)
    afd_ms = time_below_ms / crossings if crossings > 0 else 0.0

    # Coherence time via lag-1 autocorrelation, exp model R(τ)=e^(-τ/Tc).
    coherence_time_ms = 0.0
    if n > 1 and std_dev > 0:
        num = sum((samples[i] - mean_val) * (samples[i + 1] - mean_val) for i in range(n - 1))
        den = sum((s - mean_val) ** 2 for s in samples)
        r1 = num / den if den > 0 else 0.0
        r1 = max(0.01, min(0.99, r1))
        dt_s = sample_rate_ms / 1000.0
        coherence_time_ms = round((-dt_s / math.log(r1)) * 1000.0, 1)

    # Severity from the fading depth (std dev).
    if std_dev < 2.0:
        severity = "Mild"
    elif std_dev <= 5.0:
        severity = "Moderate"
    else:
        severity = "Severe"

    return {
        "n_samples": n,
        "duration_s": round(duration_s, 1),
        "mean_rssi": round(mean_val, 1),
        "std_dev": round(std_dev, 2),
        "peak_to_peak": round(peak_to_peak, 1),
        "min_rssi": round(min(samples), 1),
        "max_rssi": round(max(samples), 1),
        "fade_threshold": round(fade_threshold, 1),
        "level_crossing_rate": round(lcr, 2),
        "avg_fade_duration_ms": round(afd_ms, 1),
        "coherence_time_ms": coherence_time_ms,
        "severity": severity,
    }


def amplitude_distribution(samples: List[float], bins: int = 12) -> List[dict]:
    """
    Histogram of the measured signal ENVELOPE amplitude vs a Rayleigh PDF fitted
    to the same real data. Amplitudes are the linear envelope a = 10^(RSSI/20),
    normalised by their RMS so the fit is scale-free. Nothing is randomly
    generated — the Rayleigh curve's σ is estimated from the real samples.
    """
    if len(samples) < 2:
        return []

    amps = [10 ** (s / 20.0) for s in samples]          # dBm → linear envelope
    rms = math.sqrt(sum(a * a for a in amps) / len(amps))
    if rms == 0:
        return []
    norm = [a / rms for a in amps]                      # normalise (RMS = 1)

    hi = max(norm) * 1.05
    width = hi / bins
    if width == 0:
        return []

    counts = [0] * bins
    for v in norm:
        idx = min(bins - 1, int(v / width))
        counts[idx] += 1
    total = len(norm)

    # Rayleigh σ² from the real data: E[a²] = 2σ².
    sigma2 = sum(v * v for v in norm) / (2 * len(norm))

    dist = []
    for i in range(bins):
        centre = (i + 0.5) * width
        measured_density = counts[i] / (total * width)   # normalised histogram
        rayleigh_density = (centre / sigma2) * math.exp(-(centre ** 2) / (2 * sigma2))
        dist.append({
            "amplitude": round(centre, 3),
            "measured": round(measured_density, 3),
            "rayleigh": round(rayleigh_density, 3),
        })
    return dist


@router.post("/analyze")
def analyze_multipath(data: MultipathInput):
    """Computes fading statistics + amplitude distribution from real RSSI samples."""
    clean = [s for s in data.samples if s is not None]
    if len(clean) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 real RSSI samples to analyse.")

    stats = calculate_fading_stats(clean, data.sample_rate_ms)
    record = {
        "id": len(sessions) + 1,
        "scenario": data.scenario,
        "timestamp": datetime.now().isoformat(),
        "sample_rate_ms": data.sample_rate_ms,
        "samples": clean,
        "distribution": amplitude_distribution(clean),
        **stats,
    }
    sessions.append(record)
    if len(sessions) > 20:
        sessions.pop(0)
    return record


@router.get("/sessions")
def get_sessions():
    """Returns all saved multipath fading sessions."""
    return sessions


@router.delete("/sessions")
def clear_sessions():
    """Clears all saved multipath sessions."""
    sessions.clear()
    return {"message": "All multipath sessions cleared successfully"}
