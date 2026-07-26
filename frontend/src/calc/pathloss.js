/**
 * Log-distance path-loss model + obstacle analysis.
 *
 * Faithful JS port of backend/bluetooth_analyzer.py (build_path_loss_fit /
 * analyze_obstacles) so Android computes identically to the Windows backend.
 * Shared by Practical 6 (Bluetooth range) and Practical 7 (path loss vs obstacles).
 */

const round = (v, d) => {
  const p = 10 ** d
  return Math.round(v * p) / p
}

/** Ordinary least-squares line fit — equivalent to numpy.polyfit(x, y, 1). */
export function linfit(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, intercept: my - slope * mx }
}

/** RSSI = RSSI0 - 10*n*log10(d), fit by regression on log10(distance). */
export function logDistanceFit(readings) {
  const valid = readings.filter((r) => r.distance > 0 && r.rssi != null)
  if (valid.length < 2) return null

  const logD = valid.map((r) => Math.log10(r.distance))
  const rssi = valid.map((r) => r.rssi)
  const { slope, intercept } = linfit(logD, rssi)

  const predicted = logD.map((x) => slope * x + intercept)
  const meanR = rssi.reduce((a, b) => a + b, 0) / rssi.length
  const ssRes = rssi.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0)
  const ssTot = rssi.reduce((s, v) => s + (v - meanR) ** 2, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return {
    rssi_at_1m: round(intercept, 2),
    path_loss_exponent: round(-slope / 10, 3),
    r_squared: round(r2, 4),
    sample_count: valid.length,
  }
}

/** d = 10 ^ ((RSSI0 - RSSI) / (10n)). Null when n <= 0. */
function predictDistance(rssi, rssi0, n) {
  if (n <= 0) return null
  return 10 ** ((rssi0 - rssi) / (10 * n))
}

export function interpretN(n) {
  if (n < 2.0) return 'Below free-space (n<2): corridor waveguiding or reflective surroundings.'
  if (n < 2.5) return 'Near free-space (n~2-2.5): clear line-of-sight, minimal obstruction.'
  if (n < 3.5) return 'Typical indoor (n~2.5-3.5): normal room, some furniture.'
  if (n < 5.0) return 'Obstructed indoor (n~3.5-5): walls, doors, or body blocking the path.'
  return 'Heavily obstructed (n>=5): multiple walls, metal, or floors between devices.'
}

function interpretPerObstacle(db) {
  if (db < 2) return 'Minimal impact - thin partitions or glass.'
  if (db < 6) return 'Typical drywall/interior door - noticeable but usable.'
  if (db < 12) return 'Significant loss - concrete, brick, or a closed metal door.'
  return 'Severe attenuation - likely metal, multiple walls, or a Faraday-like effect.'
}

/** Mirrors backend build_path_loss_fit; returns null when <2 distinct distances. */
export function buildPathLossFit(readings) {
  const fit = logDistanceFit(readings)
  if (!fit) return null

  const predicted_range_m = {}
  for (const r of [-50, -60, -70, -80, -90]) {
    const d = predictDistance(r, fit.rssi_at_1m, fit.path_loss_exponent)
    predicted_range_m[String(r)] = d == null ? null : round(d, 2)
  }
  return {
    ...fit,
    interpretation: interpretN(fit.path_loss_exponent),
    predicted_range_m,
  }
}

/** Mirrors backend analyze_obstacles; returns null when no readings. */
export function analyzeObstacles(readings) {
  if (!readings || readings.length === 0) return null

  const groups = {}
  for (const r of readings) {
    const oc = r.obstacle_count ?? 0
    ;(groups[oc] ||= []).push(r.rssi)
  }

  const keys = Object.keys(groups).map(Number).sort((a, b) => a - b)
  const baselineKey = keys[0]
  const baseAvg = groups[baselineKey].reduce((a, b) => a + b, 0) / groups[baselineKey].length

  const result_groups = keys.map((oc) => {
    const vals = groups[oc]
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return {
      obstacle_count: oc,
      avg_rssi: round(avg, 1),
      attenuation_db: round(baseAvg - avg, 1),
      samples: vals.length,
    }
  })

  let per_obstacle_db = null
  let interpretation = null
  if (keys.length >= 2) {
    const xs = readings.map((r) => r.obstacle_count ?? 0)
    const ys = readings.map((r) => r.rssi)
    const { slope } = linfit(xs, ys)
    per_obstacle_db = round(-slope, 2)
    interpretation = interpretPerObstacle(per_obstacle_db)
  }

  return { groups: result_groups, per_obstacle_db, interpretation }
}
