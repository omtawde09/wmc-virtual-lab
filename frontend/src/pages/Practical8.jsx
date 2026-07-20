import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart
} from 'recharts'

const API = '/api/bluetooth'
const CONN_API = '/api/bluetooth/conn'
const ANALYSIS_API = '/api/bluetooth/analysis'

/* ── Helpers (same thresholds as Practical4's Wi-Fi page, since RSSI in
   dBm means the same thing regardless of radio - only the raw range
   differs slightly between Wi-Fi and BLE hardware) ── */
function signalColor(rssi) {
  if (rssi == null) return '#94a3b8'
  if (rssi >= -55) return '#10b981'   // excellent
  if (rssi >= -70) return '#00d4ff'   // good
  if (rssi >= -85) return '#f59e0b'   // fair
  return '#ef4444'                     // poor
}

function signalLabel(rssi) {
  if (rssi == null) return { text: 'Unknown', cls: 'badge-red' }
  if (rssi >= -55) return { text: 'Excellent', cls: 'badge-green' }
  if (rssi >= -70) return { text: 'Good', cls: 'badge-cyan' }
  if (rssi >= -85) return { text: 'Fair', cls: 'badge-amber' }
  return { text: 'Poor', cls: 'badge-red' }
}

function pct(rssi) {
  if (rssi == null) return 0
  // map [-100, -30] -> [0, 100], same convention as Practical4
  return Math.max(0, Math.min(100, Math.round(((rssi + 100) / 70) * 100)))
}

/* ── Custom Tooltip for the range-test chart ── */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: 'rgba(8,13,32,0.95)', border: '1px solid rgba(0,212,255,0.3)',
      borderRadius: '10px', padding: '12px 16px', fontSize: '13px'
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>
        Distance: <strong style={{ color: '#f1f5f9' }}>{d.distance} m</strong>
      </div>
      <div style={{ color: '#94a3b8' }}>
        RSSI: <strong style={{ color: signalColor(d.rssi) }}>{d.rssi} dBm</strong>
      </div>
    </div>
  )
}

