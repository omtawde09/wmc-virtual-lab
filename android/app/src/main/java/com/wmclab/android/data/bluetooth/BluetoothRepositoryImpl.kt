package com.wmclab.android.data.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.wmclab.android.domain.model.BtDevice
import com.wmclab.android.domain.model.BtKind
import com.wmclab.android.domain.repository.BluetoothRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Bluetooth via [BluetoothAdapter] and the LE scanner — the Android equivalent
 * of the Windows `bleak` layer. Real RSSI is captured from discovery broadcasts
 * (Classic, [BluetoothDevice.EXTRA_RSSI]) and LE advertisements ([ScanResult.getRssi]).
 *
 * Limitation: unbonding has no public API, so [disconnect] uses a best-effort
 * reflective `removeBond`; if the OEM blocks it we report failure rather than fake it.
 */
class BluetoothRepositoryImpl(
    private val context: Context,
) : BluetoothRepository {

    private val adapter: BluetoothAdapter?
        get() = (context.applicationContext
            .getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager)
            ?.adapter

    @SuppressLint("MissingPermission")
    override suspend fun scan(le: Boolean, durationMs: Long): List<BtDevice> =
        withContext(Dispatchers.IO) {
            val a = adapter ?: return@withContext emptyList()
            if (!a.isEnabled) return@withContext emptyList()
            try {
                if (le) scanLe(a, durationMs) else scanClassic(a, durationMs)
            } catch (_: SecurityException) {
                emptyList()
            }
        }

    @SuppressLint("MissingPermission")
    private suspend fun scanClassic(a: BluetoothAdapter, durationMs: Long): List<BtDevice> {
        val found = ConcurrentHashMap<String, BtDevice>()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                if (intent?.action != BluetoothDevice.ACTION_FOUND) return
                @Suppress("DEPRECATION")
                val device: BluetoothDevice =
                    intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE) ?: return
                val rssi = intent
                    .getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE)
                    .toInt()
                    .takeIf { it != Short.MIN_VALUE.toInt() }
                found[device.address] = device.toDomain(BtKind.CLASSIC, rssi, null)
            }
        }
        context.applicationContext.registerReceiver(
            receiver, IntentFilter(BluetoothDevice.ACTION_FOUND),
        )
        try {
            a.startDiscovery()
            delay(durationMs)
        } finally {
            runCatching { a.cancelDiscovery() }
            runCatching { context.applicationContext.unregisterReceiver(receiver) }
        }
        return found.values.sortedByDescending { it.rssi ?: Int.MIN_VALUE }
    }

    @SuppressLint("MissingPermission")
    private suspend fun scanLe(a: BluetoothAdapter, durationMs: Long): List<BtDevice> {
        val scanner = a.bluetoothLeScanner ?: return emptyList()
        val found = ConcurrentHashMap<String, BtDevice>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val tx = result.scanRecord?.txPowerLevel
                    ?.takeIf { it != Int.MIN_VALUE }
                found[result.device.address] =
                    result.device.toDomain(BtKind.LE, result.rssi, tx)
            }
        }
        try {
            scanner.startScan(callback)
            delay(durationMs)
        } finally {
            runCatching { scanner.stopScan(callback) }
        }
        return found.values.sortedByDescending { it.rssi ?: Int.MIN_VALUE }
    }

    @SuppressLint("MissingPermission")
    override suspend fun pairedDevices(): List<BtDevice> = withContext(Dispatchers.IO) {
        val a = adapter ?: return@withContext emptyList()
        try {
            a.bondedDevices.orEmpty().map { it.toDomain(BtKind.CLASSIC, null, null) }
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    @SuppressLint("MissingPermission")
    override suspend fun connect(address: String): Boolean = withContext(Dispatchers.IO) {
        val a = adapter ?: return@withContext false
        try {
            val device = a.getRemoteDevice(address)
            if (device.bondState == BluetoothDevice.BOND_BONDED) true
            else device.createBond()
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun disconnect(address: String): Boolean = withContext(Dispatchers.IO) {
        val a = adapter ?: return@withContext false
        try {
            val device = a.getRemoteDevice(address)
            // No public unbond API — reflective best effort.
            val method = device.javaClass.getMethod("removeBond")
            (method.invoke(device) as? Boolean) ?: false
        } catch (_: Exception) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    private fun BluetoothDevice.toDomain(kind: BtKind, rssi: Int?, tx: Int?): BtDevice {
        val safeName = try { name } catch (_: SecurityException) { null }
        val bonded = try { bondState == BluetoothDevice.BOND_BONDED } catch (_: SecurityException) { false }
        return BtDevice(
            name = safeName,
            address = address,
            rssi = rssi,
            txPower = tx,
            kind = kind,
            bonded = bonded,
            vendor = null, // OUI vendor lookup intentionally omitted (no bundled DB)
        )
    }
}
