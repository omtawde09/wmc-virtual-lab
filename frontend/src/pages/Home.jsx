import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>
        <div className="container hero-content">
          <div className="hero-eyebrow">
            📡 Mobile &amp; Data Management Lab &nbsp;·&nbsp; 2026–27
          </div>
          <h1 className="hero-title">
            Wireless Network<br />
            <span className="gradient-text">Analysis Suite</span>
          </h1>
          <p className="hero-subtitle">
            Real-time Wi-Fi signal measurement and network throughput analysis.
            Live data captured from your system — no simulation needed.
          </p>
        </div>
      </section>

      {/* ── PRACTICAL CARDS ── */}
      <section style={{ paddingBottom: '60px' }}>
        <div className="container">
          <div className="practical-cards">

            {/* Practical 4 */}
            <Link to="/practical4" className="practical-card cyan">
              <div className="card-icon-wrap cyan">📶</div>
              <div className="card-label cyan">Practical 4 · MDL501.3</div>
              <h2 className="card-title">Signal Strength vs Distance</h2>
              <p className="card-desc">
                Measure Wi-Fi RSSI (Received Signal Strength Indicator) at varying 
                distances from the router. Record readings, plot the signal-distance 
                curve, and analyze path loss behaviour.
              </p>
              <div className="card-tags">
                <span className="tag">RSSI (dBm)</span>
                <span className="tag">Signal %</span>
                <span className="tag">Path Loss</span>
                <span className="tag">netsh wlan</span>
                <span className="tag">Scatter Chart</span>
              </div>
              <span className="card-cta cyan">Launch Experiment →</span>
            </Link>

            {/* Practical 5 */}
            <Link to="/practical5" className="practical-card violet">
              <div className="card-icon-wrap violet">⚡</div>
              <div className="card-label violet">Practical 5 · MDL501.4</div>
              <h2 className="card-title">Throughput &amp; Latency Analysis</h2>
              <p className="card-desc">
                Measure network performance metrics including ping latency, 
                jitter, packet loss, and download/upload throughput using 
                real network tools.
              </p>
              <div className="card-tags">
                <span className="tag">Ping / RTT</span>
                <span className="tag">Jitter</span>
                <span className="tag">Packet Loss</span>
                <span className="tag">Speedtest</span>
                <span className="tag">Traceroute</span>
              </div>
              <span className="card-cta violet">Launch Experiment →</span>
            </Link>
          </div>

          {/* Info Row */}
          <div className="two-col" style={{ marginTop: '8px' }}>
            <div className="glass-card">
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <strong style={{ color: 'var(--cyan)', display: 'block', marginBottom: '8px' }}>
                  🔬 How it works
                </strong>
                The backend reads live data from your system using <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>netsh wlan</code> for Wi-Fi 
                and the Windows <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>ping</code> command for latency. 
                Results are visualized in real-time through interactive charts.
              </div>
            </div>
            <div className="glass-card">
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <strong style={{ color: '#a78bfa', display: 'block', marginBottom: '8px' }}>
                  🚀 Stack
                </strong>
                <span style={{ color: 'var(--cyan)' }}>FastAPI</span> (Python) backend running on port 8000 · 
                <span style={{ color: '#a78bfa' }}> React + Vite</span> frontend on port 5173 · 
                <span style={{ color: 'var(--amber)' }}> Recharts</span> for interactive data visualization
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
