import { useState } from 'react'
import { chartSvgToPngBlob, exportExp6Doc } from '../exportDocx'
import { IS_ANDROID } from '../config'

/**
 * Experiment 6 export card. Writes the student's measured Result tables — the
 * discovered BLE devices (Table 1) and the paced RSSI field test (Table 2) —
 * into the Exp-6 document, below its range-test observation table. The document
 * is bundled with the app, so there is no upload step.
 *
 * Unlocks once devices have been discovered AND at least two range readings are
 * logged (the field-test table needs distances to be meaningful). `getChartSvg`
 * is a callback so the RSSI-vs-distance graph is read at click time, not stale.
 */
export default function ExportBluetoothDoc({ devices = [], readings = [], getChartSvg }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const hasDevices = devices.length > 0
  const hasReadings = readings.length >= 2
  const ready = hasDevices && hasReadings

  // Progress hint until both halves exist, so the feature is discoverable and it
  // is clear what is still missing.
  if (!ready) {
    const missing = [
      !hasDevices && 'scan for at least one device',
      !hasReadings && 'log 2+ range readings at different distances',
    ].filter(Boolean)
    return (
      <div className="export-doc locked">
        <span className="export-doc-icon">📄</span>
        <div>
          <strong>Export to the experiment document</strong>
          <div className="export-doc-hint">
            Discover a Bluetooth device and log a couple of range readings to unlock adding your
            measured Result tables straight into the Word document.
            {missing.length > 0 && <> Still need to: <strong>{missing.join(' · ')}</strong>.</>}
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
      const res = await exportExp6Doc({ devices, readings, chartBlob })
      setDone({ name: res.name, path: res.path, hadChart: !!chartBlob })
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
          <strong>Add Result Tables to the Experiment Document</strong>
          <div className="export-doc-hint">
            Your <strong>{devices.length}</strong> discovered device{devices.length !== 1 ? 's' : ''} (Table 1)
            and <strong>{readings.length}</strong> range readings (Table 2) are inserted as a{' '}
            <strong>“Result”</strong> section directly below the Observation Tables of the experiment
            document. The document is built into the app — just click below and a ready-to-submit copy
            is saved {IS_ANDROID ? 'to your Downloads folder' : 'to your computer'}.
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
            look under the Observation Tables.
          </span>
        </div>
      )}
    </div>
  )
}
