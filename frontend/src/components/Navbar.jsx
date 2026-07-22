import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-logo">
          <div className="navbar-logo-icon">📡</div>
          <span className="navbar-logo-text">
            <span className="brand-l1">Wireless &amp; Mobile</span>
            <span className="brand-l2">Communication</span>
          </span>
        </NavLink>

        <ul className="navbar-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              🏠 <span className="nav-text">Home</span>
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
