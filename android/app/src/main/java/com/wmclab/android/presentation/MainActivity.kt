package com.wmclab.android.presentation

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.wmclab.android.BuildConfig
import com.wmclab.android.WmcApplication
import com.wmclab.android.webview.HardwareBridge

/**
 * Single-activity WebView host. It:
 *  - serves the bundled web build over https via [WebViewAssetLoader] (so React
 *    Router client-side routing works, with an index.html fallback),
 *  - exposes the native Hardware bridge as `window.AndroidHardware`,
 *  - requests the runtime permissions the hardware features need.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val assetLoader: WebViewAssetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            // The web UI degrades gracefully per feature; nothing to do here beyond
            // letting the user retry a scan after granting. Denials are surfaced by
            // the individual features returning empty results.
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        attachHardwareBridge()
        registerBackNavigation()
        requestHardwarePermissions()

        val devUrl = BuildConfig.DEV_SERVER_URL
        val startUrl =
            if (devUrl.isNotBlank()) devUrl
            else "https://appassets.androidplatform.net/"
        webView.loadUrl(startUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                val url = request.url
                if (url.host != APP_HOST) return null

                val path = url.path ?: "/"
                // Real asset (has a file extension, e.g. .js/.css/.svg) → serve it.
                val lastSegment = path.substringAfterLast('/')
                val looksLikeFile = lastSegment.contains('.')
                if (looksLikeFile) {
                    return assetLoader.shouldInterceptRequest(url)
                }
                // Otherwise it's a client-side route ("/", "/practical4", …) →
                // serve index.html so React Router renders it (pathname stays clean).
                return assetLoader.shouldInterceptRequest(
                    Uri.parse("https://$APP_HOST/index.html"),
                )
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                android.util.Log.d(
                    "WebViewConsole",
                    "${msg.messageLevel()}: ${msg.message()} @${msg.lineNumber()}",
                )
                return true
            }
        }
    }

    private fun attachHardwareBridge() {
        val container = (application as WmcApplication).container
        val bridge = HardwareBridge(
            dispatcher = container.bridgeDispatcher,
            // Activity lifecycle scope → in-flight native calls are cancelled on destroy.
            scope = lifecycleScope,
            postJs = { js -> webView.post { webView.evaluateJavascript(js, null) } },
        )
        webView.addJavascriptInterface(bridge, "AndroidHardware")
    }

    private fun registerBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun requestHardwarePermissions() {
        val missing = HardwarePermissions.missing(this)
        if (missing.isNotEmpty()) permissionLauncher.launch(missing)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val APP_HOST = "appassets.androidplatform.net"
    }
}
