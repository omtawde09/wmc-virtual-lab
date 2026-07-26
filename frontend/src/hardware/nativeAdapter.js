import { callNative } from './nativeBridge'

/**
 * Android implementation of the Hardware contract. Each method forwards to the
 * matching native method in `BridgeDispatcher.kt`, which returns JSON in the same
 * shape as the Windows FastAPI backend.
 */
export const nativeAdapter = {
  scanWifi: () => callNative('scanWifi'),
  currentWifi: () => callNative('currentWifi'),
  scanBluetooth: (opts = {}) => callNative('scanBluetooth', opts),
  pairedDevices: () => callNative('pairedDevices'),
  connect: (address) => callNative('connect', { address }),
  disconnect: (address) => callNative('disconnect', { address }),
  ping: (host, count = 4) => callNative('ping', { host, count }),
  dnsLookup: (host) => callNative('dnsLookup', { host }),
}
