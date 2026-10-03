package com.jonhararagi.animeart.document

import java.util.UUID

data class Transform(
    val translationX: Float = 0f,
    val translationY: Float = 0f,
    val scale: Float = 1f,
    val rotation: Float = 0f
)

enum class BlendMode { NORMAL, MULTIPLY, SCREEN, ADD }

data class StrokePoint(val x: Float, val y: Float, val pressure: Float = 1f, val timestamp: Long = 0L)

enum class StrokeTool { BRUSH, ERASER }

data class Stroke(
    val id: String = UUID.randomUUID().toString(),
    val points: List<StrokePoint> = emptyList(),
    val colorArgb: Long = 0xFF111111,
    val size: Float = 12f,
    val opacity: Float = 1f,
    val tool: StrokeTool = StrokeTool.BRUSH
)

sealed interface LayerContent {
    data object Empty : LayerContent
    data class Image(val uri: String) : LayerContent
    data class Reference(
        val uri: String,
        val width: Int = 0,
        val height: Int = 0
    ) : LayerContent
    data class Text(val value: String) : LayerContent
    data class Shape(val type: String) : LayerContent
    data class Drawing(val strokes: List<Stroke> = emptyList()) : LayerContent
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
    val layers: List<Layer> = listOf(Layer(name = "Background", content = LayerContent.Drawing())),
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
    val activeTool: EditorTool = EditorTool.DRAW,
    val brushColorArgb: Long = 0xFF111111,
    val brushSize: Float = 12f,
    val brushOpacity: Float = 1f
)
