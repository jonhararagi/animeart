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
        val t0 = SystemClock.elapsedRealtimeNanos()
        Log.i("AnimeArtStartup", "T0 onCreate START ns=" + t0)
        super.onCreate(savedInstanceState)
        Log.i("AnimeArtStartup", "T1 basic initialization END ns=" + SystemClock.elapsedRealtimeNanos())

        Log.i("AnimeArtStartup", "T2 loadDocument START ns=" + SystemClock.elapsedRealtimeNanos())
        val persistedDocument = ProjectPersistence(this).loadDocument()
        Log.i("AnimeArtStartup", "T3 loadDocument END ns=" + SystemClock.elapsedRealtimeNanos())

        Log.i("AnimeArtStartup", "T4 CanvasDocument START ns=" + SystemClock.elapsedRealtimeNanos())
        val initialDocument = persistedDocument ?: CanvasDocument()
        Log.i("AnimeArtStartup", "T5 CanvasDocument END ns=" + SystemClock.elapsedRealtimeNanos())

        Log.i("AnimeArtStartup", "T6 setContent START ns=" + SystemClock.elapsedRealtimeNanos())
        setContent {
            MaterialTheme {
                Surface {
                    EditorScreen(initialDocument = initialDocument)
                }
            }
        }
        Log.i("AnimeArtStartup", "T7 setContent END ns=" + SystemClock.elapsedRealtimeNanos())
    }
}
