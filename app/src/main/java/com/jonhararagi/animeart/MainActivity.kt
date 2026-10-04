package com.jonhararagi.animeart

import android.os.Bundle
import android.os.SystemClock
import android.util.Log
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
        Log.i("AnimeArtDiag", "ONCREATE_START ns=" + SystemClock.elapsedRealtimeNanos())

        val initialDocument = runCatching {
            ProjectPersistence(this).loadDocument() ?: CanvasDocument()
        }.getOrDefault(CanvasDocument())
        Log.i("AnimeArtDiag", "BASIC_INIT_END ns=" + SystemClock.elapsedRealtimeNanos())

        Log.i("AnimeArtDiag", "SETCONTENT_START ns=" + SystemClock.elapsedRealtimeNanos())
        setContent {
            MaterialTheme {
                Surface {
                    EditorScreen(initialDocument = initialDocument)
                }
            }
        }
        Log.i("AnimeArtDiag", "SETCONTENT_END ns=" + SystemClock.elapsedRealtimeNanos())
    }
}
