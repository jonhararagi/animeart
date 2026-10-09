package com.jonhararagi.animeart.persistence

import android.content.Context
import com.jonhararagi.animeart.document.*
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

sealed interface RecoveryResult {
    data object Missing : RecoveryResult
    data class Loaded(val document: CanvasDocument) : RecoveryResult
    data object Failed : RecoveryResult
}

class ProjectPersistence(private val context: Context) {
    private val prefs = context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)

    fun save(projectId: String, document: CanvasDocument) {
        val layers = JSONArray().apply {
            document.layers.forEach { layer ->
                val strokes = JSONArray()
                (layer.content as? LayerContent.Drawing)?.strokes?.forEach { stroke ->
                    val points = JSONArray()
                    stroke.points.forEach { p ->
                        points.put(JSONObject()
                            .put("x", p.x).put("y", p.y)
                            .put("pressure", p.pressure).put("timestamp", p.timestamp))
                    }
                    strokes.put(JSONObject()
                        .put("id", stroke.id).put("color", stroke.colorArgb)
                        .put("size", stroke.size).put("opacity", stroke.opacity)
                        .put("tool", stroke.tool.name).put("points", points))
                }
                put(JSONObject()
                    .put("id", layer.id)
                    .put("name", layer.name)
                    .put("visible", layer.visible)
                    .put("locked", layer.locked)
                    .put("opacity", layer.opacity)
                    .put("contentType", contentType(layer.content))
                    .put("contentValue", contentValue(layer.content))
                    .put("transform", JSONObject()
                        .put("translationX", layer.transform.translationX)
                        .put("translationY", layer.transform.translationY)
                        .put("scale", layer.transform.scale)
                        .put("rotation", layer.transform.rotation))
                    .put("strokes", strokes))
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

    fun loadDocument(): RecoveryResult {
        val raw = prefs.getString("project", null) ?: return RecoveryResult.Missing
        return try {
            RecoveryResult.Loaded(loadDocumentUnsafe(raw))
        } catch (_: Exception) {
            // Do not log the stored document: it may contain user content.
            RecoveryResult.Failed
        }
    }

    private fun loadDocumentUnsafe(raw: String): CanvasDocument {
        val root = JSONObject(raw)
        val width = root.getInt("width")
        val height = root.getInt("height")
        if (width <= 0 || height <= 0) {
            throw JSONException("Invalid document dimensions")
        }
        val layersJson = root.optJSONArray("layers")
            ?: throw JSONException("Missing document layers")
        if (layersJson.length() == 0) {
            throw JSONException("Document has no layers")
        }
        val layers = buildList {
            for (i in 0 until layersJson.length()) {
                val l = layersJson.getJSONObject(i)
                val strokesJson = l.optJSONArray("strokes") ?: throw JSONException("Missing layer strokes")
                val strokes = buildList {
                    for (j in 0 until strokesJson.length()) {
                        val s = strokesJson.getJSONObject(j)
                        val pointsJson = s.optJSONArray("points") ?: throw JSONException("Missing stroke points")
                        val points = buildList {
                            for (k in 0 until pointsJson.length()) {
                                val p = pointsJson.getJSONObject(k)
                                add(
                                    StrokePoint(
                                        p.getDouble("x").toFloat(),
                                        p.getDouble("y").toFloat(),
                                        p.optDouble("pressure", 1.0).toFloat(),
                                        p.optLong("timestamp")
                                    )
                                )
                            }
                        }
                        add(
                            Stroke(
                                id = s.getString("id"),
                                points = points,
                                colorArgb = s.optLong("color", 0xFF111111),
                                size = s.optDouble("size", 12.0).toFloat(),
                                opacity = s.optDouble("opacity", 1.0).toFloat(),
                                tool = StrokeTool.valueOf(s.optString("tool", "BRUSH"))
                            )
                        )
                    }
                }
                val layerContent = l.readContent()
                val transform = l.optJSONObject("transform")?.let {
                    Transform(
                        translationX = it.optDouble("translationX", 0.0).toFloat(),
                        translationY = it.optDouble("translationY", 0.0).toFloat(),
                        scale = it.optDouble("scale", 1.0).toFloat(),
                        rotation = it.optDouble("rotation", 0.0).toFloat()
                    )
                } ?: Transform()
                add(
                    Layer(
                        id = l.getString("id"),
                        name = l.getString("name"),
                        visible = l.optBoolean("visible", true),
                        locked = l.optBoolean("locked", false),
                        opacity = l.optDouble("opacity", 1.0).toFloat().coerceIn(0f, 1f),
                        transform = transform,
                        content = layerContent ?: LayerContent.Drawing(strokes)
                    )
                )
            }
        }
        return CanvasDocument(width, height, layers)
    }

    fun loadRecovery(): JSONObject? = prefs.getString("project", null)?.let(::JSONObject)
    fun clearRecovery() { prefs.edit().remove("project").apply() }
}


private fun contentType(content: LayerContent): String = when (content) {
    LayerContent.Empty -> "empty"
    is LayerContent.Drawing -> "drawing"
    is LayerContent.Image -> "image"
    is LayerContent.Reference -> "reference"
    is LayerContent.Text -> "text"
    is LayerContent.Shape -> "shape"
}

private fun contentValue(content: LayerContent): String = when (content) {
    LayerContent.Empty -> ""
    is LayerContent.Drawing -> ""
    is LayerContent.Image -> content.uri
    is LayerContent.Reference -> content.uri
    is LayerContent.Text -> content.value
    is LayerContent.Shape -> content.type
}

private fun JSONObject.readContent(): LayerContent? {
    if (!has("contentType") || isNull("contentType")) {
        throw JSONException("Missing layer content type")
    }
    return when (getString("contentType")) {
        "empty" -> LayerContent.Empty
        "image" -> LayerContent.Image(requiredContentValue())
        "reference" -> LayerContent.Reference(requiredContentValue())
        "text" -> LayerContent.Text(requiredContentValue())
        "shape" -> LayerContent.Shape(requiredContentValue())
        "drawing" -> null
        else -> throw JSONException("Unknown layer content type")
    }
}

private fun JSONObject.requiredContentValue(): String {
    if (!has("contentValue") || isNull("contentValue")) {
        throw JSONException("Missing layer content value")
    }
    return getString("contentValue")
}
