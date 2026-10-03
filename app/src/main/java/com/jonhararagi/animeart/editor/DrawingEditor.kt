package com.jonhararagi.animeart.editor

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.*

class DrawingEditor(initial: EditorState = EditorState()) {
    var state: EditorState = initial.copy(
        selectedLayerId = initial.selectedLayerId ?: initial.document.layers.firstOrNull()?.id
    )
        private set

    private val history = CommandHistory()
    private var activeStroke: Stroke? = null
    private var activeLayerId: String? = null
    private var transformGestureBefore: CanvasDocument? = null
    private var transformGestureLayerId: String? = null
    private var transformGestureSelectionBefore: String? = null

    fun setTool(tool: EditorTool) { state = state.copy(activeTool = tool) }
    fun setColor(argb: Long) { state = state.copy(brushColorArgb = argb) }
    fun setBrushSize(size: Float) { state = state.copy(brushSize = size.coerceIn(1f, 120f)) }
    fun setBrushOpacity(value: Float) { state = state.copy(brushOpacity = value.coerceIn(0.05f, 1f)) }
    fun setViewport(viewport: Viewport) { state = state.copy(viewport = viewport) }
    fun selectLayer(id: String) {
        if (state.document.layers.any { it.id == id }) state = state.copy(selectedLayerId = id)
    }

    fun addReferenceImage(path: String, width: Int, height: Int, name: String = "Reference Character") {
        if (width <= 0 || height <= 0) return
        val before = state.document
        val id = java.util.UUID.randomUUID().toString()
        val layer = Layer(
            id = id,
            name = name,
            content = LayerContent.Reference(path, width, height),
            transform = Transform(
                translationX = (before.width - width) / 2f,
                translationY = (before.height - height) / 2f
            )
        )
        val after = before.copy(layers = before.layers + layer)
        executeDocumentCommand(before, after, id)
    }

    fun createLayer(name: String = "Layer") {
        val before = state.document
        val index = before.layers.size
        val after = DocumentReducer.addLayer(before, name, index)
        val id = after.layers.last().id
        executeDocumentCommand(before, after, id)
    }

    fun renameLayer(name: String) = mutateSelected { doc, id -> DocumentReducer.renameLayer(doc, id, name) }

    fun setLayerVisibility(visible: Boolean) = mutateSelected { doc, id ->
        DocumentReducer.setLayerVisibility(doc, id, visible)
    }

    fun setLayerLocked(locked: Boolean) = mutateSelected { doc, id ->
        DocumentReducer.setLayerLocked(doc, id, locked)
    }

    fun setLayerOpacity(opacity: Float) = mutateSelected { doc, id ->
        DocumentReducer.setLayerOpacity(doc, id, opacity)
    }

    fun moveSelectedLayerUp() = mutateSelected { doc, id -> DocumentReducer.moveLayerUp(doc, id) }
    fun moveSelectedLayerDown() = mutateSelected { doc, id -> DocumentReducer.moveLayerDown(doc, id) }

    fun duplicateSelectedLayer() {
        val id = state.selectedLayerId ?: return
        val before = state.document
        val (after, copyId) = DocumentReducer.duplicateLayer(before, id)
        if (copyId != null) executeDocumentCommand(before, after, copyId)
    }

    fun deleteSelectedLayer() {
        val id = state.selectedLayerId ?: return
        if (state.document.layers.size <= 1) return
        val before = state.document
        val index = before.layers.indexOfFirst { it.id == id }
        val after = DocumentReducer.removeLayer(before, id)
        val nextSelection = after.layers.getOrNull(index.coerceAtMost(after.layers.lastIndex))?.id
        executeDocumentCommand(before, after, nextSelection)
    }

    fun beginStroke(point: Offset) {
        val layerId = state.selectedLayerId ?: return
        val layer = state.document.layers.firstOrNull { it.id == layerId } ?: return
        if (!layer.visible || layer.locked || layer.content !is LayerContent.Drawing || state.activeTool !in listOf(EditorTool.DRAW, EditorTool.ERASE)) return
        activeLayerId = layerId
        val localPoint = LayerTransformMath.inverse(point, layer.transform, LayerTransformMath.contentPivot(layer.content))
        activeStroke = Stroke(
            colorArgb = state.brushColorArgb,
            size = state.brushSize,
            opacity = state.brushOpacity,
            tool = if (state.activeTool == EditorTool.ERASE) StrokeTool.ERASER else StrokeTool.BRUSH,
            points = listOf(StrokePoint(localPoint.x, localPoint.y, timestamp = System.currentTimeMillis()))
        )
    }

