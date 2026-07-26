import { useState } from 'react'
import {
  MIN_READINGS_FOR_EXPORT, chartSvgToPngBlob, exportToExperimentDoc,
} from '../exportDocx'
import { IS_ANDROID } from '../config'

/**
 * Appears once the student has taken enough readings, and writes their
 * observation table + graph into the experiment document that is built into the
 * app — no file upload. The finished document downloads as a new copy.
 *
 * `getChartSvg` is a callback (not an element) so the SVG is read at click time
 * — the chart re-renders as readings are added, so grabbing it early would
 * export a stale picture.
 */
export default function ExportToDocument({
  readings = [],
  getChartSvg,
  experiment = 'Experiment 4 - Wi-Fi Signal Strength vs Distance',
  template = 'exp4',
  minReadings = MIN_READINGS_FOR_EXPORT,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  // Word export relies on the Windows backend (python-docx); not available on Android.
  if (IS_ANDROID) return null

  const enough = readings.length >= minReadings
  const remaining = minReadings - readings.length

  // Progress hint until they qualify, so the feature is discoverable.
  if (!enough) {
    return (
      <div className="export-doc locked">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Export to the experiment document</strong>
          <div className="export-doc-hint">
            Record {remaining} more reading{remaining !== 1 ? 's' : ''} ({readings.length}/{minReadings})
            to unlock adding your observation table and graph straight into the Word document.
          </div>
          <div className="export-progress">
            <div className="export-progress-fill" style={{ width: `${(readings.length / minReadings) * 100}%` }} />
          </div>
        </div>
      </div>
    )
  }

  async function handleExport() {
    setBusy(true); setError(null); setDone(null)
    try {
      const svg = typeof getChartSvg === 'function' ? getChartSvg() : null
      let chartBlob = null
      try {
        chartBlob = await chartSvgToPngBlob(svg)
      } catch {
        // A chart that fails to rasterise must not block the table export.
        chartBlob = null
      }
      const res = await exportToExperimentDoc({ readings, chartBlob, experiment, template })
      setDone({ name: res.name, hadChart: !!chartBlob })
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
          <strong>Add Observation Table &amp; Graph to the Experiment Document</strong>
          <div className="export-doc-hint">
            Your {readings.length} readings and the graph are inserted as a{' '}
            <strong>“Result &amp; Graph”</strong> section directly below the Observation Table of the
            experiment document. The document is built into the app — just click below and a
            ready-to-submit copy downloads to your computer.
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
          ✅ Downloaded <strong>{done.name}</strong> — open it and look under the Observation Table.
          {!done.hadChart && ' (The graph could not be captured, so only the table was added.)'}
        </div>
      )}
    </div>
  )
}
