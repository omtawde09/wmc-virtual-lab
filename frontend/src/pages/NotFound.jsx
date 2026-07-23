import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO'

const EXPERIMENTS = [
  { to: '/practical4', title: 'Wi-Fi Signal Strength vs Distance', blurb: 'Measure RSSI in dBm and analyse path loss.' },
  { to: '/practical5', title: 'Throughput and Latency', blurb: 'Ping, jitter, packet loss and speed test.' },
  { to: '/practical6', title: 'Bluetooth Discovery and Range', blurb: 'BLE scanning, pairing and range testing.' },
  { to: '/practical7', title: 'Indoor Path Loss vs Obstacles', blurb: 'Measure dB lost per wall and fit the exponent.' },
  { to: '/practical8', title: 'Multipath Fading Analysis', blurb: 'Fading depth, coherence time and Rayleigh fit.' },
  { to: '/practical9', title: 'Noise and Interference', blurb: 'SNR, SIR, SINR and channel congestion.' },
]

export default function NotFound() {
  useSEO({
    title: 'Page Not Found (404) | Wireless & Mobile Communication Virtual Lab',
    description: 'That page does not exist. Browse the Wireless & Mobile Communication experiments: Wi-Fi RSSI, throughput, Bluetooth range, path loss, multipath fading and interference.',
    path: '/404',
  })

  return (
    <main className="practical-page">
      <div className="container" style={{ maxWidth: '860px' }}>
        <div className="section-header">
          <div className="section-eyebrow">404</div>
          <h1 className="section-title">This page could not be found</h1>
          <p className="section-desc">
            The link may be mistyped or out of date. Pick an experiment below, or head back to the lab home page.
          </p>
        </div>

        <section className="glass-card content-block">
          <h2 className="content-h2">Browse the experiments</h2>
          <div className="related-grid">
            {EXPERIMENTS.map(e => (
              <Link to={e.to} className="related-card" key={e.to}>
                <strong>{e.title}</strong>
                <span>{e.blurb}</span>
                <em>Open experiment →</em>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: '22px' }}>
            <Link to="/" className="btn btn-primary btn-sm">← Back to home</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
