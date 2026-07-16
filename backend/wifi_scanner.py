import asyncio
import subprocess
import re
import random
import time
from datetime import datetime
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()

# In-memory store for readings
readings: List[dict] = []


class ReadingInput(BaseModel):
    distance: float


def get_current_wifi() -> dict:
    """
    Reads current Wi-Fi RSSI using `netsh wlan show interfaces` on Windows.
    Falls back to simulated data if the command fails or no Wi-Fi is connected.
    """
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = result.stdout

        ssid_match = re.search(r"^\s+SSID\s+:\s+(.+)$", output, re.MULTILINE)
        signal_match = re.search(r"Signal\s+:\s+(\d+)%", output)
        bssid_match = re.search(r"BSSID\s+:\s+([0-9a-fA-F:]+)", output)
        channel_match = re.search(r"Channel\s+:\s+(\d+)", output)

        if signal_match:
            signal_pct = int(signal_match.group(1))
            # Convert signal % to approximate dBm
            rssi = round((signal_pct / 2) - 100, 1)
            ssid = ssid_match.group(1).strip() if ssid_match else "Unknown Network"
            bssid = bssid_match.group(1).strip() if bssid_match else "N/A"
            channel = int(channel_match.group(1)) if channel_match else 0
            return {
                "ssid": ssid,
                "bssid": bssid,
                "rssi": rssi,
                "signal_pct": signal_pct,
                "channel": channel,
                "simulated": False,
            }

    except Exception:
        pass

    # Fallback: simulated values for demonstration
    rssi = round(random.uniform(-70, -40), 1)
    signal_pct = int((rssi + 100) * 2)
    return {
        "ssid": "Demo_WiFi_Network",
        "bssid": "AA:BB:CC:DD:EE:FF",
        "rssi": rssi,
        "signal_pct": signal_pct,
        "channel": 6,
        "simulated": True,
    }


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
    reading = {
        "id": len(readings) + 1,
        "distance": data.distance,
        "rssi": wifi["rssi"],
        "signal_pct": wifi["signal_pct"],
        "ssid": wifi["ssid"],
        "channel": wifi["channel"],
        "timestamp": datetime.now().isoformat(),
        "simulated": wifi["simulated"],
    }
    readings.append(reading)
    return reading


@router.delete("/clear")
def clear_readings():
    """Clears all stored readings."""
    readings.clear()
    return {"message": "All readings cleared successfully"}
