package com.jonhararagi.animeart.importexport

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

data class StoredReferenceImage(
    val path: String,
    val width: Int,
    val height: Int
)

class ReferenceImageStore(private val context: Context) {
    fun importImage(projectId: String, source: Uri, layerId: String = UUID.randomUUID().toString()): StoredReferenceImage {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(source).use { input ->
            requireNotNull(input) { "Unable to open reference image" }
            BitmapFactory.decodeStream(input, null, bounds)
        }
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Unsupported or invalid image" }

        val directory = File(context.filesDir, "projects/$projectId/references").apply { mkdirs() }
        val target = File(directory, "$layerId.bin")
        context.contentResolver.openInputStream(source).use { input ->
            requireNotNull(input) { "Unable to open reference image" }
            FileOutputStream(target).use { output -> input.copyTo(output, DEFAULT_BUFFER_SIZE) }
        }
        return StoredReferenceImage(target.absolutePath, bounds.outWidth, bounds.outHeight)
    }

    fun delete(path: String) {
        runCatching { File(path).delete() }
    }

    fun decodeForPreview(path: String, maxDimension: Int = 2048): android.graphics.Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / sample > maxDimension || bounds.outHeight / sample > maxDimension) {
            sample *= 2
        }
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeFile(path, options)
    }

    companion object {
        private const val DEFAULT_BUFFER_SIZE = 32 * 1024
    }
}
