import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Line, ComposedChart, Area
} from 'recharts'

const API = '/api/wifi'

/* ── Helpers ── */
function signalColor(rssi) {
  if (rssi >= -50) return '#10b981'  // excellent
  if (rssi >= -60) return '#00d4ff'  // good
  if (rssi >= -70) return '#f59e0b'  // fair
  return '#ef4444'                    // poor
}

function signalLabel(rssi) {
  if (rssi >= -50) return { text: 'Excellent', cls: 'badge-green' }
  if (rssi >= -60) return { text: 'Good',      cls: 'badge-cyan'  }
  if (rssi >= -70) return { text: 'Fair',       cls: 'badge-amber' }
  return                { text: 'Poor',         cls: 'badge-red'   }
}

function pct(rssi) {
  // map [-100, -30] → [0, 100]
  return Math.max(0, Math.min(100, Math.round(((rssi + 100) / 70) * 100)))
}

/* Log-distance path-loss model:  RSSI = RSSI@1m − 10·n·log10(d)
   → d = 10^((RSSI@1m − RSSI) / (10·n)).
   RSSI@1m is device/environment specific and is the biggest source of error, so
   it can be CALIBRATED from one known point:  RSSI@1m = RSSI + 10·n·log10(d). */
const DEFAULT_RSSI_AT_1M = -45
const PATH_LOSS_N = 2.7
function estimateDistance(rssi, rssiAt1m = DEFAULT_RSSI_AT_1M) {
  if (rssi == null) return null
  const d = Math.pow(10, (rssiAt1m - rssi) / (10 * PATH_LOSS_N))
  return Math.max(0.1, Math.round(d * 10) / 10)
}
function calibrateRef(rssi, knownDistance) {
  // Back out the RSSI@1m reference from a measured (distance, RSSI) point.
  return +(rssi + 10 * PATH_LOSS_N * Math.log10(Math.max(0.1, knownDistance))).toFixed(1)
}

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: 'rgba(8,13,32,0.95)', border: '1px solid rgba(0,212,255,0.3)',
      borderRadius: '10px', padding: '12px 16px', fontSize: '13px'
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Distance: <strong style={{ color: '#f1f5f9' }}>{d.distance} m</strong></div>
      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>RSSI: <strong style={{ color: signalColor(d.rssi) }}>{d.rssi} dBm</strong></div>
      <div style={{ color: '#94a3b8' }}>Signal: <strong style={{ color: '#f1f5f9' }}>{d.signal_pct}%</strong></div>
    </div>
  )
}

