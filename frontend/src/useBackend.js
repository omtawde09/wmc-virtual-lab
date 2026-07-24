import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from './config'

// Where the backend .exe is downloaded from. Point this at your GitHub Release
// asset once you publish it (Releases -> upload WMC-Lab-Backend.exe).
export const BACKEND_DOWNLOAD_URL =
  'https://github.com/omtawde09/wmc-virtual-lab/releases/latest/download/WMC-Lab-Backend.exe'

// Only meaningful in the deployed build, where API_BASE points at localhost.
// In dev (API_BASE === '') the backend is proxied and always "there".
export const NEEDS_LOCAL_BACKEND = API_BASE !== ''

/**
 * Polls the local backend's /health endpoint so the UI can show whether the
 * downloadable .exe is running. Returns 'checking' | 'online' | 'offline'.
 */
export function useBackendStatus(intervalMs = 4000) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let alive = true
    const ping = async () => {
      try {
        await axios.get('/health', { timeout: 2500 })
        if (alive) setStatus('online')
      } catch {
        if (alive) setStatus('offline')
      }
    }
    ping()
    const id = setInterval(ping, intervalMs)
    return () => { alive = false; clearInterval(id) }
  }, [intervalMs])

  return status
}
