import { useState } from 'react'
import axios from 'axios'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const API = '/api/network'
const CF = 'https://speed.cloudflare.com'

/* ── Helpers ── */
function latencyColor(ms) {
  if (ms <= 20)  return '#10b981'
  if (ms <= 60)  return '#00d4ff'
  if (ms <= 120) return '#f59e0b'
  return '#ef4444'
}
function latencyLabel(ms) {
  if (ms <= 20)  return { text: 'Excellent', cls: 'badge-green' }
  if (ms <= 60)  return { text: 'Good',      cls: 'badge-cyan'  }
  if (ms <= 120) return { text: 'Fair',      cls: 'badge-amber' }
  return               { text: 'Poor',       cls: 'badge-red'   }
}

const PHASE_COLOR = { ping: '#10b981', download: '#00d4ff', upload: '#a78bfa', done: '#00d4ff', idle: '#00d4ff' }
const PHASE_LABEL = { ping: 'Ping', download: 'Download', upload: 'Upload', done: 'Complete', idle: 'Ready' }

/* ── Client-side measurement (runs in the browser, like speedtest.net) ── */
async function measurePing(samples, onSample) {
  const times = []
  for (let i = 0; i < samples; i++) {
    const t = performance.now()
    await fetch(`${CF}/__down?bytes=0`, { cache: 'no-store' })
    const ms = performance.now() - t
    times.push(ms)
    onSample && onSample(ms)
  }
  const use = times.length > 1 ? times.slice(1) : times   // drop TCP/TLS warm-up
  const ping = Math.min(...use)
  const jitter = use.length > 1
    ? use.slice(1).reduce((a, v, i) => a + Math.abs(v - use[i]), 0) / (use.length - 1)
    : 0
  return { ping: +ping.toFixed(1), jitter: +jitter.toFixed(1) }
}

async function measureDownload(onProgress, maxSecs = 10) {
  const start = performance.now()
  let loaded = 0, lastT = start, lastLoaded = 0
  const resp = await fetch(`${CF}/__down?bytes=300000000`, { cache: 'no-store' })
  const reader = resp.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.length
    const now = performance.now()
    if (now - lastT >= 120) {
      const inst = (loaded - lastLoaded) * 8 / ((now - lastT) / 1000) / 1e6
      lastT = now; lastLoaded = loaded
      onProgress(inst, (now - start) / 1000)
    }
    if ((now - start) / 1000 >= maxSecs) { reader.cancel(); break }
  }
  const secs = (performance.now() - start) / 1000
  return +((loaded * 8) / secs / 1e6).toFixed(2)
}

