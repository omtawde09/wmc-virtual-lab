import re
import math
import random
import subprocess
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

# Import current Wi-Fi function to avoid code duplication
from wifi_scanner import get_current_wifi

router = APIRouter()

# In-memory history for scans
scan_history = []

# Thermal Noise Floor constant for 20 MHz Wi-Fi channel at room temperature (including typical 7dB noise figure)
NOISE_FLOOR_DBM = -94.0

class InterferenceStats(BaseModel):
    snr_db: float
    sir_db: float
    sinr_db: float
    noise_floor_dbm: float
    shannon_capacity_mbps: float
    co_channel_count: int
    adj_channel_count: int
    congestion_score: float

class ScanRecord(BaseModel):
    id: int
    timestamp: str
    connected: dict
    networks: List[dict]
    metrics: dict

def get_channel_overlap_factor(ch1: int, ch2: int, band1: str, band2: str) -> float:
    # If bands are different, there's no overlap
    if band1 != band2:
        return 0.0
    
    # 5 GHz channels are typically 20 MHz spaced and non-overlapping unless on the same channel
    if "5 GHz" in band1 or "5GHz" in band1:
        if ch1 == ch2:
            return 1.0
        return 0.0
        
    # 2.4 GHz channels: DSSS/CCK/OFDM mask overlap
    diff = abs(ch1 - ch2)
    if diff == 0:
        return 1.0
    elif diff == 1:
        return 0.8
    elif diff == 2:
        return 0.5
    elif diff == 3:
        return 0.2
    elif diff == 4:
        return 0.05
    else:
        return 0.0

def parse_netsh_networks(output: str) -> List[dict]:
    networks = []
    current_ssid = None
    
    lines = output.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Match SSID block
        ssid_match = re.match(r'^SSID\s+\d+\s+:\s*(.*)$', line)
        if ssid_match:
            current_ssid = ssid_match.group(1).strip()
            if not current_ssid:
                current_ssid = "<Hidden SSID>"
            i += 1
            continue
            
        # Match BSSID block inside SSID
        bssid_match = re.match(r'^\s+BSSID\s+\d+\s+:\s*([0-9a-fA-F:]+)', line)
        if bssid_match:
            current_bssid = bssid_match.group(1).strip()
            bssid_info = {
                "ssid": current_ssid,
                "bssid": current_bssid,
                "signal_pct": 0,
                "radio_type": "Unknown",
                "band": "Unknown",
                "channel": 0,
                "rssi_dbm": -100.0
            }
            
            # Read BSSID properties
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if re.match(r'^\s+BSSID\s+\d+\s+:', next_line) or re.match(r'^SSID\s+\d+\s+:', next_line):
                    break
                    
                signal_m = re.search(r'Signal\s+:\s*(\d+)%', next_line)
                if signal_m:
                    pct = int(signal_m.group(1))
                    bssid_info["signal_pct"] = pct
                    bssid_info["rssi_dbm"] = round((pct / 2.0) - 100, 1)
                    
                radio_m = re.search(r'Radio type\s+:\s*(.*)$', next_line)
                if radio_m:
                    bssid_info["radio_type"] = radio_m.group(1).strip()
                    
                band_m = re.search(r'Band\s+:\s*(.*)$', next_line)
                if band_m:
                    bssid_info["band"] = band_m.group(1).strip()
                    
                chan_m = re.search(r'Channel\s+:\s*(\d+)', next_line)
                if chan_m:
                    bssid_info["channel"] = int(chan_m.group(1))
                    
                i += 1
                
            networks.append(bssid_info)
            continue
            
        i += 1
        
    return networks

def generate_simulated_networks(connected_ap: dict) -> List[dict]:
    networks = []
    # Add connected AP
    networks.append({
        "ssid": connected_ap["ssid"],
        "bssid": connected_ap["bssid"],
        "signal_pct": connected_ap["signal_pct"],
        "rssi_dbm": connected_ap["rssi"],
        "radio_type": "802.11ax",
        "band": "2.4 GHz" if connected_ap["channel"] <= 14 else "5 GHz",
        "channel": connected_ap["channel"]
    })
    
    # Generate mock networks
    mock_ssids = ["Airtel_Extreme_5G", "JioFiber_4G", "NETGEAR_Guest", "Linksys_Home", "TP-LINK_Free"]
    channels_24 = [1, 6, 11]
    channels_5 = [36, 44, 48, 149]
    
    for i, ssid in enumerate(mock_ssids):
        # Distribute channels relative to connected AP
        if connected_ap["channel"] <= 14:
            # 2.4 GHz band
            band = "2.4 GHz"
            if i == 0:
                ch = connected_ap["channel"]  # Co-channel
            elif i == 1:
                ch = max(1, min(13, connected_ap["channel"] + 2))  # Adjacent channel
            else:
                ch = random.choice(channels_24)
        else:
            # 5 GHz band
            band = "5 GHz"
            if i == 0:
                ch = connected_ap["channel"]  # Co-channel
            else:
                ch = random.choice(channels_5)
                
        sig = int(random.uniform(40, 95))
        networks.append({
            "ssid": ssid,
            "bssid": f"00:11:22:33:44:0{i}",
            "signal_pct": sig,
            "rssi_dbm": round((sig / 2.0) - 100, 1),
            "radio_type": "802.11ac",
            "band": band,
            "channel": ch
        })
        
    return networks

