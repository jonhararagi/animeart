package com.jonhararagi.animeart.document

import java.util.UUID

data class Transform(
    val translationX: Float = 0f,
    val translationY: Float = 0f,
    val scale: Float = 1f,
    val rotation: Float = 0f
)

enum class BlendMode {
    NORMAL, MULTIPLY, SCREEN, ADD
}

sealed interface LayerContent {
    data object Empty : LayerContent
    data class Image(val uri: String) : LayerContent
    data class Reference(val uri: String) : LayerContent
    data class Text(val value: String) : LayerContent
    data class Shape(val type: String) : LayerContent
    data object Drawing : LayerContent
}

data class Layer(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val visible: Boolean = true,
    val locked: Boolean = false,
    val opacity: Float = 1f,
    val transform: Transform = Transform(),
    val blendMode: BlendMode = BlendMode.NORMAL,
    val content: LayerContent = LayerContent.Empty
)

data class CanvasDocument(
    val width: Int = 1080,
    val height: Int = 1080,
    val layers: List<Layer> = listOf(Layer(name = "Background")),
    val metadata: Map<String, String> = emptyMap()
)

data class Viewport(
    val scale: Float = 1f,
    val translationX: Float = 0f,
    val translationY: Float = 0f,
    val rotation: Float = 0f
)

enum class EditorTool { DRAW, PAN, ERASE, SELECT }

data class EditorState(
    val document: CanvasDocument = CanvasDocument(),
    val selectedLayerId: String? = null,
    val viewport: Viewport = Viewport(),
    val activeTool: EditorTool = EditorTool.DRAW
)
