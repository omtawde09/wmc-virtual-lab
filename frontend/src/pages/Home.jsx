import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO'

export default function Home() {
  useSEO({
    title: 'Wireless & Mobile Communication Virtual Lab — Live Wi-Fi, Bluetooth & Signal Experiments',
    description: 'Free virtual lab for Wireless & Mobile Communication. Measure Wi-Fi RSSI vs distance, path-loss exponent, Bluetooth range, multipath fading and SNR/SIR/SINR interference using live data from your own hardware.',
    path: '/',
    keywords: 'wireless and mobile communication lab, wifi rssi experiment, path loss exponent, bluetooth range test, multipath fading, SNR SIR SINR, virtual lab',
  })

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
            📡 Wireless &amp; Mobile Communication &nbsp;·&nbsp; Virtual Lab · 2026–27
          </div>
          <h1 className="hero-title">
            Wireless &amp; Mobile<br />
            <span className="gradient-text">Communication Lab</span>
          </h1>
          <p className="hero-subtitle">
            Real-time Wi-Fi signal, throughput, multipath and interference experiments.
            Live data captured from your system — no simulation needed.
          </p>
        </div>
      </section>

      {/* ── PRACTICAL CARDS ── */}
      <section style={{ paddingBottom: '40px' }}>
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

            {/* Practical 6 */}
            <Link to="/practical6" className="practical-card cyan">
              <div className="card-icon-wrap cyan">🔵</div>
              <div className="card-label cyan">Practical 6 · MDL501.4</div>
              <h2 className="card-title">Bluetooth Communication</h2>
              <p className="card-desc">
                Discover nearby BLE devices, study pairing and connection behaviour, and range-test
                the link — fitting how the Bluetooth signal falls with distance.
              </p>
              <div className="card-tags">
                <span className="tag">BLE Discovery</span>
                <span className="tag">Pairing</span>
                <span className="tag">Range Test</span>
                <span className="tag">RSSI vs Distance</span>
                <span className="tag">Path-Loss Fit</span>
              </div>
              <span className="card-cta cyan">Launch Experiment →</span>
            </Link>

            {/* Practical 7 */}
            <Link to="/practical7" className="practical-card violet">
              <div className="card-icon-wrap violet">🧱</div>
              <div className="card-label violet">Practical 7 · MDL501.5</div>
              <h2 className="card-title">Path Loss vs Obstacles</h2>
              <p className="card-desc">
                Log the Bluetooth RSSI as walls, doors and bodies are added between the devices, and
                measure the per-obstacle attenuation and indoor path-loss exponent.
              </p>
              <div className="card-tags">
                <span className="tag">RSSI vs Obstacles</span>
                <span className="tag">Attenuation (dB)</span>
                <span className="tag">Per-Obstacle Loss</span>
                <span className="tag">Path-Loss Exponent</span>
                <span className="tag">Indoor Model</span>
              </div>
              <span className="card-cta violet">Launch Experiment →</span>
            </Link>

            {/* Practical 8 */}
            <Link to="/practical8" className="practical-card cyan">
              <div className="card-icon-wrap cyan" style={{ background: 'var(--cyan-dim)', boxShadow: '0 0 20px var(--cyan-glow)' }}>🌊</div>
              <div className="card-label cyan" style={{ color: 'var(--cyan)' }}>Practical 8 · MDL501.5</div>
              <h2 className="card-title">Analysis of Multipath Effects</h2>
              <p className="card-desc">
                Record live Wi-Fi signal fluctuation (fading) caused by multipath propagation. Test stationary vs moving scenarios and compare the amplitude distribution to a Rayleigh model fitted to your own data.
              </p>
              <div className="card-tags">
                <span className="tag">Fast Fading</span>
                <span className="tag">Std Dev (σ)</span>
                <span className="tag">Crossing Rate</span>
                <span className="tag">Coherence Time</span>
                <span className="tag">Rayleigh Fit</span>
              </div>
              <span className="card-cta cyan" style={{ color: 'var(--cyan)' }}>Launch Experiment →</span>
            </Link>

            {/* Practical 9 */}
            <Link to="/practical9" className="practical-card cyan">
              <div className="card-icon-wrap cyan" style={{ background: 'var(--cyan-dim)', boxShadow: '0 0 20px var(--cyan-glow)' }}>📻</div>
              <div className="card-label cyan" style={{ color: 'var(--cyan)' }}>Practical 9 · MDL501.6</div>
              <h2 className="card-title">Noise &amp; Interference Analysis</h2>
              <p className="card-desc">
                Scan the real access points around you to analyze channel congestion. Quantify Signal-to-Noise (SNR) and Signal-to-Interference (SIR/SINR) ratios, and compute the theoretical Shannon capacity.
              </p>
              <div className="card-tags">
                <span className="tag">Noise Floor</span>
                <span className="tag">Co-channel Overlap</span>
                <span className="tag">SNR / SIR / SINR</span>
                <span className="tag">Shannon Capacity</span>
                <span className="tag">Channel Spectrum</span>
              </div>
              <span className="card-cta cyan" style={{ color: 'var(--cyan)' }}>Launch Experiment →</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
