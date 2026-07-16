import subprocess
import re
import time
from datetime import datetime
from typing import List

import requests
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# A real browser User-Agent — Cloudflare/Ookla reject the default library UA (HTTP 403).
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
# Cloudflare's public speed-test endpoints (the same ones speed.cloudflare.com uses).
CF_BASE = "https://speed.cloudflare.com"

# In-memory history
ping_history: List[dict] = []
speedtest_history: List[dict] = []


class PingRequest(BaseModel):
    host: str = "8.8.8.8"
    count: int = 10


def run_ping(host: str, count: int = 10) -> dict:
    """
    Runs the Windows ping command and parses the results.
    Returns latency stats: min/max/avg RTT, jitter, packet loss.
    """
    try:
        result = subprocess.run(
            ["ping", "-n", str(count), host],
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout

        if "could not find host" in output.lower() or "request timed out" in output.lower() and "Received = 0" in output:
            return {
                "success": False,
                "error": "Host unreachable or not found",
                "host": host,
            }

        # Extract individual RTT values
        times = re.findall(r"time[=<](\d+)ms", output)
        times = [int(t) for t in times]

        # Parse summary stats
        sent_m = re.search(r"Sent = (\d+)", output)
        recv_m = re.search(r"Received = (\d+)", output)
        lost_m = re.search(r"Lost = (\d+)", output)
        min_m = re.search(r"Minimum = (\d+)ms", output)
        max_m = re.search(r"Maximum = (\d+)ms", output)
        avg_m = re.search(r"Average = (\d+)ms", output)

        sent = int(sent_m.group(1)) if sent_m else count
        recv = int(recv_m.group(1)) if recv_m else len(times)
        lost = int(lost_m.group(1)) if lost_m else sent - recv
        packet_loss = round((lost / sent * 100), 1) if sent > 0 else 100.0

        min_rtt = int(min_m.group(1)) if min_m else (min(times) if times else 0)
        max_rtt = int(max_m.group(1)) if max_m else (max(times) if times else 0)
        avg_rtt = int(avg_m.group(1)) if avg_m else (sum(times) // len(times) if times else 0)

        # Jitter = mean of consecutive differences
        jitter = 0.0
        if len(times) > 1:
            diffs = [abs(times[i] - times[i - 1]) for i in range(1, len(times))]
            jitter = round(sum(diffs) / len(diffs), 1)

        return {
            "success": True,
            "host": host,
            "sent": sent,
            "received": recv,
            "lost": lost,
            "packet_loss": packet_loss,
            "min_rtt": min_rtt,
            "max_rtt": max_rtt,
            "avg_rtt": avg_rtt,
            "jitter": jitter,
            "times": times,
            "timestamp": datetime.now().isoformat(),
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Ping timed out", "host": host}
    except Exception as e:
        return {"success": False, "error": str(e), "host": host}


def run_traceroute(host: str) -> dict:
    """Runs tracert on Windows and parses hop information."""
    try:
        result = subprocess.run(
            ["tracert", "-d", "-h", "20", host],
            capture_output=True,
            text=True,
            timeout=90,
        )
        output = result.stdout
        lines = output.split("\n")
        hops = []
        for line in lines:
            hop_match = re.match(
                r"\s*(\d+)\s+(?:(\d+)\s*ms\s+(\d+)\s*ms\s+(\d+)\s*ms|\*\s+\*\s+\*)\s+([\d.]+|\*)", line
            )
            if hop_match:
                hop_num = int(hop_match.group(1))
                ip = hop_match.group(5) if hop_match.group(5) else "*"
                try:
                    t1 = int(hop_match.group(2)) if hop_match.group(2) else None
                    t2 = int(hop_match.group(3)) if hop_match.group(3) else None
                    t3 = int(hop_match.group(4)) if hop_match.group(4) else None
                    avg = round(sum(filter(None, [t1, t2, t3])) / len(list(filter(None, [t1, t2, t3]))), 1) if any([t1, t2, t3]) else None
                except Exception:
                    avg = None
                hops.append({"hop": hop_num, "ip": ip, "avg_ms": avg})
        return {
            "success": True,
            "host": host,
            "hops": hops,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "host": host}


@router.post("/ping")
def ping_host(req: PingRequest):
    """Run a ping test and return full statistics."""
    result = run_ping(req.host, req.count)
    if result.get("success"):
        ping_history.append(result)
    return result


@router.post("/traceroute")
def traceroute_host(req: PingRequest):
    """Run a traceroute to the given host."""
    return run_traceroute(req.host)


def _cf_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": BROWSER_UA})
    return session


def _measure_latency(session: requests.Session, samples: int = 5) -> List[float]:
    """Round-trip time to Cloudflare using tiny requests. Returns per-sample ms."""
    latencies = []
    for _ in range(samples):
        start = time.perf_counter()
        r = session.get(f"{CF_BASE}/__down?bytes=1", timeout=10)
        r.content  # ensure the body is fully read
        latencies.append((time.perf_counter() - start) * 1000)
    return latencies


def _measure_download(session: requests.Session) -> float:
    """
    Adaptive download test: transfer progressively larger payloads and keep the
    best sustained rate. Stops once a single transfer runs long enough (>=4s) to
    be reliable, so both slow and gigabit links get an accurate reading. Mbps.
    """
    best_mbps = 0.0
    for size in (1_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000):
        start = time.perf_counter()
        r = session.get(f"{CF_BASE}/__down?bytes={size}", timeout=60, stream=True)
        received = 0
        for chunk in r.iter_content(chunk_size=1 << 16):
            received += len(chunk)
        elapsed = time.perf_counter() - start
        if elapsed > 0:
            best_mbps = max(best_mbps, received * 8 / elapsed / 1_000_000)
        if elapsed >= 4:
            break
    return best_mbps


def _measure_upload(session: requests.Session) -> float:
    """Adaptive upload test against Cloudflare's /__up sink. Mbps."""
    best_mbps = 0.0
    for size in (1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000):
        payload = b"\0" * size
        start = time.perf_counter()
        session.post(f"{CF_BASE}/__up", data=payload, timeout=60)
        elapsed = time.perf_counter() - start
        if elapsed > 0:
            best_mbps = max(best_mbps, size * 8 / elapsed / 1_000_000)
        if elapsed >= 4:
            break
    return best_mbps


def _cf_server(session: requests.Session):
    """Reads the Cloudflare edge location (colo airport code + country)."""
    try:
        r = session.get(f"{CF_BASE}/cdn-cgi/trace", timeout=10)
        info = dict(
            line.split("=", 1) for line in r.text.splitlines() if "=" in line
        )
        return info.get("colo", ""), info.get("loc", "")
    except Exception:
        return "", ""


def _speedtest_cli_fallback(primary_error: str) -> dict:
    """
    Fallback to the speedtest-cli library (Ookla) with a patched User-Agent,
    used only if the Cloudflare method is unreachable.
    """
    try:
        import speedtest as st_lib

        _orig_build = st_lib.build_request

        def _patched_build(url, data=None, headers=None, bump="0", secure=False):
            req = _orig_build(url, data=data, headers=headers, bump=bump, secure=secure)
            req.add_header("User-Agent", BROWSER_UA)
            return req

        st_lib.build_request = _patched_build

        st = st_lib.Speedtest(secure=True)
        st.get_best_server()
        download_bps = st.download()
        upload_bps = st.upload()
        results = st.results.dict()
        server = results.get("server", {})

        record = {
            "success": True,
            "download_mbps": round(download_bps / 1_000_000, 2),
            "upload_mbps": round(upload_bps / 1_000_000, 2),
            "ping_ms": round(results.get("ping", 0), 1),
            "jitter_ms": 0.0,
            "server_name": server.get("name", "Ookla"),
            "server_country": server.get("country", ""),
            "server_host": server.get("host", ""),
            "timestamp": datetime.now().isoformat(),
        }
        speedtest_history.append(record)
        return record
    except Exception as e:
        return {
            "success": False,
            "error": (
                "Speed test failed. Could not reach Cloudflare "
                f"({primary_error}) or Ookla ({e}). Check your internet connection."
            ),
        }


@router.get("/speedtest")
def run_speedtest():
    """
    Full throughput test using Cloudflare's global speed-test network.
    Measures download speed, upload speed, ping latency and jitter — with an
    automatic fallback to the Ookla speedtest-cli library.
    """
    try:
        session = _cf_session()

        latencies = _measure_latency(session)
        ping_ms = round(min(latencies), 1) if latencies else 0.0
        if len(latencies) > 1:
            diffs = [abs(latencies[i] - latencies[i - 1]) for i in range(1, len(latencies))]
            jitter_ms = round(sum(diffs) / len(diffs), 1)
        else:
            jitter_ms = 0.0

        download_mbps = round(_measure_download(session), 2)
        upload_mbps = round(_measure_upload(session), 2)
        colo, loc = _cf_server(session)

        record = {
            "success": True,
            "download_mbps": download_mbps,
            "upload_mbps": upload_mbps,
            "ping_ms": ping_ms,
            "jitter_ms": jitter_ms,
            "server_name": f"Cloudflare {colo}".strip(),
            "server_country": loc,
            "server_host": "speed.cloudflare.com",
            "timestamp": datetime.now().isoformat(),
        }
        speedtest_history.append(record)
        return record

    except Exception as e:
        # Cloudflare unreachable — try the Ookla library as a backup.
        return _speedtest_cli_fallback(str(e))


@router.post("/speedtest/record")
def record_speedtest(result: dict):
    """
    Stores a speed-test result measured client-side (browser) so it appears in
    history. The unified test runs in the browser for live gauge animation, then
    posts its final numbers here.
    """
    result.setdefault("timestamp", datetime.now().isoformat())
    speedtest_history.append(result)
    return {"stored": True, "count": len(speedtest_history)}


@router.get("/history")
def get_history():
    """Returns all past ping test results."""
    return ping_history


@router.get("/speedtest/history")
def get_speedtest_history():
    """Returns all past speedtest results."""
    return speedtest_history


@router.delete("/history")
def clear_history():
    """Clears all ping and speedtest history."""
    ping_history.clear()
    speedtest_history.clear()
    return {"message": "History cleared successfully"}
