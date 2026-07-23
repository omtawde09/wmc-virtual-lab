import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

import { resetAllOnce } from '../resetOnLoad'
import { useSEO, experimentSchema } from '../useSEO'
import ExperimentInfo from '../components/ExperimentInfo'

const API = '/api/interference'

function congestionBadge(level) {
  if (level === 'Low') return 'badge-green'
  if (level === 'Moderate') return 'badge-amber'
  return 'badge-red'
}
function metricColor(v, good, ok) {
  if (v == null) return 'var(--text-muted)'
  if (v >= good) return '#059669'
  if (v >= ok) return '#d97706'
  return '#ef4444'
}
function channelCenterMHz(ch, band) {
  if (band && band.includes('2.4')) return 2412 + (ch - 1) * 5     // ch 1..13
  return 5000 + ch * 5                                             // 5 GHz
}
const PALETTE = ['#2563eb', '#d97706', '#4f46e5', '#ef4444', '#34d399', '#f472b6', '#facc15', '#60a5fa']

export default function Practical9() {
  useSEO({
    title: 'Wi-Fi Noise & Interference — SNR vs SIR vs SINR Explained | WMC Virtual Lab',
    description: 'Scan nearby access points to measure channel congestion and co-channel overlap, then compute SNR, SIR, SINR and the Shannon capacity limit of your Wi-Fi link.',
    path: '/practical9',
    keywords: 'SNR vs SIR vs SINR, wifi interference analysis, co-channel interference, noise floor dBm, shannon capacity, channel congestion',
    jsonLd: experimentSchema({ name: 'Noise and Interference Analysis in Wireless Communication', description: 'Measure noise, co-channel interference and compute SNR, SIR, SINR and Shannon capacity.', path: '/practical9', teaches: 'Thermal noise floor, SNR, SIR, SINR, co-channel interference, Shannon capacity' }),
  })

  const [loading, setLoading] = useState(false)
  const [scan, setScan]       = useState(null)
  const [band, setBand]       = useState('5 GHz')

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/history`)
      if (res.data.length) setScan(res.data[res.data.length - 1])
    } catch {}
  }, [])

  useEffect(() => { resetAllOnce().then(fetchHistory) }, [fetchHistory])

  const runScan = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/scan`)
      setScan(res.data)
      if (res.data.connected?.band) setBand(res.data.connected.band)
    } catch (err) {
      alert('Scan failed. Ensure the backend is running.')
    }
    setLoading(false)
  }

  const connected = scan?.connected
  const metrics   = scan?.metrics
  const networks  = scan?.networks || []
  const bandNets  = networks.filter(n => n.band === band)

  /* ── Build spectrum-map data from REAL channels/RSSI ── */
  const spectrum = (() => {
    if (bandNets.length === 0) return { data: [], keys: [] }
    const centers = bandNets.map(n => channelCenterMHz(n.channel, n.band))
    const lo = Math.min(...centers) - 40
    const hi = Math.max(...centers) + 40
    const keys = bandNets.map((n, i) => ({
      key: `${n.ssid}__${n.bssid}`,
      label: `${n.ssid} [Ch ${n.channel}]${n.interference_type === 'Connected' ? ' (You)' : ''}`,
      color: n.interference_type === 'Connected' ? '#2563eb' : PALETTE[(i + 1) % PALETTE.length],
      connected: n.interference_type === 'Connected',
    }))
    const sigma = 9 // ~20 MHz mask
    const base = -100
    const data = []
    for (let f = lo; f <= hi; f += 1) {
      const row = { freq: Math.round(f) }
      bandNets.forEach((n) => {
        const fc = channelCenterMHz(n.channel, n.band)
        const peak = n.rssi_dbm
        row[`${n.ssid}__${n.bssid}`] = +(base + (peak - base) * Math.exp(-((f - fc) ** 2) / (2 * sigma * sigma))).toFixed(1)
      })
      data.push(row)
    }
    return { data, keys }
  })()

  return (
    <main className="practical-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="section-header">
          <div className="section-eyebrow">📻 Practical 9 · MDL501.6</div>
          <h1 className="section-title">Wi-Fi Noise &amp; Interference — SNR, SIR and SINR Explained</h1>
          <p className="section-desc">
            Scan your active wireless environment, visualize channel congestion, estimate Signal-to-Noise (SNR)
            and Signal-to-Interference (SIR) ratios, and compute the theoretical Shannon capacity — all from
            real measured access points around you.
          </p>
        </div>

        <div className="two-col" style={{ marginBottom: '24px' }}>
          {/* ── Active Connection Summary ── */}
          <div className="glass-card">
            <h2 className="card-section-title accent">📊 Active Connection Summary</h2>
            {connected ? (
              <>
                <SummaryRow label="SSID"><strong style={{ fontFamily: 'var(--font-mono)' }}>{connected.ssid}</strong></SummaryRow>
                <SummaryRow label="BSSID"><strong style={{ fontFamily: 'var(--font-mono)' }}>{connected.bssid}</strong></SummaryRow>
                <SummaryRow label="Operating Band"><span className="badge badge-cyan">{connected.band}</span></SummaryRow>
                <SummaryRow label="Connected Channel"><strong>Ch {connected.channel}</strong></SummaryRow>
                <SummaryRow label="Signal strength"><strong style={{ color: 'var(--cyan)' }}>{connected.rssi_dbm} dBm</strong></SummaryRow>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">📡</div>
                <div className="empty-state-text">{scan?.message || 'Run a scan to read your connection.'}</div>
              </div>
            )}
            <button className="btn btn-primary" onClick={runScan} disabled={loading}
              style={{ width: '100%', marginTop: '18px', background: 'var(--cyan)', color: '#ffffff' }}>
              {loading ? <><div className="spinner" style={{ borderTopColor: '#ffffff' }} /> Scanning…</> : '🔍 Scan RF Environment'}
            </button>
          </div>

          {/* ── Measured Channel Metrics ── */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 className="card-section-title accent">📶 Measured Channel Metrics</h2>
              {metrics && (
                <span className={`badge ${congestionBadge(metrics.congestion_level)}`}>{metrics.congestion_level} Congestion</span>
              )}
            </div>
            {metrics ? (
              <>
                <div className="two-col" style={{ gap: '12px' }}>
                  <Tile value={`${metrics.snr_db} dB`} label="SNR (Signal-to-Noise)" color={metricColor(metrics.snr_db, 25, 15)} />
                  <Tile value={`${metrics.sir_db} dB`} label="SIR (Signal-to-Interf.)" color={metricColor(metrics.sir_db, 20, 5)} />
                  <Tile value={`${metrics.sinr_db} dB`} label="SINR (Effective Link)" color={metricColor(metrics.sinr_db, 20, 5)} />
                  <Tile value={`${metrics.co_channel_count} APs`} label="Co-channel Overlaps" color={metrics.co_channel_count === 0 ? '#059669' : '#d97706'} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px' }}>
                  * Thermal noise floor model: <strong>{metrics.noise_floor_dbm} dBm</strong>. Adjacent-channel interferers: {metrics.adj_channel_count}.
                  Shannon capacity limit: <strong style={{ color: 'var(--cyan)' }}>{metrics.shannon_capacity_mbps} Mbps</strong>.
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">📶</div>
                <div className="empty-state-text">No metrics yet — run a scan.</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Spectrum Map ── */}
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="card-section-title">📡 RF Channel Spectrum Map</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['2.4 GHz', '5 GHz'].map(b => (
                <button key={b} className={`btn btn-sm ${band === b ? 'btn-primary' : 'btn-outline'}`}
                  style={band === b ? { background: 'var(--cyan)', color: '#ffffff' } : {}}
                  onClick={() => setBand(b)}>{b} Band</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
            Signal emission masks of the real access points detected in your area. Overlapping curves on the same channel = interference.
          </div>

          {spectrum.data.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📡</div>
              <div className="empty-state-text">No {band} networks detected. Run a scan (only your connection may be visible).</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={spectrum.data} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                <CartesianGrid stroke="rgba(15,36,68,0.08)" strokeDasharray="4 4" />
                <XAxis dataKey="freq" type="number" domain={['dataMin', 'dataMax']}
                  tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155"
                  label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[-100, -30]} tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#334155"
                  label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', fontSize: '12px' }}
                  labelFormatter={(l) => `${l} MHz`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {spectrum.keys.map(k => (
                  <Area key={k.key} dataKey={k.key} name={k.label} stroke={k.color}
                    fill={k.color} fillOpacity={k.connected ? 0.28 : 0.12}
                    strokeWidth={k.connected ? 2.5 : 1.5} type="monotone" isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Visible APs table ── */}
        {networks.length > 0 && (
          <div className="glass-card">
            <h2 className="card-section-title">📋 Visible Access Points ({networks.length})</h2>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>SSID</th><th>BSSID</th><th>Band</th><th>Ch</th><th>RSSI (dBm)</th><th>Type</th></tr>
                </thead>
                <tbody>
                  {networks.map((n, i) => (
                    <tr key={i}>
                      <td style={{ color: n.interference_type === 'Connected' ? 'var(--cyan)' : 'var(--text-primary)' }}>
                        <strong>{n.ssid}</strong>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{n.bssid}</td>
                      <td>{n.band}</td>
                      <td>{n.channel}</td>
                      <td style={{ color: metricColor(n.rssi_dbm, -55, -70) }}><strong>{n.rssi_dbm}</strong></td>
                      <td>
                        <span className={`badge ${
                          n.interference_type === 'Connected' ? 'badge-cyan'
                          : n.interference_type === 'Co-channel' ? 'badge-red'
                          : n.interference_type === 'Adjacent' ? 'badge-amber' : 'badge-green'}`}>
                          {n.interference_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divider" />
            <div className="alert alert-info">
              💡 <strong>Observation:</strong> SNR depends only on your own signal vs the noise floor, while SIR/SINR fall as
              co-channel access points appear on your channel. {metrics && metrics.co_channel_count === 0
                ? 'No co-channel interferers were detected, so your channel is clean and SIR is high.'
                : `${metrics?.co_channel_count} co-channel AP(s) are competing on your channel, lowering SIR to ${metrics?.sir_db} dB.`}
            </div>
          </div>
        )}

        <ExperimentInfo
          heading="About this experiment: noise, interference, SNR, SIR and SINR"
          faqs={[
            { q: 'What is the difference between SNR, SIR and SINR?', a: 'SNR compares your signal to background thermal noise. SIR compares it to interference from other transmitters on your channel. SINR combines both noise and interference, and is the best single predictor of real link performance.' },
            { q: 'What is a good SNR for Wi-Fi?', a: 'Above 25 dB is excellent and supports the highest data rates. 15-25 dB is good, 10-15 dB is marginal with reduced speed, and below 10 dB the connection becomes unstable.' },
            { q: 'What causes co-channel interference?', a: 'Other access points transmitting on exactly the same channel. They must take turns with your network, cutting effective throughput. In 2.4 GHz only channels 1, 6 and 11 do not overlap, so congestion is common.' },
          ]}
          related={[
            { to: '/practical8', title: 'Multipath Fading Analysis', blurb: 'Distinguish interference from your own signal fading.' },
            { to: '/practical4', title: 'Wi-Fi Signal Strength vs Distance', blurb: 'SNR depends directly on your measured RSSI.' },
            { to: '/practical5', title: 'Throughput and Latency', blurb: 'See how interference translates into lost Mbps.' },
          ]}
        >
            <p>
              Three ratios describe how cleanly a wireless link can carry data, and they are frequently
              confused. <strong>SNR (Signal-to-Noise Ratio)</strong> compares your signal against the
              background <strong>thermal noise floor</strong> — roughly <code>-94 dBm</code> for a 20 MHz
              Wi-Fi channel. <strong>SIR (Signal-to-Interference Ratio)</strong> compares your signal
              against <em>other transmitters</em> sharing your channel. <strong>SINR</strong> combines
              both, and is the figure that actually predicts real-world performance.
            </p>
            <p>
              The practical difference matters. Noise is constant and unavoidable; interference is other
              networks and can be escaped by changing channel. If your SNR is excellent but SIR is poor,
              moving to a quieter channel will help enormously. If SNR itself is poor, you need to move
              closer or remove obstructions — a channel change will not save you.
            </p>
            <p>
              <strong>Co-channel</strong> access points sit on exactly your channel and compete directly.
              In 2.4 GHz only channels 1, 6 and 11 are non-overlapping, which is why the band congests so
              easily. Finally, the <strong>Shannon capacity</strong> <code>C = B·log2(1 + SINR)</code>
              gives the theoretical maximum bit rate your channel could ever support.
            </p>
        </ExperimentInfo>

      </div>
    </main>
  )
}

function SummaryRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <span>{children}</span>
    </div>
  )
}
function Tile({ value, label, color }) {
  return (
    <div className="stat-pill" style={{ textAlign: 'center' }}>
      <div className="stat-value" style={{ color, fontSize: '22px' }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
