import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { resetAllOnce } from '../resetOnLoad'

const BT_API = '/api/bluetooth'          // shared BLE discovery
const API = '/api/pathloss'              // Exp 7's own obstacle store + analysis

const DEVICE_TTL_MS = 10000

function signalColor(rssi) {
  if (rssi == null) return '#94a3b8'
  if (rssi >= -55) return '#059669'
  if (rssi >= -70) return '#2563eb'
  if (rssi >= -85) return '#d97706'
  return '#ef4444'
}
function signalLabel(rssi) {
  if (rssi == null) return { text: 'Unknown', cls: 'badge-red' }
  if (rssi >= -55) return { text: 'Excellent', cls: 'badge-green' }
  if (rssi >= -70) return { text: 'Good', cls: 'badge-cyan' }
  if (rssi >= -85) return { text: 'Fair', cls: 'badge-amber' }
  return { text: 'Poor', cls: 'badge-red' }
}

export default function Practical7() {
  /* ── Discovery ── */
  const [devices, setDevices] = useState({})
  const [scanning, setScanning] = useState(false)
  const [liveErr, setLiveErr] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')

  /* ── Obstacle logging ── */
  const [readings, setReadings] = useState([])
  const [distance, setDistance] = useState('3')
  const [obstacleCount, setObstacleCount] = useState('0')
  const [obstacleDesc, setObstacleDesc] = useState('')
  const [recording, setRecording] = useState(false)
  const [lastAdded, setLastAdded] = useState(null)
  const [logErr, setLogErr] = useState(null)

  /* ── Analysis ── */
  const [analysis, setAnalysis] = useState(null)
  const [fit, setFit] = useState(null)

  const wsRef = useRef(null)

  /* ── Live BLE discovery (shared stream) ── */
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}${BT_API}/ws`)
    wsRef.current = ws
    ws.onopen = () => { setScanning(true); setLiveErr(false) }
    ws.onerror = () => setLiveErr(true)
    ws.onclose = () => setScanning(false)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.error) { setLiveErr(true); return }
      setDevices(prev => {
        const existing = prev[data.address]
        const merged = existing ? { ...existing, ...data, name: data.name || existing.name } : data
        return { ...prev, [data.address]: { ...merged, _seenAt: Date.now() } }
      })
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - DEVICE_TTL_MS
      setDevices(prev => {
        let changed = false
        const next = {}
        for (const [addr, dev] of Object.entries(prev)) {
          if ((dev._seenAt ?? 0) >= cutoff) next[addr] = dev
          else changed = true
        }
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const fetchReadings = useCallback(async () => {
    try { setReadings((await axios.get(`${API}/readings`)).data) } catch {}
  }, [])

  useEffect(() => { resetAllOnce().then(fetchReadings) }, [fetchReadings])

  const fetchAnalysis = useCallback(async () => {
    try { setAnalysis((await axios.get(`${API}/obstacles`)).data) } catch { setAnalysis(null) }
    try { setFit((await axios.get(`${API}/fit`)).data) } catch { setFit(null) }
  }, [])

  useEffect(() => { if (readings.length >= 1) fetchAnalysis(); else { setAnalysis(null); setFit(null) } }, [readings, fetchAnalysis])

  /* ── Actions ── */
  async function handleAddReading() {
    const dist = parseFloat(distance)
    const oc = parseInt(obstacleCount, 10) || 0
    if (!selectedAddress) { setLogErr('Select a device from the list first.'); return }
    if (!dist || dist <= 0) { setLogErr('Enter a distance in metres.'); return }
    setRecording(true); setLogErr(null)
    try {
      const res = await axios.post(`${API}/reading`, { address: selectedAddress, distance: dist, obstacle_count: oc, obstacle_desc: obstacleDesc.trim() })
      setLastAdded(res.data)
      await fetchReadings()
    } catch (err) {
      setLogErr(err.response?.data?.detail || 'Could not log reading — device not seen advertising.')
    }
    setRecording(false)
  }

  async function handleClear() {
    if (!window.confirm('Clear all path-loss readings?')) return
    try { await axios.delete(`${API}/clear`); await fetchReadings() } catch {}
  }

  /* ── Derived ── */
  const deviceList = Object.values(devices).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
  const selected = selectedAddress ? devices[selectedAddress] : null
  const groups = analysis?.groups || []

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">🧱 Practical 7 · MDL501.5</div>
          <h1 className="section-title">Path Loss in an Indoor Environment (RSSI vs Obstacles)</h1>
          <p className="section-desc">
            Keep the Bluetooth device at a roughly fixed distance and log its RSSI as you add
            obstacles (walls, doors, a body) between it and the laptop. Measure how many dB each
            obstacle costs and how obstruction raises the path-loss exponent.
          </p>
        </div>

        {/* ── DEVICE PICKER ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: scanning ? 'rgba(37,99,235,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Pick a BLE Device to Test</span>
            {scanning && !liveErr && (
              <span className="badge badge-green" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Scanning · {deviceList.length} seen
              </span>
            )}
          </div>

          {liveErr && <div className="alert alert-warning">⚠️ Could not connect to the Bluetooth scan stream. Ensure the backend is running and Bluetooth is on.</div>}
          {!liveErr && deviceList.length === 0 && <div className="alert alert-warning">📡 No BLE advertisements seen yet — wait a few seconds.</div>}

          {deviceList.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th></th><th>Address</th><th>Name</th><th>RSSI</th><th>Quality</th></tr></thead>
                <tbody>
                  {deviceList.map(d => {
                    const q = signalLabel(d.rssi)
                    return (
                      <tr key={d.address} onClick={() => setSelectedAddress(d.address)}
                        style={{ cursor: 'pointer', background: selectedAddress === d.address ? 'rgba(37,99,235,0.08)' : 'transparent' }}>
                        <td><input type="radio" checked={selectedAddress === d.address} onChange={() => setSelectedAddress(d.address)} /></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.address}</td>
                        <td>{d.name || <span style={{ color: 'var(--text-muted)' }}>(no name)</span>}</td>
                        <td style={{ color: signalColor(d.rssi), fontFamily: 'var(--font-mono)' }}>{d.rssi ?? '—'}</td>
                        <td><span className={`badge ${q.cls}`}>{q.text}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── OBSTACLE LOGGING ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--cyan)' }}>🧱 Log Reading at an Obstacle Level</div>
          <p className="section-desc" style={{ marginBottom: '14px', fontSize: '13px' }}>
            Keep <strong>distance roughly constant</strong> and vary the obstacle count (e.g. same 3 m spot: 0 walls, then 1 wall, then 2 walls) so the attenuation reflects obstacles, not distance.
          </p>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Selected device: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedAddress || 'none — pick one above'}</strong>
            {selected && <> &nbsp;({selected.rssi} dBm)</>}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 130px' }}>
              <label className="input-label">Distance (m)</label>
              <input type="number" step="0.1" min="0.1" placeholder="3" value={distance} onChange={e => setDistance(e.target.value)} className="input-field" />
            </div>
            <div className="input-group" style={{ flex: '1 1 130px' }}>
              <label className="input-label"># Obstacles</label>
              <input type="number" step="1" min="0" placeholder="0" value={obstacleCount} onChange={e => setObstacleCount(e.target.value)} className="input-field" />
            </div>
            <div className="input-group" style={{ flex: '2 1 200px' }}>
              <label className="input-label">Obstacle note (optional)</label>
              <input type="text" placeholder="e.g. 1 drywall partition, human body" value={obstacleDesc} onChange={e => setObstacleDesc(e.target.value)} className="input-field" />
            </div>
            <button className="btn btn-primary" disabled={recording || !selectedAddress} onClick={handleAddReading} style={{ height: '46px' }}>
              {recording ? 'Logging…' : '🧱 Log Reading'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleClear} style={{ height: '46px' }}>🗑 Clear</button>
          </div>
          {logErr && <div className="alert alert-warning" style={{ marginTop: '12px' }}>⚠️ {logErr}</div>}
          {lastAdded && (
            <div className="alert alert-success" style={{ marginTop: '12px' }}>
              ✅ Logged {lastAdded.distance} m, {lastAdded.obstacle_count} obstacle(s) → {lastAdded.rssi} dBm
            </div>
          )}
        </div>

        {/* ── ANALYSIS SUMMARY ── */}
        <div className="four-col" style={{ marginBottom: '24px' }}>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{analysis?.per_obstacle_db != null ? `${analysis.per_obstacle_db} dB` : '—'}</div>
            <div className="stat-label">Loss per Obstacle</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--violet)' }}>{fit?.path_loss_exponent ?? '—'}</div>
            <div className="stat-label">Path-Loss Exponent (n)</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--cyan)' }}>{fit?.rssi_at_1m ?? '—'}</div>
            <div className="stat-label">RSSI @ 1m (dBm)</div>
          </div>
          <div className="stat-pill">
            <div className="stat-value" style={{ color: 'var(--green)' }}>{groups.length || '—'}</div>
            <div className="stat-label">Obstacle Levels</div>
          </div>
        </div>

        {analysis?.interpretation && (
          <div className="alert alert-info" style={{ marginBottom: '24px' }}>💡 {analysis.interpretation}</div>
        )}

        {/* ── OBSTACLE ATTENUATION CHART ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>📊 Attenuation vs Obstacles</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
            Extra loss (dB) relative to the fewest-obstacle reading, grouped by obstacle count.
          </div>
          {groups.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🧱</div>
              <div className="empty-state-text">Log readings at 2+ obstacle counts (e.g. 0 and 1) to see per-obstacle attenuation.</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={groups} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                <XAxis dataKey="obstacle_count" stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }}
                  label={{ value: '# Obstacles', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }}
                  label={{ value: 'Attenuation (dB)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: '10px', fontSize: '13px' }}
                  formatter={(v, n, p) => [`${v} dB  (avg ${p.payload.avg_rssi} dBm, ${p.payload.samples} sample${p.payload.samples > 1 ? 's' : ''})`, 'Attenuation']}
                  labelFormatter={(l) => `${l} obstacle(s)`} />
                <Bar dataKey="attenuation_db" radius={[6, 6, 0, 0]}>
                  {groups.map((g, i) => <Cell key={i} fill="#d97706" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── OBSERVATION TABLE ── */}
        {groups.length > 0 && (
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>📋 Obstacle Attenuation Table</div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th># Obstacles</th><th>Avg RSSI (dBm)</th><th>Attenuation (dB)</th><th>Samples</th></tr></thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.obstacle_count}>
                      <td>{g.obstacle_count}</td>
                      <td style={{ color: signalColor(g.avg_rssi), fontFamily: 'var(--font-mono)' }}>{g.avg_rssi}</td>
                      <td><strong>{g.attenuation_db > 0 ? `−${g.attenuation_db}` : g.attenuation_db}</strong></td>
                      <td>{g.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divider" />
            <div className="alert alert-info">
              💡 <strong>Observation:</strong> RSSI drops as obstacles are added between the devices.
              {analysis?.per_obstacle_db != null && ` Each obstacle costs about ${analysis.per_obstacle_db} dB`}
              {fit?.path_loss_exponent != null && `, and the fitted path-loss exponent is n = ${fit.path_loss_exponent}`}.
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
