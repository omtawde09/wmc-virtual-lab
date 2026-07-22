import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

import { resetAllOnce } from '../resetOnLoad'

const WSWIFI_URL = '/api/wifi/ws'
const API = '/api/multipath'
const RECORD_SECONDS = 30

function severityBadge(sev) {
  if (sev === 'Mild') return 'badge-green'
  if (sev === 'Moderate') return 'badge-amber'
  return 'badge-red'
}
function rssiColor(r) {
  if (r == null) return '#94a3b8'
  if (r >= -50) return '#059669'
  if (r >= -60) return '#2563eb'
  if (r >= -70) return '#d97706'
  return '#ef4444'
}

export default function Practical8() {
  const [liveWifi, setLiveWifi] = useState(null)
  const [liveErr, setLiveErr]   = useState(false)
  const [updateMs, setUpdateMs] = useState(null)

  const [rolling, setRolling]   = useState([])
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState(RECORD_SECONDS)
  const [scenario, setScenario]   = useState('Stationary')

  const [sessions, setSessions]       = useState([])
  const [latest, setLatest]           = useState(null)
  const [tab, setTab]                 = useState('realtime') // 'realtime' | 'distribution'

  const recordingRef = useRef(false)
  const samplesRef   = useRef([])
  const scenarioRef  = useRef(scenario)
  const updateMsRef  = useRef(updateMs)
  const lastFrameAt  = useRef(0)
  const timerRef     = useRef(null)

  useEffect(() => { recordingRef.current = recording }, [recording])
  useEffect(() => { scenarioRef.current = scenario }, [scenario])
  useEffect(() => { updateMsRef.current = updateMs }, [updateMs])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/sessions`)
      setSessions(res.data)
      if (res.data.length) setLatest(res.data[res.data.length - 1])
    } catch {}
  }, [])

  /* ── Live RSSI WebSocket ── */
  useEffect(() => {
    resetAllOnce().then(fetchSessions)   // fresh sessions after a full page reload
    let stopped = false
    let ws = null
    let retry = null
    let backoff = 1000

    const open = () => {
      if (stopped) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}${WSWIFI_URL}`)
      ws.onopen = () => { backoff = 1000 }
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data)
        const now = performance.now()
        if (lastFrameAt.current) setUpdateMs(Math.round(now - lastFrameAt.current))
        lastFrameAt.current = now
        setLiveWifi(data)
        setLiveErr(false)

        // Only accumulate the signal trace while a recording is running — the
        // chart should stay still until the user starts the test.
        if (data.connected !== false && data.rssi != null && recordingRef.current) {
          samplesRef.current.push(data.rssi)
          setRolling(prev => {
            const next = [...prev, { t: new Date(data.timestamp).toLocaleTimeString(), rssi: data.rssi }]
            return next.length > 300 ? next.slice(next.length - 300) : next
          })
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setLiveErr(true)
        retry = setTimeout(open, backoff)
        backoff = Math.min(backoff * 2, 10000)
      }
      ws.onerror = () => {}
    }
    const startTimer = setTimeout(open, 150)

    return () => {
      stopped = true
      clearTimeout(startTimer)
      clearTimeout(retry)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchSessions])

  const stopAndAnalyze = useCallback(async () => {
    setRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const samples = [...samplesRef.current]
    if (samples.length < 2) { alert('Not enough live samples were captured. Try again.'); return }
    try {
      const res = await axios.post(`${API}/analyze`, {
        scenario: scenarioRef.current,
        samples,
        sample_rate_ms: updateMsRef.current || 250.0,
      })
      setLatest(res.data)
      await fetchSessions()
      setTab('distribution')
    } catch (err) {
      alert(err?.response?.data?.detail || 'Analysis failed.')
    }
  }, [fetchSessions])

  const startSession = () => {
    if (!liveWifi || liveWifi.connected === false) return
    samplesRef.current = []
    setRolling([])          // fresh trace for this recording
    setTab('realtime')      // show the live trace while recording
    setRecording(true)
    setCountdown(RECORD_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); timerRef.current = null; stopAndAnalyze(); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const clearSessions = async () => {
    if (!window.confirm('Clear all multipath session history?')) return
    try {
      await axios.delete(`${API}/sessions`)
      setSessions([]); setLatest(null); setTab('realtime')
    } catch {}
  }

  const connected = liveWifi && liveWifi.connected !== false
  const sessionTrace = latest ? latest.samples.map((rssi, i) => ({ i, rssi })) : []

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">📶 Practical 8 · MDL501.5</div>
          <h1 className="section-title">Analysis of Multipath Effects</h1>
          <p className="section-desc">
            Observe how the received signal fluctuates (fades) due to multipath propagation.
            Record the live RSSI while stationary or moving, then measure the fading depth,
            fade rate and coherence time — and compare the amplitude distribution to a Rayleigh
            model fitted to your own data.
          </p>
        </div>

        {/* ── LIVE PANEL ── */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: connected ? 'rgba(37,99,235,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>Live Channel Monitoring</span>
            {connected && !liveErr && (
              <span className="badge badge-amber" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Streaming{updateMs != null && <>&nbsp;·&nbsp;{updateMs} ms/update</>}
              </span>
            )}
          </div>

          {liveErr && <div className="alert alert-error">⚠️ Connection error. Ensure backend FastAPI is running on port 8000.</div>}
          {liveWifi && liveWifi.connected === false && !liveErr && (
            <div className="alert alert-warning">📡 No active Wi-Fi connection detected. Connect to a network to monitor fading.</div>
          )}

          {connected && (
            <div className="four-col">
              <div className="stat-pill">
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--cyan)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>{liveWifi.ssid}</div>
                <div className="stat-label">Active SSID</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: rssiColor(liveWifi.rssi) }}>{liveWifi.rssi}</div>
                <div className="stat-label">Instantaneous RSSI (dBm)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: rssiColor(liveWifi.rssi) }}>{liveWifi.signal_pct}%</div>
                <div className="stat-label">Signal Strength</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: 'var(--cyan)' }}>{liveWifi.channel}</div>
                <div className="stat-label">Wi-Fi Channel</div>
              </div>
            </div>
          )}
        </div>

        {/* ── EXPERIMENT RUNNER ── */}
        <div className="two-col" style={{ marginBottom: '24px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--cyan)' }}>🧪 Multipath Experiment Setup</div>
              <div className="input-group" style={{ marginBottom: '18px' }}>
                <label className="input-label">Select Environmental Scenario</label>
                <select className="input-field" value={scenario} onChange={e => setScenario(e.target.value)} disabled={recording}
                  style={{ background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                  <option value="Stationary">Stationary (Minimal fading / line of sight)</option>
                  <option value="Slow Walk">Slow Walk (Walking slowly with device)</option>
                  <option value="Fast Walk">Fast Walk (Moving rapidly)</option>
                  <option value="Obstructed">Obstructed (Behind walls / people moving)</option>
                </select>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
                Records the live RSSI for {RECORD_SECONDS}s. For "walk" scenarios, move the device around
                during the capture — multipath causes constructive/destructive fading that widens the swing.
              </div>
            </div>
            {!recording ? (
              <button className="btn btn-primary" onClick={startSession} disabled={!connected}
                style={{ background: 'var(--cyan)', color: '#ffffff' }}>
                ▶ Start {RECORD_SECONDS}s Recording
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopAndAnalyze}>
                ⏹ Stop &amp; Analyze ({countdown}s)
              </button>
            )}
          </div>

          {/* Latest analysis */}
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--cyan)' }}>📊 Fading Statistics</div>
            {latest ? (
              <>
                <div className="three-col" style={{ marginBottom: '14px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: rssiColor(latest.mean_rssi) }}>{latest.mean_rssi}</div>
                    <div className="stat-label">Mean RSSI (dBm)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>±{latest.std_dev}</div>
                    <div className="stat-label">Fading Depth (σ dB)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>{latest.peak_to_peak}</div>
                    <div className="stat-label">Peak-to-Peak (dB)</div>
                  </div>
                </div>
                <div className="three-col">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{latest.level_crossing_rate}</div>
                    <div className="stat-label">Crossings/s (LCR)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{latest.coherence_time_ms}</div>
                    <div className="stat-label">Coherence Time (ms)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className={`badge ${severityBadge(latest.severity)}`} style={{ fontSize: '13px', padding: '5px 12px' }}>{latest.severity}</span>
                    <div className="stat-label" style={{ marginTop: '6px' }}>Fading Severity</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '28px 0' }}>
                <div className="empty-state-icon">📉</div>
                <div className="empty-state-text">Record a session to compute fading statistics.</div>
              </div>
            )}
          </div>
        </div>

        {/* ── CHARTS ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>
              {tab === 'realtime' ? '📈 Real-Time Rolling Signal' : '📊 Amplitude Distribution vs Rayleigh (fitted to your data)'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={`btn btn-sm ${tab === 'realtime' ? 'btn-primary' : 'btn-outline'}`}
                style={tab === 'realtime' ? { background: 'var(--cyan)', color: '#ffffff' } : {}}
                onClick={() => setTab('realtime')}>Rolling</button>
              <button className={`btn btn-sm ${tab === 'distribution' ? 'btn-primary' : 'btn-outline'}`}
                style={tab === 'distribution' ? { background: 'var(--cyan)', color: '#ffffff' } : {}}
                onClick={() => setTab('distribution')} disabled={!latest || !latest.distribution?.length}>Distribution</button>
            </div>
          </div>

          {tab === 'realtime' ? (
            rolling.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📡</div><div className="empty-state-text">Press “Start Recording” to capture the live signal trace.</div></div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={rolling} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                  <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#334155" minTickGap={40} />
                  <YAxis domain={[-100, -30]} tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155"
                    label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', fontSize: '13px' }} />
                  {latest && <ReferenceLine y={latest.mean_rssi} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'mean', fill: '#64748b', fontSize: 10, position: 'right' }} />}
                  <Line type="monotone" dataKey="rssi" name="Live RSSI" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={latest?.distribution || []} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                <XAxis dataKey="amplitude" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155"
                  label={{ value: 'Normalised amplitude (RMS = 1)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155"
                  label={{ value: 'Probability density', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', fontSize: '13px' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="measured" name="Measured (your data)" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Line dataKey="rayleigh" name="Rayleigh (fitted)" type="monotone" stroke="#2563eb" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── SESSIONS TABLE ── */}
        {sessions.length > 0 && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>📋 Recorded Sessions</div>
              <button className="btn btn-danger btn-sm" onClick={clearSessions}>🗑 Clear All</button>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Scenario</th><th>Mean (dBm)</th><th>σ (dB)</th><th>P2P (dB)</th>
                    <th>LCR (/s)</th><th>Coh. (ms)</th><th>Severity</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td style={{ color: 'var(--cyan)' }}>{s.scenario}</td>
                      <td style={{ color: rssiColor(s.mean_rssi) }}><strong>{s.mean_rssi}</strong></td>
                      <td>±{s.std_dev}</td>
                      <td>{s.peak_to_peak}</td>
                      <td>{s.level_crossing_rate}</td>
                      <td>{s.coherence_time_ms}</td>
                      <td><span className={`badge ${severityBadge(s.severity)}`}>{s.severity}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(s.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divider" />
            <div className="alert alert-info">
              💡 <strong>Observation:</strong> A larger σ (fading depth) and higher crossing rate mean more severe multipath fading —
              typically seen in the "walk"/obstructed scenarios where the reflected paths change rapidly. Stationary line-of-sight
              readings stay closer to the mean (lower σ) and their amplitude distribution deviates from Rayleigh (which assumes no dominant path).
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
