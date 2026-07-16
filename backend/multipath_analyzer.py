import math
import random
import statistics
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# In-memory session store
sessions = []

class MultipathInput(BaseModel):
    scenario: str
    samples: List[float]
    sample_rate_ms: float = 250.0

class SessionRecord(BaseModel):
    id: int
    scenario: str
    timestamp: str
    mean_rssi: float
    std_dev: float
    peak_to_peak: float
    fade_threshold: float
    level_crossing_rate: float
    avg_fade_duration_ms: float
    coherence_time_ms: float
    severity: str
    samples: List[float]

def calculate_fading_stats(samples: List[float], sample_rate_ms: float) -> dict:
    if not samples:
        return {}
    
    n = len(samples)
    mean_val = sum(samples) / n
    
    # Standard deviation (fading severity)
    std_dev = statistics.stdev(samples) if n >= 2 else 0.0
    
    # Peak-to-peak swing
    peak_to_peak = max(samples) - min(samples)
    
    # Fade threshold (10 dB below mean RSSI)
    fade_threshold = mean_val - 10.0
    
    # Duration in seconds
    duration_s = (n * sample_rate_ms) / 1000.0
    
    # Level Crossing Rate (LCR) - downward crossings
    crossings = 0
    for i in range(1, n):
        if samples[i-1] >= fade_threshold and samples[i] < fade_threshold:
            crossings += 1
            
    lcr = crossings / duration_s if duration_s > 0 else 0.0
    
    # Average Fade Duration (AFD)
    time_below_ms = sum(sample_rate_ms for s in samples if s < fade_threshold)
    afd_ms = time_below_ms / crossings if crossings > 0 else 0.0
    
    # Coherence Time (Tc) estimate using lag-1 autocorrelation
    # R(tau) = E[(X_t - mu)(X_{t+tau} - mu)] / sigma^2
    coherence_time_ms = 0.0
    if n > 1 and std_dev > 0:
        num = sum((samples[i] - mean_val) * (samples[i+1] - mean_val) for i in range(n - 1))
        den = sum((samples[i] - mean_val) ** 2 for i in range(n))
        r1 = num / den if den > 0 else 0.0
        
        # bound r1 to avoid math logs of 0/negative
        r1 = max(0.01, min(0.99, r1))
        
        dt_s = sample_rate_ms / 1000.0
        # exponential model R(tau) = e^(-tau / Tc) => Tc = -dt / ln(r1)
        coherence_time_s = -dt_s / math.log(r1)
        coherence_time_ms = round(coherence_time_s * 1000.0, 1)
    
    # Qualitative severity classification
    if std_dev < 2.0:
        severity = "Mild"
    elif std_dev <= 5.0:
        severity = "Moderate"
    else:
        severity = "Severe"
        
    return {
        "mean_rssi": round(mean_val, 1),
        "std_dev": round(std_dev, 2),
        "peak_to_peak": round(peak_to_peak, 1),
        "fade_threshold": round(fade_threshold, 1),
        "level_crossing_rate": round(lcr, 2),
        "avg_fade_duration_ms": round(afd_ms, 1),
        "coherence_time_ms": coherence_time_ms,
        "severity": severity
    }

@router.post("/analyze")
def analyze_multipath(data: MultipathInput):
    """Computes multipath fading statistics from a list of RSSI samples."""
    stats = calculate_fading_stats(data.samples, data.sample_rate_ms)
    
    # Create session record
    record = {
        "id": len(sessions) + 1,
        "scenario": data.scenario,
        "timestamp": datetime.now().isoformat(),
        "samples": data.samples,
        **stats
    }
    sessions.append(record)
    return record

@router.get("/rayleigh")
def get_rayleigh_trace(mean_dbm: float = -60.0, samples: int = 120):
    """Generates a synthetic Rayleigh fading trace for comparison."""
    # Jakes-like low-pass filtered noise to simulate doppler correlation
    alpha = 0.93  # correlation coefficient between adjacent samples
    x, y = 0.0, 0.0
    trace = []
    
    for _ in range(samples):
        w_x = random.gauss(0, 1)
        w_y = random.gauss(0, 1)
        
        x = alpha * x + (1 - alpha) * w_x
        y = alpha * y + (1 - alpha) * w_y
        
        # Rayleigh envelope
        r = math.sqrt(x**2 + y**2)
        if r < 1e-5:
            r = 1e-5
            
        # convert to dB
        db = 10 * math.log10(r**2)
        trace.append(db)
        
    # Calibrate mean to mean_dbm
    curr_mean = sum(trace) / len(trace) if trace else 0.0
    offset = mean_dbm - curr_mean
    final_trace = [round(v + offset, 1) for v in trace]
    
    return {"trace": final_trace}

@router.get("/sessions")
def get_sessions():
    """Returns list of all saved multipath fading sessions."""
    return sessions

@router.delete("/clear")
def clear_sessions():
    """Clears all saved multipath sessions."""
    sessions.clear()
    return {"message": "All multipath sessions cleared successfully"}
