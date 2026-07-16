import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-logo">
          <div className="navbar-logo-icon">📡</div>
          <span className="navbar-logo-text">MDM <span>Practicals</span></span>
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
              <span className="nav-badge" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>P5</span>
              <span className="nav-text">Network Test</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  )
}
