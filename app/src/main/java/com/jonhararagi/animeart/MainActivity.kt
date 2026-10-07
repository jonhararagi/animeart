package com.jonhararagi.animeart

import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

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

        webView.webViewClient = LocalContentWebViewClient(assetLoader)
        setContentView(webView)
        webView.loadUrl(WEB_APP_URL)
    }

    private class WebAssetPathHandler(context: ComponentActivity) : WebViewAssetLoader.PathHandler {
        private val delegate = WebViewAssetLoader.AssetsPathHandler(context)

        override fun handle(path: String): WebResourceResponse? {
            val response = delegate.handle(path) ?: return null
            if (path.endsWith(".mjs", ignoreCase = true)) {
                response.mimeType = "text/javascript"
            }
            return response
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
        const val WEBVIEW_TAG = "animeart-webview"
        const val WEB_APP_URL = "https://appassets.androidplatform.net/assets/index.html"
    }
}
