import { useEffect } from 'react'
import { REPO_URL } from '../useBackend'

/**
 * A friendly prompt shown right after a download starts, inviting the visitor to
 * star the project on GitHub. Dismissible in every obvious way (overlay click,
 * ✕, Escape, "Maybe later") so it never traps the user.
 */
export default function StarRepoModal({ onClose }) {
  // Close on Escape — expected behaviour for a modal dialog.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="star-modal-overlay" role="dialog" aria-modal="true"
         aria-label="Star the project on GitHub" onClick={onClose}>
      <div className="star-modal" onClick={(e) => e.stopPropagation()}>
        <button className="star-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="star-modal-icon">⭐</div>
        <h3 className="star-modal-title">Your download has started!</h3>
        <p className="star-modal-text">
          If you find <strong>WMC Virtual Lab</strong> useful or interesting, please consider
          giving it a star on GitHub — it genuinely helps other students find the project.
        </p>
        <div className="star-modal-actions">
          <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noopener noreferrer"
             onClick={onClose}>
            ⭐ Star on GitHub
          </a>
          <button className="btn btn-outline" onClick={onClose}>Maybe later</button>
        </div>
      </div>
    </div>
  )
}
