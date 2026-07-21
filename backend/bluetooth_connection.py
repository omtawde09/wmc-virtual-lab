"""
Bluetooth Connection & Pairing Module (Practical 8, Phase 3)
==============================================================
Demonstrates the security layer: Connect -> Pair -> Bond.

WHY PYTHON DOES NOT (AND SHOULD NOT) HANDLE PAIRING UI ITSELF
---------------------------------------------------------------
On Windows, the actual pairing handshake - PIN entry, "Confirm this code
matches on both devices", "Allow this device to connect?" - is owned by
the OS Bluetooth stack, not by this process. bleak's BleakClient.pair()
simply triggers that native OS flow and reports success/failure; it does
not (and cannot, by design) intercept or automate the PIN/confirmation
step itself.

This is correct, not a limitation to route around:
  - Long-term encryption keys generated during bonding are stored in the
    OS-protected keystore. A userspace script silently generating or
    approving trust relationships would be a serious security regression
    (any code with USB/BLE access could mint arbitrary trusted bonds).
  - The person standing next to the physical device is the correct
    authority to confirm a pairing code - not an unattended script.

What THIS module legitimately automates:
  - Establishing the unencrypted GATT connection (post-advertisement,
    pre-security)
  - Triggering the native pairing prompt via pair=True / .pair()
  - Reporting connection/pairing/bond state back to the frontend
  - Cleanly disconnecting

added timeouts and explicit state reporting throughout, because a hung
BLE connection attempt (out of range, device turned off mid-handshake)
should surface as a clear error to the person running the experiment,
never as a frontend that just spins forever.
"""

import asyncio
import subprocess
import sys
from datetime import datetime
from typing import List, Optional

if sys.platform == "win32":
    # Same MTA/STA fix as bluetooth_scanner.py - must run before any
    # BleakClient/BleakScanner is constructed in this process. Safe to
    # call again even if bluetooth_scanner already called it.
    from bleak.backends.winrt.util import allow_sta
    allow_sta()

from bleak import BleakClient, BleakScanner
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from bluetooth_scanner import _discovered_devices

router = APIRouter()

# One BleakClient per address at a time - a real lab session connects to
# one device under test, not many simultaneously. Keeping this simple and
# explicit (rather than a generic connection pool) matches the scope of
# a teaching tool and avoids silently leaking BLE connections.
_active_client: Optional[BleakClient] = None
_active_address: Optional[str] = None


class ConnectRequest(BaseModel):
    address: str
    pair: bool = False        # explicit opt-in - never pair silently
    timeout: float = 15.0


class PairedDevice(BaseModel):
    name: str
    status: str
    instance_id: str


class GATTServiceInfo(BaseModel):
    uuid: str
    name: str


class ConnectionState(BaseModel):
    address: Optional[str]
    connected: bool
    paired: Optional[bool]     # None when the platform can't report this
    services_count: Optional[int]
    services: Optional[List[GATTServiceInfo]] = None