export default function Practical4() {
  const [liveWifi, setLiveWifi]   = useState(null)
  const [liveErr, setLiveErr]     = useState(false)
  const [readings, setReadings]   = useState([])
  const [distance, setDistance]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [recording, setRecording] = useState(false)
  const [lastAdded, setLastAdded] = useState(null)
  // Calibrated RSSI@1m reference (persisted); null → using generic default.
  const [rssiRef, setRssiRef] = useState(() => {
    const s = typeof localStorage !== 'undefined' && localStorage.getItem('mdm_rssiAt1m')
    return s ? parseFloat(s) : null
  })
  const [updateMs, setUpdateMs]   = useState(null)   // gap between live frames

  const lastFrameAt = useRef(0)

  /* ── Fetch stored readings ── */
  const fetchReadings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/readings`)
      setReadings(res.data)
    } catch {}
  }, [])

  /* ── Live Wi-Fi via WebSocket — pushes as fast as the OS produces a reading ── */
  useEffect(() => {
    fetchReadings()
    let stopped = false
    let ws = null
    let reconnectTimer = null
    let backoff = 1000

    const open = () => {
      if (stopped) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/api/wifi/ws`)

      ws.onopen = () => { backoff = 1000 }
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data)
        const now = performance.now()
        if (lastFrameAt.current) setUpdateMs(Math.round(now - lastFrameAt.current))
        lastFrameAt.current = now
        setLiveWifi(data)
        setLiveErr(false)
      }
      ws.onclose = () => {
        if (stopped) return
        setLiveErr(true)
        reconnectTimer = setTimeout(open, backoff)      // reconnect with backoff
        backoff = Math.min(backoff * 2, 10000)          // 1s → 2s → … → 10s cap
      }
      // onclose fires after onerror, so let it handle reconnection.
      ws.onerror = () => {}
    }

    // Delay the first connection slightly. React StrictMode mounts effects
    // twice in dev (mount → unmount → remount); this timer is cancelled by the
    // throwaway unmount, so only the real mount ever opens a socket — no churn.
    const startTimer = setTimeout(open, 150)

    return () => {
      stopped = true
      clearTimeout(startTimer)
      clearTimeout(reconnectTimer)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close()
    }
  }, [fetchReadings])

  /* ── Calibrate the path-loss model to the user's setup ── */
  function handleCalibrate() {
    const known = parseFloat(distance)
    if (!liveWifi || isNaN(known) || known <= 0) return
    const ref = calibrateRef(liveWifi.rssi, known)
    setRssiRef(ref)
    try { localStorage.setItem('mdm_rssiAt1m', String(ref)) } catch {}
  }
  function handleResetCalibration() {
    setRssiRef(null)
    try { localStorage.removeItem('mdm_rssiAt1m') } catch {}
  }

  /* ── Record a reading ── */
  async function handleRecord() {
    const dist = parseFloat(distance)
    if (isNaN(dist) || dist < 0) return
    setRecording(true)
    try {
      const res = await axios.post(`${API}/reading`, { distance: dist })
      setLastAdded(res.data)
      await fetchReadings()
    } catch {}
    setRecording(false)
  }

  /* ── Clear ── */
  async function handleClear() {
    if (!window.confirm('Clear all readings?')) return
    setLoading(true)
    try { await axios.delete(`${API}/clear`); await fetchReadings() } catch {}
    setLoading(false)
  }

  /* ── Derived stats ── */
  const rssiValues = readings.map(r => r.rssi)
  const minRssi = rssiValues.length ? Math.min(...rssiValues) : null
  const maxRssi = rssiValues.length ? Math.max(...rssiValues) : null
  const avgRssi = rssiValues.length
    ? Math.round(rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length)
    : null

  const chartData = [...readings].sort((a, b) => a.distance - b.distance)
  const qual = liveWifi ? signalLabel(liveWifi.rssi) : null

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">📶 Practical 4 · MDL501.3</div>
          <h1 className="section-title">Signal Strength vs Distance</h1>
          <p className="section-desc">
            Record Wi-Fi RSSI at different distances from the router and analyze the signal-distance relationship.
          </p>
        </div>

        {/* ── LIVE PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: liveWifi ? 'rgba(0,212,255,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Live Wi-Fi Status</span>
            {liveWifi?.simulated && <span className="sim-badge">Simulated</span>}
            {liveWifi && !liveErr && (
              <span className="badge badge-green" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Streaming
                {updateMs != null && <>&nbsp;·&nbsp;{updateMs} ms/update</>}
                {liveWifi.latency_ms != null && <>&nbsp;·&nbsp;{liveWifi.latency_ms} ms scan</>}
              </span>
            )}
          </div>

          {liveErr && (
            <div className="alert alert-warning">
              ⚠️ Could not connect to backend. Make sure the FastAPI server is running on port 8000.
            </div>
          )}

          {liveWifi && (
            <div className="four-col">
              {/* SSID */}
              <div className="stat-pill">
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--cyan)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  {liveWifi.ssid}
                </div>
                <div className="stat-label">Network SSID</div>
              </div>

              {/* RSSI */}
              <div className="stat-pill">
                <div className="stat-value" style={{ color: signalColor(liveWifi.rssi) }}>
                  {liveWifi.rssi}
                </div>
                <div className="stat-label">RSSI (dBm)</div>
              </div>

              {/* Signal % */}
              <div className="stat-pill">
                <div className="stat-value" style={{ color: signalColor(liveWifi.rssi) }}>
                  {liveWifi.signal_pct}%
                </div>
                <div className="stat-label">Signal Strength</div>
              </div>

              {/* Quality */}
              <div className="stat-pill">
                <div style={{ marginBottom: '8px', marginTop: '4px' }}>
                  <span className={`badge ${qual.cls}`} style={{ fontSize: '14px', padding: '5px 14px' }}>
                    {qual.text}
                  </span>
                </div>
                <div className="stat-label">Quality &nbsp;· Ch {liveWifi.channel}</div>
              </div>
            </div>
          )}

          {/* Signal bar */}
          {liveWifi && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Signal Level
              </div>
              <div className="signal-bar-wrap">
                <div className="signal-bar-track" style={{ height: '10px' }}>
                  <div
                    className="signal-bar-fill"
                    style={{
                      width: `${pct(liveWifi.rssi)}%`,
                      background: `linear-gradient(90deg, ${signalColor(liveWifi.rssi)}, ${signalColor(liveWifi.rssi)}88)`,
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '36px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {pct(liveWifi.rssi)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RECORD PANEL ── */}
        <div className="two-col" style={{ marginBottom: '24px' }}>
          <div className="glass-card">
            <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: 'var(--cyan)' }}>
              ➕ Record New Reading
            </div>
            <div className="input-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Distance from Router (meters)</label>
                <input
                  id="distance-input"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input-field"
                  placeholder="e.g. 2.5"
                  value={distance}
                  onChange={e => setDistance(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRecord()}
                />
              </div>
              <button
                id="record-btn"
                className="btn btn-primary"
                onClick={handleRecord}
                disabled={recording || !distance || !liveWifi}
                style={{ height: '46px' }}
              >
                {recording ? <><div className="spinner" style={{ borderTopColor: '#050a18' }} /> Capturing…</> : '📍 Record'}
              </button>
            </div>

            {/* Optional: estimate distance from the live signal (path-loss model) */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button
                id="estimate-btn"
                className="btn btn-outline btn-sm"
                onClick={() => liveWifi && setDistance(String(estimateDistance(liveWifi.rssi, rssiRef ?? undefined)))}
                disabled={!liveWifi}
              >
                📐 Estimate from signal
                {liveWifi && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  &nbsp;≈ {estimateDistance(liveWifi.rssi, rssiRef ?? undefined)} m
                </span>}
              </button>
              <button
                id="calibrate-btn"
                className="btn btn-outline btn-sm"
                onClick={handleCalibrate}
                disabled={!liveWifi || !distance}
                title="Type your real current distance, then calibrate so estimates match your setup"
                style={{ borderColor: 'rgba(16,185,129,0.4)', color: 'var(--green)' }}
              >
                🎯 Calibrate to {distance ? `${distance} m` : '…'}
              </button>
            </div>

            <div style={{ fontSize: '12px', marginTop: '10px' }}>
              {rssiRef != null
                ? <span style={{ color: 'var(--green)' }}>✓ Calibrated to your setup (RSSI@1m = {rssiRef} dBm). <button onClick={handleResetCalibration} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', padding: 0 }}>reset</button></span>
                : <span style={{ color: 'var(--amber)' }}>⚠ Using a generic model — estimates can be off by several metres. To fix: type your real distance and press Calibrate.</span>}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.6 }}>
              Stand at the stated distance, then click Record — RSSI is auto-read from your Wi-Fi adapter.
              Note: distance-from-signal is inherently approximate (walls, orientation and near-router
              saturation all distort it), so always measure the real distance for graded readings.
            </div>
          </div>

          {/* Last Reading */}
          {lastAdded && (
            <div className="glass-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
                ✅ Last Recorded Reading
              </div>
              <div className="three-col">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                    {lastAdded.distance}m
                  </div>
                  <div className="stat-label">Distance</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: signalColor(lastAdded.rssi) }}>
                    {lastAdded.rssi}
                  </div>
                  <div className="stat-label">dBm</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: signalColor(lastAdded.rssi) }}>
                    {lastAdded.signal_pct}%
                  </div>
                  <div className="stat-label">Signal</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── STATS ── */}
        {readings.length > 0 && (
          <div className="four-col" style={{ marginBottom: '24px' }}>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>{readings.length}</div>
              <div className="stat-label">Total Readings</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: signalColor(maxRssi) }}>{maxRssi} dBm</div>
              <div className="stat-label">Best Signal</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: signalColor(minRssi) }}>{minRssi} dBm</div>
              <div className="stat-label">Worst Signal</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: signalColor(avgRssi) }}>{avgRssi} dBm</div>
              <div className="stat-label">Average RSSI</div>
            </div>
          </div>
        )}

        {/* ── CHART ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>📊 RSSI vs Distance Chart</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Signal strength (dBm) plotted against distance from the Wi-Fi router
              </div>
            </div>
            {readings.length > 0 && (
              <button id="clear-btn" className="btn btn-danger btn-sm" onClick={handleClear} disabled={loading}>
                🗑 Clear All
              </button>
            )}
          </div>

          {readings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📶</div>
              <div className="empty-state-text">No readings yet. Record your first measurement above.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="rssiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="distance"
                  name="Distance"
                  label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  stroke="#334155"
                />
                <YAxis
                  dataKey="rssi"
                  name="RSSI"
                  domain={[-100, -30]}
                  label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  stroke="#334155"
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Reference lines for quality zones */}
                <ReferenceLine y={-50} stroke="#10b981" strokeDasharray="5 3" label={{ value: 'Excellent', fill: '#10b981', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={-60} stroke="#00d4ff" strokeDasharray="5 3" label={{ value: 'Good',      fill: '#00d4ff', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={-70} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: 'Fair',      fill: '#f59e0b', fontSize: 10, position: 'right' }} />
                <Area type="monotone" dataKey="rssi" fill="url(#rssiGrad)" stroke="transparent" />
                <Line
                  type="monotone"
                  dataKey="rssi"
                  stroke="#00d4ff"
                  strokeWidth={2.5}
                  dot={{ fill: '#00d4ff', r: 5, strokeWidth: 2, stroke: '#050a18' }}
                  activeDot={{ r: 7, fill: '#00d4ff', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── DATA TABLE ── */}
        {readings.length > 0 && (
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
              📋 Observation Table
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Distance (m)</th>
                    <th>RSSI (dBm)</th>
                    <th>Signal %</th>
                    <th>Quality</th>
                    <th>Network</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => {
                    const q = signalLabel(r.rssi)
                    return (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td><strong>{r.distance}</strong></td>
                        <td style={{ color: signalColor(r.rssi) }}><strong>{r.rssi}</strong></td>
                        <td>{r.signal_pct}%</td>
                        <td><span className={`badge ${q.cls}`}>{q.text}</span></td>
                        <td style={{ color: 'var(--cyan)' }}>{r.ssid}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Conclusion */}
            <div className="divider" />
            <div className="alert alert-info">
              💡 <strong>Observation:</strong> As distance from the router increases, RSSI decreases (becomes more negative),
              confirming the inverse relationship between signal strength and distance.
              {maxRssi && minRssi && ` Across your ${readings.length} readings, signal degraded from ${maxRssi} dBm to ${minRssi} dBm — a loss of ${Math.abs(maxRssi - minRssi)} dBm.`}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
