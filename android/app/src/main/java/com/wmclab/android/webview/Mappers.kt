package com.wmclab.android.webview

import com.wmclab.android.domain.model.BtDevice
import com.wmclab.android.domain.model.BtKind
import com.wmclab.android.domain.model.DnsResult
import com.wmclab.android.domain.model.PingResult
import com.wmclab.android.domain.model.WifiConnection
import com.wmclab.android.domain.model.WifiNetwork
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Maps domain models to the JSON shapes the Windows FastAPI backend returns, so
 * the shared web frontend consumes native results without any platform branching.
 * org.json is used deliberately: it is built into Android (zero extra deps).
 */
object Mappers {

    private fun nowIso(): String = Instant.now().toString()

    fun wifiNetwork(n: WifiNetwork): JSONObject = JSONObject().apply {
        put("ssid", n.ssid)
        put("bssid", n.bssid)
        put("rssi", n.rssi)
        put("signal_pct", n.signalPct)
        put("channel", n.channel)
        put("frequency", n.frequencyMhz)
        put("connected", n.connected)
    }

    fun wifiNetworks(list: List<WifiNetwork>): JSONArray =
        JSONArray().apply { list.forEach { put(wifiNetwork(it)) } }

    fun wifiConnection(c: WifiConnection?): Any = c?.let {
        JSONObject().apply {
            put("ssid", it.ssid)
            put("bssid", it.bssid)
            put("rssi", it.rssi)
            put("signal_pct", it.signalPct)
            put("channel", it.channel)
            put("frequency", it.frequencyMhz)
            put("link_speed_mbps", it.linkSpeedMbps)
            put("connected", true)
            put("timestamp", nowIso())
        }
    } ?: JSONObject().apply {
        put("connected", false)
        put("message", "Not connected to any Wi-Fi network.")
    }

    fun btDevice(d: BtDevice): JSONObject = JSONObject().apply {
        put("name", d.name ?: JSONObject.NULL)
        put("address", d.address)
        put("rssi", d.rssi ?: JSONObject.NULL)
        put("tx_power", d.txPower ?: JSONObject.NULL)
        put("kind", if (d.kind == BtKind.LE) "le" else "classic")
        put("bonded", d.bonded)
        put("vendor", d.vendor ?: JSONObject.NULL)
        put("timestamp", nowIso())
    }

    fun btDevices(list: List<BtDevice>): JSONArray =
        JSONArray().apply { list.forEach { put(btDevice(it)) } }

    fun ping(r: PingResult): JSONObject = JSONObject().apply {
        put("success", r.success)
        put("host", r.host)
        put("sent", r.sent)
        put("received", r.received)
        put("lost", r.lost)
        put("packet_loss", r.packetLoss)
        put("min_rtt", r.minRtt)
        put("max_rtt", r.maxRtt)
        put("avg_rtt", r.avgRtt)
        put("jitter", r.jitter)
        put("times", JSONArray(r.times))
        put("timestamp", nowIso())
        if (r.error != null) put("error", r.error)
    }

    fun dns(r: DnsResult): JSONObject = JSONObject().apply {
        put("host", r.host)
        put("addresses", JSONArray(r.addresses))
        put("success", r.success)
        if (r.error != null) put("error", r.error)
    }

    fun ok(success: Boolean): JSONObject = JSONObject().put("success", success)
}