@router.post("/connect", response_model=ConnectionState)
async def connect_device(req: ConnectRequest):
    """
    Connects to a BLE device and optionally triggers native OS pairing.

    If req.pair is True, Windows will show its native pairing prompt to
    the person at the keyboard - this call will wait for that human
    decision. That's intentional: pairing consent belongs to a person,
    not to an automated script.
    """
    global _active_client, _active_address

    if _active_client is not None:
        if _active_client.is_connected:
            raise HTTPException(
                status_code=409,
                detail=f"Already connected to {_active_address}. Disconnect first.",
            )
        else:
            try:
                await _active_client.disconnect()
            except Exception:
                pass
            _active_client = None
            _active_address = None

    if not (5.0 <= req.timeout <= 60.0):
        raise HTTPException(status_code=400, detail="timeout must be between 5 and 60 seconds")

    def on_disconnect(client: BleakClient):
        global _active_client, _active_address
        if _active_address == req.address:
            _active_client = None
            _active_address = None

    # Retrieve the cached BLEDevice object to prevent "Device was not found" error on Windows
    device_to_connect = _discovered_devices.get(req.address.upper())

    if device_to_connect is not None:
        client = BleakClient(
            device_to_connect,
            timeout=req.timeout,
            pair=req.pair,
            disconnected_callback=on_disconnect
        )
    else:
        client = BleakClient(
            req.address,
            timeout=req.timeout,
            pair=req.pair,
            disconnected_callback=on_disconnect
        )

    try:
        await client.connect()
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail=(
                f"Connection to {req.address} timed out. Common causes: "
                f"(1) the device is out of range or powered off; "
                f"(2) if this address belongs to a phone, most phones only "
                f"act as a BLE *scanner*, not a connectable BLE peripheral, "
                f"so a direct GATT connect attempt will always time out - "
                f"this is normal phone behaviour, not a bug. Connectable BLE "
                f"peripherals are typically dedicated devices: fitness bands, "
                f"smart tags, sensors, or a phone app specifically running a "
                f"BLE peripheral/GATT server mode (e.g. nRF Connect's "
                f"'Advertiser' feature)."
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Connection failed: {exc}")

    is_paired = None
    if req.pair:
        try:
            is_paired = await client.pair()
        except NotImplementedError:
            # Some backends/devices report pairing state differently;
            # report honestly instead of guessing.
            is_paired = None
        except Exception as exc:
            await client.disconnect()
            _active_client = None
            _active_address = None
            raise HTTPException(status_code=502, detail=f"Pairing failed or was declined: {exc}")

    services_count = None
    services_list = None
    try:
        services = client.services
        if services:
            services_count = len(list(services))
            services_list = [
                GATTServiceInfo(uuid=s.uuid, name=s.description or "Unknown Service")
                for s in services
            ]
        else:
            services_count = 0
            services_list = []
    except Exception:
        pass

    _active_client = client
    _active_address = req.address

    return ConnectionState(
        address=req.address,
        connected=client.is_connected,
        paired=is_paired,
        services_count=services_count,
        services=services_list,
    )


@router.get("/status", response_model=ConnectionState)
async def connection_status():
    """Reports the current live connection state - never cached/assumed."""
    global _active_client, _active_address
    if _active_client is None:
        return ConnectionState(address=None, connected=False, paired=None, services_count=None, services=None)

    connected = _active_client.is_connected
    if not connected:
        _active_client = None
        _active_address = None
        return ConnectionState(address=None, connected=False, paired=None, services_count=None, services=None)

    services_count = None
    services_list = None
    try:
        services = _active_client.services
        if services:
            services_count = len(list(services))
            services_list = [
                GATTServiceInfo(uuid=s.uuid, name=s.description or "Unknown Service")
                for s in services
            ]
        else:
            services_count = 0
            services_list = []
    except Exception:
        pass

    return ConnectionState(
        address=_active_address,
        connected=connected,
        paired=None,
        services_count=services_count,
        services=services_list,
    )


@router.post("/disconnect")
async def disconnect_device():
    """Cleanly tears down the active BLE connection."""
    global _active_client, _active_address

    if _active_client is None:
        return {"message": "Already disconnected", "timestamp": datetime.now().isoformat()}

    try:
        if _active_client.is_connected:
            await _active_client.disconnect()
    except Exception:
        pass
    finally:
        addr = _active_address
        _active_client = None
        _active_address = None

    return {"message": f"Disconnected from {addr}", "timestamp": datetime.now().isoformat()}


@router.get("/paired-devices", response_model=List[PairedDevice])
def list_paired_devices():
    """
    Lists Bluetooth devices Windows itself considers paired, via PowerShell's
    Get-PnpDevice. This exists specifically because phone pairing does NOT
    happen through BleakClient.connect()/pair() in this system - most phones
    only run BLE in scanner (central) role, not connectable peripheral role,
    so a direct GATT connect attempt to a phone will simply time out (see
    the /connect endpoint's error message for the full explanation).

    Real phone pairing happens the normal way: Windows Settings -> Bluetooth
    & devices -> Add device -> confirm the code on the phone. This endpoint
    then reports on that OS-level pairing state honestly, rather than this
    Python service pretending it performed the pairing itself.
    """
    if sys.platform != "win32":
        raise HTTPException(
            status_code=501,
            detail="Paired-device listing uses Windows PnP and is only available on Windows.",
        )

    try:
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                "Get-PnpDevice -Class Bluetooth | "
                "Select-Object FriendlyName, Status, InstanceId | "
                "ConvertTo-Json -Compress",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Windows device query timed out.")

    if result.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Windows PnP query failed: {result.stderr.strip() or 'unknown error'}",
        )

    import json
    raw = result.stdout.strip()
    if not raw:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not parse Windows PnP device list.")

    # PowerShell returns a single object (not a list) when there's only one match.
    if isinstance(parsed, dict):
        parsed = [parsed]

    devices = []
    for item in parsed:
        instance_id = item.get("InstanceId") or ""
        # Filter for actual physical paired devices (prefix BTHENUM\DEV_)
        if instance_id.upper().startswith("BTHENUM\\DEV_"):
            devices.append(
                PairedDevice(
                    name=item.get("FriendlyName") or "(unnamed)",
                    status=str(item.get("Status") or "Unknown"),
                    instance_id=instance_id,
                )
            )
    return devices