function measureUpload(onProgress, maxSecs = 10) {
  return new Promise((resolve) => {
    const start = performance.now()
    const CHUNK = 8_000_000
    const blob = new Uint8Array(CHUNK)
    let sent = 0, lastT = start, lastSent = 0
    function post() {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${CF}/__up`, true)
      const base = sent
      xhr.upload.onprogress = (e) => {
        const now = performance.now()
        const total = base + e.loaded
        if (now - lastT >= 120) {
          const inst = (total - lastSent) * 8 / ((now - lastT) / 1000) / 1e6
          lastT = now; lastSent = total
          onProgress(inst, (now - start) / 1000)
        }
      }
      xhr.onload = () => {
        sent = base + CHUNK
        if ((performance.now() - start) / 1000 < maxSecs) post()
        else resolve(+((sent * 8) / ((performance.now() - start) / 1000) / 1e6).toFixed(2))
      }
      xhr.onerror = () => {
        const secs = (performance.now() - start) / 1000
        resolve(sent > 0 ? +((sent * 8) / secs / 1e6).toFixed(2) : 0)
      }
      xhr.send(blob)
    }
    post()
  })
}

async function fetchServer() {
  try {
    const r = await fetch(`${CF}/cdn-cgi/trace`, { cache: 'no-store' })
    const t = await r.text()
    const m = Object.fromEntries(t.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))
    return { colo: m.colo || '', loc: m.loc || '' }
  } catch { return { colo: '', loc: '' } }
}

/* ── Gauge geometry: 270° arc opening at the bottom, bottom-left → bottom-right ── */
const GAUGE = { cx: 150, cy: 150, r: 118 }
const ARC_LEN = 1000   // normalized pathLength for smooth dashoffset animation
function polar(f, radius = GAUGE.r) {
  const a = (135 + f * 270) * Math.PI / 180   // f=0 → bottom-left, f=1 → bottom-right
  return { x: GAUGE.cx + radius * Math.cos(a), y: GAUGE.cy + radius * Math.sin(a) }
}
function arcPath(f0, f1, radius = GAUGE.r) {
  const s = polar(f0, radius), e = polar(f1, radius)
  const large = (f1 - f0) > 0.5 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

/* speedtest.net-style non-linear scale — low speeds get more of the dial */
const SCALE = [0, 5, 10, 50, 100, 250, 500, 750, 1000]
function valueToFrac(v) {
  if (v <= 0) return 0
  for (let i = 0; i < SCALE.length - 1; i++) {
    if (v <= SCALE[i + 1]) return (i + (v - SCALE[i]) / (SCALE[i + 1] - SCALE[i])) / (SCALE.length - 1)
  }
  return 1
}
const fracFor = (v, phase) => (phase === 'ping' ? Math.min((v || 0) / 150, 1) : valueToFrac(v || 0))
const fmtVal  = (v, phase) => (phase === 'ping' ? (v < 100 ? v.toFixed(1) : v.toFixed(0)) : (v < 100 ? v.toFixed(1) : v.toFixed(0)))

/* ── Idle GO button — clean concentric rings (speedtest.net style) ── */
function GoButton({ onGo }) {
  return (
    <div style={{ width: 300, maxWidth: '100%', margin: '0 auto', aspectRatio: '1 / 1', display: 'grid', placeItems: 'center' }}>
      <button id="speedtest-go" className="go-btn" onClick={onGo} aria-label="Start speed test">
        <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="go-ring" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          <circle className="go-ring-pulse" cx="150" cy="150" r="132" fill="none" stroke="url(#go-ring)" strokeWidth="1.5" />
          <circle cx="150" cy="150" r="118" fill="none" stroke="url(#go-ring)" strokeWidth="2.5" />
          <circle cx="150" cy="150" r="101" fill="none" stroke="url(#go-ring)" strokeWidth="2" opacity="0.7" />
          <text x="150" y="165" textAnchor="middle" fontSize="44" fontWeight="700" fill="#fff" letterSpacing="5" fontFamily="var(--font-main)">GO</text>
        </svg>
      </button>
    </div>
  )
}

/* ── Animated speed gauge — React-state driven with CSS transitions ──
   The needle (transform) and arc (stroke-dashoffset) ease between the ~8/sec
   data updates via CSS, so motion is smooth without a rAF loop (which browsers
   pause in background tabs). The value is always correct even if throttled. */
function SpeedGauge({ value, phase }) {
  const { cx, cy, r } = GAUGE
  const color = PHASE_COLOR[phase] || '#00d4ff'
  const f = fracFor(value, phase)
  const rot = 135 + f * 270
  const dashoff = ARC_LEN * (1 - f)
  const showScale = phase !== 'ping'
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'

  return (
    <div style={{ width: 300, maxWidth: '100%', margin: '0 auto', aspectRatio: '1 / 1' }}>
      <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
          <linearGradient id="needle-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path d={arcPath(0, 1)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />

        {/* Ticks (major every 5th) */}
        {Array.from({ length: 41 }).map((_, i) => {
          const tf = i / 40, major = i % 5 === 0
          const inn = polar(tf, r - (major ? 21 : 14)), out = polar(tf, r - 7)
          return <line key={i} x1={inn.x} y1={inn.y} x2={out.x} y2={out.y}
            stroke={major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
        })}

        {/* Scale labels (speed phases only) */}
        {showScale && SCALE.map((s, i) => {
          const p = polar(i / (SCALE.length - 1), r - 40)
          return <text key={s} x={p.x} y={p.y + 4} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600" fontFamily="var(--font-mono)">{s}</text>
        })}

        {/* Progress arc — eased via stroke-dashoffset */}
        <path d={arcPath(0, 1)} fill="none" stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round"
          pathLength={ARC_LEN} strokeDasharray={ARC_LEN}
          style={{ strokeDashoffset: dashoff, transition: `stroke-dashoffset 0.2s ${ease}`, filter: `drop-shadow(0 0 8px ${color}99)` }} />

        {/* Tapered silver needle — eased via rotate transform */}
        <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: '150px 150px', transformBox: 'view-box', transition: `transform 0.2s ${ease}` }}>
          <polygon points={`${cx + 14},${cy - 6} ${cx + r - 34},${cy} ${cx + 14},${cy + 6}`} fill="url(#needle-grad)"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
        </g>
        <circle cx={cx} cy={cy} r="12" fill="#0b1120" stroke={color} strokeWidth="3" />
        <circle cx={cx} cy={cy} r="4" fill={color} />

        {/* Center readout */}
        <text x={cx} y={cy + 66} textAnchor="middle" fill="#f1f5f9" fontSize="46" fontWeight="800" fontFamily="var(--font-mono)">
          {fmtVal(value || 0, phase)}
        </text>
        <text x={cx} y={cy + 90} textAnchor="middle" fill={color} fontSize="13" fontWeight="600" letterSpacing="1" fontFamily="var(--font-main)">
          {phase === 'ping' ? 'ms' : (phase === 'upload' ? '↑ Mbps' : '↓ Mbps')}
        </text>
      </svg>
    </div>
  )
}

export default function Practical5() {
  /* Unified speed test */
  const [testing,  setTesting]  = useState(false)
  const [phase,    setPhase]    = useState('idle')
  const [liveVal,  setLiveVal]  = useState(0)
  const [samples,  setSamples]  = useState([])
  const [result,   setResult]   = useState(null)
  const [pingPart, setPingPart] = useState(null)
  const [dlPart,   setDlPart]   = useState(null)
  const [ulPart,   setUlPart]   = useState(null)
  const [error,    setError]    = useState('')

  /* Traceroute (advanced, optional) */
  const [traceHost,   setTraceHost]   = useState('8.8.8.8')
  const [tracing,     setTracing]     = useState(false)
  const [traceResult, setTraceResult] = useState(null)

  async function runFullTest() {
    setTesting(true); setResult(null); setError(''); setSamples([])
    setPingPart(null); setDlPart(null); setUlPart(null)
    const t0 = performance.now()
    try {
      // 1) Ping
      setPhase('ping'); setLiveVal(0)
      const p = await measurePing(6, (ms) => setLiveVal(ms))
      setPingPart(p); setLiveVal(p.ping)

      // 2) Download
      setPhase('download'); setLiveVal(0)
      const dl = await measureDownload((inst) => {
        setLiveVal(inst)
        setSamples(s => [...s, { t: +(( performance.now() - t0) / 1000).toFixed(1), dl: +inst.toFixed(1), ul: null }])
      })
      setDlPart(dl); setLiveVal(dl)

      // 3) Upload
      setPhase('upload'); setLiveVal(0)
      const ul = await measureUpload((inst) => {
        setLiveVal(inst)
        setSamples(s => [...s, { t: +(( performance.now() - t0) / 1000).toFixed(1), dl: null, ul: +inst.toFixed(1) }])
      })
      setUlPart(ul); setLiveVal(ul)

      // 4) Server + done
      const srv = await fetchServer()
      const res = {
        download_mbps: dl, upload_mbps: ul, ping_ms: p.ping, jitter_ms: p.jitter,
        server_name: `Cloudflare ${srv.colo}`.trim(), server_country: srv.loc,
        timestamp: new Date().toISOString(),
      }
      setResult(res); setPhase('done'); setLiveVal(dl)
      // Best-effort: record to backend history (ignore failure)
      axios.post(`${API}/speedtest/record`, res).catch(() => {})
    } catch (e) {
      setError(`Speed test failed — ${e.message}. Check your internet connection.`)
      setPhase('idle')
    }
    setTesting(false)
  }

  /* Traceroute */
  async function handleTrace() {
    if (!traceHost.trim()) return
    setTracing(true); setTraceResult(null)
    try {
      const res = await axios.post(`${API}/traceroute`, { host: traceHost.trim() }, { timeout: 120000 })
      setTraceResult(res.data)
    } catch {}
    setTracing(false)
  }

  const gaugeValue = phase === 'done' ? (result?.download_mbps ?? 0) : liveVal
  const showGauge = testing || phase === 'done'

  return (
    <main className="practical-page">
      <div className="container">

        {/* Header */}
        <div className="section-header">
          <div className="section-eyebrow violet">⚡ Practical 5 · MDL501.4</div>
          <h1 className="section-title">Throughput &amp; Latency Measurement</h1>
          <p className="section-desc">
            One-tap network test — measures ping, download and upload speed live, the way a real speed test does.
          </p>
        </div>

        {/* ── UNIFIED SPEED TEST ── */}
        <div className="glass-card" style={{ marginBottom: '24px', textAlign: 'center' }}>
          {/* Phase pill */}
          <div style={{ marginBottom: '8px' }}>
            <span className="badge" style={{
              background: `${PHASE_COLOR[phase]}22`, color: PHASE_COLOR[phase],
              fontSize: '12px', padding: '5px 14px', fontFamily: 'var(--font-mono)',
            }}>
              {testing && <span className="live-dot" style={{ background: PHASE_COLOR[phase], boxShadow: `0 0 8px ${PHASE_COLOR[phase]}`, display: 'inline-block', marginRight: 6 }} />}
              {testing ? `Testing · ${PHASE_LABEL[phase]}` : (result ? 'Test complete' : 'Ready to test')}
            </span>
          </div>

          {showGauge
            ? <SpeedGauge value={gaugeValue} phase={phase} />
            : <GoButton onGo={runFullTest} />}

          {/* Live mini-stats (fill in as each phase finishes) */}
          <div className="four-col" style={{ marginTop: '8px', marginBottom: '4px' }}>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>
                {result?.download_mbps ?? dlPart ?? (phase === 'download' ? liveVal.toFixed(1) : '—')}
              </div>
              <div className="stat-label">↓ Download (Mbps)</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: '#a78bfa' }}>
                {result?.upload_mbps ?? ulPart ?? (phase === 'upload' ? liveVal.toFixed(1) : '—')}
              </div>
              <div className="stat-label">↑ Upload (Mbps)</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: 'var(--green)' }}>
                {result?.ping_ms ?? pingPart?.ping ?? '—'}
              </div>
              <div className="stat-label">Ping (ms)</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: 'var(--amber)' }}>
                {result?.jitter_ms ?? pingPart?.jitter ?? '—'}
              </div>
              <div className="stat-label">Jitter (ms)</div>
            </div>
          </div>

          {!testing && !result && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Tap <strong style={{ color: 'var(--cyan)' }}>GO</strong> to run a full ping · download · upload test
            </div>
          )}
          {!testing && result && (
            <button className="btn btn-primary btn-lg" onClick={runFullTest} style={{ marginTop: '14px' }}>
              🔄 Test Again
            </button>
          )}

          {error && <div className="alert alert-error" style={{ marginTop: '16px', textAlign: 'left' }}>❌ {error}</div>}

          {/* Live throughput graph */}
          {samples.length > 1 && (
            <div style={{ marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={samples} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" unit="s" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" unit=" Mbps" width={64} />
                  <Tooltip contentStyle={{ background: 'rgba(8,13,32,0.95)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '10px', fontSize: '13px' }} labelStyle={{ color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="dl" name="Download" stroke="#00d4ff" strokeWidth={2} fill="url(#dlGrad)" connectNulls isAnimationActive={false} />
                  <Area type="monotone" dataKey="ul" name="Upload" stroke="#7c3aed" strokeWidth={2} fill="url(#ulGrad)" connectNulls isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Result summary */}
          {result && (
            <>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                🌍 Test server: <strong style={{ color: 'var(--text-primary)' }}>{result.server_name}</strong>
                {result.server_country && `, ${result.server_country}`}
                &nbsp;·&nbsp; {new Date(result.timestamp).toLocaleTimeString()}
              </div>
              <div className="alert alert-success" style={{ marginTop: '14px', textAlign: 'left' }}>
                ✅ <strong>Result:</strong> {result.download_mbps} Mbps down / {result.upload_mbps} Mbps up,
                ping {result.ping_ms} ms ({latencyLabel(result.ping_ms).text}).
                {result.download_mbps >= 25 ? ' Network supports HD streaming and general use.' : ' Below typical broadband standards.'}
              </div>
            </>
          )}
        </div>

        {/* ── ADVANCED · TRACEROUTE (optional) ── */}
        <div className="glass-card">
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--amber)' }}>
            🗺 Advanced · Traceroute <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>(optional)</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Trace the network path to a host and measure hop-by-hop latency. Takes ~30–90 seconds.
          </div>

          <div className="input-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Target Host</label>
              <input id="trace-host" className="input-field" placeholder="e.g. google.com"
                value={traceHost} onChange={e => setTraceHost(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button id="trace-btn" className="btn btn-outline" onClick={handleTrace} disabled={tracing}
                style={{ height: '46px', borderColor: 'rgba(245,158,11,0.4)', color: 'var(--amber)' }}>
                {tracing ? <><div className="spinner" style={{ borderTopColor: 'var(--amber)' }} />&nbsp;Tracing…</> : '🗺 Trace Route'}
              </button>
            </div>
          </div>

          {traceResult && traceResult.hops?.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Hop</th><th>IP Address</th><th>Avg Latency (ms)</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {traceResult.hops.map(hop => (
                    <tr key={hop.hop} className="hop-row">
                      <td>{hop.hop}</td>
                      <td style={{ color: hop.ip === '*' ? 'var(--text-muted)' : 'var(--cyan)' }}>{hop.ip}</td>
                      <td>{hop.avg_ms !== null
                        ? <span style={{ color: latencyColor(hop.avg_ms), fontWeight: '700' }}>{hop.avg_ms} ms</span>
                        : <span style={{ color: 'var(--text-muted)' }}>* * *</span>}</td>
                      <td>{hop.avg_ms !== null
                        ? <span className={`badge ${latencyLabel(hop.avg_ms).cls}`}>{latencyLabel(hop.avg_ms).text}</span>
                        : <span className="badge badge-amber">Filtered</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {traceResult && traceResult.hops?.length === 0 && (
            <div className="alert alert-warning">⚠️ No hops found — host may be unreachable or traceroute is blocked by firewall.</div>
          )}
        </div>
      </div>
    </main>
  )
}
