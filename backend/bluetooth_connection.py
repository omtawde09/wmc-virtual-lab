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
import sys
from datetime import datetime
from typing import Optional

if sys.platform == "win32":
    # Same MTA/STA fix as bluetooth_scanner.py - must run before any
    # BleakClient/BleakScanner is constructed in this process. Safe to
    # call again even if bluetooth_scanner already called it.
    from bleak.backends.winrt.util import allow_sta
    allow_sta()

from bleak import BleakClient, BleakScanner
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


class ConnectionState(BaseModel):
    address: Optional[str]
    connected: bool
    paired: Optional[bool]     # None when the platform can't report this
    services_count: Optional[int]


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
        raise HTTPException(
            status_code=409,
            detail=f"Already connected to {_active_address}. Disconnect first.",
        )

    if not (5.0 <= req.timeout <= 60.0):
        raise HTTPException(status_code=400, detail="timeout must be between 5 and 60 seconds")

    client = BleakClient(req.address, timeout=req.timeout, pair=req.pair)

    try:
        await client.connect()
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail=f"Connection to {req.address} timed out - device may be out of "
                   f"range, powered off, or not advertising a connectable service.",
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
    try:
        services = client.services
        services_count = len(list(services)) if services else 0
    except Exception:
        pass

    _active_client = client
    _active_address = req.address

    return ConnectionState(
        address=req.address,
        connected=client.is_connected,
        paired=is_paired,
        services_count=services_count,
    )


@router.get("/status", response_model=ConnectionState)
async def connection_status():
    """Reports the current live connection state - never cached/assumed."""
    if _active_client is None:
        return ConnectionState(address=None, connected=False, paired=None, services_count=None)

    connected = _active_client.is_connected
    services_count = None
    try:
        services = _active_client.services
        services_count = len(list(services)) if services else 0
    except Exception:
        pass

    return ConnectionState(
        address=_active_address,
        connected=connected,
        paired=None,
        services_count=services_count,
    )


@router.post("/disconnect")
async def disconnect_device():
    """Cleanly tears down the active BLE connection."""
    global _active_client, _active_address

    if _active_client is None:
        raise HTTPException(status_code=409, detail="No active connection to disconnect.")

    try:
        await _active_client.disconnect()
    finally:
        addr = _active_address
        _active_client = None
        _active_address = None

    return {"message": f"Disconnected from {addr}", "timestamp": datetime.now().isoformat()}