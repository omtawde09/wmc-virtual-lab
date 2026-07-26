import { useState } from 'react'
import { chartSvgToPngBlob, exportExp5Doc } from '../exportDocx'
import { IS_ANDROID } from '../config'

/**
 * Experiment 5 export card. Writes the student's measured Result tables — the
 * command-line ping (Table 1) and the live speed test (Table 2) — into the
 * experiment document, below the Observation Tables. The document is bundled
 * with the backend, so there is no upload step.
 *
 * Unlocks as soon as either measurement exists; it exports whichever results are
 * present (both, ping-only, or speed-only). `getChartSvg` is a callback so the
 * throughput graph is read at click time, not captured early and stale.
 */
export default function ExportNetworkDoc({ ping = null, speedtest = null, getChartSvg }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  // Word export relies on the Windows backend (python-docx); not available on Android.
  if (IS_ANDROID) return null

  const hasPing = !!(ping && ping.success)
  const hasSpeed = !!speedtest
  // Both measurements are required — the Result section fills Table 1 (ping) and
  // Table 2 (speed test), so the export waits until the student has run both.
  const ready = hasPing && hasSpeed

  // Progress hint until both tests are done, so the feature is discoverable and
  // it's clear what's still missing.
  if (!ready) {
    const missing = [!hasSpeed && 'speed test', !hasPing && 'command-line ping'].filter(Boolean)
    return (
      <div className="export-doc locked">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Export to the experiment document</strong>
          <div className="export-doc-hint">
            Run <strong>both</strong> the <strong>speed test</strong> above and the{' '}
            <strong>command-line ping</strong> to unlock adding your measured Result tables straight
            into the Word document.
            {missing.length === 1 && <> Still need to run the <strong>{missing[0]}</strong>.</>}
          </div>
        </div>
      </div>
    )
  }

  async function handleExport() {
    setBusy(true); setError(null); setDone(null)
    try {
      let chartBlob = null
      if (typeof getChartSvg === 'function') {
        try {
          chartBlob = await chartSvgToPngBlob(getChartSvg())
        } catch {
          // A chart that fails to rasterise must not block the table export.
          chartBlob = null
        }
      }
      const res = await exportExp5Doc({
        ping: hasPing ? ping : null,
        speedtest: hasSpeed ? speedtest : null,
        chartBlob,
      })
      setDone({ name: res.name, hadChart: !!chartBlob })
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const parts = [hasPing && 'ping (Table 1)', hasSpeed && 'speed test (Table 2)'].filter(Boolean)

  return (
    <div className="export-doc ready">
      <div className="export-doc-head">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Add Result Tables to the Experiment Document</strong>
          <div className="export-doc-hint">
            Your measured {parts.join(' and ')} {parts.length > 1 ? 'results are' : 'result is'} inserted
            as a <strong>“Result”</strong> section directly below the Observation Tables of the
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
          ✅ Downloaded <strong>{done.name}</strong> — open it and look under the Observation Tables.
        </div>
      )}
    </div>
  )
}
