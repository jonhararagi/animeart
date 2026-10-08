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
        val latch = CountDownLatch(1)
        webView.post {
            webView.evaluateJavascript(script) {
                latch.countDown()
            }
        }
        assertTrue("JavaScript did not complete", latch.await(10, TimeUnit.SECONDS))
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
