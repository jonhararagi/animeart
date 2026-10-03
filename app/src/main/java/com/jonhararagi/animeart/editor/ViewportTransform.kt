package com.jonhararagi.animeart.editor

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.Viewport

object ViewportTransform {
    fun screenToDocument(screen: Offset, viewport: Viewport, center: Offset): Offset {
        val local = screen - center - Offset(viewport.translationX, viewport.translationY)
        return Offset(local.x / viewport.scale + center.x, local.y / viewport.scale + center.y)
    }
    fun documentToScreen(document: Offset, viewport: Viewport, center: Offset): Offset {
        return (document - center) * viewport.scale + center + Offset(viewport.translationX, viewport.translationY)
    }
}
