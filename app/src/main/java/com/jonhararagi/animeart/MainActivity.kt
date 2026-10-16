package com.jonhararagi.animeart

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.widget.Toast
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.persistence.RecoveryResult
import com.jonhararagi.animeart.ui.EditorScreen

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private var pendingExportBytes: ByteArray? = null
    private var pendingExportName: String = "animeart.png"

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

    private val exportFileLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val bytes = pendingExportBytes
            val name = pendingExportName
            pendingExportBytes = null
            if (result.resultCode != RESULT_OK || result.data?.data == null || bytes == null) {
                Toast.makeText(this, "Export cancelled", Toast.LENGTH_SHORT).show()
                return@registerForActivityResult
            }
            val uri = result.data!!.data!!
            runCatching {
                contentResolver.openOutputStream(uri)?.use { output -> output.write(bytes) }
                    ?: throw IllegalStateException("Could not open the selected destination")
            }.onSuccess {
                Toast.makeText(this, "Saved $name", Toast.LENGTH_LONG).show()
            }.onFailure { error ->
                Toast.makeText(this, error.message ?: "Export failed", Toast.LENGTH_LONG).show()
            }
        }

    private inner class NativeExportBridge {
        @JavascriptInterface
        fun saveFile(base64Data: String, mimeType: String, requestedName: String) {
            runOnUiThread {
                try {
                    val safeMime = when (mimeType.substringBefore(';').trim().lowercase()) {
                        "image/png" -> "image/png"
                        "image/jpeg" -> "image/jpeg"
                        "image/webp" -> "image/webp"
                        "application/json" -> "application/json"
                        else -> throw IllegalArgumentException("Unsupported export format")
                    }
                    if (base64Data.length > 70_000_000) throw IllegalArgumentException("Export is too large")
                    val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                    if (bytes.isEmpty() || bytes.size > 50 * 1024 * 1024) {
                        throw IllegalArgumentException("Export must be between 1 byte and 50 MB")
                    }
                    val safeName = requestedName.replace(Regex("[^A-Za-z0-9._-]"), "_")
                        .take(120).ifBlank { "animeart-export" }
                    pendingExportBytes = bytes
                    pendingExportName = safeName
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = safeMime
                        putExtra(Intent.EXTRA_TITLE, safeName)
                    }
                    exportFileLauncher.launch(intent)
                } catch (error: Exception) {
                    pendingExportBytes = null
                    Toast.makeText(this@MainActivity, error.message ?: "Export failed", Toast.LENGTH_LONG).show()
                }
            }
        }
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
            addJavascriptInterface(NativeExportBridge(), "AnimeArtNative")
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
                    fileChooserParams: WebChromeClient.FileChooserParams
                ): Boolean {
                    pendingFileChooser?.onReceiveValue(null)
                    pendingFileChooser = filePathCallback
                    val acceptTypes = fileChooserParams.acceptTypes
                        .flatMap { it.split(",") }
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                    val mimeTypes = acceptTypes.filter { it.contains("/") }.distinct()
                    val preferredMime = mimeTypes.firstOrNull() ?: "*/*"
                    val documentPickerIntent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = preferredMime
                        if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                        putExtra(
                            Intent.EXTRA_ALLOW_MULTIPLE,
                            fileChooserParams.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
                        )
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                    }
                    return try {
                        // ACTION_OPEN_DOCUMENT is more consistent across Android/OEM file providers
                        // than WebView's generic ACTION_GET_CONTENT chooser and grants access only
                        // to the items the user explicitly selects. No broad storage permission needed.
                        fileChooserLauncher.launch(documentPickerIntent)
                        true
                    } catch (documentPickerError: Exception) {
                        Log.w("AnimeArtFilePicker", "Document picker unavailable; trying WebView default picker", documentPickerError)
                        try {
                            fileChooserLauncher.launch(fileChooserParams.createIntent())
                            true
                        } catch (fallbackError: Exception) {
                            pendingFileChooser = null
                            filePathCallback.onReceiveValue(null)
                            Log.e("AnimeArtFilePicker", "Could not open Android image/file picker", fallbackError)
                            Toast.makeText(
                                this@MainActivity,
                                "No se pudo abrir el selector de archivos. Comprueba que haya una app de archivos instalada.",
                                Toast.LENGTH_LONG
                            ).show()
                            false
                        }
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

        val recovery = ProjectPersistence(this).loadDocument()

        setContent {
            MaterialTheme {
                Surface {
                    when (recovery) {
                        is RecoveryResult.Loaded -> EditorScreen(initialDocument = recovery.document)
                        RecoveryResult.Missing -> EditorScreen(initialDocument = CanvasDocument())
                        RecoveryResult.Failed -> {
                            var startNewDocument by remember { mutableStateOf(false) }
                            if (startNewDocument) {
                                // Stored recovery remains untouched until an explicit save.
                                EditorScreen(initialDocument = CanvasDocument())
                            } else {
                                AlertDialog(
                                    onDismissRequest = {},
                                    title = { Text("No se pudo recuperar el documento") },
                                    text = {
                                        Text(
                                            "Los datos guardados existen, pero no se pueden interpretar. " +
                                                "Se conservarán sin cambios. Puedes cancelar o iniciar un documento nuevo; " +
                                                "solo se reemplazarán si eliges Guardar en el editor."
                                        )
                                    },
                                    confirmButton = {
                                        TextButton(onClick = { startNewDocument = true }) {
                                            Text("Iniciar documento nuevo")
                                        }
                                    },
                                    dismissButton = {
                                        TextButton(onClick = { finish() }) {
                                            Text("Cancelar")
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        pendingFileChooser?.onReceiveValue(null)
        pendingFileChooser = null
        pendingExportBytes = null
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
