package com.jonhararagi.animeart.tools

interface BackgroundRemovalEngine {
    fun removeBackground(input: String): String
    fun refineMask(input: String): String
    fun applyMask(input: String, mask: String): String
    fun restore(input: String): String
}

interface ShadingEngine {
    fun applyShadow(input: String, intensity: Float, direction: Float, softness: Float): String
    fun applyLight(input: String, intensity: Float, direction: Float, softness: Float): String
}

data class Filter(
    val id: String,
    val name: String,
    val parameters: Map<String, Float> = emptyMap()
)

data class StylePreset(
    val id: String,
    val name: String,
    val textStyle: Map<String, String> = emptyMap(),
    val outline: Float = 0f,
    val shadow: Float = 0f,
    val glow: Float = 0f,
    val shapes: Map<String, String> = emptyMap()
)
