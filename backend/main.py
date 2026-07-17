"""
MDM Practicals API
==================
FastAPI backend serving:
  - Practical 4: Wi-Fi Signal Strength vs Distance  (/api/wifi/*)
  - Practical 5: Throughput & Latency Measurement   (/api/network/*)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wifi_scanner import router as wifi_router
from network_tester import router as network_router
from multipath_analyzer import router as multipath_router
from path_loss_analyzer import router as pathloss_router
from bluetooth_scanner import router as bluetooth_router
from bluetooth_connection import router as bt_connection_router
from bluetooth_analyzer import router as bt_analyzer_router



app = FastAPI(
    title="MDM Practicals API",
    description="Backend for MDM Practical 4 (Wi-Fi RSSI), Practical 5 (Network Throughput), Practical 6 (Multipath), and Practical 7 (Path Loss vs Obstacles)",
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
app.include_router(multipath_router, prefix="/api/multipath", tags=["Practical 6 – Multipath Fading"])
app.include_router(pathloss_router, prefix="/api/pathloss", tags=["Practical 7 – Path Loss vs Obstacles"])
app.include_router(bluetooth_router, prefix="/api/bluetooth", tags=["Practical 8 – Bluetooth Range & Discovery"])
app.include_router(bt_connection_router, prefix="/api/bluetooth/conn", tags=["Practical 8 – Bluetooth Connection & Pairing"])
app.include_router(bt_analyzer_router, prefix="/api/bluetooth/analysis", tags=["Practical 8 – Path Loss Analysis"])



@app.get("/", tags=["Health"])
def root():
    return {
        "status": "running",
        "message": "MDM Practicals API is live",
        "practicals": {
            "4": "/api/wifi",
            "5": "/api/network",
            "6": "/api/multipath",
            "7": "/api/pathloss",
            "8": "/api/bluetooth",
        },
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