export default function Practical8() {
  /* ── Discovery state ── */
  const [devices, setDevices] = useState({})       // keyed by address, latest advertisement
  const [scanning, setScanning] = useState(false)
  const [liveErr, setLiveErr] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')

  /* ── Range test state ── */
  const [readings, setReadings] = useState([])
  const [distance, setDistance] = useState('')
  const [obstacleCount, setObstacleCount] = useState('0')
  const [obstacleDesc, setObstacleDesc] = useState('')
  const [recording, setRecording] = useState(false)
  const [lastAdded, setLastAdded] = useState(null)
  const [fit, setFit] = useState(null)
  const [fitErr, setFitErr] = useState(null)
  const [obstacleAnalysis, setObstacleAnalysis] = useState(null)

  /* ── Connection/pairing state ── */
  const [connStatus, setConnStatus] = useState({ connected: false, address: null })
  const [connecting, setConnecting] = useState(false)
  const [connErr, setConnErr] = useState(null)
  const [pairedDevices, setPairedDevices] = useState([])

  const wsRef = useRef(null)

  /* ── Live BLE advertisement stream ── */
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}${API}/ws`)
    wsRef.current = ws

    ws.onopen = () => { setScanning(true); setLiveErr(false) }
    ws.onerror = () => setLiveErr(true)
    ws.onclose = () => setScanning(false)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.error) { setLiveErr(true); return }
      setDevices(prev => ({ ...prev, [data.address]: data }))
    }

    return () => ws.close()
  }, [])

  /* ── Fetch stored range readings ── */
  const fetchReadings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/readings`)
      setReadings(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchReadings() }, [fetchReadings])

  /* ── Fetch path-loss fit whenever readings change ── */
  const fetchFit = useCallback(async () => {
    try {
      const res = await axios.get(`${ANALYSIS_API}/fit`)
      setFit(res.data)
      setFitErr(null)
    } catch (err) {
      setFit(null)
      setFitErr(err.response?.data?.detail || 'Not enough readings yet.')
    }
  }, [])

  useEffect(() => { if (readings.length >= 2) fetchFit() }, [readings, fetchFit])

  /* ── Fetch obstacle attenuation analysis whenever readings change ── */
  const fetchObstacleAnalysis = useCallback(async () => {
    try {
      const res = await axios.get(`${ANALYSIS_API}/obstacles`)
      setObstacleAnalysis(res.data)
    } catch {
      setObstacleAnalysis(null)
    }
  }, [])

  useEffect(() => { if (readings.length >= 1) fetchObstacleAnalysis() }, [readings, fetchObstacleAnalysis])

  /* ── Fetch connection status periodically (cheap poll, not a stream -
     connection state changes rarely compared to advertisement events) ── */
  const fetchConnStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${CONN_API}/status`)
      setConnStatus(res.data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchConnStatus()
    const id = setInterval(fetchConnStatus, 4000)
    return () => clearInterval(id)
  }, [fetchConnStatus])

  /* ── Actions ── */
  async function handleAddReading() {
    const dist = parseFloat(distance)
    const oc = parseInt(obstacleCount, 10) || 0
    if (!selectedAddress) { setFitErr('Select a device from the list first.'); return }
    if (!dist || dist <= 0) return
    setRecording(true)
    try {
      const res = await axios.post(`${API}/reading`, {
        address: selectedAddress,
        distance: dist,
        obstacle_count: oc,
        obstacle_desc: obstacleDesc.trim(),
      })
      setLastAdded(res.data)
      setDistance('')
      await fetchReadings()
    } catch (err) {
      setFitErr(err.response?.data?.detail || 'Could not log reading - device not seen advertising.')
    }
    setRecording(false)
  }

  async function handleClear() {
    if (!window.confirm('Clear all Bluetooth range readings?')) return
    try { await axios.delete(`${API}/clear`); await fetchReadings() } catch {}
  }

  async function handleConnect(pair) {
    if (!selectedAddress) return
    setConnecting(true)
    setConnErr(null)
    try {
      const res = await axios.post(`${CONN_API}/connect`, {
        address: selectedAddress, pair, timeout: 15,
      })
      setConnStatus(res.data)
    } catch (err) {
      setConnErr(err.response?.data?.detail || 'Connection failed.')
    }
    setConnecting(false)
  }

  async function handleDisconnect() {
    try {
      await axios.post(`${CONN_API}/disconnect`)
      await fetchConnStatus()
    } catch {}
  }

  async function fetchPairedDevices() {
    try {
      const res = await axios.get(`${CONN_API}/paired-devices`)
      setPairedDevices(res.data)
    } catch (err) {
      setConnErr(err.response?.data?.detail || 'Could not read Windows paired-device list.')
    }
  }

  /* ── Derived data ── */
  const deviceList = Object.values(devices).sort(
    (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)
  )
  const chartData = [...readings].sort((a, b) => a.distance - b.distance)
  const selected = selectedAddress ? devices[selectedAddress] : null
  const qual = selected ? signalLabel(selected.rssi) : null

  // Build the fitted curve as a line overlay across the observed distance range
  const fittedCurve = fit && chartData.length
    ? Array.from({ length: 30 }, (_, i) => {
        const maxD = Math.max(...chartData.map(r => r.distance))
        const d = 0.3 + (i / 29) * (maxD - 0.3)
        const predicted = fit.rssi_at_1m - 10 * fit.path_loss_exponent * Math.log10(d)
        return { distance: +d.toFixed(2), fitted_rssi: +predicted.toFixed(1) }
      })
    : []

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">🔵 Practical 8 · MDL501.3</div>
          <h1 className="section-title">Bluetooth Discovery, Pairing &amp; Range Testing</h1>
          <p className="section-desc">
            Scan nearby BLE devices, study pairing/connection behaviour, and analyze
            signal-strength-vs-distance using the log-distance path loss model.
          </p>
        </div>

        {/* ── LIVE DISCOVERY PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: scanning ? 'rgba(0,212,255,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Live BLE Advertisement Scan</span>
            {scanning && !liveErr && (
              <span className="badge badge-green" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Scanning &middot; {deviceList.length} device{deviceList.length !== 1 ? 's' : ''} seen
              </span>
            )}
          </div>

          {liveErr && (
            <div className="alert alert-warning">
              ⚠️ Could not connect to the Bluetooth scan stream. Make sure the FastAPI
              server is running and Bluetooth is turned on in Windows Settings.
            </div>
          )}

          {!liveErr && deviceList.length === 0 && (
            <div className="alert alert-warning">
              📡 No BLE advertisements seen yet. Some devices advertise infrequently -
              wait a few seconds, or check that nearby devices have Bluetooth enabled.
            </div>
          )}

          {deviceList.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Address</th>
                    <th>Name</th>
                    <th>RSSI</th>
                    <th>Signal</th>
                    <th>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceList.map(d => {
                    const q = signalLabel(d.rssi)
                    return (
                      <tr
                        key={d.address}
                        onClick={() => setSelectedAddress(d.address)}
                        style={{
                          cursor: 'pointer',
                          background: selectedAddress === d.address ? 'rgba(0,212,255,0.08)' : 'transparent',
                        }}
                      >
                        <td>
                          <input
                            type="radio"
                            checked={selectedAddress === d.address}
                            onChange={() => setSelectedAddress(d.address)}
                          />
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.address}</td>
                        <td>{d.name || <span style={{ color: 'var(--muted)' }}>(no name)</span>}</td>
                        <td style={{ color: signalColor(d.rssi), fontFamily: 'var(--font-mono)' }}>{d.rssi ?? '—'}</td>
                        <td>{pct(d.rssi)}%</td>
                        <td><span className={`badge ${q.cls}`}>{q.text}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CONNECTION & PAIRING PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px' }}>Connection &amp; Pairing</h3>
          <p className="section-desc" style={{ marginBottom: '16px', fontSize: '13px' }}>
            Select a device above, then attempt a direct BLE connection. Note: most
            phones only operate as BLE <em>scanners</em>, not connectable peripherals -
            a connect attempt against a phone address will time out, which is expected
            behaviour, not a bug. Dedicated BLE peripherals (fitness bands, smart tags,
            sensors) will accept connections. Phone pairing itself is done through
            Windows Settings → Bluetooth &amp; devices; use "Refresh Windows Paired List"
            below to confirm it happened.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button
              className="btn btn-primary"
              disabled={!selectedAddress || connecting || connStatus.connected}
              onClick={() => handleConnect(false)}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedAddress || connecting || connStatus.connected}
              onClick={() => handleConnect(true)}
            >
              Connect &amp; Pair
            </button>
            <button
              className="btn btn-outline"
              disabled={!connStatus.connected}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
            <button className="btn btn-outline" onClick={fetchPairedDevices}>
              Refresh Windows Paired List
            </button>
          </div>

          {connErr && <div className="alert alert-warning" style={{ marginBottom: '16px' }}>⚠️ {connErr}</div>}

          <div className="four-col" style={{ marginBottom: '16px' }}>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: connStatus.connected ? 'var(--green)' : 'var(--muted)' }}>
                {connStatus.connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="stat-label">Connection State</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {connStatus.address || '—'}
              </div>
              <div className="stat-label">Active Address</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value">{connStatus.services_count ?? '—'}</div>
              <div className="stat-label">GATT Services</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value">
                {connStatus.paired === true ? 'Yes' : connStatus.paired === false ? 'No' : '—'}
              </div>
              <div className="stat-label">Paired (this session)</div>
            </div>
          </div>

          {pairedDevices.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  {pairedDevices.map((p, i) => (
                    <tr key={i}><td>{p.name}</td><td>{p.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RANGE TEST LOGGING PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Log a Range-Test Reading</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Selected device: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedAddress || 'none - pick one above'}</strong>
              {selected && <> &nbsp;({selected.rssi} dBm)</>}
            </span>
          </div>
          <p className="section-desc" style={{ marginBottom: '12px', fontSize: '13px' }}>
            To isolate obstacle effect from distance effect, keep distance roughly
            constant while varying obstacle_count across readings (e.g. same 3m
            spot, but 0 walls vs 1 wall vs 2 walls in the path).
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Distance (m)"
              value={distance}
              onChange={e => setDistance(e.target.value)}
              className="input-field"
              style={{ maxWidth: '160px' }}
            />
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Obstacle count"
              value={obstacleCount}
              onChange={e => setObstacleCount(e.target.value)}
              className="input-field"
              style={{ maxWidth: '160px' }}
            />
            <input
              type="text"
              placeholder="Obstacle description (e.g. 1 drywall wall)"
              value={obstacleDesc}
              onChange={e => setObstacleDesc(e.target.value)}
              className="input-field"
              style={{ maxWidth: '260px' }}
            />
            <button className="btn btn-primary" disabled={recording || !selectedAddress} onClick={handleAddReading}>
              {recording ? 'Logging…' : 'Log Reading'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleClear}>Clear All</button>
          </div>
          {lastAdded && (
            <div className="alert alert-success" style={{ marginTop: '12px' }}>
              ✅ Logged {lastAdded.distance} m, {lastAdded.obstacle_count} obstacle(s) → {lastAdded.rssi} dBm for {lastAdded.address}
            </div>
          )}
        </div>

        {/* ── OBSTACLE ATTENUATION ANALYSIS ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>RSSI vs Obstacles — Indoor Path Loss</h3>

          {!obstacleAnalysis && (
            <div className="alert alert-warning">
              🧱 Log readings with different obstacle_count values (e.g. 0 and 1)
              to see per-obstacle attenuation here.
            </div>
          )}

          {obstacleAnalysis && (
            <>
              <div className="data-table-wrap" style={{ marginBottom: '16px' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Obstacles</th><th>Avg RSSI</th><th>Attenuation (dB)</th><th>Samples</th></tr>
                  </thead>
                  <tbody>
                    {obstacleAnalysis.groups.map(g => (
                      <tr key={g.obstacle_count}>
                        <td>{g.obstacle_count}</td>
                        <td style={{ color: signalColor(g.avg_rssi), fontFamily: 'var(--font-mono)' }}>{g.avg_rssi} dBm</td>
                        <td>{g.attenuation_db > 0 ? `-${g.attenuation_db}` : g.attenuation_db} dB</td>
                        <td>{g.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="four-col" style={{ marginBottom: '12px' }}>
                <div className="stat-pill">
                  <div className="stat-value">
                    {obstacleAnalysis.per_obstacle_db != null ? `${obstacleAnalysis.per_obstacle_db} dB` : '—'}
                  </div>
                  <div className="stat-label">Loss per Obstacle</div>
                </div>
              </div>

              {obstacleAnalysis.interpretation && (
                <div className="alert alert-warning" style={{ background: 'rgba(0,212,255,0.06)', borderColor: 'rgba(0,212,255,0.2)' }}>
                  💡 {obstacleAnalysis.interpretation}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── PATH LOSS CHART & FIT ── */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '16px' }}>Distance vs RSSI — Path Loss Model Fit</h3>

          {fitErr && chartData.length < 2 && (
            <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
              📊 {fitErr}
            </div>
          )}

          {chartData.length > 0 && (
            <div style={{ width: '100%', height: 340, marginBottom: '20px' }}>
              <ResponsiveContainer>
                <ComposedChart data={[...chartData, ...fittedCurve]}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="distance" type="number" stroke="#94a3b8" label={{ value: 'Distance (m)', position: 'insideBottom', dy: 10, fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" domain={['dataMin - 5', 'dataMax + 5']} label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter dataKey="rssi" fill="#00d4ff" />
                  {fit && <Line type="monotone" dataKey="fitted_rssi" stroke="#a78bfa" dot={false} strokeWidth={2} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {fit && (
            <div className="four-col">
              <div className="stat-pill">
                <div className="stat-value">{fit.rssi_at_1m}</div>
                <div className="stat-label">RSSI @ 1m (dBm)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value">{fit.path_loss_exponent}</div>
                <div className="stat-label">Path Loss Exponent (n)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value">{fit.r_squared}</div>
                <div className="stat-label">R² (fit quality)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value">{fit.sample_count}</div>
                <div className="stat-label">Samples Used</div>
              </div>
            </div>
          )}
          {fit?.interpretation && (
            <div className="alert alert-warning" style={{ marginTop: '16px', background: 'rgba(0,212,255,0.06)', borderColor: 'rgba(0,212,255,0.2)' }}>
              💡 {fit.interpretation}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}