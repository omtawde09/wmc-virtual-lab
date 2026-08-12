/**
 * Bluetooth field-test classification — shared by the on-screen results table
 * and the experiment-document export so both show identical values.
 *
 * These label a REAL measured RSSI; they do not invent data. The boundaries and
 * wording mirror the Experiment 6 syllabus Table 2 (Connected / Weak /
 * Intermittent / Disconnected) and the Python backend `_bt_link_state`.
 */

/** @returns {[state: string, performance: string]} for a measured BLE RSSI. */
export function btLinkState(rssi) {
  if (rssi == null || !Number.isFinite(Number(rssi))) {
    return ['Disconnected', 'No advertisement received — device out of range.']
  }
  const r = Number(rssi)
  if (r >= -65) return ['Connected', 'Flawless connection. Instantaneous file/audio transfers.']
  if (r >= -75) return ['Connected', 'Very stable. Minimal buffering, stuttering, or delay.']
  if (r >= -88) return ['Weak Connection', 'Sluggish response times. Transfers take longer to start.']
  if (r >= -98) return ['Intermittent', 'Audio/data stream stutters, drops, and tries to reconnect.']
  return ['Disconnected', 'Pairing link lost entirely due to signal path loss.']
}

/** A CSS badge class for a link state, for the on-screen table. */
export function btStateBadge(state) {
  if (state === 'Connected') return 'badge-green'
  if (state === 'Weak Connection') return 'badge-amber'
  if (state === 'Intermittent') return 'badge-amber'
  return 'badge-red'
}

/** Honest device category from the scan (BLE + vendor when the OUI resolved). */
export const btCategory = (d) =>
  (d.vendor || '').trim() ? `BLE · ${d.vendor.trim()}` : 'BLE (Low Energy)'

/** What service profiles were actually observed for this device. */
export const btServices = (d) =>
  d.connected && d.services_count
    ? `${d.services_count} GATT service${d.services_count !== 1 ? 's' : ''} (connected)`
    : 'GAP advertisement only'
