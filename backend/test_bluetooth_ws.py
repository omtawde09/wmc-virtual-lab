"""
Quick manual test for the live Bluetooth advertisement WebSocket stream.

Run this from a SEPARATE terminal while `uvicorn main:app --reload` is
already running in another one. This is not part of the FastAPI app -
it's a throwaway client script to sanity-check the /ws endpoint is
actually pushing live, changing RSSI values.

Usage:
    python test_bluetooth_ws.py
Press Ctrl+C to stop.
"""

import asyncio
import websockets
import json


async def main():
    uri = "ws://127.0.0.1:8000/api/bluetooth/ws"
    print(f"Connecting to {uri} ...")
    async with websockets.connect(uri) as ws:
        print("Connected. Listening for live advertisements (Ctrl+C to stop)...\n")
        count = 0
        try:
            while True:
                message = await ws.recv()
                data = json.loads(message)
                count += 1
                name = data.get("name") or "(no name)"
                print(
                    f"[{count:03}] {data['address']}  "
                    f"rssi={data['rssi']:>4} dBm  "
                    f"name={name}"
                )
        except KeyboardInterrupt:
            print(f"\nStopped. Received {count} advertisement events total.")


if __name__ == "__main__":
    asyncio.run(main())