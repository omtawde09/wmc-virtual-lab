import { useBackendStatus, NEEDS_LOCAL_BACKEND, BACKEND_DOWNLOAD_URL } from '../useBackend'

/**
 * Shows the local-backend connection state on every experiment page (deployed
 * build only). Live experiments read the visitor's own Wi-Fi/Bluetooth hardware,
 * which only the locally-run backend .exe can do — so this tells them to
 * download and start it, and confirms once it's connected.
 */
export default function BackendBanner() {
  // In dev the backend is proxied, so there is nothing to prompt for.
  if (!NEEDS_LOCAL_BACKEND) return null

  const status = useBackendStatus()

  if (status === 'online') {
    return (
      <div className="backend-banner online" role="status">
        <span className="backend-dot online" />
        <span><strong>Local backend connected.</strong> Live measurements are ready.</span>
      </div>
    )
  }

  return (
    <div className="backend-banner offline" role="status">
      <span className="backend-dot offline" />
      <div className="backend-banner-text">
        <strong>Live measurements need the local backend.</strong> These experiments read
        your own Wi-Fi &amp; Bluetooth hardware, which the browser cannot do alone.
        Download the small helper, run it, and keep its window open — this banner turns green
        when it connects.
        <div className="backend-banner-note">
          Windows only · Chrome/Edge recommended · SmartScreen may warn on first run → <em>More info → Run anyway</em>.
        </div>
      </div>
      <a className="btn btn-primary btn-sm backend-dl" href={BACKEND_DOWNLOAD_URL}
         target="_blank" rel="noopener noreferrer">
        ⬇ Download backend
      </a>
    </div>
  )
}
