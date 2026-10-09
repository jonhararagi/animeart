package com.jonhararagi.animeart

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.document.Layer
import com.jonhararagi.animeart.document.LayerContent
import com.jonhararagi.animeart.document.Stroke
import com.jonhararagi.animeart.document.StrokePoint
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.persistence.RecoveryResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProjectPersistenceRecoveryTest {
    private lateinit var context: Context
    private lateinit var persistence: ProjectPersistence

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
            .edit().clear().commit()
        persistence = ProjectPersistence(context)
    }

    @After
    fun tearDown() {
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    @Test
    fun validDocumentRoundTripsWithoutBeingReportedAsFailure() {
        val document = CanvasDocument(
            width = 640,
            height = 480,
            layers = listOf(
                Layer(
                    name = "Sketch",
                    content = LayerContent.Drawing(
                        listOf(Stroke(points = listOf(StrokePoint(12f, 34f))))
                    )
                )
            )
        )

        persistence.save("test-project", document)

        val result = persistence.loadDocument()
        assertTrue("Valid saved document must load", result is RecoveryResult.Loaded)
        assertEquals(document, (result as RecoveryResult.Loaded).document)
    }

    @Test
    fun missingDocumentIsDistinctFromFailedRecovery() {
        val result = persistence.loadDocument()
        assertTrue("Missing storage must remain a normal first-run state", result is RecoveryResult.Missing)
    }

    @Test
    fun corruptDocumentIsReportedAndRawRecoveryIsPreserved() {
        val raw = "{not valid json"
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
            .edit().putString("project", raw).commit()

        val result = persistence.loadDocument()

        assertTrue("Corrupt JSON must not become an empty document", result is RecoveryResult.Failed)
        assertEquals(
            "The original recovery payload must remain unchanged",
            raw,
            context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
                .getString("project", null)
        )
    }

    @Test
    fun incompatibleLayerContentIsReportedAndRawRecoveryIsPreserved() {
        val raw = """{"projectId":"test","timestamp":1,"width":640,"height":480,"layers":[{"id":"layer-1","name":"Sketch","visible":true,"locked":false,"opacity":1.0,"contentType":"future-unknown-type","contentValue":"keep-me","transform":{"translationX":0,"translationY":0,"scale":1,"rotation":0},"strokes":[]}]}"""
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
            .edit().putString("project", raw).commit()

        val result = persistence.loadDocument()

        assertTrue("Unknown content type must not silently fall back to drawing", result is RecoveryResult.Failed)
        assertEquals(
            "Incompatible recovery payload must remain unchanged",
            raw,
            context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
                .getString("project", null)
        )
    }
}
