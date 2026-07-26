/**
 * Async bridge to the Android native layer.
 *
 * The Android app injects `window.AndroidHardware` (a Kotlin @JavascriptInterface).
 * Its methods return immediately and deliver results later by evaluating
 * `window.__hwResolve(id, json)` / `window.__hwReject(id, json)`. This module
 * turns that callback protocol into clean Promises.
 *
 * On the web/Windows build `window.AndroidHardware` is absent, so `isAndroid()`
 * is false and callers use the FastAPI adapter instead.
 */

let seq = 0
const pending = new Map()

/** One-time install of the global resolve/reject callbacks the native side calls. */
function ensureInstalled() {
  if (window.__hwInstalled) return
  window.__hwInstalled = true

  window.__hwResolve = (id, json) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    try {
      entry.resolve(JSON.parse(json))
    } catch (err) {
      entry.reject(err)
    }
  }

  window.__hwReject = (id, json) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    let message = 'Native hardware call failed'
    try {
      message = JSON.parse(json).message || message
    } catch {
      /* keep default */
    }
    entry.reject(new Error(message))
  }
}

/** True when running inside the Android WebView shell. */
export function isAndroid() {
  return typeof window !== 'undefined' && !!window.AndroidHardware
}

/**
 * Invoke a native hardware method and await its JSON result.
 * @param {string} method  one of the names in BridgeDispatcher.kt
 * @param {object} [args]  serialised to JSON and passed to the native side
 * @returns {Promise<any>} parsed JSON matching the FastAPI response shape
 */
export function callNative(method, args = {}) {
  ensureInstalled()
  return new Promise((resolve, reject) => {
    const id = `hw_${Date.now()}_${seq++}`
    pending.set(id, { resolve, reject })

    try {
      window.AndroidHardware.invoke(method, JSON.stringify(args), id)
    } catch (err) {
      pending.delete(id)
      reject(err)
      return
    }

    // Safety net so a lost native callback can never leak a pending Promise.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`Native call '${method}' timed out`))
      }
    }, 60_000)
  })
}
