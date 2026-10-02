import { Children } from 'react'
import AdSlot from './AdSlot'
import { ADS_ENABLED } from './adsConfig'

// Formats rotate in this order so neighbouring slots differ. The Native unit goes
// first (it sits highest on the page, where attention is best). A Native unit can
// only appear once per page, so it appears once here.
const DEFAULT_PATTERN = ['native:0', 'banner', 'rectangle', 'banner', 'rectangle']

/**
 * The page's `.container`, with ad slots interleaved between its sections so ads
 * appear all the way down the page instead of only at the bottom.
 *
 *   startAfter  first ad goes after this many sections (default 1: right under the
 *               page title, the highest-attention spot)
 *   every       then one more ad after every N sections
 *   max         never more than this many interleaved ads
 *
 * No ad is placed after the final section (ExperimentInfo supplies its own).
 * With ads disabled this renders exactly the plain container it replaced.
 */
export default function AdFlow({
  children, pattern = DEFAULT_PATTERN, startAfter = 1, every = 2, max = 6,
}) {
  if (!ADS_ENABLED) return <div className="container">{children}</div>

  // toArray drops false/null children (conditional sections), so only sections
  // that actually render are counted.
  const sections = Children.toArray(children)
  const out = []
  let placed = 0

  sections.forEach((child, i) => {
    out.push(child)
    const n = i + 1
    const isLast = n === sections.length
    if (!isLast && placed < max && n >= startAfter && (n - startAfter) % every === 0) {
      out.push(<AdSlot key={`ad-${n}`} variant={pattern[placed % pattern.length]} flow />)
      placed += 1
    }
  })

  return <div className="container">{out}</div>
}
