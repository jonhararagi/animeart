package com.jonhararagi.animeart

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.jonhararagi.animeart.document.CanvasDocument
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.ui.EditorScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val initialDocument = runCatching {
            ProjectPersistence(this).loadDocument() ?: CanvasDocument()
        }.getOrDefault(CanvasDocument())

        setContent {
            MaterialTheme {
                Surface {
                    EditorScreen(initialDocument = initialDocument)
                }
            }
        }
    }
}
