# WMC Virtual Lab — Android

The Android app is a **WebView shell** that runs the *same* React frontend as the
Windows version. Only the hardware layer differs: the Windows `netsh/bleak/ping`
backend is replaced by **native Android APIs** exposed to the web app through a
JavaScript bridge, behind a shared `Hardware` abstraction.

```
┌──────────────────────────────────────────────────────────────┐
│  React frontend  (identical UI, routing, styling on both)     │
│     page → Hardware.scanWifi() / ping() / scanBluetooth()      │
│                        │                                       │
│         ┌──────────────┴───────────────┐                       │
│         ▼                              ▼                        │
│  fastApiAdapter (web)          nativeAdapter (Android)          │
│   axios → /api/* (FastAPI)      window.AndroidHardware.invoke() │
└─────────┬──────────────────────────────┬──────────────────────┘
          ▼                              ▼
   Windows Backend.exe            Android native (Kotlin)
   netsh / bleak / ping           WifiManager / Bluetooth / ping
```

The adapter is chosen **once at load** by feature-detecting `window.AndroidHardware`.
The frontend never branches on platform beyond that.

---

## 1. Android project layout

```
android/
 ├─ settings.gradle.kts, build.gradle.kts, gradle.properties
 ├─ gradle/libs.versions.toml           # version catalog
 └─ app/
     ├─ build.gradle.kts                # compileSdk 36, minSdk 26, targetSdk 36
     ├─ proguard-rules.pro              # keeps the @JavascriptInterface bridge
     └─ src/main/
         ├─ AndroidManifest.xml         # permissions + single activity
         ├─ assets/                     # ← copy the web build here (see below)
         ├─ res/                        # Material 3 theme, adaptive icon, colors
         └─ java/com/wmclab/android/
             ├─ WmcApplication.kt        # owns the DI container
             ├─ di/AppContainer.kt       # manual DI (lazy singletons)
             ├─ presentation/
             │   ├─ MainActivity.kt      # WebView host + asset loader + SPA fallback
             │   └─ HardwarePermissions.kt
             ├─ webview/
             │   ├─ HardwareBridge.kt    # @JavascriptInterface (window.AndroidHardware)
             │   ├─ BridgeDispatcher.kt  # method name → repository (unit-testable)
             │   └─ Mappers.kt           # domain → FastAPI-identical JSON
             ├─ domain/
             │   ├─ model/Models.kt
             │   └─ repository/Repositories.kt   # interfaces (DIP)
             └─ data/
                 ├─ wifi/WifiRepositoryImpl.kt        # WifiManager
                 ├─ bluetooth/BluetoothRepositoryImpl.kt  # Classic + LE
                 └─ network/NetworkRepositoryImpl.kt      # ping + DNS
```

Clean Architecture: **presentation → domain ← data**. The bridge depends only on
domain interfaces; Android SDK types live solely in `data/`.

---

## 2. JavaScript bridge contract

`window.AndroidHardware` (Kotlin `HardwareBridge`) exposes:

| JS call | Native method | Args (JSON) | Resolves with |
|---|---|---|---|
| `Hardware.scanWifi()` | `scanWifi` | — | `WifiNetwork[]` |
| `Hardware.currentWifi()` | `currentWifi` | — | `WifiConnection` or `{connected:false}` |
| `Hardware.scanBluetooth({le,durationMs})` | `scanBluetooth` | `{le:bool, durationMs:int}` | `BtDevice[]` |
| `Hardware.pairedDevices()` | `pairedDevices` | — | `BtDevice[]` |
| `Hardware.connect(addr)` | `connect` | `{address}` | `{success}` |
| `Hardware.disconnect(addr)` | `disconnect` | `{address}` | `{success}` |
| `Hardware.ping(host,count)` | `ping` | `{host,count}` | `PingResult` |
| `Hardware.dnsLookup(host)` | `dnsLookup` | `{host}` | `DnsResult` |

**Async protocol:** `invoke(method, argsJson, requestId)` returns immediately; the
native side runs the work on a coroutine and calls back
`window.__hwResolve(id, json)` or `window.__hwReject(id, {message})`. `nativeBridge.js`
wraps this as a Promise (with a 60 s safety timeout). JSON shapes are byte-for-byte
compatible with the FastAPI responses (see `Mappers.kt`).

---

## 3. Permissions

Requested at launch by `HardwarePermissions`, split by API level:

| Permission | Why | API |
|---|---|---|
| `ACCESS_FINE_LOCATION` | Wi-Fi/BT scanning + SSID reads | all |
| `NEARBY_WIFI_DEVICES` (`neverForLocation`) | Wi-Fi scan without location | 33+ |
| `BLUETOOTH_SCAN` (`neverForLocation`) | Classic/LE discovery | 31+ |
| `BLUETOOTH_CONNECT` | device name, bonding | 31+ |
| `INTERNET`, `ACCESS_NETWORK_STATE` | ping, DNS, speed test | all |

Location **services** must be ON for Wi-Fi/BT scans to return results (an OS rule).

---

## 4. Feature parity & documented limitations

