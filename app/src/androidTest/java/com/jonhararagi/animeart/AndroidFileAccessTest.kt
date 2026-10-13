package com.jonhararagi.animeart

import android.webkit.WebView
import android.view.ViewGroup
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidFileAccessTest {
    @Test
    fun webEditorUsesSystemFilePickerWithoutBroadStoragePermission() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val content = activity.findViewById<ViewGroup>(android.R.id.content)
                val webView = content.getChildAt(0) as WebView

                assertTrue(webView.settings.javaScriptEnabled)
                assertTrue(webView.settings.allowContentAccess)
                assertFalse(webView.settings.allowFileAccess)

                val packageInfo = activity.packageManager.getPackageInfo(
                    activity.packageName,
                    android.content.pm.PackageManager.GET_PERMISSIONS
                )
                val requested = packageInfo.requestedPermissions.orEmpty().toSet()
                assertFalse("Image import must not request broad media permission",
                    requested.contains(android.Manifest.permission.READ_EXTERNAL_STORAGE))
                assertFalse("Image import must not request broad image permission",
                    requested.contains("android.permission.READ_MEDIA_IMAGES"))
                assertFalse("Image import must not request broad video permission",
                    requested.contains("android.permission.READ_MEDIA_VIDEO"))
            }
        }
    }
}
