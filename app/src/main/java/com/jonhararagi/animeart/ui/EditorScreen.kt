package com.jonhararagi.animeart.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateRotation
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke as DrawStroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.jonhararagi.animeart.document.*
import com.jonhararagi.animeart.editor.DrawingEditor
import com.jonhararagi.animeart.editor.LayerTransformMath
import com.jonhararagi.animeart.editor.ViewportTransform
import com.jonhararagi.animeart.persistence.ProjectPersistence
import kotlin.math.max

@Composable
fun EditorScreen() {
    val context = LocalContext.current
    val persistence = remember { ProjectPersistence(context) }
    val referenceStore = remember { ReferenceImageStore(context) }
    val editor = remember { DrawingEditor(EditorState(document = persistence.loadDocument() ?: CanvasDocument())) }
    val scope = rememberCoroutineScope()
    val referenceBitmaps = remember { mutableStateMapOf<String, ImageBitmap>() }
    var tick by remember { mutableIntStateOf(0) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var renameText by remember { mutableStateOf("") }
    fun refresh() { tick++ }

    val state = editor.state
    val selectedLayer = state.document.layers.firstOrNull { it.id == state.selectedLayerId }
    val referenceLayers = state.document.layers.filter { it.content is LayerContent.Reference }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { referenceStore.importImage("default", uri) }
            }.onSuccess { stored ->
                editor.addReferenceImage(stored.path, stored.width, stored.height)
                persistence.save("default", editor.state.document)
                refresh()
            }
        }
    }

    LaunchedEffect(referenceLayers.map { it.id to (it.content as LayerContent.Reference).uri }) {
        val activeIds = referenceLayers.map { it.id }.toSet()
        referenceBitmaps.keys.toList().filterNot(activeIds::contains).forEach(referenceBitmaps::remove)
        referenceLayers.forEach { layer ->
            if (!referenceBitmaps.containsKey(layer.id)) {
                val reference = layer.content as LayerContent.Reference
                val bitmap = withContext(Dispatchers.IO) { referenceStore.decodeForPreview(reference.uri) }
                if (bitmap != null) referenceBitmaps[layer.id] = bitmap.asImageBitmap()
            }
        }
    }

    LaunchedEffect(state.selectedLayerId, selectedLayer?.name) {
        renameText = selectedLayer?.name.orEmpty()
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("AnimeArt — Día 4", style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(onClick = { picker.launch(arrayOf("image/png", "image/jpeg", "image/webp")) }) { Text("Importar referencia") }
                TextButton(onClick = { editor.undo(); refresh() }, enabled = editor.canUndo()) { Text("↶") }
                TextButton(onClick = { editor.redo(); refresh() }, enabled = editor.canRedo()) { Text("↷") }
                TextButton(onClick = { persistence.save("default", editor.state.document) }) { Text("Guardar") }
            }
        }

        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(selected = state.activeTool == EditorTool.DRAW, onClick = { editor.setTool(EditorTool.DRAW); refresh() }, label = { Text("Pincel") })
            FilterChip(selected = state.activeTool == EditorTool.ERASE, onClick = { editor.setTool(EditorTool.ERASE); refresh() }, label = { Text("Borrador") })
            FilterChip(selected = state.activeTool == EditorTool.PAN, onClick = { editor.setTool(EditorTool.PAN); refresh() }, label = { Text("Pan") })
            FilterChip(selected = state.activeTool == EditorTool.SELECT, onClick = { editor.setTool(EditorTool.SELECT); refresh() }, label = { Text("Transformar") })
        }

        LayerPanel(
            state = state,
            renameText = renameText,
            onRenameText = { renameText = it },
            onCreate = { editor.createLayer("Layer"); refresh() },
            onSelect = { editor.selectLayer(it); refresh() },
            onVisibility = { id, value -> editor.selectLayer(id); editor.setLayerVisibility(value); refresh() },
            onLock = { id, value -> editor.selectLayer(id); editor.setLayerLocked(value); refresh() },
            onRename = { editor.renameLayer(renameText); refresh() },
            onDuplicate = { editor.duplicateSelectedLayer(); refresh() },
            onDelete = { editor.deleteSelectedLayer(); refresh() },
            onUp = { editor.moveSelectedLayerUp(); refresh() },
            onDown = { editor.moveSelectedLayerDown(); refresh() },
            onOpacity = { editor.setLayerOpacity(it); refresh() }
        )

        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0xFF111111L, 0xFFFF3355L, 0xFF3366FFL, 0xFF22AA66L, 0xFFFFFFFFL).forEach { color ->
                Button(onClick = { editor.setColor(color); refresh() }, contentPadding = PaddingValues(0.dp), modifier = Modifier.size(42.dp)) {
                    Text("●", color = Color(color.toULong()))
                }
            }
            Column(Modifier.weight(1f)) {
                Text("Pincel " + state.brushSize.toInt())
                Slider(value = state.brushSize, onValueChange = { editor.setBrushSize(it); refresh() }, valueRange = 1f..80f)
            }
            Column(Modifier.weight(1f)) {
                Text("Opacidad pincel " + (state.brushOpacity * 100).toInt() + "%")
                Slider(value = state.brushOpacity, onValueChange = { editor.setBrushOpacity(it); refresh() }, valueRange = 0.05f..1f)
            }
        }

        Canvas(
            Modifier.fillMaxWidth().weight(1f)
                .onSizeChanged { canvasSize = it }
                .pointerInput(state.activeTool, state.selectedLayerId, state.viewport, selectedLayer?.locked) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = false)
                        var navigation = false
                        var transforming = false
                        while (true) {
                            val event = awaitPointerEvent()
                            val pressed = event.changes.filter { it.pressed }
                            if (pressed.isEmpty()) {
                                when {
                                    transforming -> editor.commitLayerTransformGesture()
                                    !navigation -> editor.commitStroke()
                                }
                                refresh()
                                break
                            }

                            if (state.activeTool == EditorTool.SELECT) {
                                if (!transforming) {
                                    editor.beginLayerTransformGesture()
                                    transforming = true
                                }
                                val zoom = if (pressed.size >= 2) event.calculateZoom() else 1f
                                val rotation = if (pressed.size >= 2) event.calculateRotation() else 0f
                                val pan = event.calculatePan()
                                editor.updateLayerTransformGesture(pan, zoom, rotation)
                                pressed.forEach { it.consume() }
                                refresh()
                                continue
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
                                if (editor.activeStroke() == null) editor.beginStroke(documentPoint)
                                else editor.appendStrokePoint(documentPoint)
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
                drawRect(Color.White, topLeft = Offset(center.x - 540f, center.y - 540f), size = Size(1080f, 1080f))
                state.document.layers.filter { it.visible }.forEach { layer ->
                    val pivot = LayerTransformMath.contentPivot(layer.content)
                    withTransform({
                        translate(layer.transform.translationX, layer.transform.translationY)
                        rotate(layer.transform.rotation, pivot = pivot)
                        scale(layer.transform.scale, layer.transform.scale, pivot = pivot)
                    }) {
                        when (val content = layer.content) {
                            is LayerContent.Drawing -> {
                                content.strokes.forEach { stroke -> drawStroke(stroke, layer.opacity) }
                                if (layer.id == state.selectedLayerId && state.activeTool == EditorTool.SELECT) drawDrawingSelectionOverlay(content)
                            }
                            is LayerContent.Reference -> {
                                referenceBitmaps[layer.id]?.let { bitmap -> drawImage(bitmap, topLeft = Offset.Zero, alpha = layer.opacity) }
                                if (layer.id == state.selectedLayerId && state.activeTool == EditorTool.SELECT) {
                                    drawRect(Color(0xFF3366FF), topLeft = Offset.Zero, size = Size(content.width.toFloat(), content.height.toFloat()), style = DrawStroke(width = 2f))
                                }
                            }
                            else -> Unit
                        }
                    }
                }
                editor.activeStroke()?.let { active ->
                    val layer = state.document.layers.firstOrNull { it.id == state.selectedLayerId }
                    if (layer != null) {
                        val pivot = LayerTransformMath.contentPivot(layer.content)
                        withTransform({
                            translate(layer.transform.translationX, layer.transform.translationY)
                            rotate(layer.transform.rotation, pivot = pivot)
                            scale(layer.transform.scale, layer.transform.scale, pivot = pivot)
                        }) { drawStroke(active, 1f) }
                    }
                }
            }
        )

        Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            Text("Zoom " + (state.viewport.scale * 100).toInt() + "%")
            Text("Capa: " + (selectedLayer?.name ?: "—"))
            Text(if (state.activeTool == EditorTool.SELECT) "1 dedo = mover · 2 dedos = mover/escala/rotación" else "2 dedos = zoom/pan")
        }
    }
    @Suppress("UNUSED_VARIABLE") val forceRecompose = tick
}

