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

app = FastAPI(
    title="MDM Practicals API",
    description="Backend for MDM Practical 4 (Wi-Fi RSSI) and Practical 5 (Network Throughput & Latency)",
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


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "running",
        "message": "MDM Practicals API is live",
        "practicals": {
            "4": "/api/wifi",
            "5": "/api/network",
        },
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
