import axios from 'axios'

// Clears every practical's stored results exactly once per full page load.
// A browser refresh re-runs this module, so `done` resets to false — but during
// in-app navigation the flag stays true, so switching tabs does NOT wipe results.
let done = false
let inFlight = null

export function resetAllOnce() {
  if (done) return Promise.resolve()
  if (inFlight) return inFlight
  inFlight = Promise.allSettled([
    axios.delete('/api/wifi/clear'),            // Practical 4 – RSSI readings
    axios.delete('/api/network/history'),       // Practical 5 – ping & speedtest history
    axios.delete('/api/bluetooth/clear'),       // Practical 6 – BLE range readings
    axios.delete('/api/pathloss/clear'),        // Practical 7 – obstacle readings
    axios.delete('/api/multipath/sessions'),    // Practical 8 – multipath sessions
    axios.delete('/api/interference/history'),  // Practical 9 – interference scans
  ]).then(() => { done = true })
  return inFlight
}
