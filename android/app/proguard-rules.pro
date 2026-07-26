# Keep the JavaScript bridge — reflected over by the WebView, so R8 must not
# rename or strip @JavascriptInterface methods.
-keepclassmembers class com.wmclab.android.webview.HardwareBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.wmclab.android.webview.HardwareBridge { *; }

# Domain models are serialised by name via org.json — keep their fields readable.
-keep class com.wmclab.android.domain.model.** { *; }
