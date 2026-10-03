package com.jonhararagi.animeart

import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.document.DocumentReducer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DocumentReducerTest {
    @Test fun addAndRemoveLayer() {
        val initial = CanvasDocument()
        val withLayer = DocumentReducer.addLayer(initial, "Sketch")
        assertEquals(2, withLayer.layers.size)
        val id = withLayer.layers.last().id
        val removed = DocumentReducer.removeLayer(withLayer, id)
        assertEquals(1, removed.layers.size)
    }

    @Test fun visibilityLockAndOpacity() {
        val initial = CanvasDocument()
        val id = initial.layers.first().id
        val changed = DocumentReducer
            .setLayerVisibility(initial, id, false)
            .let { DocumentReducer.setLayerLocked(it, id, true) }
            .let { DocumentReducer.setLayerOpacity(it, id, 0.5f) }
        assertFalse(changed.layers.first().visible)
        assertTrue(changed.layers.first().locked)
        assertEquals(0.5f, changed.layers.first().opacity)
    }
}
