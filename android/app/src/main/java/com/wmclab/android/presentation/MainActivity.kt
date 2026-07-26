package com.wmclab.android.presentation

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.wmclab.android.BuildConfig
import com.wmclab.android.R
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

    // The splash stays up until the WebView has painted its first page, so the
    // user never sees a blank/black cold-start window.
    private var contentReady = false

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
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !contentReady }

        webView = WebView(this)
        setContentView(webView)

        applyWindowInsets()
        configureWebView()
        attachHardwareBridge()
        registerBackNavigation()
        requestHardwarePermissions()

        // Safety net: never hold the splash more than 3s, even if a load stalls.
        webView.postDelayed({ contentReady = true }, 3000)

        val devUrl = BuildConfig.DEV_SERVER_URL
        val startUrl =
            if (devUrl.isNotBlank()) devUrl
            else "https://appassets.androidplatform.net/"
        webView.loadUrl(startUrl)
    }

    /**
     * Android 15+ (API 35+) forces edge-to-edge, so the WebView would draw behind
     * the status bar and gesture navigation bar. We keep the app edge-to-edge but
     * pad the *content root* (the WebView's parent) by the system-bar + cutout
     * insets, so the WebView is laid out fully inside the safe area. Padding the
     * parent (rather than the WebView itself) avoids WebView's own internal inset
     * handling, which otherwise swallows a listener set directly on it.
     */
    private fun applyWindowInsets() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root: View = findViewById(android.R.id.content)
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.brand_surface))
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            view.updatePadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(root)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        // Light background matches the app, so the splash → content hand-off has
        // no white/black flash even before the first frame paints.
        webView.setBackgroundColor(ContextCompat.getColor(this, R.color.brand_surface))

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

            override fun onPageFinished(view: WebView, url: String) {
                // First page painted — release the splash for a smooth reveal.
                contentReady = true
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
