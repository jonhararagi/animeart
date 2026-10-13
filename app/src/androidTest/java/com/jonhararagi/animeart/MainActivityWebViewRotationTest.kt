package com.jonhararagi.animeart

import android.view.View
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeEditorActivityTest {
    @Test
    fun activityStartsAndRecreatesWithoutEmbeddingTheWebEditor() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            var firstContent: View? = null
            scenario.onActivity { activity ->
                firstContent = activity.findViewById(android.R.id.content).getChildAt(0)
                assertNotNull(firstContent)
                assertTrue("Native Compose content expected", firstContent !is WebView)
                assertNull("The mobile app must not launch a WebView", findWebView(activity.window.decorView))
            }

            scenario.recreate()

            scenario.onActivity { activity ->
                val restoredContent = activity.findViewById<View>(android.R.id.content).getChildAt(0)
                assertNotNull(restoredContent)
                assertNotSame(firstContent, restoredContent)
                assertTrue("Native Compose content expected after recreation", restoredContent !is WebView)
                assertNull("The mobile app must not fall back to a WebView", findWebView(activity.window.decorView))
            }
        }
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
