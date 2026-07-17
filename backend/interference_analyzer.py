"""
Practical 9 – Noise and Interference Analysis in Wireless Communication
=======================================================================
Syllabus: MDL501.6

Uses only REAL measured data:
  - the active connection (netsh wlan show interfaces), and
  - real neighbouring BSSIDs (netsh wlan show networks mode=bssid).

From these it derives SNR, SIR and SINR, the Shannon capacity limit, and a
channel-congestion score. Nothing is fabricated — if no other APs are visible,
the channel is honestly reported as clean.
"""

import re
import math
import subprocess
from typing import List
from datetime import datetime
from fastapi import APIRouter

from wifi_scanner import get_current_wifi

router = APIRouter()

# In-memory scan history.
scan_history: List[dict] = []

# Thermal noise floor for a 20 MHz Wi-Fi channel at room temperature
# (kTB ≈ -101 dBm + ~7 dB receiver noise figure).
NOISE_FLOOR_DBM = -94.0


def channel_overlap_factor(ch1: int, ch2: int, band1: str, band2: str) -> float:
    """Fractional spectral overlap between two Wi-Fi channels."""
    if band1 != band2:
        return 0.0
    # 5 GHz channels are 20 MHz and non-overlapping unless identical.
    if "5" in band1:
        return 1.0 if ch1 == ch2 else 0.0
    # 2.4 GHz DSSS/OFDM overlap mask.
    diff = abs(ch1 - ch2)
    return {0: 1.0, 1: 0.8, 2: 0.5, 3: 0.2, 4: 0.05}.get(diff, 0.0)


def parse_netsh_networks(output: str) -> List[dict]:
    """Parses `netsh wlan show networks mode=bssid` into a list of BSSIDs."""
    networks: List[dict] = []
    current_ssid = None
    lines = output.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        ssid_match = re.match(r'^SSID\s+\d+\s+:\s*(.*)$', line)
        if ssid_match:
            current_ssid = ssid_match.group(1).strip() or "<Hidden SSID>"
            i += 1
            continue

        bssid_match = re.match(r'^\s+BSSID\s+\d+\s+:\s*([0-9a-fA-F:]+)', line)
        if bssid_match:
            info = {
                "ssid": current_ssid,
                "bssid": bssid_match.group(1).strip(),
                "signal_pct": 0,
                "radio_type": "Unknown",
                "band": "Unknown",
                "channel": 0,
                "rssi_dbm": -100.0,
            }
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if re.match(r'^\s+BSSID\s+\d+\s+:', nxt) or re.match(r'^SSID\s+\d+\s+:', nxt):
                    break
                sig = re.search(r'Signal\s+:\s*(\d+)%', nxt)
                if sig:
                    pct = int(sig.group(1))
                    info["signal_pct"] = pct
                    info["rssi_dbm"] = round((pct / 2.0) - 100, 1)
                radio = re.search(r'Radio type\s+:\s*(.*)$', nxt)
                if radio:
                    info["radio_type"] = radio.group(1).strip()
                band = re.search(r'Band\s+:\s*(.*)$', nxt)
                if band:
                    info["band"] = band.group(1).strip()
                chan = re.search(r'Channel\s+:\s*(\d+)', nxt)
                if chan:
                    info["channel"] = int(chan.group(1))
                i += 1

            # Derive band from channel if netsh omitted the Band line.
            if info["band"] in ("Unknown", "") and info["channel"] > 0:
                info["band"] = "2.4 GHz" if info["channel"] <= 14 else "5 GHz"
            networks.append(info)
            continue
        i += 1
    return networks


def _interpret_congestion(score: float) -> str:
    if score < 3.0:
        return "Low"
    if score < 6.0:
        return "Moderate"
    return "High"


@router.get("/scan")
def scan_interference():
    """Scans the wireless environment using only real measured data."""
    connected = get_current_wifi()

    if not connected.get("connected"):
        record = {
            "id": len(scan_history) + 1,
            "timestamp": datetime.now().isoformat(),
            "connected": None,
            "networks": [],
            "metrics": None,
            "message": "No active Wi-Fi connection detected.",
        }
        scan_history.append(record)
        if len(scan_history) > 10:
            scan_history.pop(0)
        return record

    conn_bssid = (connected.get("bssid") or "").lower()
    conn_rssi = connected.get("rssi")
    conn_channel = connected.get("channel") or 0
    conn_band = "2.4 GHz" if conn_channel <= 14 else "5 GHz"

    # Always include the real connected AP.
    networks = [{
        "ssid": connected.get("ssid") or "Unknown Network",
        "bssid": connected.get("bssid") or "N/A",
        "signal_pct": connected.get("signal_pct") or 0,
        "rssi_dbm": conn_rssi,
        "radio_type": "Connected",
        "band": conn_band,
        "channel": conn_channel,
    }]

    # Add real neighbouring BSSIDs.
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "networks", "mode=bssid"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            for net in parse_netsh_networks(result.stdout):
                if net["bssid"].lower() == conn_bssid or net.get("channel", 0) == 0:
                    continue
                networks.append(net)
    except Exception:
        pass

    # Interference power from real neighbours.
    co_channel = 0
    adj_channel = 0
    p_sig = 10 ** (conn_rssi / 10.0)
    p_inf = 0.0
    for net in networks:
        if net["bssid"].lower() == conn_bssid:
            net["interference_type"] = "Connected"
            continue
        overlap = channel_overlap_factor(conn_channel, net["channel"], conn_band, net["band"])
        if overlap == 1.0:
            net["interference_type"] = "Co-channel"
            co_channel += 1
            p_inf += 10 ** (net["rssi_dbm"] / 10.0) * overlap
        elif overlap > 0.0:
            net["interference_type"] = "Adjacent"
            adj_channel += 1
            p_inf += 10 ** (net["rssi_dbm"] / 10.0) * overlap
        else:
            net["interference_type"] = "None"

    snr_db = conn_rssi - NOISE_FLOOR_DBM
    p_noise = 10 ** (NOISE_FLOOR_DBM / 10.0)
    sir_db = round(10 * math.log10(p_sig / p_inf), 1) if p_inf > 0 else 40.0
    sinr_db = round(10 * math.log10(p_sig / (p_inf + p_noise)), 1)
    shannon = 20.0 * math.log2(1.0 + 10 ** (sinr_db / 10.0))
    congestion = min(10.0, round(co_channel * 1.5 + adj_channel * 0.6, 1))

    metrics = {
        "snr_db": round(snr_db, 1),
        "sir_db": sir_db,
        "sinr_db": sinr_db,
        "noise_floor_dbm": NOISE_FLOOR_DBM,
        "shannon_capacity_mbps": round(shannon, 1),
        "co_channel_count": co_channel,
        "adj_channel_count": adj_channel,
        "congestion_score": congestion,
        "congestion_level": _interpret_congestion(congestion),
    }

    record = {
        "id": len(scan_history) + 1,
        "timestamp": datetime.now().isoformat(),
        "connected": {
            "ssid": connected.get("ssid") or "Unknown Network",
            "bssid": connected.get("bssid") or "N/A",
            "channel": conn_channel,
            "rssi_dbm": conn_rssi,
            "band": conn_band,
        },
        "networks": networks,
        "metrics": metrics,
    }
    scan_history.append(record)
    if len(scan_history) > 10:
        scan_history.pop(0)
    return record


@router.get("/history")
def get_scan_history():
    """Returns past scans (up to 10)."""
    return scan_history


@router.delete("/history")
def clear_scan_history():
    """Clears all scan history."""
    scan_history.clear()
    return {"message": "Scan history cleared successfully"}
