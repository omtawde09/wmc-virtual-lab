import { useState } from 'react'
import { useBackendStatus, NEEDS_LOCAL_BACKEND, BACKEND_DOWNLOAD_URL } from '../useBackend'

/**
 * Shows the local-backend connection state on every experiment page (deployed
 * build only). Live experiments read the visitor's own Wi-Fi/Bluetooth hardware,
 * which only the locally-run backend .exe can do — so this tells them how to get
 * running, and confirms once it's connected.
 *
 * Hooks are called unconditionally (before any early return) to satisfy React's
 * rules of hooks; `NEEDS_LOCAL_BACKEND` is passed in to disable polling in dev.
 */
export default function BackendBanner() {
  const status = useBackendStatus(NEEDS_LOCAL_BACKEND)
  // Steps start open while offline — if you're seeing this banner, you need them.
  const [showSteps, setShowSteps] = useState(true)

  // In dev the backend is proxied, so there is nothing to prompt for.
  if (!NEEDS_LOCAL_BACKEND) return null

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
      <div className="backend-banner-head">
        <span className="backend-dot offline" />
        <div className="backend-banner-text">
          <strong>Live measurements need the local backend.</strong> These experiments read
          your own Wi-Fi &amp; Bluetooth hardware, which a website cannot do on its own.
        </div>
        <div className="backend-banner-actions">
          <a className="btn btn-primary btn-sm backend-dl" href={BACKEND_DOWNLOAD_URL}
             target="_blank" rel="noopener noreferrer">
            ⬇ Download backend
          </a>
          <button type="button" className="backend-toggle"
                  onClick={() => setShowSteps(s => !s)}
                  aria-expanded={showSteps}>
            {showSteps ? '▾ Hide steps' : '▸ How to run'}
          </button>
        </div>
      </div>

      {showSteps && (
        <div className="backend-steps">
          <div className="backend-steps-title">How to run — 4 steps, nothing to install</div>
          <ol className="backend-steps-list">
            <li>
              <strong>Download</strong> the file using the button above
              <span className="step-note">≈44 MB · Windows only</span>
            </li>
            <li>
              <strong>Double-click</strong> <code>WMC-Lab-Backend.exe</code> and allow it past
              two safety prompts:
              <span className="step-note">
                • <strong>Windows SmartScreen</strong> — “Windows protected your PC” → click
                <strong> More info → Run anyway</strong>.<br />
                • <strong>Your antivirus</strong> (AVG, Avast, Norton…) may say
                “suspicious file” and close it → choose <strong>Allow / Run anyway</strong>,
                or add the file to its exclusions.
              </span>
              <span className="step-note">
                Both are expected: the file isn’t code-signed, and self-extracting Python apps
                trigger heuristic warnings. It is not harmful — the full source is public on GitHub.
              </span>
            </li>
            <li>
              <strong>Keep the black console window open.</strong> It shows
              <code>Server running on http://localhost:8000</code>
              <span className="step-note">Closing that window stops the backend.</span>
            </li>
            <li>
              <strong>Come back to this page</strong> — this banner turns green automatically
              within a few seconds, and every experiment starts working
            </li>
          </ol>

          <div className="backend-steps-foot">
            <span className="backend-pill">✅ No Python needed</span>
            <span className="backend-pill">✅ No installation</span>
            <span className="backend-pill">✅ Nothing else to download</span>
            <p>
              Everything — the Python runtime, all libraries and every experiment script — is
              already bundled inside that single <code>.exe</code>.
              <br />
              <strong>Before measuring:</strong> turn <strong>Bluetooth ON</strong> for Practicals 6 &amp; 7,
              and stay <strong>connected to Wi-Fi</strong> for Practicals 4, 8 &amp; 9.
              Chrome or Edge recommended.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