| Feature | Android source | Limitation |
|---|---|---|
| Current Wi-Fi (RSSI/freq/channel/link speed) | `WifiManager.connectionInfo` | full parity |
| Nearby Wi-Fi scan | `startScan()` + `scanResults` | **throttled ~4 scans/2 min**; falls back to cached results |
| Ping / latency / loss / jitter | `/system/bin/ping` (ICMP), TCP fallback | full parity, unrooted |
| DNS | `InetAddress.getAllByName` | Android-only (no Windows endpoint) |
| Bluetooth Classic + LE | `BluetoothAdapter` + `BluetoothLeScanner` | full parity |
| Bluetooth bonding | `createBond()` / reflective `removeBond()` | unbond is best-effort (no public API) |
| Speed test throughput | runs in-WebView vs Cloudflare | identical on both platforms |
| Path loss / multipath / interference | shared JS calc (see §6) | computed on-device, no backend needed |
| DOCX export | — | Python-only today; regenerate in-JS for Android (§6) |

No feature returns fake data. Where Android can't measure something, the call
returns an empty/failed result with a message — never a fabricated value.

---

## 5. Build & run

1. **Bundle the web app** (see `android/app/src/main/assets/README.md`):
   ```bash
   cd frontend && npm install && npm run build
   # copy frontend/dist/* into android/app/src/main/assets/ (replace index.html)
   ```
2. **Open `android/` in Android Studio** (Ladybug or newer). Let it sync Gradle and
   install SDK 36 if prompted. If your AGP is older than 8.9, either update it or
   lower `compileSdk`/`targetSdk` to 35 in `app/build.gradle.kts`.
3. **Run** on a physical device (USB debugging on). Wi-Fi/Bluetooth need real
   hardware — the emulator can't measure RSSI.
4. **Dev loop (optional):** set `DEV_SERVER_URL` in the debug buildType to
   `http://<LAN-IP>:5173` to load the live Vite dev server instead of bundled assets.

Release: standard `Build → Generate Signed Bundle/APK`. R8 rules already keep the bridge.

---

## 6. Remaining integration work (not yet applied)

The Android **shell, bridge, and native hardware are complete**, and the frontend
`Hardware` abstraction exists. Two integration steps remain before every practical
works inside the app. These touch the *working* web frontend, so they should be done
**incrementally with device testing** (and are intentionally left un-applied here
because they can't be verified from a Windows dev box):

### 6a. Route the pages through `Hardware`
Today each page calls `axios` against `/api/*` directly. In the Android WebView there
is no FastAPI server, so those calls fail. Replace the direct calls with the facade:

```diff
- import axios from 'axios'
- const res = await axios.post(`${API}/ping`, { host, count: 4 })
- const data = res.data
+ import Hardware from '../hardware'
+ const data = await Hardware.ping(host, 4)
```

Per page: **P4** `currentWifi`/`scanWifi` (+ replace the `/ws` stream with a polling
loop on Android — `WebSocket` has no native backend), **P5** `ping` (+ speed test is
already in-WebView), **P6** `scanBluetooth`/`pairedDevices`/`connect`/`disconnect`.
Behaviour on Windows is unchanged because `fastApiAdapter` calls the same endpoints.

### 6b. Move pure calculations to shared JS
Path loss (P7), multipath (P8), interference (P9) and the Bluetooth range fit are
pure math currently in Python/numpy. Port them into `frontend/src/calc/*` so both
platforms share one implementation and Android needs no backend for them. Keep the
Windows backend calling its Python version until the JS port is validated to match,
then switch the pages to the shared module. **Do not invent the formulas** — port
them faithfully from `backend/{interference_analyzer,multipath_analyzer,bluetooth_pathloss}.py`.

### 6c. DOCX export on Android
`python-docx` can't run on-device. Either generate the document client-side (e.g.
`docx` JS library) behind `Hardware.platform === 'android'`, or keep export as a
Windows-only feature. Recommended: client-side generation so it works everywhere.

---

## 7. Build environment note (this machine)

This laptop runs **Avast**, which TLS-intercepts HTTPS with its own root CA. The
JBR's truststore doesn't trust it, so Gradle downloads fail with a PKIX error
(while `curl`/Android Studio work, using the Windows store). The fix, already
applied:

- `android/gradle/cacerts` — a copy of the JBR truststore with Avast's root merged in.
- `android/gradle.properties` points Gradle at it via `-Djavax.net.ssl.trustStore=…`.

On a machine **without** Avast, delete those two `trustStore` args from
`gradle.properties`. The `gradle/cacerts` file and the absolute path are
machine-specific — do not commit them to a shared repo without adjusting.

CLI build (verified working):
```bash
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" \
GRADLE_OPTS="-Djavax.net.ssl.trustStore=$PWD/gradle/cacerts -Djavax.net.ssl.trustStorePassword=changeit" \
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## 8. Status

- ✅ Android Studio project, Gradle, Material 3, permissions, WebView + asset loader
- ✅ JS bridge (async, typed, FastAPI-identical JSON)
- ✅ Native Wi-Fi, Bluetooth (Classic + LE), ping, DNS repositories (MVVM/Repository/DI)
- ✅ Frontend `Hardware` abstraction (native + FastAPI adapters, auto-detected)
- ✅ **`./gradlew assembleDebug` builds a working `app-debug.apk`** (verified on this machine)
- ✅ Frontend build bundled into `assets/` (UI loads in the WebView)
- ⏳ Page rewiring through `Hardware` (§6a) — needs on-device testing
- ⏳ Calculations ported to shared JS (§6b)
- ⏳ DOCX export path for Android (§6c)
