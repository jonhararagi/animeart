package com.jonhararagi.animeart

import android.view.View
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityWebViewRotationTest {
    @Test
    fun androidLoadsTheCurrentWebEditorWithCropFlipAndExportControls() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val webView = waitForWebView(scenario)
            waitUntil(scenario, timeoutMs = 10_000) {
                findWebView(it.window.decorView)?.progress == 100
            }
            val currentEditorLoaded = evaluateJavascriptResult(
                webView,
                """(() => document.title === "AnimeArt Studio | Diseña tu mundo anime" &&
                    !!document.querySelector(".brand-mark") &&
                    !!document.querySelector("#home-create-cover") &&
                    !!document.querySelector("#home-open-stickers") &&
                    !!document.querySelector("#share-current-design") &&
                    !!document.querySelector("#crop-resize-image") &&
                    !!document.querySelector("#flip-image-horizontal") &&
                    !!document.querySelector("#export-format") && !!document.querySelector("#export-png") &&
                    !!document.querySelector("#recolor-image") && !!document.querySelector("#recolor-dialog") &&
                    !!document.querySelector("#background-removal-edge-sensitivity") &&
                    !!document.querySelector("#brush-hardness"))()"""
            )
            assertEquals("true", currentEditorLoaded)
        }
    }

    @Test
    fun activityRecreationRestoresWebViewNavigationState() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val initialWebView = waitForWebView(scenario)
            assertNotNull(initialWebView)

            evaluateJavascript(initialWebView, "window.location.hash='t049-rotation-marker';")

            waitUntil(scenario, timeoutMs = 10_000) {
                findWebView(it.window.decorView)?.url?.contains("#t049-rotation-marker") == true
            }

            scenario.recreate()

            waitUntil(scenario, timeoutMs = 10_000) {
                findWebView(it.window.decorView)?.url?.contains("#t049-rotation-marker") == true
            }

            scenario.onActivity { activity ->
                val restoredWebView = findWebView(activity.window.decorView)
                assertNotNull(restoredWebView)
                assertNotSame(initialWebView, restoredWebView)
                assertEquals(
                    "https://appassets.androidplatform.net/assets/web/index.html#t049-rotation-marker",
                    restoredWebView?.url
                )
            }
        }
    }

    private fun waitForWebView(scenario: ActivityScenario<MainActivity>): WebView {
        var found: WebView? = null
        waitUntil(scenario, timeoutMs = 10_000) {
            found = findWebView(it.window.decorView)
            found != null
        }
        return requireNotNull(found)
    }

    private fun evaluateJavascript(webView: WebView, script: String) {
        evaluateJavascriptResult(webView, script)
    }

    private fun evaluateJavascriptResult(webView: WebView, script: String): String {
        val latch = CountDownLatch(1)
        var result = "null"
        webView.post {
            webView.evaluateJavascript(script) { value ->
                result = value ?: "null"
                latch.countDown()
            }
        }
        assertTrue("JavaScript did not complete", latch.await(10, TimeUnit.SECONDS))
        return result
    }

    private fun waitUntil(
        scenario: ActivityScenario<MainActivity>,
        timeoutMs: Long,
        condition: (MainActivity) -> Boolean
    ) {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
        while (System.nanoTime() < deadline) {
            var matched = false
            scenario.onActivity { activity ->
                matched = condition(activity)
            }
            if (matched) return
            Thread.sleep(100)
        }
        throw AssertionError("Condition not met within " + timeoutMs + " ms")
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is android.view.ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }
}
