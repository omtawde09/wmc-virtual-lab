import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Area, ReferenceLine
} from 'recharts'

const WSWIFI_URL = '/api/wifi/ws'
const API_MULTIPATH = '/api/multipath'

function getSeverityBadgeClass(severity) {
  if (severity === 'Mild') return 'badge-green'
  if (severity === 'Moderate') return 'badge-amber'
  return 'badge-red'
}

export default function Practical6() {
  // Live WiFi Streaming state
  const [liveWifi, setLiveWifi] = useState(null)
  const [liveErr, setLiveErr] = useState(false)
  const [updateMs, setUpdateMs] = useState(null)
  
  // Real-time rolling chart state
  const [rollingTrace, setRollingTrace] = useState([])
  
  // Session recording state
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [scenario, setScenario] = useState('Stationary')
  
  const recordingRef = useRef(false)
  const sessionSamplesRef = useRef([])
  const scenarioRef = useRef(scenario)
  const updateMsRef = useRef(updateMs)
  
  // Analysis results
  const [sessions, setSessions] = useState([])
  const [latestSession, setLatestSession] = useState(null)
  const [rayleighTrace, setRayleighTrace] = useState([])
  const [activeTab, setActiveTab] = useState('realtime') // 'realtime' or 'rayleigh'
  
  // Manual Observations
  const [obsNote, setObsNote] = useState('')
  const [observations, setObservations] = useState([])
  
  const wsRef = useRef(null)
  const lastFrameAt = useRef(0)
  const timerRef = useRef(null)

  // Keep refs in sync with state to prevent stale closures in intervals/listeners
  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    scenarioRef.current = scenario
  }, [scenario])

  useEffect(() => {
    updateMsRef.current = updateMs
  }, [updateMs])
  
  // Fetch session history
  const fetchSessions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_MULTIPATH}/sessions`)
      setSessions(res.data)
      if (res.data.length > 0) {
        setLatestSession(res.data[res.data.length - 1])
      }
    } catch (err) {
      console.error("Failed to fetch multipath sessions", err)
    }
  }, [])
  
  // Connect to live RSSI WS
  useEffect(() => {
    fetchSessions()
    let stopped = false
    let ws = null
    let retry = null
    let backoff = 1000

    const connect = () => {
      if (stopped) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}${WSWIFI_URL}`)
      wsRef.current = ws

      ws.onopen = () => { backoff = 1000 }
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data)
        const now = performance.now()
        if (lastFrameAt.current) setUpdateMs(Math.round(now - lastFrameAt.current))
        lastFrameAt.current = now
        setLiveWifi(data)
        setLiveErr(false)

        // Add to rolling chart (keep last 50 points)
        setRollingTrace(prev => {
          const next = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString(),
            rssi: data.rssi
          }]
          if (next.length > 50) next.shift()
          return next
        })

        // If recording a session, capture sample in ref
        if (recordingRef.current) {
          sessionSamplesRef.current.push(data.rssi)
        }
      }

      ws.onclose = () => {
        if (stopped) return
        setLiveErr(true)
        retry = setTimeout(connect, backoff)         // reconnect with backoff
        backoff = Math.min(backoff * 2, 10000)       // 1s → 2s → … → 10s cap
      }
      // onclose fires after onerror, so let it handle reconnection.
      ws.onerror = () => {}
    }

    // Delay the first connection slightly. React StrictMode mounts effects
    // twice in dev (mount → unmount → remount); this timer is cancelled by the
    // throwaway unmount, so only the real mount ever opens a socket — no churn.
    const startTimer = setTimeout(connect, 150)

    return () => {
      stopped = true
      clearTimeout(startTimer)
      clearTimeout(retry)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchSessions])

  // Stop recording and send data to backend for analysis
  const stopAndAnalyze = useCallback(async () => {
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    const samplesToUse = [...sessionSamplesRef.current]
    if (samplesToUse.length === 0) {
      console.warn("No samples collected during session.")
      return
    }
    
    try {
      const res = await axios.post(`${API_MULTIPATH}/analyze`, {
        scenario: scenarioRef.current,
        samples: samplesToUse,
        sample_rate_ms: updateMsRef.current || 250.0
      })
      setLatestSession(res.data)
      await fetchSessions()
      
      // Also fetch a synthetic Rayleigh comparison trace for the session mean RSSI
      const rayleighRes = await axios.get(`${API_MULTIPATH}/rayleigh`, {
        params: {
          mean_dbm: res.data.mean_rssi,
          samples: samplesToUse.length
        }
      })
      setRayleighTrace(rayleighRes.data.trace)
      setActiveTab('rayleigh')
    } catch (err) {
      console.error("Analysis failed", err)
    }
  }, [fetchSessions])
  
  // Start session recording
  const startSession = () => {
    if (!liveWifi) return
    sessionSamplesRef.current = [] // reset samples buffer
    setRecording(true)
    setCountdown(30)
    
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          stopAndAnalyze()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }
  
  // Clear saved session logs
  const clearSessions = async () => {
    if (!window.confirm("Clear all multipath session history?")) return
    try {
      await axios.delete(`${API_MULTIPATH}/clear`)
      setSessions([])
      setLatestSession(null)
      setRayleighTrace([])
      setActiveTab('realtime')
    } catch {}
  }
  
  // Save custom observation
  const addObservation = () => {
    if (!obsNote.trim()) return
    setObservations(prev => [
      ...prev,
      {
        id: prev.length + 1,
        note: obsNote.trim(),
        timestamp: new Date().toLocaleTimeString(),
        scenario: latestSession ? latestSession.scenario : "Live Observation"
      }
    ])
    setObsNote('')
  }
  
  // Format Rayleigh chart data
  const getComparisonData = () => {
    if (!latestSession) return []
    const traceLen = Math.max(latestSession.samples.length, rayleighTrace.length)
    const chartPoints = []
    for (let i = 0; i < traceLen; i++) {
      chartPoints.push({
        index: i + 1,
        measured: latestSession.samples[i] || null,
        rayleigh: rayleighTrace[i] || null
      })
    }
    return chartPoints
  }
  
  return (
    <main className="practical-page">
      <div className="container">
        
        {/* HEADER */}
        <div className="section-header">
          <div className="section-eyebrow amber">🌊 Practical 6 · MDL501.5</div>
          <h1 className="section-title">Analysis of Multipath Effects</h1>
          <p className="section-desc">
            Observe fast signal fluctuation (fading) caused by multi-path propagation. Record data under different environmental scenarios and compare it to the theoretical Rayleigh fading model.
          </p>
        </div>
        
        {/* LIVE PANEL */}
        <div className="glass-card" style={{ marginBottom: '24px', borderColor: liveWifi ? 'rgba(245,158,11,0.2)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="live-dot" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--amber)' }}>Live Channel Monitoring</span>
            {liveWifi && liveWifi.connected !== false && !liveErr && (
              <span className="badge badge-amber" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ● Streaming
                {updateMs != null && <>&nbsp;·&nbsp;{updateMs} ms/update</>}
              </span>
            )}
          </div>
          
          {liveErr && (
            <div className="alert alert-error">
              ⚠️ Connection error. Ensure backend FastAPI is running on port 8000.
            </div>
          )}

          {liveWifi && liveWifi.connected === false && !liveErr && (
            <div className="alert alert-warning">
              📡 No active Wi-Fi connection detected. Connect to a network to monitor the channel.
            </div>
          )}

          {liveWifi && liveWifi.connected !== false && (
            <div className="four-col">
              <div className="stat-pill">
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--amber)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  {liveWifi.ssid}
                </div>
                <div className="stat-label">Active SSID</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: 'var(--amber)' }}>{liveWifi.rssi}</div>
                <div className="stat-label">Instantaneous RSSI (dBm)</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: 'var(--amber)' }}>{liveWifi.signal_pct}%</div>
                <div className="stat-label">Signal Strength</div>
              </div>
              <div className="stat-pill">
                <div className="stat-value" style={{ color: 'var(--amber)' }}>{liveWifi.channel}</div>
                <div className="stat-label">Wi-Fi Channel</div>
              </div>
            </div>
          )}
        </div>
        
        {/* EXPERIMENT RUNNER & CHART */}
        <div className="two-col" style={{ marginBottom: '24px' }}>
          
          {/* CONTROL BOX */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--amber)' }}>
                🧪 Multipath Experiment Setup
              </div>
              
              <div className="input-group" style={{ marginBottom: '18px' }}>
                <label className="input-label">Select Environmental Scenario</label>
                <select 
                  className="input-field" 
                  value={scenario} 
                  onChange={e => setScenario(e.target.value)}
                  disabled={recording}
                  style={{ background: 'var(--bg-secondary)', cursor: 'pointer' }}
                >
                  <option value="Stationary">Stationary (Minimal Fading / Line of Sight)</option>
                  <option value="Slow Walk">Slow Walk (Walking slowly with device)</option>
                  <option value="Fast Walk">Fast Walk (Moving rapidly/running)</option>
                  <option value="Obstructed">Obstructed (Path blocked by human bodies/walls)</option>
                </select>
              </div>
              
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '18px' }}>
                <strong>How to test:</strong> select a scenario. Click <strong>Start Session</strong>. Walk or remain still as stated. The app collects 30 seconds of high-resolution RSSI samples to calculate statistical metrics.
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!recording ? (
                <button 
                  className="btn btn-primary" 
                  style={{ background: 'linear-gradient(135deg, var(--amber), #d97706)', color: '#050a18', flex: 1 }}
                  onClick={startSession}
                  disabled={!liveWifi}
                >
                  ▶ Start Session (30s)
                </button>
              ) : (
                <button 
                  className="btn btn-danger" 
                  style={{ flex: 1 }}
                  onClick={stopAndAnalyze}
                >
                  ⏹ Stop & Analyze ({countdown}s)
                </button>
              )}
            </div>
          </div>
          
          {/* LATEST RESULTS PANEL */}
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--amber)' }}>
              📊 Session Fading Analysis
            </div>
            
            {latestSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Scenario: <strong>{latestSession.scenario}</strong></span>
                  <span className={`badge ${getSeverityBadgeClass(latestSession.severity)}`}>
                    {latestSession.severity} Fading
                  </span>
                </div>
                
                <div className="divider" style={{ margin: '8px 0' }} />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {latestSession.std_dev} dB
                    </div>
                    <div className="stat-label">Std Dev (σ)</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {latestSession.peak_to_peak} dB
                    </div>
                    <div className="stat-label">Peak-to-Peak Depth</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {latestSession.level_crossing_rate} /s
                    </div>
                    <div className="stat-label">Fade Rate (LCR)</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {latestSession.coherence_time_ms} ms
                    </div>
                    <div className="stat-label">Coherence Time (Tc)</div>
                  </div>
                </div>
                
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  * Fade threshold set at 10 dB below average RSSI ({latestSession.fade_threshold} dBm). Average Fade Duration: {latestSession.avg_fade_duration_ms} ms.
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-text">No sessions recorded yet. Start a session on the left.</div>
              </div>
            )}
          </div>
          
        </div>
        
        {/* CHART SECTION */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>
                {activeTab === 'realtime' ? '📊 Real-Time Rolling Signal' : '📈 Measured Fading vs Rayleigh Theoretical Model'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {activeTab === 'realtime' 
                  ? 'Rolling time-series showing momentary multipath RSSI fluctuations.' 
                  : 'Compares your recorded session amplitude distribution to a Rayleigh model trace.'}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`btn btn-sm ${activeTab === 'realtime' ? 'btn-primary' : 'btn-outline'}`}
                style={activeTab === 'realtime' ? { background: 'var(--amber)', color: '#050a18' } : {}}
                onClick={() => setActiveTab('realtime')}
              >
                Live Rolling
              </button>
              <button 
                className={`btn btn-sm ${activeTab === 'rayleigh' ? 'btn-primary' : 'btn-outline'}`}
                style={activeTab === 'rayleigh' ? { background: 'var(--amber)', color: '#050a18' } : {}}
                onClick={() => setActiveTab('rayleigh')}
                disabled={!latestSession || rayleighTrace.length === 0}
              >
                Model Comparison
              </button>
            </div>
          </div>
          
          <div style={{ height: '320px', width: '100%' }}>
            {activeTab === 'realtime' ? (
              rollingTrace.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-text">Waiting for stream data...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rollingTrace} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#334155" />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
                    <Tooltip contentStyle={{ background: '#080d20', border: '1px solid var(--border)' }} />
                    <Area type="monotone" dataKey="rssi" fill="url(#amberGrad)" stroke="transparent" />
                    <Line type="monotone" dataKey="rssi" stroke="var(--amber)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getComparisonData()} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <XAxis dataKey="index" label={{ value: 'Sample Number', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#334155" />
                  <YAxis label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
                  <Tooltip contentStyle={{ background: '#080d20', border: '1px solid var(--border)' }} />
                  {latestSession && (
                    <ReferenceLine y={latestSession.fade_threshold} stroke="var(--red)" strokeDasharray="5 5" label={{ value: 'Fade Limit', fill: 'var(--red)', fontSize: 10, position: 'insideBottomRight' }} />
                  )}
                  <Line type="monotone" name="Measured RSSI" dataKey="measured" stroke="var(--amber)" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Rayleigh Model" dataKey="rayleigh" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        {/* SESSION TABLE */}
        {sessions.length > 0 && (
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>📋 Environmental Scenario Comparison</div>
              <button className="btn btn-danger btn-sm" onClick={clearSessions}>🗑 Clear Records</button>
            </div>
            
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Scenario</th>
                    <th>Average RSSI</th>
                    <th>Fading Dev (σ)</th>
                    <th>Fade Depth</th>
                    <th>Fade Crossing Rate</th>
                    <th>Coherence Time</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td><strong>{s.scenario}</strong></td>
                      <td>{s.mean_rssi} dBm</td>
                      <td style={{ color: 'var(--amber)' }}><strong>{s.std_dev} dB</strong></td>
                      <td>{s.peak_to_peak} dB</td>
                      <td>{s.level_crossing_rate} /s</td>
                      <td>{s.coherence_time_ms} ms</td>
                      <td><span className={`badge ${getSeverityBadgeClass(s.severity)}`}>{s.severity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* OBSERVATION LOGGER */}
        <div className="glass-card">
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--amber)' }}>
            📝 Practical Observations & Conclusions
          </div>
          
          <div className="input-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Record your analysis findings here</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="e.g., When walking, the standard deviation increased to 5.2 dB, proving multipath constructive/destructive fading..."
                value={obsNote}
                onChange={e => setObsNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addObservation()}
              />
            </div>
            <button className="btn btn-primary" style={{ background: 'var(--amber)', color: '#050a18' }} onClick={addObservation} disabled={!obsNote}>
              Save Note
            </button>
          </div>
          
          {observations.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Time</th>
                    <th style={{ width: '120px' }}>Context</th>
                    <th>Observation Log</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{o.timestamp}</td>
                      <td><span className="badge badge-cyan">{o.scenario}</span></td>
                      <td style={{ fontFamily: 'inherit', color: 'var(--text-primary)' }}>{o.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No observations added yet. Type your findings above and save them.
            </div>
          )}
        </div>
        
      </div>
    </main>
  )
}
