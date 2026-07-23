import { useEffect, useRef } from 'react'

const UPDATED = '23 July 2026'

function Section({ n, title, children }) {
  return (
    <div className="policy-section">
      <h3 className="policy-heading"><span className="policy-num">{n}</span>{title}</h3>
      {children}
    </div>
  )
}

export default function PrivacyModal({ open, onClose }) {
  const cardRef = useRef(null)

  // Close on Escape, and lock background scroll while the dialog is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cardRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onClick={(e) => e.stopPropagation()}   /* don't close when clicking inside */
      >
        {/* ── Sticky header ── */}
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">🔒 Legal</div>
            <h2 className="modal-title" id="privacy-title">Privacy Policy &amp; Disclaimer</h2>
            <div className="modal-sub">Last updated: {UPDATED} · Wireless &amp; Mobile Communication Virtual Lab</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="modal-body">
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            ⚠️ <strong>Educational project.</strong> This application was built by students as
            coursework for the Wireless &amp; Mobile Communication laboratory. It is provided free of
            charge, “as is”, for learning and demonstration purposes only — it is not a commercial
            product, not a certified measurement instrument, and must not be relied upon for
            professional, regulatory, safety-critical or legal purposes.
          </div>

          <Section n="1" title="Purpose & Scope">
            <p>
              The Wireless &amp; Mobile Communication Virtual Lab (“the Application”) is an academic
              project created to demonstrate wireless networking concepts — Wi-Fi signal strength,
              network throughput and latency, Bluetooth discovery and range, indoor path loss,
              multipath fading, and radio interference. It is intended solely for educational and
              research use in a controlled laboratory setting.
            </p>
          </Section>

          <Section n="2" title="Information We Collect">
            <p>
              <strong>We do not collect, transmit, sell, or share any personal information.</strong>{' '}
              The Application has no user accounts, no sign-up, no tracking cookies, no analytics, and
              no advertising. We operate no server that receives your data.
            </p>
            <p>To perform its experiments the Application reads the following <em>locally</em>:</p>
            <ul className="policy-list">
              <li>Wi-Fi adapter status reported by your operating system (network name, signal strength, channel, BSSID).</li>
              <li>Publicly broadcast Bluetooth Low Energy advertisements from nearby devices (address, advertised name, signal strength).</li>
              <li>Network performance measurements you explicitly start (ping round-trip time, throughput).</li>
            </ul>
          </Section>

          <Section n="3" title="How Your Data Is Handled">
            <p>
              All readings are processed on your own computer and held only in temporary memory for
              the duration of your session. <strong>Nothing is written to a database, and nothing is
              uploaded to us.</strong> Recorded measurements are automatically discarded when you
              refresh or close the page, and can be cleared any time via the “Clear” controls.
            </p>
          </Section>

          <Section n="4" title="Third-Party Services">
            <p>
              The throughput test in Practical 5 measures your connection against{' '}
              <strong>Cloudflare’s public speed-test endpoints</strong>, and may fall back to Ookla’s
              Speedtest service. These requests are initiated only when you press “GO”, and are subject
              to those providers’ own privacy policies. No identifying information is added by us. All
              other experiments run entirely against your own hardware.
            </p>
          </Section>

          <Section n="5" title="Responsible Use of Scanning Features">
            <p>
              Wi-Fi and Bluetooth scanning only observe information that nearby devices already
              broadcast publicly; the Application does not connect to, access, decrypt, or interfere
              with any third-party device or network. Bluetooth pairing is always performed by your
              operating system and requires your explicit confirmation.
            </p>
            <p>
              You are responsible for using these features lawfully. Scan only your own devices and
              networks, or those you have permission to test, and comply with all applicable local
              laws, institutional policies, and radio regulations.
            </p>
          </Section>

          <Section n="6" title="Accuracy & No Warranty">
            <p>
              Measurements are derived from consumer hardware and operating-system APIs and are
              approximate. Radio conditions, drivers, antenna orientation and interference all affect
              results. The Application is provided <strong>“as is” and “as available”, without warranty
              of any kind</strong>, express or implied, including warranties of merchantability, fitness
              for a particular purpose, accuracy, and non-infringement.
            </p>
          </Section>

          <Section n="7" title="Limitation of Liability">
            <p>
              To the fullest extent permitted by applicable law, the authors and contributors shall not
              be liable for any direct, indirect, incidental, special, consequential or exemplary
              damages — including loss of data, equipment, profits, or goodwill — arising out of or in
              connection with the use of, or inability to use, this Application, even if advised of the
              possibility of such damages. You use it entirely at your own risk.
            </p>
          </Section>

          <Section n="8" title="Intellectual Property">
            <p>
              This is an open-source academic project. Product names, trademarks and brands referenced
              (including any Wi-Fi network or Bluetooth device names detected on your system) are the
              property of their respective owners and are shown only as measured technical data. No
              affiliation or endorsement is implied.
            </p>
          </Section>

          <Section n="9" title="Changes to This Policy">
            <p>
              As an evolving academic project, this policy may be updated. Any revision will be
              reflected by the “Last updated” date above.
            </p>
          </Section>

          <Section n="10" title="Contact">
            <p>
              For questions about this project or policy, please open an issue on the{' '}
              <a href="https://github.com/omtawde09/wmc-virtual-lab" target="_blank" rel="noopener noreferrer" className="footer-link">
                project repository
              </a>.
            </p>
          </Section>

          <div className="divider" />
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <strong>Note:</strong> This document is a general statement of practice for a student
            project and is provided for transparency — it is not legal advice. If this project is ever
            deployed publicly or used beyond coursework, its authors should seek qualified legal
            guidance appropriate to their jurisdiction.
          </p>
        </div>

        {/* ── Sticky footer ── */}
        <div className="modal-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
