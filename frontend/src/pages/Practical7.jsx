import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  ComposedChart, Scatter, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'

const API = '/api/pathloss'

/* ── Helpers ── */
function signalColor(rssi) {
  if (rssi == null) return '#94a3b8'
  if (rssi >= -50) return '#10b981'  // excellent
  if (rssi >= -60) return '#00d4ff'  // good
  if (rssi >= -70) return '#f59e0b'  // fair
  return '#ef4444'                    // poor
}
function signalLabel(rssi) {
  if (rssi >= -50) return { text: 'Excellent', cls: 'badge-green' }
  if (rssi >= -60) return { text: 'Good',      cls: 'badge-cyan'  }
  if (rssi >= -70) return { text: 'Fair',      cls: 'badge-amber' }
  return                { text: 'Poor',        cls: 'badge-red'   }
}
function nColor(n) {
  if (n == null) return 'var(--text-muted)'
  if (n < 2.5) return '#10b981'
  if (n < 3.5) return '#00d4ff'
  if (n < 5.0) return '#f59e0b'
  return '#ef4444'
}

export default function Practical7() {
  const [liveWifi, setLiveWifi] = useState(null)
  const [liveErr, setLiveErr]   = useState(false)
  const [updateMs, setUpdateMs] = useState(null)

  const [measurements, setMeasurements] = useState([])
  const [analysis, setAnalysis] = useState(null)

  const [distance, setDistance]       = useState('')
  const [obstacleCount, setObstacleCount] = useState(0)
  const [obstacleDesc, setObstacleDesc]   = useState('')
  const [recording, setRecording] = useState(false)
  const [loading, setLoading]     = useState(false)

  const lastFrameAt = useRef(0)

  /* ── Load logged measurements + analysis ── */
  const fetchData = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([
        axios.get(`${API}/measurements`),
        axios.get(`${API}/analysis`),
      ])
      setMeasurements(m.data)
      setAnalysis(a.data)
    } catch {}
  }, [])

  /* ── Live RSSI via the shared Wi-Fi WebSocket ── */
  useEffect(() => {
    fetchData()
    let stopped = false
    let ws = null
    let retry = null
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
        retry = setTimeout(open, backoff)
        backoff = Math.min(backoff * 2, 10000)
      }
      ws.onerror = () => {}
    }
    const startTimer = setTimeout(open, 150)   // StrictMode-safe delayed open

    return () => {
      stopped = true
      clearTimeout(startTimer)
      clearTimeout(retry)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close()
    }
  }, [fetchData])

  /* ── Capture a measurement at the current spot ── */
  async function handleCapture() {
    const d = parseFloat(distance)
    if (isNaN(d) || d <= 0) return
    setRecording(true)
    try {
      await axios.post(`${API}/measurement`, {
        distance_m: d,
        obstacle_count: parseInt(obstacleCount) || 0,
        obstacle_desc: obstacleDesc,
      })
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not capture reading.')
    }
    setRecording(false)
  }

  async function handleClear() {
    if (!window.confirm('Clear all measurements?')) return
    setLoading(true)
    try { await axios.delete(`${API}/measurements`); await fetchData() } catch {}
    setLoading(false)
  }

  const connected = liveWifi && liveWifi.connected !== false
  const qual = connected ? signalLabel(liveWifi.rssi) : null

  /* Measured scatter points for the RSSI-vs-distance chart */
  const measuredPts = measurements
    .filter(m => m.distance_m > 0)
    .map(m => ({ distance_m: m.distance_m, rssi_dbm: m.rssi_dbm }))

  const fitPts = analysis?.fit_points || []
  const obstacleRows = analysis?.obstacle_attenuation || []

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">📡 Practical 7 · MDL501.5</div>
          <h1 className="section-title">Path Loss in an Indoor Environment</h1>
          <p className="section-desc">
            Measure how Wi-Fi RSSI decays with distance and obstacles. Move the phone/router,
            add walls between them, and capture the real signal at each point — then fit the
            log-distance path-loss exponent <em>n</em> and the attenuation per obstacle.
          </p>
        </div>

        {/* ── LIVE PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: connected ? 'rgba(16,185,129,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--green)' }}>Live RSSI</span>
            {connected && !liveErr && (
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
              📡 No active Wi-Fi connection detected. Connect to the router/hotspot you are testing.
            </div>
          )}

          {connected && (
            <div className="four-col">
              <div className="stat-pill">
                <div className="stat-value" title={liveWifi.ssid} style={{ color: 'var(--green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {liveWifi.ssid}
                </div>
                <div className="stat-label">Network SSID</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: signalColor(liveWifi.rssi) }}>{liveWifi.rssi}</div>
                <div className="stat-label">RSSI (dBm)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: signalColor(liveWifi.rssi) }}>{liveWifi.signal_pct}%</div>
                <div className="stat-label">Signal Strength</div>
              </div>
              <div className="stat-pill">
                <div style={{ marginBottom: '8px', marginTop: '4px' }}>
                  <span className={`badge ${qual.cls}`} style={{ fontSize: '14px', padding: '5px 14px' }}>{qual.text}</span>
                </div>
                <div className="stat-label">Quality · Ch {liveWifi.channel}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── CAPTURE PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
            📍 Capture Measurement
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 160px' }}>
              <label className="input-label">Distance from router (m)</label>
              <input type="number" min="0.1" step="0.5" className="input-field"
                placeholder="e.g. 3" value={distance}
                onChange={e => setDistance(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCapture()} />
            </div>
            <div className="input-group" style={{ flex: '1 1 140px' }}>
              <label className="input-label"># Obstacles (walls)</label>
              <input type="number" min="0" step="1" className="input-field"
                placeholder="0" value={obstacleCount}
                onChange={e => setObstacleCount(e.target.value)} />
            </div>
            <div className="input-group" style={{ flex: '2 1 200px' }}>
              <label className="input-label">Obstacle note (optional)</label>
              <input type="text" className="input-field"
                placeholder="e.g. Line of sight, 1 brick wall, door closed"
                value={obstacleDesc}
                onChange={e => setObstacleDesc(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleCapture}
              disabled={recording || !distance || !connected} style={{ height: '46px' }}>
              {recording ? <><div className="spinner" style={{ borderTopColor: '#050a18' }} /> Capturing…</> : '📍 Capture'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
            Stand at the stated distance (add walls/obstacles between the devices to test attenuation),
            then click Capture — the live RSSI is read straight from your Wi-Fi adapter. Take readings
            at several distances (e.g. 1, 3, 6, 10 m) to fit the path-loss exponent.
          </div>
        </div>

        {/* ── ANALYSIS SUMMARY ── */}
        <div className="four-col" style={{ marginBottom: '24px' }}>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: nColor(analysis?.path_loss_exponent) }}>
              {analysis?.path_loss_exponent ?? '—'}
            </div>
            <div className="stat-label">Path-Loss Exponent (n)</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--cyan)' }}>
              {analysis?.rssi_at_1m != null ? `${analysis.rssi_at_1m}` : '—'}
            </div>
            <div className="stat-label">RSSI @ 1 m (dBm)</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--green)' }}>
              {analysis?.r_squared != null ? analysis.r_squared : '—'}
            </div>
            <div className="stat-label">Fit Quality (R²)</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--amber)' }}>
              {analysis?.per_obstacle_db != null ? `${analysis.per_obstacle_db} dB` : '—'}
            </div>
            <div className="stat-label">Loss per Obstacle</div>
          </div>
        </div>

        {analysis?.interpretation && (
          <div className="alert alert-info" style={{ marginBottom: '24px' }}>
            🧭 <strong>Environment (n = {analysis.path_loss_exponent}):</strong> {analysis.interpretation}
          </div>
        )}

        {/* ── RSSI vs DISTANCE CHART ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>📉 RSSI vs Distance (Log-Distance Path-Loss Fit)</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Measured points vs the fitted model and the free-space (n = 2) reference.
              </div>
            </div>
            {measurements.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleClear} disabled={loading}>🗑 Clear All</button>
            )}
          </div>

          {measuredPts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-text">No measurements yet. Capture readings at a few distances above.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart margin={{ top: 10, right: 30, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <XAxis type="number" dataKey="distance_m" name="Distance"
                  domain={[0, 'dataMax']} allowDecimals
                  label={{ value: 'Distance (m)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <YAxis type="number" domain={[-100, -30]}
                  label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <Tooltip
                  contentStyle={{ background: 'rgba(8,13,32,0.95)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontSize: '13px' }}
                  formatter={(v, name) => [`${v} dBm`, name]}
                  labelFormatter={(l) => `Distance: ${l} m`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line data={fitPts} dataKey="rssi_freespace" name="Free space (n=2)"
                  stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                <Line data={fitPts} dataKey="rssi_fit" name={`Fitted model (n=${analysis?.path_loss_exponent ?? '?'})`}
                  stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Scatter data={measuredPts} dataKey="rssi_dbm" name="Measured" fill="#00d4ff">
                  {measuredPts.map((p, i) => (
                    <Cell key={i} fill={signalColor(p.rssi_dbm)} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── OBSTACLE ATTENUATION CHART ── */}
        {obstacleRows.length > 0 && (
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>🧱 Attenuation vs Obstacles</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Extra signal loss (dB) relative to the fewest-obstacle reading, grouped by obstacle count.
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={obstacleRows} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <XAxis dataKey="obstacle_count"
                  label={{ value: '# Obstacles', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <YAxis label={{ value: 'Attenuation (dB)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                  tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155" />
                <Tooltip
                  contentStyle={{ background: 'rgba(8,13,32,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', fontSize: '13px' }}
                  formatter={(v, n, p) => [`${v} dB  (avg ${p.payload.avg_rssi} dBm, ${p.payload.samples} sample${p.payload.samples > 1 ? 's' : ''})`, 'Attenuation']}
                  labelFormatter={(l) => `${l} obstacle(s)`} />
                <Bar dataKey="attenuation_db" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── DATA TABLE ── */}
        {measurements.length > 0 && (
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>📋 Observation Table</div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Distance (m)</th>
                    <th>Obstacles</th>
                    <th>Note</th>
                    <th>RSSI (dBm)</th>
                    <th>Signal %</th>
                    <th>Quality</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, i) => {
                    const q = signalLabel(m.rssi_dbm)
                    return (
                      <tr key={m.id}>
                        <td>{i + 1}</td>
                        <td><strong>{m.distance_m}</strong></td>
                        <td>{m.obstacle_count}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{m.obstacle_desc || '—'}</td>
                        <td style={{ color: signalColor(m.rssi_dbm) }}><strong>{m.rssi_dbm}</strong></td>
                        <td>{m.signal_pct}%</td>
                        <td><span className={`badge ${q.cls}`}>{q.text}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divider" />
            <div className="alert alert-info">
              💡 <strong>Observation:</strong> RSSI falls as distance and obstacles increase.
              {analysis?.path_loss_exponent != null
                ? ` The fitted path-loss exponent n = ${analysis.path_loss_exponent} (R² = ${analysis.r_squared}) — ${analysis.interpretation}`
                : ' Capture readings at two or more different distances to compute the path-loss exponent.'}
              {analysis?.per_obstacle_db != null && ` Each added obstacle costs about ${analysis.per_obstacle_db} dB.`}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
