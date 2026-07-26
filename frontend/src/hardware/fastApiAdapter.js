import axios from 'axios'

/**
 * Web/Windows implementation of the Hardware contract. Each method calls the
 * existing FastAPI backend over the Vite `/api` proxy, returning exactly what the
 * pages already receive today — so adopting the Hardware layer is behaviour-
 * preserving on Windows.
 *
 * Endpoints that only exist on one platform are handled explicitly:
 *  - `dnsLookup` has no Windows endpoint (Android-only feature).
 *  - `scanWifi`/`currentWifi` both map to GET /api/wifi/scan, which returns the
 *    current connection reading on Windows.
 */
export const fastApiAdapter = {
  scanWifi: () => axios.get('/api/wifi/scan').then((r) => r.data),
  currentWifi: () => axios.get('/api/wifi/scan').then((r) => r.data),
  scanBluetooth: () => axios.get('/api/bluetooth/scan').then((r) => r.data),
  pairedDevices: () => axios.get('/api/bluetooth/conn/paired-devices').then((r) => r.data),
  connect: (address) =>
    axios.post('/api/bluetooth/conn/connect', { address }).then((r) => r.data),
  disconnect: (address) =>
    axios.post('/api/bluetooth/conn/disconnect', { address }).then((r) => r.data),
  ping: (host, count = 4) =>
    axios.post('/api/network/ping', { host, count }).then((r) => r.data),
  dnsLookup: () =>
    Promise.reject(new Error('DNS lookup is only available in the Android app.')),
}
