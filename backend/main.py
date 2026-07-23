"""
Wireless & Mobile Communication — Virtual Lab API
=================================================
FastAPI backend serving:
  - Practical 4: Wi-Fi Signal Strength vs Distance   (/api/wifi/*)
  - Practical 5: Throughput & Latency Measurement    (/api/network/*)
  - Practical 6: Bluetooth Discovery & Pairing       (/api/bluetooth/*)
  - Practical 7: Path Loss vs Obstacles              (/api/pathloss/*)
  - Practical 8: Multipath Fading Effects            (/api/multipath/*)
  - Practical 9: Noise & Interference Analysis       (/api/interference/*)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wifi_scanner import router as wifi_router
from network_tester import router as network_router
from multipath_analyzer import router as multipath_router
from interference_analyzer import router as interference_router
from bluetooth_scanner import router as bluetooth_router
from bluetooth_connection import router as bluetooth_conn_router
from bluetooth_analyzer import router as bluetooth_analysis_router
from bluetooth_pathloss import router as pathloss_router

app = FastAPI(
    title="Wireless & Mobile Communication — Virtual Lab API",
    description=(
        "Backend for the WMC Virtual Lab: Practical 4 (Wi-Fi RSSI vs Distance), "
        "Practical 5 (Throughput & Latency), Practical 6 (Bluetooth Discovery & Pairing), "
        "Practical 7 (Path Loss vs Obstacles), Practical 8 (Multipath Effects), "
        "and Practical 9 (Noise & Interference)."
    ),
    version="1.0.0",
)

# Allow all origins for local development (React dev server on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wifi_router, prefix="/api/wifi", tags=["Practical 4 – Wi-Fi RSSI"])
app.include_router(network_router, prefix="/api/network", tags=["Practical 5 – Network Test"])
app.include_router(bluetooth_router, prefix="/api/bluetooth", tags=["Practical 6 – Bluetooth Communication"])
app.include_router(bluetooth_conn_router, prefix="/api/bluetooth/conn", tags=["Practical 6 – Bluetooth Pairing"])
app.include_router(bluetooth_analysis_router, prefix="/api/bluetooth/analysis", tags=["Practical 6 – Bluetooth Range Fit"])
app.include_router(pathloss_router, prefix="/api/pathloss", tags=["Practical 7 – Path Loss vs Obstacles"])
app.include_router(multipath_router, prefix="/api/multipath", tags=["Practical 8 – Multipath Effects"])
app.include_router(interference_router, prefix="/api/interference", tags=["Practical 9 – Noise & Interference"])


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "running",
        "message": "Wireless & Mobile Communication Virtual Lab API is live",
        "practicals": {
            "4": "/api/wifi",
            "5": "/api/network",
            "6": "/api/bluetooth",
            "7": "/api/pathloss",
            "8": "/api/multipath",
            "9": "/api/interference",
        },
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
