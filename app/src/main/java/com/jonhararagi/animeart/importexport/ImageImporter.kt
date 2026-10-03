package com.jonhararagi.animeart.importexport

import android.content.Context
import android.net.Uri

class ImageImporter(private val context: Context) {
    fun takeUri(uri: Uri): String = uri.toString()
    fun hasPersistedPermission(uri: Uri): Boolean =
        context.contentResolver.persistedUriPermissions.any { it.uri == uri }
}
