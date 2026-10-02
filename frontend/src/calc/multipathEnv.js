/**
 * Multipath environment reference model (Experiment 8).
 *
 * The webapp measures REAL RSSI over a recording window — mean, peak, deep-fade
 * and fluctuation span all come from actual samples. The one thing a phone/laptop
 * cannot count from a live scan is how many distinct reflected paths are hitting
 * the receiver, so "Active Reflection Paths" is the standard reference count the
 * syllabus simulator assigns to each environment type — labelled as a model
 * reference in the exported table, exactly like Exp 7's material/base path loss.
 *
 * A Python mirror of these lives in backend/doc_export.py.
 */

/** The three syllabus environment profiles, with their reference path counts. */
export const MULTIPATH_ENVIRONMENTS = [
  { name: 'Open Field (Rician / Strong LoS)', paths: 2 },
  { name: 'Suburban Room (Moderate Multipath)', paths: 5 },
  { name: 'Dense Urban Corridor (Rayleigh / High Multipath)', paths: 10 },
]

export const DEFAULT_ENVIRONMENT = MULTIPATH_ENVIRONMENTS[1].name

export const referencePaths = (name) =>
  MULTIPATH_ENVIRONMENTS.find((e) => e.name === name)?.paths ?? 0

/**
 * Overall verdict for one recording session, from its MEASURED peak-to-fade
 * span (peak_to_peak). Mirrors the reference simulator's own threshold (10 dB).
 */
export function multipathVerdict(peakToPeakDb) {
  const span = Number(peakToPeakDb)
  if (!Number.isFinite(span)) return 'Insufficient data'
  return span > 10.0
    ? 'High Multipath Distortion (diversity/equalization recommended)'
    : 'Stable channel dynamics'
}

/** CSS badge class for a verdict, for the on-screen table. */
export function verdictBadge(verdict) {
  return verdict.startsWith('High') ? 'badge-red' : 'badge-green'
}

/**
 * The 7-column "Multipath Signal Fluctuation Data Log" row for one recorded
 * session — measured peak/fade/span plus the reference path count.
 */
export function exp8Row(session, i) {
  const env = session.scenario || DEFAULT_ENVIRONMENT
  return {
    setupNo: i + 1,
    environment: env,
    referencePaths: referencePaths(env),
    peakRssi: session.max_rssi,
    deepFadeRssi: session.min_rssi,
    span: session.peak_to_peak,
    verdict: multipathVerdict(session.peak_to_peak),
  }
}
