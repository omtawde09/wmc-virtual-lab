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
from interference_analyzer import router as interference_router

app = FastAPI(
    title="MDM Practicals API",
    description="Backend for MDM Practical 4 (Wi-Fi RSSI), Practical 5 (Network Throughput), Practical 8 (Multipath Effects), and Practical 9 (Noise & Interference)",
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
app.include_router(multipath_router, prefix="/api/multipath", tags=["Practical 8 – Multipath Effects"])
app.include_router(interference_router, prefix="/api/interference", tags=["Practical 9 – Noise & Interference"])


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "running",
        "message": "MDM Practicals API is live",
        "practicals": {
            "4": "/api/wifi",
            "5": "/api/network",
            "8": "/api/multipath",
            "9": "/api/interference",
        },
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
