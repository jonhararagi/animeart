package com.jonhararagi.animeart

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewFeature

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val webView = WebView(this).apply {
            tag = WEBVIEW_TAG
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.cacheMode = WebSettings.LOAD_DEFAULT
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebAssetPathHandler(this))
            .build()

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            val serviceWorkerAssets = WebAssetPathHandler(this)
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                object : ServiceWorkerClientCompat() {
                    override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                        val path = request.url.path ?: return null
                        if (!path.startsWith("/assets/")) return null
                        val assetPath = path.removePrefix("/assets/").ifBlank { "index.html" }
                        return serviceWorkerAssets.handleServiceWorker(assetPath)
                    }
                }
            )
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
                Log.d(TAG, "Web console " + message.messageLevel() + ": " + message.message() + " @ " + message.sourceId() + ":" + message.lineNumber())
                return true
            }
        }
        webView.webViewClient = LocalContentWebViewClient(assetLoader)
        setContentView(webView)
        webView.loadUrl(WEB_APP_URL)
    }

    private class WebAssetPathHandler(private val activity: ComponentActivity) : WebViewAssetLoader.PathHandler {
        private val delegate = WebViewAssetLoader.AssetsPathHandler(activity)

        override fun handle(path: String): WebResourceResponse? {
            val response = delegate.handle(path) ?: return null
            configureJavascriptMimeType(path, response)
            return response
        }

        fun handleServiceWorker(path: String): WebResourceResponse? {
            if (path.contains("..") || path.isBlank()) return null
            val input = runCatching { activity.assets.open(path) }.getOrNull() ?: return null
            return WebResourceResponse(
                javascriptMimeType(path),
                "UTF-8",
                200,
                "OK",
                mapOf(
                    "Content-Type" to "${javascriptMimeType(path)}; charset=UTF-8",
                    "Cache-Control" to "no-cache"
                ),
                input
            )
        }

        private fun configureJavascriptMimeType(path: String, response: WebResourceResponse) {
            if (path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true)) {
                response.mimeType = javascriptMimeType(path)
            }
        }

        private fun javascriptMimeType(path: String): String =
            if (path.endsWith(".mjs", ignoreCase = true) || path.endsWith(".js", ignoreCase = true)) {
                "text/javascript"
            } else {
                "application/octet-stream"
            }
    }

    private class LocalContentWebViewClient(
        private val assetLoader: WebViewAssetLoader
    ) : WebViewClientCompat() {
        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
        ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

        @Suppress("DEPRECATION")
        override fun shouldInterceptRequest(
            view: WebView,
            url: String
        ): WebResourceResponse? = assetLoader.shouldInterceptRequest(Uri.parse(url))
    }

    private companion object {
        const val TAG = "AnimeArtWebView"
        const val WEBVIEW_TAG = "animeart-webview"
        const val WEB_APP_URL = "https://appassets.androidplatform.net/assets/index.html"
    }
}
