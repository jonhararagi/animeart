package com.jonhararagi.animeart.editor

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.*

class DrawingEditor(initial: EditorState = EditorState()) {
    var state: EditorState = initial.copy(selectedLayerId = initial.selectedLayerId ?: initial.document.layers.firstOrNull()?.id)
        private set
    private val history = CommandHistory()
    private var activeStroke: Stroke? = null
    private var activeLayerId: String? = null

    fun setTool(tool: EditorTool) { state = state.copy(activeTool = tool) }
    fun setColor(argb: Long) { state = state.copy(brushColorArgb = argb) }
    fun setBrushSize(size: Float) { state = state.copy(brushSize = size.coerceIn(1f, 120f)) }
    fun setBrushOpacity(value: Float) { state = state.copy(brushOpacity = value.coerceIn(0.05f, 1f)) }
    fun setViewport(viewport: Viewport) { state = state.copy(viewport = viewport) }

    fun beginStroke(point: Offset) {
        val layerId = state.selectedLayerId ?: return
        val layer = state.document.layers.firstOrNull { it.id == layerId } ?: return
        if (!layer.visible || layer.locked || state.activeTool !in listOf(EditorTool.DRAW, EditorTool.ERASE)) return
        activeLayerId = layerId
        activeStroke = Stroke(
            colorArgb = state.brushColorArgb, size = state.brushSize, opacity = state.brushOpacity,
            tool = if (state.activeTool == EditorTool.ERASE) StrokeTool.ERASER else StrokeTool.BRUSH,
            points = listOf(StrokePoint(point.x, point.y, timestamp = System.currentTimeMillis()))
        )
    }
    fun appendStrokePoint(point: Offset) {
        val current = activeStroke ?: return
        val last = current.points.lastOrNull()
        if (last != null && (last.x - point.x) * (last.x - point.x) + (last.y - point.y) * (last.y - point.y) < 0.25f) return
        activeStroke = current.copy(points = current.points + StrokePoint(point.x, point.y, timestamp = System.currentTimeMillis()))
    }
    fun cancelStroke() { activeStroke = null; activeLayerId = null }
    fun activeStroke(): Stroke? = activeStroke

    fun commitStroke() {
        val stroke = activeStroke ?: return
        val layerId = activeLayerId ?: return
        val before = state.document
        val after = DocumentReducer.appendStroke(before, layerId, stroke)
        if (after == before) { cancelStroke(); return }
        history.execute(object : EditorCommand {
            override fun execute() { state = state.copy(document = after) }
            override fun undo() { state = state.copy(document = before) }
        })
        cancelStroke()
    }
    fun undo() { history.undo() }
    fun redo() { history.redo() }
    fun canUndo() = history.canUndo()
    fun canRedo() = history.canRedo()
    fun replaceDocument(document: CanvasDocument) { state = state.copy(document = document, selectedLayerId = state.selectedLayerId ?: document.layers.firstOrNull()?.id) }
}
