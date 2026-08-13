import { useState } from 'react'
import { exportExp7Doc } from '../exportDocx'
import { IS_ANDROID } from '../config'

/**
 * Experiment 7 export card. Writes the measured "Indoor Obstacle Attenuation
 * Data Log" (Table 1) into the Exp-7 document, replacing its blank Observations
 * placeholder. The document is bundled with the app, so there is no upload step.
 *
 * Unlocks once at least one obstacle reading has been logged.
 */
export default function ExportPathLossDoc({ readings = [] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  if (readings.length < 1) {
    return (
      <div className="export-doc locked">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Export to the experiment document</strong>
          <div className="export-doc-hint">
            Log at least one obstacle reading above to unlock adding your measured Data Log straight
            into the Word document.
          </div>
        </div>
      </div>
    )
  }

  async function handleExport() {
    setBusy(true); setError(null); setDone(null)
    try {
      const res = await exportExp7Doc({ readings })
      setDone({ name: res.name, path: res.path })
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="export-doc ready">
      <div className="export-doc-head">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Add the Data Log to the Experiment Document</strong>
          <div className="export-doc-hint">
            Your <strong>{readings.length}</strong> logged reading{readings.length !== 1 ? 's' : ''} are
            inserted as the <strong>“Indoor Obstacle Attenuation Data Log”</strong> table under a
            Result section of the experiment document. The document is built into the app — just click
            below and a ready-to-submit copy is saved {IS_ANDROID ? 'to your Downloads folder' : 'to your computer'}.
          </div>
        </div>
      </div>

      <div className="export-doc-row">
        <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={busy}>
          {busy
            ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Building…</>
            : '📥 Add to Document'}
        </button>
      </div>

      {error && <div className="alert alert-warning" style={{ marginTop: 12 }}>⚠️ {error}</div>}

      {done && (
        <div className="alert alert-success" style={{ marginTop: 12 }}>
          <span>✅</span>
          <span className="alert-body">
            Saved <strong>{done.name}</strong>
            {done.path ? <> to <strong>{done.path}</strong></> : null} — open it and
            look under the Observations section.
          </span>
        </div>
      )}
    </div>
  )
}