@router.get("/scan")
def scan_interference():
    """Runs a full scan of the wireless environment to detect noise/interference."""
    # 1. Get the current connected AP status
    connected_ap = get_current_wifi()
    simulated = connected_ap.get("simulated", False)
    
    networks = []
    if not simulated:
        try:
            # Attempt real scan
            result = subprocess.run(
                ["netsh", "wlan", "show", "networks", "mode=bssid"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                networks = parse_netsh_networks(result.stdout)
            else:
                simulated = True
        except Exception:
            simulated = True
            
    if simulated or not networks:
        # Fallback to simulated networks
        networks = generate_simulated_networks(connected_ap)
        
    # 2. Identify the active network in the scan list
    # If connected to a real network, find it in the scan list by BSSID or SSID
    connected_bssid = connected_ap.get("bssid", "").lower()
    connected_rssi = connected_ap.get("rssi", -70.0)
    connected_channel = connected_ap.get("channel", 6)
    connected_band = "2.4 GHz" if connected_channel <= 14 else "5 GHz"
    
    # 3. Compute interference metrics
    co_channel_count = 0
    adj_channel_count = 0
    
    p_sig_linear = 10 ** (connected_rssi / 10.0)
    p_inf_linear = 0.0
    
    for net in networks:
        # Avoid counting our own connected BSSID as an interferer
        if net["bssid"].lower() == connected_bssid:
            net["interference_type"] = "Connected"
            continue
            
        overlap = get_channel_overlap_factor(
            connected_channel, net["channel"],
            connected_band, net["band"]
        )
        
        if overlap == 1.0:
            net["interference_type"] = "Co-channel"
            co_channel_count += 1
            p_inf_linear += 10 ** (net["rssi_dbm"] / 10.0) * overlap
        elif overlap > 0.0:
            net["interference_type"] = "Adjacent"
            adj_channel_count += 1
            p_inf_linear += 10 ** (net["rssi_dbm"] / 10.0) * overlap
        else:
            net["interference_type"] = "None"
            
    # 4. Calculate SNR, SIR, SINR
    snr_db = connected_rssi - NOISE_FLOOR_DBM
    
    p_noise_linear = 10 ** (NOISE_FLOOR_DBM / 10.0)
    
    # SIR calculation
    if p_inf_linear > 0:
        sir_db = round(10 * math.log10(p_sig_linear / p_inf_linear), 1)
    else:
        sir_db = 40.0  # clean channel cap
        
    # SINR calculation
    sinr_linear = p_sig_linear / (p_inf_linear + p_noise_linear)
    sinr_db = round(10 * math.log10(sinr_linear), 1)
    
    # Shannon Theoretical capacity: C = B * log2(1 + SINR)
    # Wi-Fi bandwidth assumed to be 20 MHz (20e6)
    shannon_capacity = 20.0 * math.log2(1.0 + (10 ** (sinr_db / 10.0)))
    
    # Congestion Score: 0 to 10 scale
    # Weighted sum of interferers
    congestion_score = (co_channel_count * 1.5) + (adj_channel_count * 0.6)
    congestion_score = min(10.0, round(congestion_score, 1))
    
    metrics = {
        "snr_db": round(snr_db, 1),
        "sir_db": sir_db,
        "sinr_db": sinr_db,
        "noise_floor_dbm": NOISE_FLOOR_DBM,
        "shannon_capacity_mbps": round(shannon_capacity, 1),
        "co_channel_count": co_channel_count,
        "adj_channel_count": adj_channel_count,
        "congestion_score": congestion_score
    }
    
    record = {
        "id": len(scan_history) + 1,
        "timestamp": datetime.now().isoformat(),
        "connected": {
            "ssid": connected_ap.get("ssid", "Unknown Network"),
            "bssid": connected_ap.get("bssid", "N/A"),
            "channel": connected_channel,
            "rssi_dbm": connected_rssi,
            "band": connected_band,
            "simulated": simulated
        },
        "networks": networks,
        "metrics": metrics
    }
    
    scan_history.append(record)
    # Keep only the latest 10 scans
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