    fun appendStrokePoint(point: Offset) {
        val current = activeStroke ?: return
        val layer = state.document.layers.firstOrNull { it.id == activeLayerId } ?: return
        val localPoint = LayerTransformMath.inverse(point, layer.transform, LayerTransformMath.contentPivot(layer.content))
        val last = current.points.lastOrNull()
        if (last != null && (last.x - localPoint.x) * (last.x - localPoint.x) +
            (last.y - localPoint.y) * (last.y - localPoint.y) < 0.25f) return
        activeStroke = current.copy(
            points = current.points + StrokePoint(localPoint.x, localPoint.y, timestamp = System.currentTimeMillis())
        )
    }

    fun cancelStroke() { activeStroke = null; activeLayerId = null }
    fun activeStroke(): Stroke? = activeStroke

    fun commitStroke() {
        val stroke = activeStroke ?: return
        val layerId = activeLayerId ?: return
        val before = state.document
        val after = DocumentReducer.appendStroke(before, layerId, stroke)
        if (after == before) { cancelStroke(); return }
        executeDocumentCommand(before, after, state.selectedLayerId)
        cancelStroke()
    }

    fun beginLayerTransformGesture() {
        val id = state.selectedLayerId ?: return
        val layer = state.document.layers.firstOrNull { it.id == id } ?: return
        if (layer.locked || !layer.visible) return
        transformGestureBefore = state.document
        transformGestureLayerId = id
        transformGestureSelectionBefore = state.selectedLayerId
    }

    fun updateLayerTransformGesture(pan: Offset, zoom: Float, rotation: Float) {
        val id = transformGestureLayerId ?: return
        val layer = state.document.layers.firstOrNull { it.id == id } ?: return
        val current = layer.transform
        val next = current.copy(
            translationX = current.translationX + pan.x,
            translationY = current.translationY + pan.y,
            scale = (current.scale * zoom).coerceIn(0.01f, 100f),
            rotation = current.rotation + rotation
        )
        state = state.copy(document = DocumentReducer.setLayerTransform(state.document, id, next))
    }

    fun commitLayerTransformGesture() {
        val before = transformGestureBefore ?: return clearTransformGesture()
        val id = transformGestureLayerId ?: return clearTransformGesture()
        val after = state.document
        if (before != after) {
            val selection = state.selectedLayerId
            history.execute(object : EditorCommand {
                override fun execute() { state = state.copy(document = after, selectedLayerId = selection) }
                override fun undo() { state = state.copy(document = before, selectedLayerId = transformGestureSelectionBefore) }
            })
        }
        clearTransformGesture()
    }

    fun cancelLayerTransformGesture() {
        transformGestureBefore?.let { state = state.copy(document = it, selectedLayerId = transformGestureSelectionBefore) }
        clearTransformGesture()
    }

    private fun clearTransformGesture() {
        transformGestureBefore = null
        transformGestureLayerId = null
        transformGestureSelectionBefore = null
    }

    private inline fun mutateSelected(change: (CanvasDocument, String) -> CanvasDocument) {
        val id = state.selectedLayerId ?: return
        val before = state.document
        val after = change(before, id)
        if (after != before) executeDocumentCommand(before, after, id)
    }

    private fun executeDocumentCommand(before: CanvasDocument, after: CanvasDocument, selectionAfter: String?) {
        val selectionBefore = state.selectedLayerId
        history.execute(object : EditorCommand {
            override fun execute() {
                state = state.copy(document = after, selectedLayerId = selectionAfter ?: selectionBefore)
            }
            override fun undo() {
                state = state.copy(document = before, selectedLayerId = selectionBefore)
            }
        })
    }

    fun undo() { history.undo() }
    fun redo() { history.redo() }
    fun canUndo() = history.canUndo()
    fun canRedo() = history.canRedo()
    fun replaceDocument(document: CanvasDocument) {
        state = state.copy(document = document, selectedLayerId = document.layers.firstOrNull()?.id)
    }
}
