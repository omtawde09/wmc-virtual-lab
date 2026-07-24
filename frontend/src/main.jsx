import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import App from './App.jsx'
import { API_BASE } from './config'
import './index.css'

// Every relative axios call ('/api/...') is prefixed with this base. Empty in
// dev (Vite proxy), http://localhost:8000 in the production build so the
// deployed page reaches the local backend .exe.
axios.defaults.baseURL = API_BASE

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
