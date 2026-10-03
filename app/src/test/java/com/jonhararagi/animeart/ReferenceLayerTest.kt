package com.jonhararagi.animeart

import com.jonhararagi.animeart.document.*
import com.jonhararagi.animeart.editor.LayerTransformMath
import org.junit.Assert.*
import org.junit.Test

class ReferenceLayerTest {
    @Test fun reference_is_a_normal_layer_with_independent_properties() {
        val reference = Layer(
            name = "Reference Character",
            visible = true,
            locked = false,
            opacity = 0.4f,
            content = LayerContent.Reference("/app/projects/default/references/ref.bin", 800, 600)
        )
        val drawing = Layer(name = "Lineart", content = LayerContent.Drawing())
        val document = CanvasDocument(layers = listOf(reference, drawing))

        assertEquals(2, document.layers.size)
        assertTrue(document.layers.first().content is LayerContent.Reference)
        assertEquals(800, (reference.content as LayerContent.Reference).width)
        assertEquals(600, (reference.content as LayerContent.Reference).height)

        val hidden = DocumentReducer.setLayerVisibility(document, reference.id, false)
        val locked = DocumentReducer.setLayerLocked(hidden, reference.id, true)
        val opaque = DocumentReducer.setLayerOpacity(locked, reference.id, 0.25f)
        assertFalse(opaque.layers.first().visible)
        assertTrue(opaque.layers.first().locked)
        assertEquals(0.25f, opaque.layers.first().opacity)
        assertEquals(1f, opaque.layers[1].opacity)
    }

    @Test fun reference_transform_uses_image_pivot_and_is_reversible() {
        val content = LayerContent.Reference("ref.bin", 400, 200)
        val pivot = LayerTransformMath.contentPivot(content)
        val transform = Transform(translationX = 80f, translationY = -30f, scale = 1.5f, rotation = 25f)
        val source = androidx.compose.ui.geometry.Offset(100f, 40f)
        val transformed = LayerTransformMath.apply(source, transform, pivot)
        val restored = LayerTransformMath.inverse(transformed, transform, pivot)

        assertEquals(200f, pivot.x, 0.001f)
        assertEquals(100f, pivot.y, 0.001f)
        assertEquals(source.x, restored.x, 0.01f)
        assertEquals(source.y, restored.y, 0.01f)
    }

    @Test fun drawing_and_reference_layers_are_isolated() {
        val stroke = Stroke(points = listOf(StrokePoint(10f, 10f), StrokePoint(20f, 20f)))
        val reference = Layer(name = "Reference", content = LayerContent.Reference("ref.bin", 100, 100))
        val drawing = Layer(name = "Drawing", content = LayerContent.Drawing(listOf(stroke)))
        val document = CanvasDocument(layers = listOf(reference, drawing))

        val changed = DocumentReducer.setLayerOpacity(document, reference.id, 0.3f)
        assertEquals(document.layers[1].content, changed.layers[1].content)
        assertEquals(document.layers[0].content, changed.layers[0].content)

        val afterStroke = DocumentReducer.appendStroke(changed, drawing.id, Stroke(points = listOf(StrokePoint(30f, 30f))))
        assertEquals(2, (afterStroke.layers[1].content as LayerContent.Drawing).strokes.size)
        assertEquals(reference.content, afterStroke.layers[0].content)
    }
}
