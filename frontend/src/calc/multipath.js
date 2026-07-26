/**
 * Multipath fading analysis — faithful JS port of backend/multipath_analyzer.py.
 * All statistics are derived from the real RSSI samples; nothing is generated.
 */

const round = (v, d) => {
  const p = 10 ** d
  return Math.round(v * p) / p
}

/** Sample standard deviation (n-1 denominator) — matches Python statistics.stdev. */
function stdev(xs) {
  const n = xs.length
  if (n < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(variance)
}

export function calculateFadingStats(samples, sampleRateMs) {
  const n = samples.length
  if (n === 0) return {}

  const mean = samples.reduce((a, b) => a + b, 0) / n
  const sd = stdev(samples)
  const minV = Math.min(...samples)
  const maxV = Math.max(...samples)
  const peakToPeak = maxV - minV

  const fadeThreshold = mean - 10.0
  const durationS = (n * sampleRateMs) / 1000.0

  // Level Crossing Rate — downward crossings of the fade threshold.
  let crossings = 0
  for (let i = 1; i < n; i++) {
    if (samples[i - 1] >= fadeThreshold && samples[i] < fadeThreshold) crossings++
  }
  const lcr = durationS > 0 ? crossings / durationS : 0

  const timeBelowMs = samples.reduce((s, v) => s + (v < fadeThreshold ? sampleRateMs : 0), 0)
  const afdMs = crossings > 0 ? timeBelowMs / crossings : 0

  // Coherence time via lag-1 autocorrelation, R(τ) = e^(-τ/Tc).
  let coherenceTimeMs = 0.0
  if (n > 1 && sd > 0) {
    let num = 0
    let den = 0
    for (let i = 0; i < n - 1; i++) num += (samples[i] - mean) * (samples[i + 1] - mean)
    for (const s of samples) den += (s - mean) ** 2
    let r1 = den > 0 ? num / den : 0
    r1 = Math.max(0.01, Math.min(0.99, r1))
    const dtS = sampleRateMs / 1000.0
    coherenceTimeMs = round((-dtS / Math.log(r1)) * 1000.0, 1)
  }

  let severity = 'Severe'
  if (sd < 2.0) severity = 'Mild'
  else if (sd <= 5.0) severity = 'Moderate'

  return {
    n_samples: n,
    duration_s: round(durationS, 1),
    mean_rssi: round(mean, 1),
    std_dev: round(sd, 2),
    peak_to_peak: round(peakToPeak, 1),
    min_rssi: round(minV, 1),
    max_rssi: round(maxV, 1),
    fade_threshold: round(fadeThreshold, 1),
    level_crossing_rate: round(lcr, 2),
    avg_fade_duration_ms: round(afdMs, 1),
    coherence_time_ms: coherenceTimeMs,
    severity,
  }
}

export function amplitudeDistribution(samples, bins = 12) {
  if (samples.length < 2) return []

  const amps = samples.map((s) => 10 ** (s / 20.0)) // dBm → linear envelope
  const rms = Math.sqrt(amps.reduce((s, a) => s + a * a, 0) / amps.length)
  if (rms === 0) return []
  const norm = amps.map((a) => a / rms)

  const hi = Math.max(...norm) * 1.05
  const width = hi / bins
  if (width === 0) return []

  const counts = new Array(bins).fill(0)
  for (const v of norm) {
    const idx = Math.min(bins - 1, Math.floor(v / width))
    counts[idx]++
  }
  const total = norm.length
  const sigma2 = norm.reduce((s, v) => s + v * v, 0) / (2 * norm.length)

  const dist = []
  for (let i = 0; i < bins; i++) {
    const centre = (i + 0.5) * width
    const measured = counts[i] / (total * width)
    const rayleigh = (centre / sigma2) * Math.exp(-(centre ** 2) / (2 * sigma2))
    dist.push({
      amplitude: round(centre, 3),
      measured: round(measured, 3),
      rayleigh: round(rayleigh, 3),
    })
  }
  return dist
}

/** Mirrors POST /api/multipath/analyze — returns the full session record. */
export function analyzeMultipath({ samples, sample_rate_ms, scenario }, nextId = 1) {
  const clean = samples.filter((s) => s != null)
  if (clean.length < 2) {
    throw new Error('Need at least 2 real RSSI samples to analyse.')
  }
  return {
    id: nextId,
    scenario,
    timestamp: new Date().toISOString(),
    sample_rate_ms,
    samples: clean,
    distribution: amplitudeDistribution(clean),
    ...calculateFadingStats(clean, sample_rate_ms),
  }
}
