import { useEffect } from 'react'
import { ADS_ENABLED, GLOBAL_AD_SCRIPTS } from './adsConfig'

// The Social Bar and Popunder scripts must run once per page load, not once per
// route — they attach to the document itself and cannot be cleanly torn down.
let injected = false

/** Mounts the site-wide script ads. Renders nothing visible. */
export default function GlobalAds() {
  useEffect(() => {
    if (!ADS_ENABLED || injected) return
    injected = true
    for (const src of GLOBAL_AD_SCRIPTS) {
      const s = document.createElement('script')
      s.async = true
      s.setAttribute('data-cfasync', 'false')
      s.src = src
      document.body.appendChild(s)
    }
  }, [])

  return null
}
