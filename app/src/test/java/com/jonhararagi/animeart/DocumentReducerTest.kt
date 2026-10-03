package com.jonhararagi.animeart

import com.jonhararagi.animeart.document.*
import org.junit.Assert.*
import org.junit.Test

class DocumentReducerTest {
    @Test fun addRenameAndRemoveLayer_keepMinimumLayer() {
        val initial = CanvasDocument()
        val withLayer = DocumentReducer.addLayer(initial, "Sketch")
        assertEquals(2, withLayer.layers.size)
        val id = withLayer.layers.last().id
        val renamed = DocumentReducer.renameLayer(withLayer, id, "  Lineart  ")
        assertEquals("Lineart", renamed.layers.last().name)
        val removed = DocumentReducer.removeLayer(renamed, id)
        assertEquals(1, removed.layers.size)
        val afterDeletingFirst = DocumentReducer.removeLayer(renamed, renamed.layers.first().id)
        assertEquals(renamed.layers.last().id, afterDeletingFirst.layers.single().id)
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
        assertEquals(0f, DocumentReducer.setLayerOpacity(changed, id, -1f).layers.first().opacity)
        assertEquals(1f, DocumentReducer.setLayerOpacity(changed, id, 2f).layers.first().opacity)
    }

    @Test fun reorderAndDuplicate_areIsolated() {
        val initial = CanvasDocument()
        val first = initial.layers.first()
        val withSecond = DocumentReducer.addLayer(initial, "Sketch")
        val second = withSecond.layers.last()
        val reordered = DocumentReducer.moveLayerDown(withSecond, second.id)
        assertEquals(second.id, reordered.layers.first().id)
        assertEquals(first.id, reordered.layers.last().id)

        val stroke = Stroke(points = listOf(StrokePoint(1f, 2f), StrokePoint(3f, 4f)))
        val contentDoc = reordered.copy(
            layers = reordered.layers.map {
                if (it.id == second.id) it.copy(content = LayerContent.Drawing(listOf(stroke))) else it
            }
        )
        val (duplicated, copyId) = DocumentReducer.duplicateLayer(contentDoc, second.id)
        assertNotNull(copyId)
        assertEquals(3, duplicated.layers.size)
        val original = duplicated.layers.first { it.id == second.id }
        val copy = duplicated.layers.first { it.id == copyId }
        assertEquals(original.content, copy.content)
        assertNotEquals(original.id, copy.id)
        val copyStroke = (copy.content as LayerContent.Drawing).strokes.first()
        val originalStroke = (original.content as LayerContent.Drawing).strokes.first()
        assertNotSame(originalStroke.points, copyStroke.points)
    }
}
