package com.wmclab.android.data.wifi

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import com.wmclab.android.domain.model.WifiConnection
import com.wmclab.android.domain.model.WifiNetwork
import com.wmclab.android.domain.repository.WifiRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.roundToInt

/**
 * Wi-Fi via [WifiManager] — the Android equivalent of the Windows `netsh wlan`
 * layer. All data is real hardware measurement (RSSI, frequency, link speed).
 *
 * Limitation: Android throttles [WifiManager.startScan] to ~4 calls / 2 min for
 * foreground apps (API 28+). When a fresh scan is throttled we transparently
 * fall back to the most recent cached results rather than returning nothing.
 */
class WifiRepositoryImpl(
    private val context: Context,
) : WifiRepository {

    private val wifi: WifiManager
        get() = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    @SuppressLint("MissingPermission")
    override suspend fun scan(): List<WifiNetwork> = withContext(Dispatchers.IO) {
        val connectedBssid = currentBssidOrNull()

        // Kick a scan and wait briefly for SCAN_RESULTS_AVAILABLE. If the OS
        // throttles us (startScan == false) we skip the wait and read the cache.
        val started = try {
            wifi.startScan()
        } catch (_: SecurityException) {
            false
        }

        if (started) {
            withTimeoutOrNull(SCAN_TIMEOUT_MS) { awaitScanBroadcast() }
        }

        readResults(connectedBssid)
    }

    @SuppressLint("MissingPermission")
    private fun readResults(connectedBssid: String?): List<WifiNetwork> = try {
        wifi.scanResults
            .filter { it.BSSID != null }
            .map { r ->
                @Suppress("DEPRECATION")
                val ssid = r.SSID?.takeIf { it.isNotBlank() } ?: "<hidden>"
                WifiNetwork(
                    ssid = ssid,
                    bssid = r.BSSID,
                    rssi = r.level,
                    signalPct = rssiToPercent(r.level),
                    channel = frequencyToChannel(r.frequency),
                    frequencyMhz = r.frequency,
                    connected = r.BSSID.equals(connectedBssid, ignoreCase = true),
                )
            }
            .sortedByDescending { it.rssi }
    } catch (_: SecurityException) {
        emptyList()
    }

    @SuppressLint("MissingPermission")
    override suspend fun current(): WifiConnection? = withContext(Dispatchers.IO) {
        @Suppress("DEPRECATION")
        val info = try {
            wifi.connectionInfo
        } catch (_: SecurityException) {
            null
        } ?: return@withContext null

        // RSSI is NOT location-redacted, so it's the reliable "connected" signal
        // even when SSID/BSSID/networkId are hidden (Location services off).
        // WifiInfo.INVALID_RSSI == -127.
        val rssi = info.rssi
        if (rssi == -127) return@withContext null

        @Suppress("DEPRECATION")
        val ssid = info.ssid?.trim('"')
            ?.takeIf { it.isNotBlank() && it != "<unknown ssid>" }
            ?: "(SSID hidden — turn on Location)"
        val bssid = info.bssid?.takeIf { it != "02:00:00:00:00:00" } ?: ""

        @Suppress("DEPRECATION")
        val frequency = info.frequency
        WifiConnection(
            ssid = ssid,
            bssid = bssid,
            rssi = rssi,
            signalPct = rssiToPercent(rssi),
            channel = frequencyToChannel(frequency),
            frequencyMhz = frequency,
            linkSpeedMbps = info.linkSpeed,
            connected = true,
        )
    }

    @SuppressLint("MissingPermission")
    private fun currentBssidOrNull(): String? = try {
        @Suppress("DEPRECATION")
        wifi.connectionInfo?.bssid
    } catch (_: SecurityException) {
        null
    }

    private suspend fun awaitScanBroadcast(): Unit = suspendCancellableCoroutine { cont ->
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                context.applicationContext.unregisterReceiver(this)
                if (cont.isActive) cont.resume(Unit)
            }
        }
        val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        context.applicationContext.registerReceiver(receiver, filter)
        cont.invokeOnCancellation {
            runCatching { context.applicationContext.unregisterReceiver(receiver) }
        }
    }

    private companion object {
        const val SCAN_TIMEOUT_MS = 8_000L

        /**
         * RSSI (dBm) → percentage over the −100…−30 dBm span, matching the scale
         * the rest of the lab uses.
         *
         * The obvious `2*(rssi+100)` (the Windows "signal quality" scale) tops out
         * at 100% for anything stronger than −50 dBm, so indoor readings all
         * reported 100% and the Signal-% chart drew as a flat line. It also
         * disagreed with the Windows build for the same measurement.
         */
        fun rssiToPercent(rssi: Int): Int =
            (((rssi + 100) / 70.0) * 100).roundToInt().coerceIn(0, 100)

        /** Convert a centre frequency (MHz) to a Wi-Fi channel number. */
        fun frequencyToChannel(freq: Int): Int = when {
            freq == 2484 -> 14
            freq in 2412..2472 -> (freq - 2407) / 5
            freq in 5160..5885 -> (freq - 5000) / 5
            freq in 5955..7115 -> (freq - 5950) / 5   // 6 GHz (Wi-Fi 6E)
            else -> 0
        }
    }
}
