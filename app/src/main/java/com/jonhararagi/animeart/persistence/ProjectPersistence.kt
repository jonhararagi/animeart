package com.jonhararagi.animeart.persistence

import android.content.Context
import com.jonhararagi.animeart.document.*
import org.json.JSONArray
import org.json.JSONObject

class ProjectPersistence(private val context: Context) {
    private val prefs = context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)

    fun save(projectId: String, document: CanvasDocument) {
        val layers = JSONArray().apply {
            document.layers.forEach { layer ->
                val strokes = JSONArray()
                (layer.content as? LayerContent.Drawing)?.strokes?.forEach { stroke ->
                    val points = JSONArray()
                    stroke.points.forEach { p ->
                        points.put(JSONObject().put("x", p.x).put("y", p.y).put("pressure", p.pressure).put("timestamp", p.timestamp))
                    }
                    strokes.put(JSONObject()
                        .put("id", stroke.id).put("color", stroke.colorArgb)
                        .put("size", stroke.size).put("opacity", stroke.opacity)
                        .put("tool", stroke.tool.name).put("points", points))
                }
                put(JSONObject().put("id", layer.id).put("name", layer.name)
                    .put("visible", layer.visible).put("locked", layer.locked).put("opacity", layer.opacity)
                    .put("strokes", strokes))
            }
        }
        val root = JSONObject().put("projectId", projectId).put("timestamp", System.currentTimeMillis())
            .put("width", document.width).put("height", document.height).put("layers", layers)
        prefs.edit().putString("project", root.toString()).apply()
    }

    fun loadDocument(): CanvasDocument? {
        val root = prefs.getString("project", null)?.let(::JSONObject) ?: return null
        val layersJson = root.optJSONArray("layers") ?: return null
        val layers = buildList {
            for (i in 0 until layersJson.length()) {
                val l = layersJson.getJSONObject(i)
                val strokesJson = l.optJSONArray("strokes") ?: JSONArray()
                val strokes = buildList {
                    for (j in 0 until strokesJson.length()) {
                        val s = strokesJson.getJSONObject(j)
                        val pointsJson = s.optJSONArray("points") ?: JSONArray()
                        val points = buildList {
                            for (k in 0 until pointsJson.length()) {
                                val p = pointsJson.getJSONObject(k)
                                add(StrokePoint(p.getDouble("x").toFloat(), p.getDouble("y").toFloat(),
                                    p.optDouble("pressure", 1.0).toFloat(), p.optLong("timestamp")))
                            }
                        }
                        add(Stroke(id = s.getString("id"), points = points, colorArgb = s.optLong("color", 0xFF111111),
                            size = s.optDouble("size", 12.0).toFloat(), opacity = s.optDouble("opacity", 1.0).toFloat(),
                            tool = runCatching { StrokeTool.valueOf(s.optString("tool", "BRUSH")) }.getOrDefault(StrokeTool.BRUSH)))
                    }
                }
                add(Layer(id = l.getString("id"), name = l.getString("name"), visible = l.optBoolean("visible", true),
                    locked = l.optBoolean("locked", false), opacity = l.optDouble("opacity", 1.0).toFloat(),
                    content = LayerContent.Drawing(strokes)))
            }
        }
        return CanvasDocument(root.optInt("width", 1080), root.optInt("height", 1080), layers.ifEmpty {
            listOf(Layer(name = "Background", content = LayerContent.Drawing()))
        })
    }

    fun loadRecovery(): JSONObject? = prefs.getString("project", null)?.let(::JSONObject)
    fun clearRecovery() { prefs.edit().remove("project").apply() }
}
