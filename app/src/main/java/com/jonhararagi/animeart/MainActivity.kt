package com.jonhararagi.animeart

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.jonhararagi.animeart.persistence.ProjectPersistence
import com.jonhararagi.animeart.ui.EditorScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var failed by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<Throwable?>(null) }
                    if (failed == null) {
                        try {
                            EditorScreen()
                        } catch (t: Throwable) {
                            Log.e("AnimeArtStartup", "EditorScreen failed during startup", t)
                            failed = t
                        }
                    } else {
                        StartupRecoveryScreen(
                            error = failed!!,
                            onClearRecovery = {
                                ProjectPersistence(this@MainActivity).clearRecovery()
                                failed = null
                            }
                        )
                    }
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun StartupRecoveryScreen(error: Throwable, onClearRecovery: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("AnimeArt no pudo iniciar el editor", style = MaterialTheme.typography.titleMedium)
        Text(
            error.javaClass.simpleName + ": " + (error.message ?: "sin detalle"),
            style = MaterialTheme.typography.bodySmall
        )
        Button(onClick = onClearRecovery) {
            Text("Limpiar recuperación y reintentar")
        }
    }
}
