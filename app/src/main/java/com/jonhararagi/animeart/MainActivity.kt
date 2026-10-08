package com.jonhararagi.animeart

import android.graphics.Color
import android.util.Log
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.WebViewFeature
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.webkit.WebViewAssetLoader
import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.ui.EditorScreen

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showWebEditor()
    }

    private fun showWebEditor() {
        val offlineValidation = intent.getBooleanExtra("animeart_offline_validation", false)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            val controller = ServiceWorkerControllerCompat.getInstance()
            controller.setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest) =
                    if (offlineValidation) null else loader.shouldInterceptRequest(request.url)
            })
            if (offlineValidation) {
                controller.serviceWorkerWebSettings.setBlockNetworkLoads(true)
                controller.serviceWorkerWebSettings.setCacheMode(android.webkit.WebSettings.LOAD_CACHE_ONLY)
            }
        }

        val view = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (offlineValidation) {
                settings.blockNetworkLoads = true
                settings.cacheMode = android.webkit.WebSettings.LOAD_CACHE_ONLY
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ) = if (offlineValidation) null else loader.shouldInterceptRequest(request.url)

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    if (request.isForMainFrame) showLegacyEditor()
                }
            }
            loadUrl(START_URL)
        }

        if (offlineValidation) {
            Log.i("AnimeArtOffline", "ANIMEART_OFFLINE_NETWORK webViewBlockNetworkLoads=" + view.settings.blockNetworkLoads + "; webViewCacheMode=" + view.settings.cacheMode + "; serviceWorkerBlockNetworkLoads=" + if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BLOCK_NETWORK_LOADS)) "true" else "unsupported")
        }
        webView = view
        setContentView(view)
    }

    private fun showLegacyEditor() {
        webView?.apply {
            stopLoading()
            (parent as? ViewGroup)?.removeView(this)
            destroy()
        }
        webView = null

        val initialDocument = runCatching {
            ProjectPersistence(this).loadDocument() ?: CanvasDocument()
        }.getOrDefault(CanvasDocument())

        setContent {
            MaterialTheme {
                Surface {
                    EditorScreen(initialDocument = initialDocument)
                }
            }
        }
    }

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            (parent as? ViewGroup)?.removeView(this)
            destroy()
        }
        webView = null
        super.onDestroy()
    }

    private companion object {
        const val START_URL = "https://appassets.androidplatform.net/assets/web/index.html"
    }
}
