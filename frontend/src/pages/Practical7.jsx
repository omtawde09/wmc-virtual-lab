import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

const API_INTERFERENCE = '/api/interference'
const NOISE_FLOOR_DBM = -94.0

function getCongestionBadgeClass(score) {
  if (score < 3.0) return 'badge-green'
  if (score < 6.0) return 'badge-amber'
  return 'badge-red'
}

function getCongestionText(score) {
  if (score < 3.0) return 'Low Congestion'
  if (score < 6.0) return 'Moderate Congestion'
  return 'High Congestion'
}

export default function Practical7() {
  const [loading, setLoading] = useState(false)
  const [scanData, setScanData] = useState(null)
  const [scans, setScans] = useState([])
  const [bandView, setBandView] = useState('2.4 GHz') // '2.4 GHz' or '5 GHz'
  const [obsNote, setObsNote] = useState('')
  const [observations, setObservations] = useState([])
  
  // Fetch scan history from backend
  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_INTERFERENCE}/history`)
      setScans(res.data)
      if (res.data.length > 0) {
        setScanData(res.data[res.data.length - 1])
      }
    } catch {}
  }, [])
  
  // Initial scan and load history
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])
  
  // Trigger environment scan
  const handleScan = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_INTERFERENCE}/scan`)
      setScanData(res.data)
      await fetchHistory()
      
      // Auto-switch band view based on connected AP band
      if (res.data.connected && res.data.connected.band) {
        setBandView(res.data.connected.band)
      }
    } catch (err) {
      console.error("Scan failed", err)
    } finally {
      setLoading(false)
    }
  }
  
  // Clear scan history
  const handleClearHistory = async () => {
    if (!window.confirm("Clear all environment scan history?")) return
    try {
      await axios.delete(`${API_INTERFERENCE}/history`)
      setScans([])
      setScanData(null)
    } catch {}
  }
  
  // Add manual observation
  const addObservation = () => {
    if (!obsNote.trim()) return
    setObservations(prev => [
      ...prev,
      {
        id: prev.length + 1,
        note: obsNote.trim(),
        timestamp: new Date().toLocaleTimeString(),
        ssid: scanData?.connected?.ssid || "N/A"
      }
    ])
    setObsNote('')
  }
  
  // Generate data points for the parabolic channel spectrum chart
  const getSpectrumData = () => {
    if (!scanData || !scanData.networks) return []
    
    // Filter networks by current selected band
    const filteredNets = scanData.networks.filter(net => net.band === bandView)
    if (filteredNets.length === 0) return []
    
    const points = []
    
    if (bandView === '2.4 GHz') {
      // 2.4 GHz channels: 1 to 14
      // We generate points from 0.0 to 14.5 in steps of 0.2
      for (let x = 0.0; x <= 14.5; x += 0.2) {
        const point = { channel: parseFloat(x.toFixed(1)) }
        filteredNets.forEach(net => {
          const ch = net.channel
          const dist = Math.abs(x - ch)
          // OFDM/DSSS mask bandwidth: channel spacing is 5MHz, signal width is 22MHz (approx 4.4 channels)
          if (dist <= 2.2) {
            const factor = 1 - Math.pow(dist / 2.2, 2)
            // Cap minimum at -100 dBm
            point[net.bssid] = parseFloat(( -100 + (net.rssi_dbm + 100) * factor ).toFixed(1))
          } else {
            point[net.bssid] = -100
          }
        })
        points.push(point)
      }
    } else {
      // 5 GHz channels: typically 36, 40, 44, 48, 52, 56, 60, 64, 149, 153, 157, 161, 165
      // To display 5 GHz spectrum cleanly without huge gaps, we only span the channels actually found in scan
      const activeChannels = filteredNets.map(n => n.channel)
      const minCh = Math.max(36, Math.min(...activeChannels) - 4)
      const maxCh = Math.min(165, Math.max(...activeChannels) + 4)
      
      // Step of 0.5 channel
      for (let x = minCh; x <= maxCh; x += 0.5) {
        const point = { channel: x }
        filteredNets.forEach(net => {
          const ch = net.channel
          const dist = Math.abs(x - ch)
          // 5GHz typical channel width is 20MHz (approx 4 channels spacing, width 4)
          if (dist <= 2.0) {
            const factor = 1 - Math.pow(dist / 2.0, 2)
            point[net.bssid] = parseFloat(( -100 + (net.rssi_dbm + 100) * factor ).toFixed(1))
          } else {
            point[net.bssid] = -100
          }
        })
        points.push(point)
      }
    }
    
    return points
  }
  
  // Get color for AP curve based on interference type
  const getAPColor = (net) => {
    if (net.bssid.lowerCase === scanData?.connected?.bssid?.lowerCase) return '#00d4ff' // Connected (Cyan)
    if (net.interference_type === 'Connected') return '#00d4ff'
    if (net.interference_type === 'Co-channel') return '#ef4444' // Co-channel (Red)
    if (net.interference_type === 'Adjacent') return '#f59e0b' // Adjacent (Amber)
    return '#475569' // None/Non-overlapping (Muted Gray)
  }
  
  const getAPDisplayName = (net) => {
    const typeLabel = net.interference_type === 'Connected' ? ' (Connected)' : ''
    return `${net.ssid} [Ch ${net.channel}]${typeLabel}`
  }
  
  return (
    <main className="practical-page">
      <div className="container">
        
        {/* HEADER */}
        <div className="section-header">
          <div className="section-eyebrow violet" style={{ borderColor: 'rgba(16,185,129,0.3)', color: 'var(--green)', background: 'var(--green-dim)' }}>
            📻 Practical 7 · MDL501.6
          </div>
          <h1 className="section-title">Noise &amp; Interference Analysis</h1>
          <p className="section-desc">
            Scan your active wireless environment, visualize channel congestion, estimate Signal-to-Noise (SNR) and Signal-to-Interference (SIR) ratios, and compute theoretical network capacity.
          </p>
        </div>
        
        {/* CONNECTED AP & ACTIONS */}
        <div className="two-col" style={{ marginBottom: '24px' }}>
          
          {/* AP CARD */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
                📶 Active Connection Summary
              </div>
              {scanData?.connected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SSID:</span>
                    <strong>{scanData.connected.ssid}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>BSSID:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{scanData.connected.bssid}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Operating Band:</span>
                    <span className="badge badge-cyan">{scanData.connected.band}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Connected Channel:</span>
                    <strong>Ch {scanData.connected.channel}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Signal strength:</span>
                    <strong style={{ color: 'var(--green)' }}>{scanData.connected.rssi_dbm} dBm</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No scan performed yet. Click the Scan button below to read live metrics.
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, var(--green), #059669)', color: '#050a18', flex: 1 }}
                onClick={handleScan}
                disabled={loading}
              >
                {loading ? <><div className="spinner" style={{ borderTopColor: '#050a18' }} /> Scanning...</> : '🔍 Scan RF Environment'}
              </button>
            </div>
          </div>
          
          {/* STATS PANEL */}
          <div className="glass-card">
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
              📊 Measured Channel Metrics
            </div>
            
            {scanData?.metrics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Spectrum Congestion:</span>
                  <span className={`badge ${getCongestionBadgeClass(scanData.metrics.congestion_score)}`}>
                    {getCongestionText(scanData.metrics.congestion_score)}
                  </span>
                </div>
                
                <div className="divider" style={{ margin: '8px 0' }} />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--green)' }}>
                      {scanData.metrics.snr_db} dB
                    </div>
                    <div className="stat-label">SNR (Signal-to-Noise)</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--amber)' }}>
                      {scanData.metrics.sir_db} dB
                    </div>
                    <div className="stat-label">SIR (Signal-to-Interf.)</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {scanData.metrics.sinr_db} dB
                    </div>
                    <div className="stat-label">SINR (Effective Link)</div>
                  </div>
                  <div className="stat-pill" style={{ padding: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {scanData.metrics.co_channel_count} APs
                    </div>
                    <div className="stat-label">Co-channel Overlaps</div>
                  </div>
                </div>
                
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  * Thermal Noise Floor model: <strong>{NOISE_FLOOR_DBM} dBm</strong>. Total adjacent channel interferers detected: {scanData.metrics.adj_channel_count}.
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-icon">📡</div>
                <div className="empty-state-text">Perform a scan to calculate signal metrics.</div>
              </div>
            )}
          </div>
        </div>
        
        {/* VISUALIZATION SPECTRUM */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>🗺️ RF Channel Spectrum Map</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Modeled WiFi signal emission masks. Shows channel overlap and relative signal density in your area.
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`btn btn-sm ${bandView === '2.4 GHz' ? 'btn-primary' : 'btn-outline'}`}
                style={bandView === '2.4 GHz' ? { background: 'var(--green)', color: '#050a18' } : {}}
                onClick={() => setBandView('2.4 GHz')}
              >
                2.4 GHz Band
              </button>
              <button 
                className={`btn btn-sm ${bandView === '5 GHz' ? 'btn-primary' : 'btn-outline'}`}
                style={bandView === '5 GHz' ? { background: 'var(--green)', color: '#050a18' } : {}}
                onClick={() => setBandView('5 GHz')}
              >
                5 GHz Band
              </button>
            </div>
          </div>
          
          <div style={{ height: '340px', width: '100%' }}>
            {!scanData ? (
              <div className="empty-state">
                <div className="empty-state-text">No scan data to plot. Click Scan above.</div>
              </div>
            ) : getSpectrumData().length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">No access points found on the {bandView} band in this scan.</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getSpectrumData()} margin={{ top: 10, right: 30, left: -20, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <XAxis 
                    dataKey="channel" 
                    type="number"
                    domain={bandView === '2.4 GHz' ? [0.5, 14.5] : ['dataMin', 'dataMax']}
                    tickCount={bandView === '2.4 GHz' ? 15 : undefined}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: `${bandView} Channel Number`, position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 12 }} 
                    stroke="#334155" 
                  />
                  <YAxis 
                    domain={[-100, -30]} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    label={{ value: 'Signal RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                    stroke="#334155" 
                  />
                  <Tooltip 
                    contentStyle={{ background: '#080d20', border: '1px solid var(--border)' }}
                    labelFormatter={(label) => `Ch ${label}`}
                  />
                  <ReferenceLine y={NOISE_FLOOR_DBM} stroke="var(--red)" strokeDasharray="4 4" label={{ value: 'Noise Floor', fill: 'var(--red)', fontSize: 10, position: 'right' }} />
                  {scanData.networks.filter(n => n.band === bandView).map((net) => (
                    <Line 
                      key={net.bssid}
                      type="monotone"
                      name={getAPDisplayName(net)}
                      dataKey={net.bssid}
                      stroke={getAPColor(net)}
                      strokeWidth={net.bssid.toLowerCase() === scanData.connected.bssid.toLowerCase() ? 3 : 1.5}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {scanData && (
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#00d4ff' }} />
                <span>Your Connection</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                <span>Co-channel Interferer (Direct Collision)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} />
                <span>Adjacent Channel Interferer (Sideband bleeding)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#475569' }} />
                <span>Non-overlapping / Muted APs</span>
              </div>
            </div>
          )}
        </div>
        
        {/* SHANNON & TABLE ROW */}
        <div className="two-col" style={{ marginBottom: '24px' }}>
          
          {/* SHANNON CAPACITY CARD */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
                🧮 Shannon-Hartley Capacity Limits
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                The maximum theoretical bit rate achievable over this link channel is limited by bandwidth and signal quality (SINR):
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', margin: '12px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', border: '1px solid var(--border)' }}>
                  C = B &times; log₂ (1 + SINR_linear)
                </div>
                {scanData?.metrics ? (
                  <div>
                    Given channel bandwidth <strong>B = 20 MHz</strong> and link SINR = <strong>{scanData.metrics.sinr_db} dB</strong>:
                    <ul style={{ paddingLeft: '18px', marginTop: '8px' }}>
                      <li>SINR Linear Ratio: <strong>{ (10 ** (scanData.metrics.sinr_db / 10.0)).toFixed(1) }</strong></li>
                      <li>Capacity limit: <strong style={{ color: 'var(--green)' }}>{scanData.metrics.shannon_capacity_mbps} Mbps</strong></li>
                    </ul>
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Scan the environment to calculate live Shannon capacities.</span>
                )}
              </div>
            </div>
            
            <div className="alert alert-info" style={{ marginTop: '16px', fontSize: '12px', marginBottom: 0 }}>
              💡 <strong>Observation:</strong> Higher co-channel interference raises the interference power, decreasing the SINR and capping the maximum network speed possible.
            </div>
          </div>
          
          {/* SCAN LIST TABLE */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--green)' }}>📋 Visible Access Points ({scanData?.networks?.length || 0})</div>
            </div>
            
            <div className="data-table-wrap" style={{ flex: 1, maxHeight: '280px', overflowY: 'auto' }}>
              {scanData?.networks ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SSID</th>
                      <th>Ch</th>
                      <th>RSSI</th>
                      <th>Relation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.networks.map((n) => (
                      <tr key={n.bssid}>
                        <td style={{ color: n.interference_type === 'Connected' ? 'var(--green)' : 'inherit' }}>
                          <strong>{n.ssid}</strong>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{n.bssid}</div>
                        </td>
                        <td>{n.channel}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{n.rssi_dbm}</td>
                        <td>
                          <span className={`badge ${
                            n.interference_type === 'Connected' ? 'badge-green' :
                            n.interference_type === 'Co-channel' ? 'badge-red' :
                            n.interference_type === 'Adjacent' ? 'badge-amber' : 'badge-violet'
                          }`} style={{ fontSize: '10px' }}>
                            {n.interference_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ padding: '60px 0' }}>
                  <div className="empty-state-text">No networks scanned.</div>
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        {/* OBSERVATION LOGGER */}
        <div className="glass-card">
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--green)' }}>
            📝 Practical Observations &amp; Conclusions
          </div>
          
          <div className="input-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Record your analysis findings here</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="e.g. My channel Ch 6 has 3 interferers. SIR is 7.5 dB, degrading the theoretical Shannon throughput to 45 Mbps..."
                value={obsNote}
                onChange={e => setObsNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addObservation()}
              />
            </div>
            <button className="btn btn-primary" style={{ background: 'var(--green)', color: '#050a18' }} onClick={addObservation} disabled={!obsNote}>
              Save Note
            </button>
          </div>
          
          {observations.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Time</th>
                    <th style={{ width: '120px' }}>Connection</th>
                    <th>Observation Log</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{o.timestamp}</td>
                      <td><span className="badge badge-cyan">{o.ssid}</span></td>
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
