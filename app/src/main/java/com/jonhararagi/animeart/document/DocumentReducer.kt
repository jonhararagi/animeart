package com.jonhararagi.animeart.document

object DocumentReducer {
    private fun normalizeName(name: String, fallback: String = "Layer"): String =
        name.trim().ifEmpty { fallback }

    fun addLayer(document: CanvasDocument, name: String, index: Int = document.layers.size): CanvasDocument {
        val layer = Layer(name = normalizeName(name), content = LayerContent.Drawing())
        val layers = document.layers.toMutableList()
        layers.add(index.coerceIn(0, layers.size), layer)
        return document.copy(layers = layers)
    }

    fun renameLayer(document: CanvasDocument, id: String, name: String): CanvasDocument =
        document.copy(layers = document.layers.map { layer ->
            if (layer.id == id) layer.copy(name = normalizeName(name, layer.name)) else layer
        })

    fun removeLayer(document: CanvasDocument, id: String): CanvasDocument =
        if (document.layers.size <= 1) document else document.copy(layers = document.layers.filterNot { it.id == id })

    fun setLayerVisibility(document: CanvasDocument, id: String, visible: Boolean): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(visible = visible) else it })

    fun setLayerLocked(document: CanvasDocument, id: String, locked: Boolean): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(locked = locked) else it })

    fun setLayerOpacity(document: CanvasDocument, id: String, opacity: Float): CanvasDocument =
        document.copy(layers = document.layers.map { if (it.id == id) it.copy(opacity = opacity.coerceIn(0f, 1f)) else it })

    fun setLayerTransform(document: CanvasDocument, id: String, transform: Transform): CanvasDocument =
        document.copy(layers = document.layers.map {
            if (it.id == id) it.copy(transform = transform.normalized()) else it
        })

    fun moveLayer(document: CanvasDocument, id: String, toIndex: Int): CanvasDocument {
        val current = document.layers.indexOfFirst { it.id == id }
        if (current < 0 || document.layers.size < 2) return document
        val copy = document.layers.toMutableList()
        val layer = copy.removeAt(current)
        copy.add(toIndex.coerceIn(0, copy.size), layer)
        return document.copy(layers = copy)
    }

    fun moveLayerUp(document: CanvasDocument, id: String): CanvasDocument {
        val index = document.layers.indexOfFirst { it.id == id }
        return if (index < 0) document else moveLayer(document, id, index + 1)
    }

    fun moveLayerDown(document: CanvasDocument, id: String): CanvasDocument {
        val index = document.layers.indexOfFirst { it.id == id }
        return if (index < 0) document else moveLayer(document, id, index - 1)
    }

    fun duplicateLayer(document: CanvasDocument, id: String): Pair<CanvasDocument, String?> {
        val index = document.layers.indexOfFirst { it.id == id }
        if (index < 0) return document to null
        val original = document.layers[index]
        val copy = original.copy(
            id = java.util.UUID.randomUUID().toString(),
            name = uniqueCopyName(document, original.name),
            content = copyContent(original.content)
        )
        val layers = document.layers.toMutableList()
        layers.add(index + 1, copy)
        return document.copy(layers = layers) to copy.id
    }

    fun appendStroke(document: CanvasDocument, layerId: String, stroke: Stroke): CanvasDocument =
        document.copy(layers = document.layers.map { layer ->
            if (layer.id != layerId || layer.locked || !layer.visible) layer
            else {
                val drawing = layer.content as? LayerContent.Drawing ?: LayerContent.Drawing()
                layer.copy(content = drawing.copy(strokes = drawing.strokes + stroke))
            }
        })

    fun activeStrokes(document: CanvasDocument, layerId: String?): List<Stroke> =
        document.layers.firstOrNull { it.id == layerId }
            ?.let { (it.content as? LayerContent.Drawing)?.strokes.orEmpty() }
            .orEmpty()

    private fun uniqueCopyName(document: CanvasDocument, base: String): String {
        val root = if (base.endsWith(" Copy")) base else "$base Copy"
        if (document.layers.none { it.name == root }) return root
        var n = 2
        while (document.layers.any { it.name == "$root $n" }) n++
        return "$root $n"
    }

    private fun copyContent(content: LayerContent): LayerContent = when (content) {
        LayerContent.Empty -> LayerContent.Empty
        is LayerContent.Image -> content.copy()
        is LayerContent.Reference -> content.copy()
        is LayerContent.Text -> content.copy()
        is LayerContent.Shape -> content.copy()
        is LayerContent.Drawing -> LayerContent.Drawing(content.strokes.map { it.copy(points = it.points.toList()) })
    }
}

private fun Transform.normalized(): Transform = copy(scale = scale.coerceIn(0.01f, 100f))
