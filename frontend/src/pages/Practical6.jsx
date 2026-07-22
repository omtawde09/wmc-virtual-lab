import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart
} from 'recharts'
import { resetAllOnce } from '../resetOnLoad'

const API = '/api/bluetooth'
const CONN_API = '/api/bluetooth/conn'
const ANALYSIS_API = '/api/bluetooth/analysis'

// A BLE scan never emits a "device left" event — infer departure from the
// absence of advertisement packets within this window.
const DEVICE_TTL_MS = 10000

/* ── Helpers (BLE RSSI ranges run a little lower than Wi-Fi) ── */
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

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px' }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Distance: <strong style={{ color: 'var(--text-primary)' }}>{d.distance} m</strong></div>
      <div style={{ color: 'var(--text-secondary)' }}>RSSI: <strong style={{ color: signalColor(d.rssi) }}>{d.rssi} dBm</strong></div>
    </div>
  )
}

export default function Practical6() {
  /* ── Discovery ── */
  const [devices, setDevices] = useState({})
  const [scanning, setScanning] = useState(false)
  const [liveErr, setLiveErr] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')

  /* ── Range test ── */
  const [readings, setReadings] = useState([])
  const [distance, setDistance] = useState('')
  const [recording, setRecording] = useState(false)
  const [lastAdded, setLastAdded] = useState(null)
  const [fit, setFit] = useState(null)
  const [fitErr, setFitErr] = useState(null)

  /* ── Connection / pairing ── */
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
      setDevices(prev => {
        const existing = prev[data.address]
        const merged = existing ? { ...existing, ...data, name: data.name || existing.name } : data
        return { ...prev, [data.address]: { ...merged, _seenAt: Date.now() } }
      })
    }
    return () => ws.close()
  }, [])

  /* ── Expire stale devices ── */
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

  const fetchFit = useCallback(async () => {
    try { setFit((await axios.get(`${ANALYSIS_API}/fit`)).data); setFitErr(null) }
    catch (err) { setFit(null); setFitErr(err.response?.data?.detail || 'Not enough readings yet.') }
  }, [])

  useEffect(() => { if (readings.length >= 2) fetchFit(); else setFit(null) }, [readings, fetchFit])

  const fetchConnStatus = useCallback(async () => {
    try { setConnStatus((await axios.get(`${CONN_API}/status`)).data) } catch {}
  }, [])

  useEffect(() => {
    fetchConnStatus()
    const id = setInterval(fetchConnStatus, 4000)
    return () => clearInterval(id)
  }, [fetchConnStatus])

  /* ── Actions ── */
  async function handleAddReading() {
    const dist = parseFloat(distance)
    if (!selectedAddress) { setFitErr('Select a device from the list first.'); return }
    if (!dist || dist <= 0) return
    setRecording(true)
    try {
      const res = await axios.post(`${API}/reading`, { address: selectedAddress, distance: dist, obstacle_count: 0, obstacle_desc: '' })
      setLastAdded(res.data)
      setDistance('')
      await fetchReadings()
    } catch (err) {
      setFitErr(err.response?.data?.detail || 'Could not log reading — device not seen advertising.')
    }
    setRecording(false)
  }

  async function handleClear() {
    if (!window.confirm('Clear all Bluetooth range readings?')) return
    try { await axios.delete(`${API}/clear`); await fetchReadings() } catch {}
  }

  async function handleConnect(pair) {
    if (!selectedAddress) return
    setConnecting(true); setConnErr(null)
    try {
      const res = await axios.post(`${CONN_API}/connect`, { address: selectedAddress, pair, timeout: 15 })
      setConnStatus(res.data)
    } catch (err) { setConnErr(err.response?.data?.detail || 'Connection failed.') }
    setConnecting(false)
  }

  async function handleDisconnect() {
    try { await axios.post(`${CONN_API}/disconnect`); await fetchConnStatus() } catch {}
  }

  async function fetchPairedDevices() {
    try { setPairedDevices((await axios.get(`${CONN_API}/paired-devices`)).data) }
    catch (err) { setConnErr(err.response?.data?.detail || 'Could not read Windows paired-device list.') }
  }

  /* ── Derived ── */
  const deviceList = Object.values(devices).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
  const chartData = [...readings].sort((a, b) => a.distance - b.distance)
  const selected = selectedAddress ? devices[selectedAddress] : null

  const fittedCurve = fit && chartData.length
    ? Array.from({ length: 30 }, (_, i) => {
        const maxD = Math.max(...chartData.map(r => r.distance))
        const d = 0.3 + (i / 29) * (maxD - 0.3)
        return { distance: +d.toFixed(2), fitted_rssi: +(fit.rssi_at_1m - 10 * fit.path_loss_exponent * Math.log10(d)).toFixed(1) }
      })
    : []

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">🔵 Practical 6 · MDL501.4</div>
          <h1 className="section-title">Bluetooth Communication — Pairing &amp; Range Testing</h1>
          <p className="section-desc">
            Scan nearby BLE devices, study pairing/connection behaviour, and analyze how the
            Bluetooth signal falls with distance using the log-distance path-loss model.
          </p>
        </div>

        {/* ── LIVE DISCOVERY ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: scanning ? 'rgba(37,99,235,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Live BLE Advertisement Scan</span>
            {scanning && !liveErr && (
              <span className="badge badge-green" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Scanning · {deviceList.length} device{deviceList.length !== 1 ? 's' : ''} seen
              </span>
            )}
          </div>

          {liveErr && (
            <div className="alert alert-warning">
              ⚠️ Could not connect to the Bluetooth scan stream. Make sure the backend is running and Bluetooth is turned on in Windows Settings.
            </div>
          )}
          {!liveErr && deviceList.length === 0 && (
            <div className="alert alert-warning">
              📡 No BLE advertisements seen yet. Some devices advertise infrequently — wait a few seconds, or check that nearby devices have Bluetooth enabled.
            </div>
          )}

          {deviceList.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th></th><th>Address</th><th>Name</th><th>RSSI</th><th>Quality</th></tr>
                </thead>
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
              <p className="section-desc" style={{ marginTop: '14px', fontSize: '12px' }}>
                ℹ️ Rows showing <em>(no name)</em> are normal BLE behaviour — phones use randomised addresses and omit their name from advertisements for privacy. A name only appears when a device broadcasts one (fitness bands, smart tags, beacons). To confirm a phone, pair it via Windows Settings → Bluetooth &amp; devices and use "Refresh Windows Paired List".
              </p>
            </div>
          )}
        </div>

        {/* ── CONNECTION & PAIRING ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--cyan)' }}>🔗 Connection &amp; Pairing</div>
          <p className="section-desc" style={{ marginBottom: '16px', fontSize: '13px' }}>
            Select a device above, then attempt a direct BLE connection. Most phones only act as BLE <em>scanners</em>, not connectable peripherals — a connect attempt against a phone will time out, which is expected. Dedicated BLE peripherals (bands, tags, sensors) accept connections. Phone pairing itself is done in Windows Settings; use "Refresh Windows Paired List" to confirm.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button className="btn btn-primary" disabled={!selectedAddress || connecting || connStatus.connected} onClick={() => handleConnect(false)}>
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button className="btn btn-primary" disabled={!selectedAddress || connecting || connStatus.connected} onClick={() => handleConnect(true)}>
              Connect &amp; Pair
            </button>
            <button className="btn btn-outline" disabled={!connStatus.connected} onClick={handleDisconnect}>Disconnect</button>
            <button className="btn btn-outline" onClick={fetchPairedDevices}>Refresh Windows Paired List</button>
          </div>

          {connErr && <div className="alert alert-warning" style={{ marginBottom: '16px' }}>⚠️ {connErr}</div>}

          <div className="four-col" style={{ marginBottom: '16px' }}>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: connStatus.connected ? 'var(--green)' : 'var(--text-muted)', fontSize: '18px' }}>
                {connStatus.connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="stat-label">Connection State</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" title={connStatus.address || ''} style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{connStatus.address || '—'}</div>
              <div className="stat-label">Active Address</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ fontSize: '18px' }}>{connStatus.services_count ?? '—'}</div>
              <div className="stat-label">GATT Services</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ fontSize: '18px' }}>{connStatus.paired === true ? 'Yes' : connStatus.paired === false ? 'No' : '—'}</div>
              <div className="stat-label">Paired (this session)</div>
            </div>
          </div>

          {pairedDevices.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Status</th></tr></thead>
                <tbody>{pairedDevices.map((p, i) => (<tr key={i}><td>{p.name}</td><td>{p.status}</td></tr>))}</tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RANGE TEST LOGGING ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--cyan)' }}>📍 Range Test — Log Distance → RSSI</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Selected device: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedAddress || 'none — pick one above'}</strong>
            {selected && <> &nbsp;({selected.rssi} dBm)</>}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="number" step="0.1" min="0.1" placeholder="Distance (m)" value={distance}
              onChange={e => setDistance(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddReading()}
              className="input-field" style={{ maxWidth: '180px' }} />
            <button className="btn btn-primary" disabled={recording || !selectedAddress} onClick={handleAddReading}>
              {recording ? 'Logging…' : '📍 Log Reading'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleClear}>🗑 Clear All</button>
          </div>
          {lastAdded && (
            <div className="alert alert-success" style={{ marginTop: '12px' }}>
              ✅ Logged {lastAdded.distance} m → {lastAdded.rssi} dBm for {lastAdded.address}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.6 }}>
            Move the device to several distances (e.g. 1, 3, 6, 10 m) with a clear line of sight and log RSSI at each — the fit below needs 2+ distinct distances.
          </div>
        </div>

        {/* ── DISTANCE vs RSSI FIT ── */}
        <div className="glass-card">
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📉 Distance vs RSSI — Path-Loss Model Fit</div>

          {fitErr && chartData.length < 2 && <div className="alert alert-warning" style={{ marginBottom: '16px' }}>📊 {fitErr}</div>}

          {chartData.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🔵</div><div className="empty-state-text">No range readings yet. Log a few at different distances above.</div></div>
          ) : (
            <div style={{ width: '100%', height: 340, marginBottom: '20px' }}>
              <ResponsiveContainer>
                <ComposedChart data={[...chartData, ...fittedCurve]} margin={{ top: 10, right: 30, left: 0, bottom: 16 }}>
                  <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                  <XAxis dataKey="distance" type="number" stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }}
                    label={{ value: 'Distance (m)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']}
                    label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter dataKey="rssi" fill="#2563eb" />
                  {fit && <Line type="monotone" dataKey="fitted_rssi" stroke="#4f46e5" dot={false} strokeWidth={2} name="Fitted model" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {fit && (
            <>
              <div className="four-col">
                <div className="stat-pill"><div className="stat-value" style={{ color: 'var(--cyan)' }}>{fit.rssi_at_1m}</div><div className="stat-label">RSSI @ 1m (dBm)</div></div>
                <div className="stat-pill"><div className="stat-value" style={{ color: 'var(--violet)' }}>{fit.path_loss_exponent}</div><div className="stat-label">Path-Loss Exponent (n)</div></div>
                <div className="stat-pill"><div className="stat-value" style={{ color: 'var(--green)' }}>{fit.r_squared}</div><div className="stat-label">R² (fit quality)</div></div>
                <div className="stat-pill"><div className="stat-value">{fit.sample_count}</div><div className="stat-label">Samples Used</div></div>
              </div>
              {fit.interpretation && <div className="alert alert-info" style={{ marginTop: '16px' }}>💡 {fit.interpretation}</div>}
            </>
          )}
        </div>

      </div>
    </main>
  )
}
