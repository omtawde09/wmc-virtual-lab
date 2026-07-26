package com.wmclab.android.domain.model

/**
 * Domain models for the hardware layer.
 *
 * Field names are chosen so the JSON produced by [com.wmclab.android.webview.Mappers]
 * matches, one-to-one, the shapes the Windows FastAPI backend returns. That parity
 * is what lets the shared web frontend render identically on both platforms.
 */

/** A nearby Wi-Fi access point (Practical 4 scan). */
data class WifiNetwork(
    val ssid: String,
    val bssid: String,
    val rssi: Int,          // dBm
    val signalPct: Int,     // 0..100
    val channel: Int,
    val frequencyMhz: Int,
    val connected: Boolean,
)

/** The currently-connected Wi-Fi link (Practical 4 current / readings). */
data class WifiConnection(
    val ssid: String,
    val bssid: String,
    val rssi: Int,
    val signalPct: Int,
    val channel: Int,
    val frequencyMhz: Int,
    val linkSpeedMbps: Int,
    val connected: Boolean,
)

enum class BtKind { CLASSIC, LE }

/** A discovered or paired Bluetooth device (Practical 6). */
data class BtDevice(
    val name: String?,
    val address: String,
    val rssi: Int?,         // dBm, null when not reported (e.g. paired list)
    val txPower: Int?,      // dBm, LE advertisement only
    val kind: BtKind,
    val bonded: Boolean,
    val vendor: String?,
)

/** Result of a command-line style ping (Practical 5, Table 1). */
data class PingResult(
    val success: Boolean,
    val host: String,
    val sent: Int,
    val received: Int,
    val lost: Int,
    val packetLoss: Double,   // percent
    val minRtt: Int,
    val maxRtt: Int,
    val avgRtt: Int,
    val jitter: Double,
    val times: List<Int>,
    val error: String? = null,
)

/** DNS resolution result (Practical 5). */
data class DnsResult(
    val host: String,
    val addresses: List<String>,
    val success: Boolean,
    val error: String? = null,
)
