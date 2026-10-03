package com.jonhararagi.animeart.document

object DocumentReducer {
    fun addLayer(document: CanvasDocument, name: String): CanvasDocument =
        document.copy(layers = document.layers + Layer(name = name))

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
}
