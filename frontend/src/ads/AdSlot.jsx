import { useEffect, useRef, useState } from 'react'
import { ADS_ENABLED, BANNER_UNITS, NATIVE_UNIT } from './adsConfig'

/**
 * One advertising slot. Renders nothing at all unless ADS_ENABLED (production,
 * approved host, not the Android app), so dev builds and the app stay ad-free.
 *
 *   variant="banner"     728x90 on desktop, 320x50 on phones (picked by width)
 *   variant="rectangle"  300x250
 *   variant="native"     Adsterra Native Banner (self-sizing; ONE per page max,
 *                        because its container id must be unique)
 */
export default function AdSlot({ variant = 'banner' }) {
  if (!ADS_ENABLED) return null
  if (variant === 'native') return <NativeSlot />
  return <BannerSlot variant={variant} />
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
 * page. Giving it its own iframe document is the reliable fix. The sandbox has no
 * allow-same-origin, so the ad code cannot reach this app's DOM or storage; it
 * keeps scripts and popups so the ad still renders and is clickable.
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

function BannerSlot({ variant }) {
  const wide = useIsWide()
  const unit = variant === 'rectangle'
    ? BANNER_UNITS.rectangle
    : (wide ? BANNER_UNITS.leaderboard : BANNER_UNITS.mobile)

  return (
    <div className="ad-slot" aria-label="Advertisement" role="complementary">
      <span className="ad-label">Advertisement</span>
      <iframe
        // Remount when the size changes so the right unit is requested.
        key={unit.key}
        title="Advertisement"
        width={unit.width}
        height={unit.height}
        srcDoc={bannerDocument(unit)}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        loading="eager"
        scrolling="no"
        style={{ border: 0, display: 'block', maxWidth: '100%' }}
      />
    </div>
  )
}

function NativeSlot() {
  const holder = useRef(null)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const script = document.createElement('script')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.src = NATIVE_UNIT.src
    // The ad script looks the container up by id, so the div must already exist
    // (it does — React rendered it) before the script is appended after it.
    el.appendChild(script)
    return () => {
      // Leaving the page: drop the script and whatever it rendered.
      el.replaceChildren()
      const box = document.createElement('div')
      box.id = NATIVE_UNIT.containerId
      el.appendChild(box)
    }
  }, [])

  return (
    <div className="ad-slot ad-slot-native" aria-label="Advertisement" role="complementary">
      <span className="ad-label">Advertisement</span>
      <div ref={holder}>
        <div id={NATIVE_UNIT.containerId} />
      </div>
    </div>
  )
}
