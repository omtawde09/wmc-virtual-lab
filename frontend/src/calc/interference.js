/**
 * Wi-Fi noise & interference analysis — faithful JS port of
 * backend/interference_analyzer.py. Computes SNR / SIR / SINR, Shannon capacity
 * and a channel-congestion score from the real connected AP + the real nearby
 * scan. Nothing is fabricated: with no neighbours the channel is reported clean.
 */

const round = (v, d) => {
  const p = 10 ** d
  return Math.round(v * p) / p
}

// Thermal noise floor for a 20 MHz channel (kTB ≈ -101 dBm + ~7 dB NF).
const NOISE_FLOOR_DBM = -94.0

const bandFor = (channel) => (channel <= 14 ? '2.4 GHz' : '5 GHz')

/** Fractional spectral overlap between two Wi-Fi channels. */
export function channelOverlapFactor(ch1, ch2, band1, band2) {
  if (band1 !== band2) return 0.0
  if (band1.includes('5')) return ch1 === ch2 ? 1.0 : 0.0
  const diff = Math.abs(ch1 - ch2)
  return { 0: 1.0, 1: 0.8, 2: 0.5, 3: 0.2, 4: 0.05 }[diff] ?? 0.0
}

function interpretCongestion(score) {
  if (score < 3.0) return 'Low'
  if (score < 6.0) return 'Moderate'
  return 'High'
}

/**
 * @param connected  the current Wi-Fi link (from Hardware.currentWifi)
 * @param scan       nearby APs (from Hardware.scanWifi) — {bssid, rssi, channel}
 * @param nextId     record id
 */
export function analyzeInterference(connected, scan, nextId = 1) {
  const nowIso = new Date().toISOString()

  if (!connected || connected.connected === false || connected.rssi == null) {
    return {
      id: nextId,
      timestamp: nowIso,
      connected: null,
      networks: [],
      metrics: null,
      message: 'No active Wi-Fi connection detected.',
    }
  }

  const connBssid = (connected.bssid || '').toLowerCase()
  const connRssi = connected.rssi
  const connChannel = connected.channel || 0
  const connBand = bandFor(connChannel)

  // Always include the real connected AP first.
  const networks = [{
    ssid: connected.ssid || 'Unknown Network',
    bssid: connected.bssid || 'N/A',
    signal_pct: connected.signal_pct || 0,
    rssi_dbm: connRssi,
    radio_type: 'Connected',
    band: connBand,
    channel: connChannel,
  }]

  // Add real neighbouring BSSIDs from the scan (skip self + channel-less).
  for (const net of scan || []) {
    const ch = net.channel || 0
    const bssid = net.bssid || ''
    if (bssid.toLowerCase() === connBssid || ch === 0) continue
    networks.push({
      ssid: net.ssid || 'Hidden',
      bssid,
      signal_pct: net.signal_pct ?? 0,
      rssi_dbm: net.rssi,
      radio_type: 'Neighbour',
      band: bandFor(ch),
      channel: ch,
    })
  }

  // Interference power from real neighbours.
  let coChannel = 0
  let adjChannel = 0
  const pSig = 10 ** (connRssi / 10.0)
  let pInf = 0.0
  for (const net of networks) {
    if (net.bssid.toLowerCase() === connBssid) {
      net.interference_type = 'Connected'
      continue
    }
    const overlap = channelOverlapFactor(connChannel, net.channel, connBand, net.band)
    if (overlap === 1.0) {
      net.interference_type = 'Co-channel'
      coChannel++
      pInf += 10 ** (net.rssi_dbm / 10.0) * overlap
    } else if (overlap > 0.0) {
      net.interference_type = 'Adjacent'
      adjChannel++
      pInf += 10 ** (net.rssi_dbm / 10.0) * overlap
    } else {
      net.interference_type = 'None'
    }
  }

  const snrDb = connRssi - NOISE_FLOOR_DBM
  const pNoise = 10 ** (NOISE_FLOOR_DBM / 10.0)
  const sirDb = pInf > 0 ? round(10 * Math.log10(pSig / pInf), 1) : 40.0
  const sinrDb = round(10 * Math.log10(pSig / (pInf + pNoise)), 1)
  const shannon = 20.0 * Math.log2(1.0 + 10 ** (sinrDb / 10.0))
  const congestion = Math.min(10.0, round(coChannel * 1.5 + adjChannel * 0.6, 1))

  const metrics = {
    snr_db: round(snrDb, 1),
    sir_db: sirDb,
    sinr_db: sinrDb,
    noise_floor_dbm: NOISE_FLOOR_DBM,
    shannon_capacity_mbps: round(shannon, 1),
    co_channel_count: coChannel,
    adj_channel_count: adjChannel,
    congestion_score: congestion,
    congestion_level: interpretCongestion(congestion),
  }

  return {
    id: nextId,
    timestamp: nowIso,
    connected: {
      ssid: connected.ssid || 'Unknown Network',
      bssid: connected.bssid || 'N/A',
      channel: connChannel,
      rssi_dbm: connRssi,
      band: connBand,
    },
    networks,
    metrics,
  }
}
