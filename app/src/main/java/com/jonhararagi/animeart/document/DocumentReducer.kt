package com.jonhararagi.animeart.document

object DocumentReducer {
    fun addLayer(document: CanvasDocument, name: String): CanvasDocument =
        document.copy(layers = document.layers + Layer(name = name, content = LayerContent.Drawing()))

    fun removeLayer(document: CanvasDocument, id: String): CanvasDocument =
        document.copy(layers = document.layers.filterNot { it.id == id })

    fun setLayerVisibility(document: CanvasDocument, id: String, visible: Boolean): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(visible = visible) else it })

    fun setLayerLocked(document: CanvasDocument, id: String, locked: Boolean): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(locked = locked) else it })

    fun setLayerOpacity(document: CanvasDocument, id: String, opacity: Float): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(opacity = opacity.coerceIn(0f, 1f)) else it })

    fun moveLayer(document: CanvasDocument, id: String, toIndex: Int): CanvasDocument {
        val current = document.layers.indexOfFirst { it.id == id }
        if (current < 0) return document
        val copy = document.layers.toMutableList()
        val layer = copy.removeAt(current)
        copy.add(toIndex.coerceIn(0, copy.size), layer)
        return document.copy(layers = copy)
    }

    fun appendStroke(document: CanvasDocument, layerId: String, stroke: Stroke): CanvasDocument =
        document.copy(layers = document.layers.map { layer ->
            if (layer.id != layerId || layer.locked || !layer.visible) layer
            else {
                val drawing = layer.content as? LayerContent.Drawing ?: LayerContent.Drawing()
                layer.copy(content = drawing.copy(strokes = drawing.strokes + stroke))
            }
        })

    fun replaceLayerStrokes(document: CanvasDocument, layerId: String, strokes: List<Stroke>): CanvasDocument =
        document.copy(layers = document.layers.map { layer ->
            if (layer.id != layerId) layer
            else layer.copy(content = LayerContent.Drawing(strokes))
        })

    fun activeStrokes(document: CanvasDocument, layerId: String?): List<Stroke> =
        document.layers.firstOrNull { it.id == layerId }
            ?.let { (it.content as? LayerContent.Drawing)?.strokes.orEmpty() }
            .orEmpty()
}
