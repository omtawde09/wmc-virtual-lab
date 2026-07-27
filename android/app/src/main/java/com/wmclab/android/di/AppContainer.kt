package com.wmclab.android.di

import android.content.Context
import com.wmclab.android.data.bluetooth.BluetoothRepositoryImpl
import com.wmclab.android.data.files.FileSaver
import com.wmclab.android.data.network.NetworkRepositoryImpl
import com.wmclab.android.data.wifi.WifiRepositoryImpl
import com.wmclab.android.domain.repository.BluetoothRepository
import com.wmclab.android.domain.repository.NetworkRepository
import com.wmclab.android.domain.repository.WifiRepository
import com.wmclab.android.webview.BridgeDispatcher

/**
 * Manual dependency container (constructor injection + lazy singletons).
 *
 * Chosen over a DI framework deliberately: the graph is tiny and this keeps the
 * first build friction-free (no kapt/ksp/Hilt setup). Swapping in Hilt later is
 * mechanical because every dependency is already an interface with a single impl.
 */
class AppContainer(context: Context) {

    private val app = context.applicationContext

    val wifiRepository: WifiRepository by lazy { WifiRepositoryImpl(app) }
    val bluetoothRepository: BluetoothRepository by lazy { BluetoothRepositoryImpl(app) }
    val networkRepository: NetworkRepository by lazy { NetworkRepositoryImpl() }
    val fileSaver: FileSaver by lazy { FileSaver(app) }

    val bridgeDispatcher: BridgeDispatcher by lazy {
        BridgeDispatcher(wifiRepository, bluetoothRepository, networkRepository, fileSaver)
    }
}
