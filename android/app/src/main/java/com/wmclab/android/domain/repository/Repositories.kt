package com.wmclab.android.domain.repository

import com.wmclab.android.domain.model.BtDevice
import com.wmclab.android.domain.model.DnsResult
import com.wmclab.android.domain.model.PingResult
import com.wmclab.android.domain.model.WifiConnection
import com.wmclab.android.domain.model.WifiNetwork

/**
 * Repository interfaces (domain layer). The data layer provides Android-native
 * implementations; the bridge depends only on these abstractions (DIP).
 */

interface WifiRepository {
    /** Nearby access points. Triggers a scan and returns the latest results. */
    suspend fun scan(): List<WifiNetwork>

    /** The currently-connected link, or null if Wi-Fi is off / disconnected. */
    suspend fun current(): WifiConnection?
}

interface BluetoothRepository {
    /** Discover nearby devices for [durationMs]. [le] selects LE vs Classic. */
    suspend fun scan(le: Boolean, durationMs: Long): List<BtDevice>

    /** Devices already bonded/paired with this phone. */
    suspend fun pairedDevices(): List<BtDevice>

    /** Begin bonding with a device by MAC address. Returns true if bonded/bonding. */
    suspend fun connect(address: String): Boolean

    /** Remove/cancel the bond where possible. */
    suspend fun disconnect(address: String): Boolean
}

interface NetworkRepository {
    /** ICMP ping to [host] with [count] echoes, parsed into RTT + loss stats. */
    suspend fun ping(host: String, count: Int): PingResult

    /** Resolve [host] to its IP addresses. */
    suspend fun dns(host: String): DnsResult
}
