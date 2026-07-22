"""
Practical 7 – Path Loss in an Indoor Environment (RSSI vs Obstacles)
====================================================================
Syllabus: MDL501.5

Studies how much signal a wall/door/body costs by logging the Bluetooth link's
RSSI at (roughly fixed distance) with a VARYING number of obstacles in the path,
then measuring the per-obstacle attenuation.

This module owns its OWN reading store (`obstacle_readings`), completely separate
from Practical 6's range readings. That separation is deliberate: mixing
distance-varying readings (Exp 6) with obstacle-varying readings (Exp 7) would
confound the two effects. Discovery, RSSI capture and the analysis maths are all
reused from the shared Bluetooth modules so the two experiments stay consistent.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bleak.exc import BleakBluetoothNotAvailableError

from bluetooth_scanner import scan_for_address
from bluetooth_analyzer import (
    ObstacleAnalysis, PathLossFit, analyze_obstacles, build_path_loss_fit,
)

router = APIRouter()

# Exp 7's own store — never shared with Practical 6's range readings.
obstacle_readings: List[dict] = []


class ObstacleReadingInput(BaseModel):
    address: str
    distance: float           # metres; keep ~constant across a run to isolate obstacles
    obstacle_count: int = 0    # number of walls/doors/bodies in the path
    obstacle_desc: str = ""    # free-text, e.g. "1 drywall partition"


@router.get("/readings")
def get_readings():
    """All logged path-loss (obstacle) readings."""
    return obstacle_readings


@router.post("/reading")
async def add_reading(data: ObstacleReadingInput):
    """
    Captures a fresh RSSI for the target device and logs it against the current
    obstacle count. Reuses Practical 6's live-scan capture so the measurement is
    taken the exact same way.
    """
    if data.distance is None or data.distance <= 0:
        raise HTTPException(status_code=400, detail="Distance must be greater than 0 m.")

    try:
        found = await scan_for_address(data.address)
    except BleakBluetoothNotAvailableError:
        raise HTTPException(
            status_code=503,
            detail="Bluetooth radio is not powered on. Turn on Bluetooth and try again.",
        )

    if found is None or found["rssi"] is None:
        raise HTTPException(
            status_code=409,
            detail=f"Device {data.address} was not seen advertising during the scan window.",
        )

    reading = {
        "id": len(obstacle_readings) + 1,
        "address": data.address,
        "name": found["name"],
        "distance": round(float(data.distance), 2),
        "obstacle_count": int(data.obstacle_count),
        "obstacle_desc": data.obstacle_desc.strip(),
        "rssi": found["rssi"],
        "tx_power": found["tx_power"],
        "timestamp": datetime.now().isoformat(),
    }
    obstacle_readings.append(reading)
    return reading


@router.delete("/clear")
def clear_readings():
    """Clears all path-loss (obstacle) readings."""
    obstacle_readings.clear()
    return {"message": "All path-loss readings cleared successfully"}


@router.get("/obstacles", response_model=ObstacleAnalysis)
def get_obstacle_analysis():
    """Per-obstacle attenuation analysis over this experiment's own readings."""
    return analyze_obstacles(obstacle_readings)


@router.get("/fit", response_model=PathLossFit)
def get_path_loss_fit():
    """
    Log-distance path-loss fit over the obstacle readings — shows how the
    exponent n rises as obstruction increases. Requires 2+ distinct distances.
    """
    return build_path_loss_fit(obstacle_readings)
