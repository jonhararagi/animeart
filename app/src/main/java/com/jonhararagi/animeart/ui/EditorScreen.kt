package com.jonhararagi.animeart.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jonhararagi.animeart.document.*
import com.jonhararagi.animeart.editor.DrawingEditor
import com.jonhararagi.animeart.editor.ViewportTransform
import com.jonhararagi.animeart.persistence.ProjectPersistence
import kotlin.math.max

@Composable
fun EditorScreen() {
    val context = LocalContext.current
    val persistence = remember { ProjectPersistence(context) }
    val editor = remember { DrawingEditor(EditorState(document = persistence.loadDocument() ?: CanvasDocument())) }
    var tick by remember { mutableIntStateOf(0) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    fun refresh() { tick++ }
    val state = editor.state

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("AnimeArt — Día 2", style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(onClick = { editor.undo(); refresh() }, enabled = editor.canUndo()) { Text("↶") }
                TextButton(onClick = { editor.redo(); refresh() }, enabled = editor.canRedo()) { Text("↷") }
                TextButton(onClick = { persistence.save("default", editor.state.document) }) { Text("Guardar") }
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(selected = state.activeTool == EditorTool.DRAW, onClick = { editor.setTool(EditorTool.DRAW); refresh() }, label = { Text("Pincel") })
            FilterChip(selected = state.activeTool == EditorTool.ERASE, onClick = { editor.setTool(EditorTool.ERASE); refresh() }, label = { Text("Borrador") })
            FilterChip(selected = state.activeTool == EditorTool.PAN, onClick = { editor.setTool(EditorTool.PAN); refresh() }, label = { Text("Pan") })
            Text("Capa: " + (state.document.layers.firstOrNull { it.id == state.selectedLayerId }?.name ?: "—"))
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0xFF111111L, 0xFFFF3355L, 0xFF3366FFL, 0xFF22AA66L, 0xFFFFFFFFL).forEach { color ->
                Button(onClick = { editor.setColor(color); refresh() }, contentPadding = PaddingValues(0.dp), modifier = Modifier.size(42.dp)) {
                    Text("●", color = Color(color))
                }
            }
            Column(Modifier.weight(1f)) {
                Text("Tamaño " + state.brushSize.toInt())
                Slider(value = state.brushSize, onValueChange = { editor.setBrushSize(it); refresh() }, valueRange = 1f..80f)
            }
            Column(Modifier.weight(1f)) {
                Text("Opacidad " + (state.brushOpacity * 100).toInt() + "%")
                Slider(value = state.brushOpacity, onValueChange = { editor.setBrushOpacity(it); refresh() }, valueRange = 0.05f..1f)
            }
        }

        Canvas(
            Modifier.fillMaxWidth().weight(1f).onSizeChanged { canvasSize = it }.pointerInput(state.activeTool, state.viewport) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    var navigation = false
                    while (true) {
                        val event = awaitPointerEvent()
                        val pressed = event.changes.filter { it.pressed }
                        if (pressed.isEmpty()) {
                            if (!navigation) editor.commitStroke()
                            refresh()
                            break
                        }
                        if (pressed.size >= 2) {
                            if (!navigation) { editor.cancelStroke(); navigation = true }
                            val zoom = event.calculateZoom()
                            val pan = event.calculatePan()
                            val center = event.calculateCentroid(useCurrent = false)
                            val old = editor.state.viewport
                            val newScale = (old.scale * zoom).coerceIn(0.25f, 8f)
                            val factor = newScale / max(old.scale, 0.0001f)
                            val newTranslation = Offset(
                                old.translationX + pan.x - (center.x - canvasSize.width / 2f) * (factor - 1f),
                                old.translationY + pan.y - (center.y - canvasSize.height / 2f) * (factor - 1f)
                            )
                            editor.setViewport(old.copy(scale = newScale, translationX = newTranslation.x, translationY = newTranslation.y))
                            pressed.forEach { it.consume() }
                            refresh()
                            continue
                        }
                        val change = pressed.first()
                        val center = Offset(canvasSize.width / 2f, canvasSize.height / 2f)
                        if (navigation || editor.state.activeTool == EditorTool.PAN) {
                            val delta = change.position - change.previousPosition
                            val old = editor.state.viewport
                            editor.setViewport(old.copy(translationX = old.translationX + delta.x, translationY = old.translationY + delta.y))
                        } else {
                            val documentPoint = ViewportTransform.screenToDocument(change.position, editor.state.viewport, center)
                            if (editor.activeStroke() == null) editor.beginStroke(documentPoint) else editor.appendStrokePoint(documentPoint)
                        }
                        change.consume()
                        refresh()
                    }
                }
            }
        ) {
            drawRect(Color(0xFFF3F3F3))
            val viewport = state.viewport
            val center = Offset(size.width / 2f, size.height / 2f)
            withTransform({
                translate(viewport.translationX, viewport.translationY)
                scale(viewport.scale, viewport.scale, pivot = center)
            }) {
                drawRect(Color.White, topLeft = Offset(center.x - 540f, center.y - 540f), size = androidx.compose.ui.geometry.Size(1080f, 1080f))
                state.document.layers.filter { it.visible }.forEach { layer ->
                    val drawing = layer.content as? LayerContent.Drawing ?: return@forEach
                    drawing.strokes.forEach { stroke -> drawStroke(stroke, layer.opacity) }
                }
                editor.activeStroke()?.let { drawStroke(it, 1f) }
            }
        }
        Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            Text("Zoom " + (state.viewport.scale * 100).toInt() + "%")
            Text("Trazos " + DocumentReducer.activeStrokes(state.document, state.selectedLayerId).size)
            Text("2 dedos = zoom/pan")
        }
    }
    @Suppress("UNUSED_VARIABLE") val forceRecompose = tick
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawStroke(stroke: Stroke, layerOpacity: Float) {
    if (stroke.points.isEmpty()) return
    val path = Path().apply {
        moveTo(stroke.points.first().x, stroke.points.first().y)
        stroke.points.drop(1).forEach { lineTo(it.x, it.y) }
    }
    val color = Color(stroke.colorArgb.toULong()).copy(alpha = stroke.opacity * layerOpacity)
    drawPath(
        path = path,
        color = if (stroke.tool == StrokeTool.ERASER) Color.Transparent else color,
        style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke.size, cap = StrokeCap.Round, join = StrokeJoin.Round),
        blendMode = if (stroke.tool == StrokeTool.ERASER) BlendMode.Clear else BlendMode.SrcOver
    )
}
