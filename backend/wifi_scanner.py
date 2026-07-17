import asyncio
import subprocess
import re
import time
from datetime import datetime
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

router = APIRouter()

# In-memory store for readings
readings: List[dict] = []


class ReadingInput(BaseModel):
    distance: float


def get_current_wifi() -> dict:
    """
    Reads the current Wi-Fi connection using `netsh wlan show interfaces` on
    Windows. Returns only real measured values. If there is no active Wi-Fi
    connection (or the command fails), returns a disconnected state — no data
    is ever fabricated.
    """
    disconnected = {
        "ssid": None,
        "bssid": None,
        "rssi": None,
        "signal_pct": None,
        "channel": None,
        "connected": False,
    }

    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = result.stdout

        # A live link must report "State : connected".
        state_match = re.search(r"^\s+State\s+:\s+(.+)$", output, re.MULTILINE)
        if not state_match or state_match.group(1).strip().lower() != "connected":
            return disconnected

        ssid_match = re.search(r"^\s+SSID\s+:\s+(.+)$", output, re.MULTILINE)
        signal_match = re.search(r"Signal\s+:\s+(\d+)%", output)
        bssid_match = re.search(r"BSSID\s+:\s+([0-9a-fA-F:]+)", output)
        channel_match = re.search(r"Channel\s+:\s+(\d+)", output)

        if signal_match:
            signal_pct = int(signal_match.group(1))
            # netsh reports link quality as a percentage; convert to approximate
            # dBm using Microsoft's standard linear mapping (quality 0% ≈ -100 dBm,
            # 100% ≈ -50 dBm). This is a derivation of a real measurement, not
            # synthetic data.
            rssi = round((signal_pct / 2) - 100, 1)
            return {
                "ssid": ssid_match.group(1).strip() if ssid_match else "Unknown Network",
                "bssid": bssid_match.group(1).strip() if bssid_match else None,
                "rssi": rssi,
                "signal_pct": signal_pct,
                "channel": int(channel_match.group(1)) if channel_match else None,
                "connected": True,
            }

    except Exception:
        pass

    return disconnected


@router.get("/scan")
def scan_wifi():
    """Returns the current Wi-Fi signal information (single reading)."""
    return get_current_wifi()


@router.websocket("/ws")
async def wifi_stream(ws: WebSocket):
    """
    Live Wi-Fi stream. Pushes a fresh reading as fast as the OS can produce one
    (each `netsh` scan takes ~100-400 ms, which is the hardware/driver limit for
    RSSI on Windows). Each frame includes the scan latency so the client can show
    how live the data actually is.
    """
    await ws.accept()
    loop = asyncio.get_event_loop()
    seq = 0
    try:
        while True:
            start = time.perf_counter()
            # Run the blocking netsh call off the event loop so streaming stays smooth.
            data = await loop.run_in_executor(None, get_current_wifi)
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            seq += 1
            await ws.send_json({
                **data,
                "latency_ms": latency_ms,
                "seq": seq,
                "timestamp": datetime.now().isoformat(),
            })
            # Small floor so we never busy-spin if a scan ever returns instantly.
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    except Exception:
        # Client closed mid-send or the socket errored — end the stream quietly.
        pass


@router.get("/readings")
def get_readings():
    """Returns all stored distance-RSSI readings."""
    return readings


@router.post("/reading")
def add_reading(data: ReadingInput):
    """
    Records a new distance-RSSI measurement.
    Captures current RSSI and associates it with the provided distance.
    """
    wifi = get_current_wifi()
    if not wifi.get("connected"):
        # No active Wi-Fi connection — there is no real RSSI to record.
        raise HTTPException(status_code=409, detail="No active Wi-Fi connection to record.")
    reading = {
        "id": len(readings) + 1,
        "distance": data.distance,
        "rssi": wifi["rssi"],
        "signal_pct": wifi["signal_pct"],
        "ssid": wifi["ssid"],
        "channel": wifi["channel"],
        "timestamp": datetime.now().isoformat(),
    }
    readings.append(reading)
    return reading


@router.delete("/clear")
def clear_readings():
    """Clears all stored readings."""
    readings.clear()
    return {"message": "All readings cleared successfully"}
