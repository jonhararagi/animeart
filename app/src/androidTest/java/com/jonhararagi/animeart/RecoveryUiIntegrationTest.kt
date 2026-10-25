package com.jonhararagi.animeart

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.persistence.RecoveryResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RecoveryUiIntegrationTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    private lateinit var context: Context
    private val preferencesName = "animeart_recovery"
    private var originalPreferences: Map<String, Any?> = emptyMap()

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        val prefs = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        originalPreferences = snapshotPreferences(prefs)
        check(prefs.edit().clear().commit()) { "Could not isolate recovery UI test preferences" }
    }

    @After
    fun tearDown() {
        restorePreferences(
            context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE),
            originalPreferences
        )
    }

    @Test
    fun mainFrameLoadErrorShowsRecoveryDecisionAndCancelPreservesStoredPayload() {
        val raw = "{known-corrupt-recovery-payload"
        seedCorruptRecovery(raw)
        simulateMainFrameLoadError()

        composeRule.onNodeWithText("No se pudo recuperar el documento").assertIsDisplayed()
        val activity = composeRule.activity
        composeRule.onNodeWithText("Cancelar").performClick()
        composeRule.waitForIdle()

        assertTrue("Cancel must finish the Activity", activity.isFinishing)
        assertEquals("Cancel must preserve the original recovery payload", raw, storedPayload())
    }

    @Test
    fun choosingNewDocumentDoesNotWriteUntilExplicitSaveAfterMainFrameError() {
        val raw = "{known-corrupt-recovery-payload"
        seedCorruptRecovery(raw)
        simulateMainFrameLoadError()

        composeRule.onNodeWithText("Iniciar documento nuevo").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithText("Guardar").assertIsDisplayed()
        assertEquals("Opening a new document must not replace recovery", raw, storedPayload())
        assertTrue(
            "Corrupt recovery must still fail before explicit save",
            ProjectPersistence(context).loadDocument() is RecoveryResult.Failed
        )

        composeRule.onNodeWithText("Guardar").performClick()
        composeRule.waitForIdle()

        val saved = storedPayload()
        assertNotEquals("Explicit Save must replace the previous raw payload", raw, saved)
        assertTrue(
            "The explicitly saved new document must be loadable",
            ProjectPersistence(context).loadDocument() is RecoveryResult.Loaded
        )
    }

    @Test
    fun subframeLoadErrorDoesNotEnterRecoveryUiOrModifyStoredPayload() {
        val raw = "{known-corrupt-recovery-payload"
        seedCorruptRecovery(raw)

        composeRule.activity.runOnUiThread {
            composeRule.activity.handleWebViewLoadError(isMainFrame = false)
        }
        composeRule.waitForIdle()

        composeRule.onAllNodesWithText("No se pudo recuperar el documento").assertCountEquals(0)
        assertEquals("Subframe errors must not change recovery data", raw, storedPayload())
    }

    private fun simulateMainFrameLoadError() {
        composeRule.activity.runOnUiThread {
            // Exercises the same deterministic handler wired directly to WebViewClient.onReceivedError.
            composeRule.activity.handleWebViewLoadError(isMainFrame = true)
        }
        composeRule.waitForIdle()
    }

    private fun seedCorruptRecovery(raw: String) {
        check(
            context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
                .edit().putString("project", raw).commit()
        ) { "Could not seed isolated instrumentation recovery data" }
    }

    private fun storedPayload(): String? =
        context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
            .getString("project", null)

    private fun snapshotPreferences(prefs: SharedPreferences): Map<String, Any?> =
        prefs.all.mapValues { (_, value) ->
            if (value is Set<*>) value.filterIsInstance<String>().toSet() else value
        }

    private fun restorePreferences(prefs: SharedPreferences, snapshot: Map<String, Any?>) {
        val editor = prefs.edit().clear()
        snapshot.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
                null -> Unit
                else -> error("Unsupported SharedPreferences test fixture type: ${value::class.java.name}")
            }
        }
        check(editor.commit()) { "Could not restore original recovery preferences after UI test" }
    }
}
