package com.jonhararagi.animeart.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

@androidx.compose.runtime.Composable
fun EditorScreen() {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { androidx.compose.runtime.mutableStateOf(Offset.Zero) }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("←  AnimeArt")
            Text("⋮")
        }
        HorizontalDivider()
        Canvas(
            Modifier.fillMaxWidth().weight(1f).pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.25f, 8f)
                    offset += pan
                }
            }
        ) {
            withTransform({
                translate(offset.x, offset.y)
                scale(scale, scale, center = center)
            }) {
                drawRect(
                    topLeft = Offset(
                        center.x - size.minDimension * 0.35f,
                        center.y - size.minDimension * 0.35f
                    ),
                    size = androidx.compose.ui.geometry.Size(
                        size.minDimension * 0.7f,
                        size.minDimension * 0.7f
                    )
                )
            }
        }
        Row(
            Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(onClick = {}) { Text("✎") }
            Button(onClick = {}) { Text("🖐") }
            Button(onClick = {}) { Text("⌫") }
            Button(onClick = {}) { Text("+") }
            Button(onClick = {}) { Text("▣") }
        }
        Text("Capas", Modifier.padding(12.dp))
    }
}
