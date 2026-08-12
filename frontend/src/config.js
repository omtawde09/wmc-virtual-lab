// Central API/WebSocket base.
//
// - In DEV, VITE_API_BASE is empty, so everything stays relative ('/api/...')
//   and Vite's dev proxy forwards it to http://localhost:8000.
// - In the PRODUCTION build (deployed to an HTTPS host), VITE_API_BASE is set to
//   http://localhost:8000 (see .env.production) so the deployed page talks to the
//   locally-running backend .exe on the visitor's own machine.
//
// Chromium (Chrome/Edge) treats http://localhost & ws://localhost as a secure
// context, so an HTTPS page is allowed to reach them. The backend additionally
// sends the Private Network Access header so Chrome's preflight passes.

export const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * True when running inside the Android app's WebView, where the native bridge
 * (window.AndroidHardware) replaces the FastAPI backend entirely. Pages use this
 * to source data from the native Hardware layer instead of localhost, and to
 * skip the "run the backend .exe" prompts that only apply to the Windows build.
 */
export const IS_ANDROID =
  typeof window !== 'undefined' && !!window.AndroidHardware

/**
 * True on a phone/tablet browser (NOT the Android app itself). A mobile browser
 * can't run the Windows backend .exe, so these visitors are pointed at the
 * installable Android app instead. Device type is stable for the session, so a
 * one-time user-agent check is enough.
 */
export const IS_MOBILE_BROWSER =
  !IS_ANDROID &&
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)

/** Build a WebSocket URL for a given API path (e.g. '/api/wifi/ws'). */
export function wsUrl(path) {
  if (API_BASE) {
    // http://localhost:8000 -> ws://localhost:8000 ; https -> wss
    return API_BASE.replace(/^http/, 'ws') + path
  }
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173'
  return `${proto}://${host}${path}`
}

/** The origin the backend health-check pings, e.g. 'http://localhost:8000' (or '' in dev). */
export const BACKEND_ORIGIN = API_BASE
