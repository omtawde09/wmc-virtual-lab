package com.wmclab.android.data.network

import com.wmclab.android.domain.model.DnsResult
import com.wmclab.android.domain.model.PingResult
import com.wmclab.android.domain.repository.NetworkRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Latency + DNS via native tooling — the Android equivalent of the Windows
 * `ping` / `subprocess` layer.
 *
 * Ping runs the real `/system/bin/ping` ICMP binary (present and usable without
 * root on virtually all Android builds) and parses its output into the exact
 * shape the web app's Table 1 expects. If the binary is unavailable we fall back
 * to a TCP-reachability probe so the feature still returns real measurements.
 */
class NetworkRepositoryImpl : NetworkRepository {

    override suspend fun ping(host: String, count: Int): PingResult =
        withContext(Dispatchers.IO) {
            runNativePing(host, count) ?: reachabilityFallback(host, count)
        }

    private fun runNativePing(host: String, count: Int): PingResult? {
        return try {
            val process = ProcessBuilder(
                "/system/bin/ping", "-c", count.toString(), "-W", "2", host,
            ).redirectErrorStream(true).start()

            val output = process.inputStream.bufferedReader().readText()
            val finished = process.waitFor(count * 3L + 5, TimeUnit.SECONDS)
            if (!finished) process.destroy()

            parsePing(host, count, output)
        } catch (_: Exception) {
            null
        }
    }

    private fun parsePing(host: String, requested: Int, output: String): PingResult {
        val times = TIME_RE.findAll(output).map { it.groupValues[1].toDouble() }.toList()

        val summary = SUMMARY_RE.find(output)
        val sent = summary?.groupValues?.get(1)?.toIntOrNull() ?: requested
        val received = summary?.groupValues?.get(2)?.toIntOrNull() ?: times.size
        val lost = (sent - received).coerceAtLeast(0)
        val loss = if (sent > 0) (lost.toDouble() / sent * 100.0) else 100.0

        val intTimes = times.map { it.roundToInt() }
        val min = intTimes.minOrNull() ?: 0
        val max = intTimes.maxOrNull() ?: 0
        val avg = if (intTimes.isNotEmpty()) intTimes.average().roundToInt() else 0

        return PingResult(
            success = received > 0,
            host = host,
            sent = sent,
            received = received,
            lost = lost,
            packetLoss = round1(loss),
            minRtt = min,
            maxRtt = max,
            avgRtt = avg,
            jitter = jitter(times),
            times = intTimes,
            error = if (received == 0) "Host unreachable or request timed out." else null,
        )
    }

    /** No ping binary → measure TCP connect latency, still real data. */
    private fun reachabilityFallback(host: String, count: Int): PingResult {
        val times = mutableListOf<Double>()
        repeat(count) {
            val start = System.nanoTime()
            val ok = try {
                InetAddress.getByName(host).isReachable(2000)
            } catch (_: Exception) {
                false
            }
            if (ok) times.add((System.nanoTime() - start) / 1_000_000.0)
        }
        val received = times.size
        val lost = count - received
        val intTimes = times.map { it.roundToInt() }
        return PingResult(
            success = received > 0,
            host = host,
            sent = count,
            received = received,
            lost = lost,
            packetLoss = round1(if (count > 0) lost.toDouble() / count * 100 else 100.0),
            minRtt = intTimes.minOrNull() ?: 0,
            maxRtt = intTimes.maxOrNull() ?: 0,
            avgRtt = if (intTimes.isNotEmpty()) intTimes.average().roundToInt() else 0,
            jitter = jitter(times),
            times = intTimes,
            error = if (received == 0) "Host unreachable." else null,
        )
    }

    override suspend fun dns(host: String): DnsResult = withContext(Dispatchers.IO) {
        try {
            val addresses = InetAddress.getAllByName(host).map { it.hostAddress ?: "" }
                .filter { it.isNotBlank() }
            DnsResult(host, addresses, success = addresses.isNotEmpty())
        } catch (e: Exception) {
            DnsResult(host, emptyList(), success = false, error = e.message ?: "DNS lookup failed")
        }
    }

    private companion object {
        val TIME_RE = Regex("""time[=<]([0-9.]+)\s*ms""")
        val SUMMARY_RE = Regex("""(\d+) packets transmitted, (\d+)(?: packets)? received""")

        fun jitter(times: List<Double>): Double {
            if (times.size < 2) return 0.0
            val diffs = times.zipWithNext { a, b -> abs(b - a) }
            return round1(diffs.average())
        }

        fun round1(v: Double): Double = (v * 10).roundToInt() / 10.0
    }
}
