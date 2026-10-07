package com.jonhararagi.animeart

import android.view.MotionEvent
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewFeature
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class WebViewContainerSmokeTest {
    @Test
    fun webEditorLoadsRendersRespondsAndReloadsOffline() {
        require(WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            "WebView Service Worker support is required for T047"
        }
        require(WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            "WebView Service Worker request interception is required for T047 offline verification"
        }
        require(WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BLOCK_NETWORK_LOADS)) {
            "WebView Service Worker network blocking is required for T047 offline verification"
        }

        val serviceWorkerSettings = ServiceWorkerControllerCompat.getInstance().serviceWorkerWebSettings
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val webView = waitForWebView(scenario)
            waitForCondition("local web document") {
                evaluate(webView, "window.location.href") == "https://appassets.androidplatform.net/assets/index.html"
            }
            assertEquals("loading-complete", evaluate(webView, "document.readyState === 'complete' ? 'loading-complete' : document.readyState"))
            assertEquals("true", evaluate(webView, "document.querySelector('#canvas') !== null"))
            waitForCondition("canvas ready") {
                evaluate(webView, "document.documentElement.dataset.animeartCanvasReady === 'true'") == "true"
            }

            waitForCondition("service worker registered") {
                evaluate(webView, "document.documentElement.dataset.animeartServiceWorker === 'registered'") == "true"
            }
            waitForCondition("service worker ready") {
                evaluate(
                    webView,
                    "navigator.serviceWorker.ready.then(() => document.documentElement.dataset.animeartServiceWorkerReady = 'true'); true"
                ) == "true" &&
                    evaluate(webView, "document.documentElement.dataset.animeartServiceWorkerReady === 'true'") == "true"
            }
            reload(webView)
            waitForCondition("service worker controller") {
                evaluate(webView, "navigator.serviceWorker.controller !== null") == "true"
            }
            assertEquals("true", evaluate(webView, "caches.has('animeart-web-shell-v1')"))

            dispatchTouchSequence(webView)
            waitForCondition("pointer event delivered") {
                (evaluate(webView, "Number(document.documentElement.dataset.animeartPointerEvents || '0')") ?: "0") != "0"
            }

            serviceWorkerSettings.setBlockNetworkLoads(true)
            try {
                reload(webView)
                waitForCondition("offline canvas") {
                    evaluate(webView, "document.documentElement.dataset.animeartCanvasReady === 'true'") == "true"
                }
                assertEquals("true", evaluate(webView, "document.querySelector('#canvas') !== null"))
                assertEquals("true", evaluate(webView, "navigator.serviceWorker.controller !== null"))
            } finally {
                serviceWorkerSettings.setBlockNetworkLoads(false)
            }
        }
    }

    private fun waitForWebView(scenario: ActivityScenario<MainActivity>): WebView {
        var result: WebView? = null
        waitForCondition("WebView instance") {
            scenario.onActivity { activity ->
                result = activity.window.decorView.findViewWithTag(WEBVIEW_TAG)
            }
            result != null
        }
        return requireNotNull(result)
    }

    private fun dispatchTouchSequence(webView: WebView) {
        val x = webView.width / 2f
        val y = (webView.height * 0.75f).coerceAtLeast(1f)
        webView.post {
            val downTime = System.currentTimeMillis()
            webView.dispatchTouchEvent(MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, x, y, 0))
            webView.dispatchTouchEvent(MotionEvent.obtain(downTime, downTime + 40, MotionEvent.ACTION_MOVE, x + 12f, y + 8f, 0))
            webView.dispatchTouchEvent(MotionEvent.obtain(downTime, downTime + 80, MotionEvent.ACTION_UP, x + 12f, y + 8f, 0))
        }
    }

    private fun reload(webView: WebView) {
        webView.post { webView.reload() }
    }

    private fun evaluate(webView: WebView, script: String): String? {
        val latch = CountDownLatch(1)
        var value: String? = null
        webView.post {
            webView.evaluateJavascript(script) {
                value = it.trim('"')
                latch.countDown()
            }
        }
        assertTrue("JavaScript evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        return value
    }

    private fun waitForCondition(name: String, timeoutMs: Long = 20_000, condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        var last = false
        while (System.currentTimeMillis() < deadline) {
            last = condition()
            if (last) return true
            Thread.sleep(250)
        }
        assertTrue(name + " was not observed within " + timeoutMs + "ms", last)
        return last
    }

    private companion object {
        const val WEBVIEW_TAG = "animeart-webview"
    }
}