@Composable
private fun LayerPanel(
    state: EditorState,
    renameText: String,
    onRenameText: (String) -> Unit,
    onCreate: () -> Unit,
    onSelect: (String) -> Unit,
    onVisibility: (String, Boolean) -> Unit,
    onLock: (String, Boolean) -> Unit,
    onRename: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
    onUp: () -> Unit,
    onDown: () -> Unit,
    onOpacity: (Float) -> Unit
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Button(onClick = onCreate) { Text("+ Capa") }
            OutlinedTextField(value = renameText, onValueChange = onRenameText, modifier = Modifier.weight(1f), singleLine = true, label = { Text("Nombre") })
            TextButton(onClick = onRename) { Text("Renombrar") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = onDuplicate, enabled = state.selectedLayerId != null) { Text("Duplicar") }
            TextButton(onClick = onDelete, enabled = state.document.layers.size > 1) { Text("Eliminar") }
            TextButton(onClick = onUp) { Text("↑") }
            TextButton(onClick = onDown) { Text("↓") }
        }
        LazyColumn(Modifier.heightIn(max = 150.dp)) {
            items(state.document.layers.asReversed(), key = { it.id }) { layer ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { onVisibility(layer.id, !layer.visible) }) { Text(if (layer.visible) "👁" else "·") }
                    TextButton(onClick = { onLock(layer.id, !layer.locked) }) { Text(if (layer.locked) "🔒" else "🔓") }
                    Text(
                        if (layer.content is LayerContent.Reference) "🖼 \${layer.name}" else layer.name,
                        modifier = Modifier.weight(1f),
                        style = if (layer.id == state.selectedLayerId) MaterialTheme.typography.labelLarge else MaterialTheme.typography.bodyMedium
                    )
                    TextButton(onClick = { onSelect(layer.id) }) { Text(if (layer.id == state.selectedLayerId) "●" else "○") }
                }
            }
        }
        Text("Opacidad de capa " + ((state.document.layers.firstOrNull { it.id == state.selectedLayerId }?.opacity ?: 1f) * 100).toInt() + "%")
        Slider(value = state.document.layers.firstOrNull { it.id == state.selectedLayerId }?.opacity ?: 1f, onValueChange = onOpacity, valueRange = 0f..1f)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawStroke(stroke: Stroke, layerOpacity: Float) {
    if (stroke.points.isEmpty()) return
    val path = Path().apply {
        moveTo(stroke.points.first().x, stroke.points.first().y)
        stroke.points.drop(1).forEach { lineTo(it.x, it.y) }
    }
    val color = Color(stroke.colorArgb.toULong()).copy(alpha = stroke.opacity * layerOpacity)
    drawPath(path = path, color = if (stroke.tool == StrokeTool.ERASER) Color.Transparent else color, style = DrawStroke(width = stroke.size, cap = StrokeCap.Round, join = StrokeJoin.Round), blendMode = if (stroke.tool == StrokeTool.ERASER) BlendMode.Clear else BlendMode.SrcOver)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDrawingSelectionOverlay(drawing: LayerContent.Drawing) {
    val points = drawing.strokes.flatMap { it.points }
    if (points.isEmpty()) return
    val minX = points.minOf { it.x }
    val minY = points.minOf { it.y }
    val maxX = points.maxOf { it.x }
    val maxY = points.maxOf { it.y }
    drawRect(color = Color(0xFF3366FF), topLeft = Offset(minX, minY), size = Size((maxX - minX).coerceAtLeast(1f), (maxY - minY).coerceAtLeast(1f)), style = DrawStroke(width = 2f))
}
