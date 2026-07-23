import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import PrivacyModal from './components/PrivacyModal'
import Home from './pages/Home'
import Practical4 from './pages/Practical4'
import Practical5 from './pages/Practical5'
import Practical6 from './pages/Practical6'
import Practical7 from './pages/Practical7'
import Practical8 from './pages/Practical8'
import Practical9 from './pages/Practical9'
import { resetAllOnce } from './resetOnLoad'

export default function App() {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const location = useLocation()

  // On every full page load (refresh), wipe all practicals' stored results.
  useEffect(() => { resetAllOnce() }, [])

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="route-fade" key={location.pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practical4" element={<Practical4 />} />
        <Route path="/practical5" element={<Practical5 />} />
        <Route path="/practical6" element={<Practical6 />} />
        <Route path="/practical7" element={<Practical7 />} />
        <Route path="/practical8" element={<Practical8 />} />
        <Route path="/practical9" element={<Practical9 />} />
      </Routes>
      </div>
      <footer className="footer">
        <div className="container">
          <div className="footer-brand">
            <span className="footer-dot" />
            Wireless &amp; Mobile Communication
          </div>
          <div className="footer-meta">Virtual Lab &nbsp;·&nbsp; 2026–27 &nbsp;·&nbsp; Experiments 4–9</div>
          <div className="footer-credits">
            Built with <span className="footer-heart">❤️</span> by{' '}
            <a href="https://github.com/omtawde09" target="_blank" rel="noopener noreferrer" className="footer-link">Om Tawde</a>,{' '}
            <a href="https://github.com/parthvarekar" target="_blank" rel="noopener noreferrer" className="footer-link">Parth Varekar</a>{' '}&amp;{' '}
            <a href="https://github.com/ishwar-prog" target="_blank" rel="noopener noreferrer" className="footer-link">Ishwar Suthar</a>
          </div>
          <a
            href="https://github.com/omtawde09/wmc-virtual-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-star"
          >
            <span className="footer-star-icon">⭐</span>
            Like this project? Star it on GitHub
          </a>
          <div className="footer-legal">
            📘 This project is an academic work, built and shared for <strong>educational purposes only</strong>,
            and is provided “as is” without warranty of any kind.
            <br />
            <button type="button" className="footer-link footer-link-btn" onClick={() => setShowPrivacy(true)}>
              Privacy Policy &amp; Disclaimer
            </button>
          </div>
        </div>
      </footer>

      <PrivacyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  )
}
