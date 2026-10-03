package com.jonhararagi.animeart

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.*
import com.jonhararagi.animeart.editor.DrawingEditor
import com.jonhararagi.animeart.editor.LayerTransformMath
import com.jonhararagi.animeart.editor.ViewportTransform
import org.junit.Assert.*
import org.junit.Test

class DrawingEditorTest {
    @Test fun stroke_is_committed_as_one_undo_operation() {
        val editor = DrawingEditor()
        editor.beginStroke(Offset(10f, 10f))
        editor.appendStrokePoint(Offset(20f, 20f))
        editor.commitStroke()
        assertEquals(1, DocumentReducer.activeStrokes(editor.state.document, editor.state.selectedLayerId).size)
        editor.undo()
        assertEquals(0, DocumentReducer.activeStrokes(editor.state.document, editor.state.selectedLayerId).size)
        editor.redo()
        assertEquals(1, DocumentReducer.activeStrokes(editor.state.document, editor.state.selectedLayerId).size)
    }

    @Test fun layer_operations_are_undoable() {
        val editor = DrawingEditor()
        editor.createLayer("Sketch")
        val id = editor.state.selectedLayerId!!
        assertEquals("Sketch", editor.state.document.layers.last().name)
        editor.renameLayer("Lineart")
        editor.setLayerVisibility(false)
        editor.setLayerLocked(true)
        editor.setLayerOpacity(0.5f)
        editor.duplicateSelectedLayer()
        assertEquals(3, editor.state.document.layers.size)
        editor.undo()
        assertEquals(2, editor.state.document.layers.size)
        editor.undo()
        assertEquals(1f, editor.state.document.layers.last().opacity)
        editor.redo()
        assertEquals(0.5f, editor.state.document.layers.last().opacity)
        assertEquals(id, editor.state.selectedLayerId)
    }

    @Test fun delete_selects_another_layer_and_undo_restores_it() {
        val editor = DrawingEditor()
        editor.createLayer("Sketch")
        val deleted = editor.state.selectedLayerId!!
        editor.deleteSelectedLayer()
        assertEquals(1, editor.state.document.layers.size)
        assertNotEquals(deleted, editor.state.selectedLayerId)
        editor.undo()
        assertEquals(2, editor.state.document.layers.size)
        assertEquals(deleted, editor.state.selectedLayerId)
    }

    @Test fun transform_gesture_is_one_undo_operation() {
        val editor = DrawingEditor()
        val id = editor.state.selectedLayerId!!
        editor.beginLayerTransformGesture()
        editor.updateLayerTransformGesture(Offset(20f, 30f), 2f, 45f)
        editor.updateLayerTransformGesture(Offset(5f, -5f), 1.5f, 15f)
        editor.commitLayerTransformGesture()
        val transformed = editor.state.document.layers.first { it.id == id }.transform
        assertEquals(25f, transformed.translationX)
        assertEquals(25f, transformed.translationY)
        assertEquals(3f, transformed.scale)
        assertEquals(60f, transformed.rotation)
        editor.undo()
        assertEquals(Transform(), editor.state.document.layers.first { it.id == id }.transform)
        editor.redo()
        assertEquals(transformed, editor.state.document.layers.first { it.id == id }.transform)
    }

    @Test fun transformed_layer_coordinates_round_trip() {
        val transform = Transform(translationX = 20f, translationY = -10f, scale = 2f, rotation = 30f)
        val pivot = Offset(100f, 100f)
        val local = Offset(130f, 70f)
        val screen = LayerTransformMath.apply(local, transform, pivot)
        val roundTrip = LayerTransformMath.inverse(screen, transform, pivot)
        assertEquals(local.x, roundTrip.x, 0.001f)
        assertEquals(local.y, roundTrip.y, 0.001f)
    }

    @Test fun locked_or_hidden_layer_rejects_stroke() {
        val base = CanvasDocument()
        val layer = base.layers.first()
        val editor = DrawingEditor(EditorState(document = DocumentReducer.setLayerLocked(base, layer.id, true)))
        editor.beginStroke(Offset.Zero)
        assertNull(editor.activeStroke())
    }

    @Test fun viewport_round_trip_preserves_document_coordinate() {
        val viewport = Viewport(scale = 2f, translationX = 30f, translationY = -10f)
        val center = Offset(500f, 500f)
        val document = Offset(240f, 180f)
        val screen = ViewportTransform.documentToScreen(document, viewport, center)
        val roundTrip = ViewportTransform.screenToDocument(screen, viewport, center)
        assertEquals(document.x, roundTrip.x, 0.001f)
        assertEquals(document.y, roundTrip.y, 0.001f)
    }
}
