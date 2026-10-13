package com.jonhararagi.animeart

import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.ui.EditorScreen

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = pendingFileChooser
            pendingFileChooser = null
            if (callback == null) return@registerForActivityResult

            val selectedUris = if (result.resultCode == RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            } else {
                null
            }
            callback.onReceiveValue(selectedUris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showWebEditor(savedInstanceState)
    }

    private fun showWebEditor(savedInstanceState: Bundle?) {
        val offlineValidation = intent.getBooleanExtra("animeart_offline_validation", false)
        Log.i("AnimeArtOffline", "ANIMEART_OFFLINE_INTENT=" + offlineValidation)
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
            // Android's system picker returns content:// URIs. WebView must be allowed to
            // read those selected items; it still cannot browse arbitrary file:// paths.
            settings.allowContentAccess = true
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (offlineValidation) {
                settings.blockNetworkLoads = true
                settings.cacheMode = android.webkit.WebSettings.LOAD_CACHE_ONLY
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    pendingFileChooser?.onReceiveValue(null)
                    pendingFileChooser = filePathCallback
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (error: Exception) {
                        pendingFileChooser = null
                        filePathCallback.onReceiveValue(null)
                        Log.e("AnimeArtFilePicker", "Could not open Android file picker", error)
                        false
                    }
                }
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
        }

        webView = view
        setContentView(view)

        val restored = savedInstanceState != null && view.restoreState(savedInstanceState) != null
        if (!restored) {
            view.loadUrl(START_URL)
        }

        if (offlineValidation) {
            Log.i("AnimeArtOffline", "ANIMEART_OFFLINE_NETWORK webViewBlockNetworkLoads=" + view.settings.blockNetworkLoads + "; webViewCacheMode=" + view.settings.cacheMode + "; serviceWorkerBlockNetworkLoads=" + if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BLOCK_NETWORK_LOADS)) "true" else "unsupported")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView?.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    private fun showLegacyEditor() {
        pendingFileChooser?.onReceiveValue(null)
        pendingFileChooser = null
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
        pendingFileChooser?.onReceiveValue(null)
        pendingFileChooser = null
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
