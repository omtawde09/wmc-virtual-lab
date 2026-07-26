package com.wmclab.android.webview

import com.wmclab.android.domain.repository.BluetoothRepository
import com.wmclab.android.domain.repository.NetworkRepository
import com.wmclab.android.domain.repository.WifiRepository
import org.json.JSONObject

/**
 * Routes a Hardware-API method name to the matching repository call and returns
 * the JSON string the web frontend expects. Pure orchestration — no Android SDK
 * types here, so it is unit-testable with fake repositories.
 *
 * This is the single source of truth for the native side of the Hardware
 * contract; the JS `nativeAdapter` mirrors these method names.
 */
class BridgeDispatcher(
    private val wifi: WifiRepository,
    private val bluetooth: BluetoothRepository,
    private val network: NetworkRepository,
) {

    /** @return JSON string result. Throws on unknown method / bad args. */
    suspend fun dispatch(method: String, argsJson: String): String {
        val args = if (argsJson.isBlank()) JSONObject() else JSONObject(argsJson)
        return when (method) {
            "scanWifi" -> Mappers.wifiNetworks(wifi.scan()).toString()

            "currentWifi" -> Mappers.wifiConnection(wifi.current()).toString()

            "scanBluetooth" -> {
                val le = args.optBoolean("le", false)
                val duration = args.optLong("durationMs", DEFAULT_BT_SCAN_MS)
                Mappers.btDevices(bluetooth.scan(le, duration)).toString()
            }

            "pairedDevices" -> Mappers.btDevices(bluetooth.pairedDevices()).toString()

            "connect" -> Mappers.ok(bluetooth.connect(args.requireString("address"))).toString()

            "disconnect" -> Mappers.ok(bluetooth.disconnect(args.requireString("address"))).toString()

            "ping" -> {
                val host = args.optString("host", "8.8.8.8").ifBlank { "8.8.8.8" }
                val count = args.optInt("count", 4).coerceIn(1, 20)
                Mappers.ping(network.ping(host, count)).toString()
            }

            "dnsLookup" -> Mappers.dns(network.dns(args.requireString("host"))).toString()

            else -> throw IllegalArgumentException("Unknown hardware method: $method")
        }
    }

    private fun JSONObject.requireString(key: String): String {
        val v = optString(key, "")
        require(v.isNotBlank()) { "Missing required argument '$key'." }
        return v
    }

    private companion object {
        const val DEFAULT_BT_SCAN_MS = 8_000L
    }
}
