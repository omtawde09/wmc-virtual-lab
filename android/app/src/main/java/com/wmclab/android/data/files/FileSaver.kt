package com.wmclab.android.data.files

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import java.io.File

/**
 * Saves a generated document into the public Downloads folder.
 *
 * The WebView builds the .docx itself (see frontend/src/docx/buildDocx.js) and
 * hands it over as base64; a page inside a WebView cannot write to shared
 * storage on its own, so this is the native half of the export.
 *
 * Uses MediaStore on API 29+ (scoped storage, no permission needed) and falls
 * back to a direct write on older releases.
 */
class FileSaver(private val context: Context) {

    /** @return a human-readable location for the saved file. */
    fun saveToDownloads(fileName: String, base64: String, mimeType: String): String {
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        val safeName = fileName.replace(Regex("""[\\/:*?"<>|]"""), "_")

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: error("Could not create the file in Downloads.")

            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: error("Could not open the file for writing.")

            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            "Downloads/$safeName"
        } else {
            @Suppress("DEPRECATION")
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!dir.exists()) dir.mkdirs()
            val out = File(dir, safeName)
            out.writeBytes(bytes)
            out.absolutePath
        }
    }
}
