import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  // Once past a small threshold, the bar collapses into a floating pill.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()  // set correct state on mount (e.g. when loaded already scrolled)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-logo">
          <img className="navbar-logo-icon" src="/logo.png" alt="" width="36" height="36" />
          <span className="navbar-logo-text">
            <span className="brand-l1">Wireless &amp; Mobile</span>
            <span className="brand-l2">Communication</span>
          </span>
        </NavLink>

        <ul className="navbar-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              {/* Stroked house icon rather than an emoji: it inherits the link
                  colour (including the active state) so it matches the theme. */}
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.9"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.2 10.4 12 3.4l8.8 7" />
                <path d="M5.6 9.3V19a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4V9.3" />
                <path d="M9.7 20.4v-5.2a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1v5.2" />
              </svg>
              <span className="nav-text">Home</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical4" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P4</span>
              <span className="nav-text">Wi-Fi RSSI</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical5" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P5</span>
              <span className="nav-text">Network Test</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical6" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P6</span>
              <span className="nav-text">Bluetooth</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical7" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P7</span>
              <span className="nav-text">Path Loss</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical8" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P8</span>
              <span className="nav-text">Multipath</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/practical9" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-badge">P9</span>
              <span className="nav-text">Noise &amp; Interf.</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  )
}
