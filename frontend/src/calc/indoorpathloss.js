/**
 * Indoor path-loss reference model (Experiment 7).
 *
 * The webapp measures REAL RSSI with a real obstacle in the path. These helpers
 * add the standard theoretical decomposition the syllabus asks for — the base
 * (distance) path loss and the material attenuation — so the observation table
 * shows measured signal alongside the model's predicted loss breakdown.
 *
 * Constants mirror the Exp-7 reference simulator: 2.4 GHz, Tx 15 dBm, indoor
 * path-loss exponent n = 3. The material losses are the standard 2.4 GHz values
 * from the syllabus. A Python mirror of these lives in backend/doc_export.py.
 */

export const PATH_LOSS_TX_DBM = 15.0
export const PATH_LOSS_FREQ_MHZ = 2400
export const PATH_LOSS_EXPONENT = 3.0

/** Standard 2.4 GHz obstacle attenuation (dB), matching the Exp-7 syllabus. */
export const OBSTACLE_MATERIALS = [
  { name: 'Line of Sight (Free Space)', loss: 0 },
  { name: 'Clear Glass Window', loss: 2 },
  { name: 'Solid Wooden Door', loss: 5 },
  { name: 'Concrete / Brick Wall', loss: 14 },
  { name: 'Reinforced Metal Shield', loss: 28 },
]

export const DEFAULT_MATERIAL = OBSTACLE_MATERIALS[0].name

export const materialLoss = (name) =>
  OBSTACLE_MATERIALS.find((m) => m.name === name)?.loss ?? 0

// Free-space path loss at the 1 m reference distance for 2.4 GHz (≈40.05 dB).
// FSPL(dB) = 20·log10(f_MHz) − 27.55, with distance in metres.
const FSPL_1M = 20 * Math.log10(PATH_LOSS_FREQ_MHZ) - 27.55

/**
 * Theoretical free-space + distance path loss at `d` metres, from the
 * log-distance model: FSPL(1 m) + 10·n·log10(d). This is the "Base Path Loss"
 * column — a model reference computed from the entered distance, not a
 * measurement.
 */
export function basePathLoss(d) {
  const dist = Math.max(1, Number(d) || 1)
  return +(FSPL_1M + 10 * PATH_LOSS_EXPONENT * Math.log10(dist)).toFixed(1)
}

/** Connection verdict from a MEASURED RSSI, per the Exp-7 thresholds. */
export function connectionStatus(rssi) {
  if (rssi == null || !Number.isFinite(Number(rssi))) return 'No Signal'
  const r = Number(rssi)
  if (r >= -65) return 'Excellent'
  if (r >= -80) return 'Good'
  if (r >= -92) return 'Poor'
  return 'Out of Range'
}

/** CSS badge class for a connection status, for the on-screen table. */
export function statusBadge(status) {
  if (status === 'Excellent') return 'badge-green'
  if (status === 'Good') return 'badge-cyan'
  if (status === 'Poor') return 'badge-amber'
  return 'badge-red'
}

/**
 * The 7-column "Indoor Obstacle Attenuation Data Log" row for one reading —
 * measured RSSI plus the theoretical base/material loss decomposition.
 */
export function exp7Row(reading, i) {
  const material = reading.material || DEFAULT_MATERIAL
  return {
    testNo: i + 1,
    material,
    distance: reading.distance,
    basePathLoss: basePathLoss(reading.distance),
    materialLoss: materialLoss(material),
    rssi: reading.rssi,
    status: connectionStatus(reading.rssi),
  }
}
