import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Practical4 from './pages/Practical4'
import Practical5 from './pages/Practical5'
import Practical8 from './pages/Practical8'
import Practical9 from './pages/Practical9'

export default function App() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practical4" element={<Practical4 />} />
        <Route path="/practical5" element={<Practical5 />} />
        <Route path="/practical8" element={<Practical8 />} />
        <Route path="/practical9" element={<Practical9 />} />
      </Routes>
      <footer className="footer">
        <div className="container">
          MDM Practicals 2026-27 &nbsp;·&nbsp; Experiments 4, 5, 8 &amp; 9 &nbsp;·&nbsp; Built with FastAPI + React
        </div>
      </footer>
    </div>
  )
}
