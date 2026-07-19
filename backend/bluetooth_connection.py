"""
Bluetooth Discovery & Range Testing Service (Practical 8)
===========================================================
Covers the GAP (Generic Access Profile) layer of Bluetooth Low Energy:
  - Advertisement scanning / device discovery
  - Live RSSI streaming for range testing
  - Manual "distance -> RSSI" logging, same pattern as wifi_scanner.py

Design decisions (documented inline, not just here):
  1. bleak over pybluez  -> bleak is actively maintained, asyncio-native,
     and uses Windows' own WinRT Bluetooth stack. pybluez is Classic-only
     and effectively dead upstream; it frequently fails to build on modern
     Windows/Python combos.
  2. asyncio throughout   -> BLE calls are I/O-bound waits on the radio.
     Blocking here would stall the whole FastAPI event loop for every
     other route, exactly like the wifi_scanner already avoids by using
     run_in_executor for its blocking `netsh` subprocess calls.
  3. No fabricated data   -> if scanning finds nothing, or a device drops
     out of range mid-stream, we report that honestly (empty list / last
     known RSSI marked stale) rather than interpolating fake numbers.
  4. In-memory storage    -> matches the rest of this codebase; a real
     lab tool does not need a database for a session's worth of readings.
"""

import asyncio
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional

if sys.platform == "win32":
    # Bleak's WinRT backend requires the thread to be MTA (multi-threaded
    # apartment). FastAPI/uvicorn's event loop thread is not guaranteed to
    # be MTA by default, which otherwise raises:
    #   BleakError: The current thread apartment type is not MTA: MAIN_STA
    # This must run before any BleakScanner/BleakClient is constructed.
    from bleak.backends.winrt.util import allow_sta
    allow_sta()

from bleak import BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData
from bleak.exc import BleakBluetoothNotAvailableError
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory state (mirrors wifi_scanner.py's `readings: List[dict]` pattern)
# ---------------------------------------------------------------------------
range_readings: List[dict] = []

# Cache of last-seen advertisement data per address, used by the live RSSI
# stream so the frontend can show "last seen Xs ago" instead of nothing.
_last_seen: Dict[str, dict] = {}


class RangeReadingInput(BaseModel):
    address: str          # target device's Bluetooth address
    distance: float        # metres, measured by the person doing the experiment


class DiscoveredDevice(BaseModel):
    address: str
    name: Optional[str]
    rssi: Optional[int]
    tx_power: Optional[int]
    service_uuids: List[str]
    manufacturer_ids: List[int]


def _to_public_device(device: BLEDevice, adv: AdvertisementData) -> dict:
    """
    Normalises a bleak (BLEDevice, AdvertisementData) pair into the shape
    the frontend expects. Only ever reports values bleak actually gave us -
    RSSI/tx_power are None if the platform didn't supply them, never guessed.
    """
    return {
        "address": device.address,
        "name": device.name or adv.local_name,
        "rssi": adv.rssi,
        "tx_power": adv.tx_power,
        "service_uuids": list(adv.service_uuids or []),
        "manufacturer_ids": list((adv.manufacturer_data or {}).keys()),
    }


@router.get("/scan", response_model=List[DiscoveredDevice])
async def scan_devices(timeout: float = 5.0):
    """
    One-shot BLE discovery scan (GAP advertisement listening).

    timeout: how many seconds to listen for advertisement packets.
    5s is the practical floor - BLE devices advertise on a duty cycle
    (commonly every 100ms-1s), so shorter windows miss infrequent
    advertisers. This mirrors why the Wi-Fi practical polls repeatedly
    rather than trusting a single netsh call.
    """
    if not (1.0 <= timeout <= 30.0):
        raise HTTPException(status_code=400, detail="timeout must be between 1 and 30 seconds")

    try:
        devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
    except BleakBluetoothNotAvailableError:
        # This is an expected, recoverable condition (radio off / no
        # adapter) - not a server bug, so it gets a clean 503 rather than
        # a raw 500 stack trace. The person just needs to turn Bluetooth on.
        raise HTTPException(
            status_code=503,
            detail="Bluetooth radio is not powered on. Turn on Bluetooth in "
                   "Windows Settings and try again.",
        )

    results = [_to_public_device(dev, adv) for dev, adv in devices.values()]
    # Strongest signal first - most relevant for range testing / triage.
    results.sort(key=lambda d: (d["rssi"] is None, -(d["rssi"] or -999)))
    return results


@router.websocket("/ws")
async def bluetooth_stream(ws: WebSocket):
    """
    Live BLE advertisement stream for range testing.

    Unlike Wi-Fi's netsh (single active connection, one reading per call),
    BLE scanning is inherently a *stream* of advertisement events from
    potentially many devices at once. So instead of polling in a loop like
    wifi_stream does, we register bleak's detection_callback and forward
    each advertisement event to the websocket as it arrives - this is the
    lower-latency, more correct approach for this radio model.
    """
    await ws.accept()
    seq = 0
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def detection_callback(device: BLEDevice, adv: AdvertisementData):
        # bleak calls this synchronously from its own backend thread/loop
        # context; hand off to the websocket's loop via a thread-safe queue
        # put so we never touch the websocket from the wrong task.
        loop.call_soon_threadsafe(queue.put_nowait, _to_public_device(device, adv))

    scanner = BleakScanner(detection_callback=detection_callback)
    started = False

    try:
        await scanner.start()
        started = True
        while True:
            data = await queue.get()
            seq += 1
            _last_seen[data["address"]] = {**data, "timestamp": datetime.now().isoformat()}
            await ws.send_json({**data, "seq": seq, "timestamp": datetime.now().isoformat()})
    except WebSocketDisconnect:
        pass
    except BleakBluetoothNotAvailableError:
        # Tell the client honestly why the stream can't start, instead of
        # just closing silently and leaving the frontend guessing.
        try:
            await ws.send_json({
                "error": "bluetooth_unavailable",
                "detail": "Bluetooth radio is not powered on.",
            })
        except Exception:
            pass
    except Exception:
        # Client closed mid-send, adapter was disabled, etc. - end quietly,
        # matching wifi_scanner's approach of never crashing the route.
        pass
    finally:
        if started:
            await scanner.stop()


@router.get("/readings")
def get_readings():
    """Returns all stored distance-RSSI readings for the range-test curve."""
    return range_readings


@router.post("/reading")
async def add_reading(data: RangeReadingInput):
    """
    Records a distance-RSSI measurement for a specific target device.
    Performs a short live scan filtered to that address so the RSSI is
    fresh at the moment of recording, not pulled from a stale cache.
    """
    found = None
    try:
        devices = await BleakScanner.discover(timeout=4.0, return_adv=True)
    except BleakBluetoothNotAvailableError:
        raise HTTPException(
            status_code=503,
            detail="Bluetooth radio is not powered on. Turn on Bluetooth and try again.",
        )
    for dev, adv in devices.values():
        if dev.address.lower() == data.address.lower():
            found = _to_public_device(dev, adv)
            break

    if found is None or found["rssi"] is None:
        raise HTTPException(
            status_code=409,
            detail=f"Device {data.address} was not seen advertising during the scan window.",
        )

    reading = {
        "id": len(range_readings) + 1,
        "address": data.address,
        "name": found["name"],
        "distance": data.distance,
        "rssi": found["rssi"],
        "tx_power": found["tx_power"],
        "timestamp": datetime.now().isoformat(),
    }
    range_readings.append(reading)
    return reading


@router.delete("/clear")
def clear_readings():
    """Clears all stored range readings."""
    range_readings.clear()
    return {"message": "All Bluetooth range readings cleared successfully"}