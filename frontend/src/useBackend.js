import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE, IS_ANDROID } from './config'

// Where the backend .exe is downloaded from. Point this at your GitHub Release
// asset once you publish it (Releases -> upload WMC-Lab-Backend.exe).
export const BACKEND_DOWNLOAD_URL =
  'https://github.com/omtawde09/wmc-virtual-lab/releases/latest/download/WMC-Lab-Backend.exe'

// The installable Android app. Points at the latest release page (rather than a
// versioned asset path) so the link keeps working across releases regardless of
// the .apk's version suffix — the APK is listed right there to download.
export const ANDROID_APP_URL =
  'https://github.com/omtawde09/wmc-virtual-lab/releases/latest'

// Only meaningful in the deployed Windows build, where API_BASE points at
// localhost. In dev (API_BASE === '') the backend is proxied and always "there",
// and on Android the native bridge replaces the backend — neither needs the .exe.
export const NEEDS_LOCAL_BACKEND = API_BASE !== '' && !IS_ANDROID

/**
 * Polls the local backend's /health endpoint so the UI can show whether the
 * downloadable .exe is running. Returns 'checking' | 'online' | 'offline'.
 *
 * `enabled` is a parameter (rather than the caller bailing out early) so this
 * hook is always called unconditionally — React's rules of hooks forbid calling
 * it behind an early return. In dev it's disabled, so no pointless polling.
 */
export function useBackendStatus(enabled = true, intervalMs = 4000) {
  const [status, setStatus] = useState(IS_ANDROID ? 'online' : 'checking')

  useEffect(() => {
    // On Android the native hardware bridge is always present — no server to poll.
    if (IS_ANDROID) { setStatus('online'); return }
    if (!enabled) return
    let alive = true
    const ping = async () => {
      try {
        await axios.get('/health', { timeout: 2500 })
        if (alive) setStatus('online')
      } catch {
        if (alive) setStatus('offline')
      }
    }
    ping()
    const id = setInterval(ping, intervalMs)
    return () => { alive = false; clearInterval(id) }
  }, [enabled, intervalMs])

  return status
}
