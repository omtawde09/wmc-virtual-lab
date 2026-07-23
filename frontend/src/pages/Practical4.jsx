import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Line, ComposedChart, Area, Legend
} from 'recharts'

import { resetAllOnce } from '../resetOnLoad'
import { useSEO, experimentSchema } from '../useSEO'
import ExperimentInfo from '../components/ExperimentInfo'

const API = '/api/wifi'

/* ── Helpers ── */
function signalColor(rssi) {
  if (rssi >= -50) return '#059669'  // excellent
  if (rssi >= -60) return '#2563eb'  // good
  if (rssi >= -70) return '#d97706'  // fair
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
      background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)',
      borderRadius: '10px', padding: '12px 16px', fontSize: '13px'
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Distance: <strong style={{ color: '#0f2444' }}>{d.distance} m</strong></div>
      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>RSSI: <strong style={{ color: signalColor(d.rssi) }}>{d.rssi} dBm</strong></div>
      <div style={{ color: '#94a3b8' }}>Signal: <strong style={{ color: '#0f2444' }}>{d.signal_pct}%</strong></div>
    </div>
  )
}

export default function Practical4() {
  useSEO({
    title: 'Wi-Fi Signal Strength vs Distance — Measure RSSI in dBm | WMC Virtual Lab',
    description: 'Measure real Wi-Fi RSSI at different distances, plot the signal-distance curve and analyse path loss. Live dBm readings from your own Wi-Fi adapter using netsh.',
    path: '/practical4',
    keywords: 'wifi rssi vs distance, wifi signal strength dbm, netsh wlan show interfaces, rssi to distance, path loss experiment',
    jsonLd: experimentSchema({ name: 'Wi-Fi Signal Strength vs Distance', description: 'Measure Wi-Fi RSSI at increasing distances and analyse the signal-distance relationship.', path: '/practical4', teaches: 'Wi-Fi RSSI measurement, dBm scale, log-distance path loss, signal quality classification' }),
  })

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
  const [chartMode, setChartMode] = useState('percent') // 'percent' (experiment view) | 'dbm'

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
    // On a full page reload, all practicals' stored results are cleared first,
    // then we load the (now empty) readings. Across in-app navigation the reset
    // is a no-op, so readings persist while you switch tabs.
    resetAllOnce().then(fetchReadings)
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

  /* Theoretical inverse-decay curve (100/√d) for the Signal % view, per the experiment. */
  const maxDist = chartData.length ? Math.max(...chartData.map(r => r.distance), 2) : 20
  const theoretical = []
  for (let i = 0; i <= 40; i++) {
    const d = 1 + (maxDist - 1) * i / 40
    theoretical.push({ distance: +d.toFixed(2), theo: +Math.min(100, 100 / Math.sqrt(d)).toFixed(1) })
  }

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">📶 Practical 4 · MDL501.3</div>
          <h1 className="section-title">Wi-Fi Signal Strength vs Distance — Measure RSSI &amp; Path Loss in dBm</h1>
          <p className="section-desc">
            Record Wi-Fi RSSI at different distances from the router and analyze the signal-distance relationship.
          </p>
        </div>

        {/* ── LIVE PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: liveWifi ? 'rgba(37,99,235,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Live Wi-Fi Status</span>
            {liveWifi && liveWifi.connected !== false && !liveErr && (
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

          {liveWifi && liveWifi.connected === false && !liveErr && (
            <div className="alert alert-warning">
              📡 No active Wi-Fi connection detected. Connect to a network to see live readings.
            </div>
          )}

          {liveWifi && liveWifi.connected !== false && (
            <div className="four-col">
              {/* SSID — same stat-value style/size as the other cards */}
              <div className="stat-pill">
                <div
                  className="stat-value"
                  title={liveWifi.ssid}
                  style={{ color: 'var(--cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
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
          {liveWifi && liveWifi.connected !== false && (
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
                {recording ? <><div className="spinner" style={{ borderTopColor: '#ffffff' }} /> Capturing…</> : '📍 Record'}
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
                style={{ borderColor: 'rgba(37,99,235,0.4)', color: 'var(--cyan)' }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                {chartMode === 'percent' ? '📊 Signal Strength (%) vs Distance' : '📊 RSSI (dBm) vs Distance'}
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {chartMode === 'percent'
                  ? 'PC signal strength (%) vs distance, with the theoretical inverse-decay curve (100/√d).'
                  : 'Raw signal strength (dBm) vs distance from the Wi-Fi router.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={`btn btn-sm ${chartMode === 'percent' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartMode('percent')}>Signal %</button>
              <button className={`btn btn-sm ${chartMode === 'dbm' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartMode('dbm')}>RSSI dBm</button>
              {readings.length > 0 && (
                <button id="clear-btn" className="btn btn-danger btn-sm" onClick={handleClear} disabled={loading}>🗑 Clear All</button>
              )}
            </div>
          </div>

          {readings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📶</div>
              <div className="empty-state-text">No readings yet. Record your first measurement above.</div>
            </div>
          ) : chartMode === 'percent' ? (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart margin={{ top: 10, right: 30, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                <XAxis type="number" dataKey="distance" domain={[0, 'dataMax']} allowDecimals
                  label={{ value: 'Distance (m)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <YAxis type="number" domain={[0, 110]}
                  label={{ value: 'Signal Strength (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', fontSize: '13px' }}
                  formatter={(v, name) => [`${v}%`, name]} labelFormatter={(l) => `Distance: ${l} m`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line data={theoretical} dataKey="theo" name="Theoretical decay (100/√d)"
                  stroke="#d97706" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                <Line data={chartData} dataKey="signal_pct" name="Measured (your Wi-Fi)"
                  stroke="#2563eb" strokeWidth={2.5}
                  dot={{ fill: '#2563eb', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="rssiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                <XAxis dataKey="distance" name="Distance"
                  label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <YAxis dataKey="rssi" name="RSSI" domain={[-100, -30]}
                  label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={-50} stroke="#059669" strokeDasharray="5 3" label={{ value: 'Excellent', fill: '#059669', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={-60} stroke="#2563eb" strokeDasharray="5 3" label={{ value: 'Good',      fill: '#2563eb', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={-70} stroke="#d97706" strokeDasharray="5 3" label={{ value: 'Fair',      fill: '#d97706', fontSize: 10, position: 'right' }} />
                <Area type="monotone" dataKey="rssi" fill="url(#rssiGrad)" stroke="transparent" />
                <Line type="monotone" dataKey="rssi" stroke="#2563eb" strokeWidth={2.5}
                  dot={{ fill: '#2563eb', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── DATA TABLE ── */}
        {readings.length > 0 && (
          <div className="glass-card">
            <h2 className="card-section-title">
              📋 Observation Table
            </h2>
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

        <ExperimentInfo
          heading="About this experiment: Wi-Fi signal strength vs distance"
          faqs={[
            { q: 'What is a good Wi-Fi signal strength in dBm?', a: '-30 to -50 dBm is excellent, -50 to -60 dBm is good, -60 to -70 dBm is fair and still usable for browsing, and below -80 dBm the connection becomes unreliable or drops entirely.' },
            { q: 'Why is Wi-Fi RSSI always negative?', a: 'dBm is a logarithmic ratio against 1 milliwatt. Received Wi-Fi power is far less than 1 mW, so the logarithm is negative. A smaller absolute number (-45) means more power than a larger one (-80).' },
            { q: 'How do I check Wi-Fi signal strength on Windows?', a: 'Run netsh wlan show interfaces in Command Prompt. It reports Signal as a percentage, and on newer Windows builds an Rssi value in dBm. This lab reads the real dBm value whenever your driver exposes it.' },
          ]}
          related={[
            { to: '/practical7', title: 'Indoor Path Loss vs Obstacles', blurb: 'Add walls between the devices and measure how many dB each one costs.' },
            { to: '/practical8', title: 'Multipath Fading Analysis', blurb: 'See why the signal fluctuates even when you stand perfectly still.' },
            { to: '/practical5', title: 'Throughput and Latency', blurb: 'Check what that signal strength actually delivers in Mbps and ping.' },
          ]}
        >
            <p>
              <strong>RSSI (Received Signal Strength Indicator)</strong> tells you how strong the Wi-Fi
              signal arriving at your adapter is. It is reported in <strong>dBm</strong> — a logarithmic
              scale that is always negative for Wi-Fi, because the received power is a tiny fraction of a
              milliwatt. A value closer to zero is stronger: <code>-45 dBm</code> is excellent,
              <code>-70 dBm</code> is usable, and below <code>-85 dBm</code> the link usually drops.
            </p>
            <p>
              Signal does not fall off linearly with distance. It follows the <strong>log-distance path
              loss model</strong>, where received power drops with the logarithm of distance:
              <code>RSSI = RSSI(1m) − 10·n·log10(d)</code>. That is why the curve is steep near the
              router and flattens further away — doubling the distance costs roughly the same number of dB
              every time, not the same number of metres.
            </p>
            <p>
              This page reads your adapter directly with <code>netsh wlan show interfaces</code>, so every
              point on the chart is a genuine measurement from your own hardware. Record readings at
              several distances (1 m, 3 m, 6 m, 10 m) with a clear line of sight, then compare your curve
              against the theoretical decay line.
            </p>
        </ExperimentInfo>

      </div>
    </main>
  )
}
