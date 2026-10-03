package com.jonhararagi.animeart

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.*
import com.jonhararagi.animeart.editor.DrawingEditor
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
