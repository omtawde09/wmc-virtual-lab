package com.wmclab.android.webview

import android.util.Log
import android.webkit.JavascriptInterface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * The object exposed to JavaScript as `window.AndroidHardware`.
 *
 * The bridge is intentionally thin: JS calls [invoke] with a method name, a JSON
 * argument string and a request id; the work runs on a background coroutine and
 * the result is delivered back asynchronously by evaluating
 * `window.__hwResolve(id, json)` / `window.__hwReject(id, json)` on the WebView.
 *
 * This async request/response pattern is required because @JavascriptInterface
 * methods run on a binder thread and must return immediately — they cannot block
 * on hardware I/O.
 */
class HardwareBridge(
    private val dispatcher: BridgeDispatcher,
    private val scope: CoroutineScope,
    /** Runs a snippet of JS on the WebView (MainActivity wires this to the UI thread). */
    private val postJs: (String) -> Unit,
) {

    /** Advertises the contract version to JS so the adapter can feature-detect. */
    @JavascriptInterface
    fun version(): String = "1"

    @JavascriptInterface
    fun invoke(method: String, argsJson: String, requestId: String) {
        scope.launch {
            try {
                val json = dispatcher.dispatch(method, argsJson)
                resolve(requestId, json)
            } catch (t: Throwable) {
                Log.w(TAG, "Hardware call '$method' failed", t)
                reject(requestId, t.message ?: "Native hardware call failed")
            }
        }
    }

    private fun resolve(requestId: String, resultJson: String) {
        // Quote both values as JS string literals; JS parses resultJson back.
        val id = JSONObject.quote(requestId)
        val payload = JSONObject.quote(resultJson)
        postJs("window.__hwResolve && window.__hwResolve($id, $payload);")
    }

    private fun reject(requestId: String, message: String) {
        val id = JSONObject.quote(requestId)
        val err = JSONObject.quote(JSONObject().put("message", message).toString())
        postJs("window.__hwReject && window.__hwReject($id, $err);")
    }

    private companion object {
        const val TAG = "HardwareBridge"
    }
}
