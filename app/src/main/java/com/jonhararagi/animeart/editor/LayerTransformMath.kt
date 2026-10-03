package com.jonhararagi.animeart.editor

import androidx.compose.ui.geometry.Offset
import com.jonhararagi.animeart.document.LayerContent
import com.jonhararagi.animeart.document.Transform
import kotlin.math.cos
import kotlin.math.sin

object LayerTransformMath {
    fun contentPivot(content: LayerContent): Offset {
        if (content is LayerContent.Reference && content.width > 0 && content.height > 0) {
            return Offset(content.width / 2f, content.height / 2f)
        }
        val points = (content as? LayerContent.Drawing)?.strokes?.flatMap { it.points }.orEmpty()
        if (points.isEmpty()) return Offset.Zero
        var minX = Float.POSITIVE_INFINITY
        var minY = Float.POSITIVE_INFINITY
        var maxX = Float.NEGATIVE_INFINITY
        var maxY = Float.NEGATIVE_INFINITY
        points.forEach {
            minX = minOf(minX, it.x)
            minY = minOf(minY, it.y)
            maxX = maxOf(maxX, it.x)
            maxY = maxOf(maxY, it.y)
        }
        return Offset((minX + maxX) / 2f, (minY + maxY) / 2f)
    }

    fun apply(point: Offset, transform: Transform, pivot: Offset): Offset {
        val scaled = pivot + (point - pivot) * transform.scale
        val radians = Math.toRadians(transform.rotation.toDouble())
        val cos = cos(radians).toFloat()
        val sin = sin(radians).toFloat()
        val relative = scaled - pivot
        val rotated = Offset(relative.x * cos - relative.y * sin, relative.x * sin + relative.y * cos)
        return pivot + rotated + Offset(transform.translationX, transform.translationY)
    }

    fun inverse(point: Offset, transform: Transform, pivot: Offset): Offset {
        val translated = point - Offset(transform.translationX, transform.translationY)
        val relative = translated - pivot
        val radians = Math.toRadians((-transform.rotation).toDouble())
        val cos = cos(radians).toFloat()
        val sin = sin(radians).toFloat()
        val rotated = Offset(relative.x * cos - relative.y * sin, relative.x * sin + relative.y * cos)
        return pivot + rotated / transform.scale.coerceAtLeast(0.0001f)
    }
}
