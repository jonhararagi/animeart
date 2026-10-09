package com.jonhararagi.animeart

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    @After
    fun tearDown() {
        context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    @Test
    fun cancelAfterFailedRecoveryFinishesActivityAndPreservesStoredPayload() {
        val raw = "{known-corrupt-recovery-payload"
        seedCorruptRecovery(raw)
        showRecoveryDecision()

        composeRule.onNodeWithText("No se pudo recuperar el documento").assertIsDisplayed()
        composeRule.onNodeWithText("Cancelar").performClick()
        composeRule.waitForIdle()

        assertTrue("Cancel must finish the Activity", composeRule.activity.isFinishing)
        assertEquals(raw, storedPayload())
    }

    @Test
    fun choosingNewDocumentDoesNotWriteUntilExplicitSave() {
        val raw = "{known-corrupt-recovery-payload"
        seedCorruptRecovery(raw)
        showRecoveryDecision()

        composeRule.onNodeWithText("Iniciar documento nuevo").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithText("Guardar").assertIsDisplayed()
        assertEquals("Opening a new document must not replace recovery", raw, storedPayload())
        assertTrue("The corrupt recovery must still fail before explicit save",
            ProjectPersistence(context).loadDocument() is RecoveryResult.Failed)

        composeRule.onNodeWithText("Guardar").performClick()
        composeRule.waitForIdle()

        val saved = storedPayload()
        assertNotEquals("Explicit Save must replace the previous raw payload", raw, saved)
        val recovered = ProjectPersistence(context).loadDocument()
        assertTrue("The explicitly saved new document must be loadable", recovered is RecoveryResult.Loaded)
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

    private fun showRecoveryDecision() {
        composeRule.activity.runOnUiThread {
            // Exercise the real recovery UI deterministically without relying on a WebView
            // network failure, which varies across emulator images and network conditions.
            val method = MainActivity::class.java.getDeclaredMethod("showLegacyEditor")
            method.isAccessible = true
            method.invoke(composeRule.activity)
        }
        composeRule.waitForIdle()
    }
}
