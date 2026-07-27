/**
 * Chart scaling helpers.
 *
 * The RSSI charts used to pin the Y axis to a fixed textbook range (−100…−30
 * dBm). That is 70 dB tall, so a real measurement — a 3 dB multipath fade, or
 * readings spanning −50 to −58 — occupied under a tenth of the plot and drew as
 * a flat line no matter what the hardware reported. These helpers frame the axis
 * on the data actually collected, so the shape of the result is visible.
 */

/**
 * Y-axis domain that frames `values`, padded slightly and never narrower than
 * `minSpan` (so a perfectly steady signal still gets a sane axis rather than a
 * zero-height one).
 *
 * @param {number[]} values    the measured series
 * @param {object}  [opts]
 * @param {number}  [opts.pad=3]       dB of headroom above/below the data
 * @param {number}  [opts.minSpan=10]  smallest axis span to ever show
 * @param {number[]} [opts.fallback]   domain to use when there is no data yet
 */
export function fitDomain(values, { pad = 3, minSpan = 10, fallback = [-100, -30] } = {}) {
  const v = (values || []).filter((x) => typeof x === 'number' && Number.isFinite(x))
  if (!v.length) return fallback

  let lo = Math.min(...v) - pad
  let hi = Math.max(...v) + pad

  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  return [Math.floor(lo), Math.ceil(hi)]
}

/** True when `y` sits inside `[domain[0], domain[1]]` — used to drop reference
 *  lines that would otherwise stretch the axis back out. */
export function inDomain(y, domain) {
  return y >= domain[0] && y <= domain[1]
}
