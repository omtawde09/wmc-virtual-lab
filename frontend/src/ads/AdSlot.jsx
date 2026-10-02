import { useEffect, useRef, useState } from 'react'
import { ADS_ENABLED, BANNER_UNITS, NATIVE_UNITS } from './adsConfig'

/**
 * One advertising slot. Renders nothing at all unless ADS_ENABLED (production,
 * approved host, not the Android app), so dev builds and the app stay ad-free.
 *
 *   variant="banner"     728x90 on desktop, 320x50 on phones (picked by width)
 *   variant="rectangle"  300x250
 *   variant="native"     first Native Banner unit; "native:1" = second unit, etc.
 *                        Each unit may appear once per page (unique container id).
 *                        If that unit doesn't exist yet, a 300x250 is shown instead.
 *
 * `flow` removes the outer margin so the slot sits flush between page sections.
 */
export default function AdSlot({ variant = 'banner', flow = false }) {
  if (!ADS_ENABLED) return null
  const cls = `ad-slot${flow ? ' ad-slot-flow' : ''}`

  if (variant.startsWith('native')) {
    const unit = NATIVE_UNITS[Number(variant.split(':')[1] || 0)]
    return unit
      ? <NativeSlot unit={unit} className={`${cls} ad-slot-native`} />
      : <BannerSlot variant="rectangle" className={cls} />
  }
  return <BannerSlot variant={variant} className={cls} />
}

/** True on viewports wide enough for a 728px leaderboard. */
function useIsWide() {
  const query = '(min-width: 768px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

/**
 * Adsterra's banner snippet sets a global `atOptions` and loads a script that
 * uses document.write — that silently fails when injected into a mounted React
 * page, so it gets its own iframe document.
 *
 * The iframe must NOT be sandboxed. Without allow-same-origin the frame has an
 * opaque origin, so the ad script cannot read the referrer or top-level hostname,
 * Adsterra cannot attribute the impression to this domain, and nothing is counted
 * (this is exactly what produced 0 impressions on all three banner units). The ad
 * code already runs unsandboxed in the page for the Native/Social/Popunder units,
 * and this app holds no accounts or secrets, so the isolation bought little.
 */
function bannerDocument(unit) {
  const options = JSON.stringify({
    key: unit.key, format: 'iframe', height: unit.height, width: unit.width, params: {},
  })
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>' +
    '</head><body>' +
    `<script>atOptions = ${options};</script>` +
    `<script src="${unit.src}"></script>` +
    '</body></html>'
  )
}

function BannerSlot({ variant, className }) {
  const wide = useIsWide()
  const unit = variant === 'rectangle'
    ? BANNER_UNITS.rectangle
    : (wide ? BANNER_UNITS.leaderboard : BANNER_UNITS.mobile)

  return (
    <div className={className} aria-label="Advertisement" role="complementary">
      <span className="ad-label">Advertisement</span>
      <iframe
        // Remount when the size changes so the right unit is requested.
        key={unit.key}
        title="Advertisement"
        width={unit.width}
        height={unit.height}
        srcDoc={bannerDocument(unit)}
        loading="eager"
        scrolling="no"
        style={{ border: 0, display: 'block', maxWidth: '100%' }}
      />
    </div>
  )
}

function NativeSlot({ unit, className }) {
  const holder = useRef(null)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const script = document.createElement('script')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.src = unit.src
    // The ad script looks the container up by id, so the div must already exist
    // (React rendered it) before the script is appended after it.
    el.appendChild(script)
    return () => {
      // Leaving the page: drop the script and whatever it rendered.
      el.replaceChildren()
      const box = document.createElement('div')
      box.id = unit.containerId
      el.appendChild(box)
    }
  }, [unit])

  return (
    <div className={className} aria-label="Advertisement" role="complementary">
      <span className="ad-label">Advertisement</span>
      <div ref={holder}>
        <div id={unit.containerId} />
      </div>
    </div>
  )
}
