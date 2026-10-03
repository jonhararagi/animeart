package com.jonhararagi.animeart.persistence

import android.content.Context
import com.jonhararagi.animeart.document.CanvasDocument
import org.json.JSONArray
import org.json.JSONObject

class ProjectPersistence(private val context: Context) {
    private val prefs = context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)

    fun save(projectId: String, document: CanvasDocument) {
        val layers = JSONArray().apply {
            document.layers.forEach { layer ->
                put(JSONObject().apply {
                    put("id", layer.id)
                    put("name", layer.name)
                    put("visible", layer.visible)
                    put("locked", layer.locked)
                    put("opacity", layer.opacity.toDouble())
                    put("rotation", layer.transform.rotation.toDouble())
                    put("scale", layer.transform.scale.toDouble())
                    put("translationX", layer.transform.translationX.toDouble())
                    put("translationY", layer.transform.translationY.toDouble())
                })
            }
        }
        val root = JSONObject()
            .put("projectId", projectId)
            .put("timestamp", System.currentTimeMillis())
            .put("width", document.width)
            .put("height", document.height)
            .put("layers", layers)
        prefs.edit().putString("project", root.toString()).apply()
    }

    fun loadRecovery(): JSONObject? =
        prefs.getString("project", null)?.let { JSONObject(it) }

    fun clearRecovery() {
        prefs.edit().remove("project").apply()
    }
}
