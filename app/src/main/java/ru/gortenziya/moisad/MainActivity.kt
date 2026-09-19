package ru.gortenziya.moisad

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.widget.Toast
import org.json.JSONObject

/** Офлайн-оболочка: данные растений хранятся в WebView localStorage. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val exportRequest = 501
    private val importRequest = 502
    private val notificationRequest = 503
    private var pendingExport = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(247, 247, 242)
        window.navigationBarColor = android.graphics.Color.WHITE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        } else {
            window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true // только локальные файлы приложения
        web.settings.allowContentAccess = false
        web.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        web.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return request?.url.toString() != "file:///android_asset/index.html"
            }
            @Deprecated("Compatibility for Android 6")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url != "file:///android_asset/index.html"
            }
        }
        web.addJavascriptInterface(Bridge(), "GardenAndroid")
        setContentView(web)
        web.loadUrl("file:///android_asset/index.html")
        if (ReminderReceiver.isEnabled(this)) ReminderReceiver.schedule(this)
    }

    inner class Bridge {
        @JavascriptInterface
        fun setReminderEnabled(enabled: Boolean) {
            runOnUiThread {
                if (enabled && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), notificationRequest)
                } else {
                    ReminderReceiver.setEnabled(this@MainActivity, enabled)
                    reportReminderState()
                }
            }
        }

        @JavascriptInterface
        fun getReminderState(): Boolean = ReminderReceiver.isEnabled(this@MainActivity)

        @JavascriptInterface
        fun exportBackup(data: String) {
            if (data.length > 1_000_000) return
            runOnUiThread {
                pendingExport = data
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, "gortenziya-moy-sad.json")
                }
                startActivityForResult(intent, exportRequest)
            }
        }

        @JavascriptInterface
        fun importBackup() {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                }
                startActivityForResult(intent, importRequest)
            }
        }
    }

    private fun reportReminderState() {
        val enabled = ReminderReceiver.isEnabled(this)
        web.evaluateJavascript("window.nativeReminderStatus && window.nativeReminderStatus($enabled);", null)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == notificationRequest) {
            val accepted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            ReminderReceiver.setEnabled(this, accepted)
            reportReminderState()
            if (!accepted) Toast.makeText(this, "Для напоминаний разрешите уведомления в настройках", Toast.LENGTH_LONG).show()
        }
    }

    @Deprecated("Using ACTION_OPEN_DOCUMENT for compatibility with Android 6+")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data?.data == null) return
        val uri = data.data!!
        try {
            when (requestCode) {
                exportRequest -> {
                    val stream = contentResolver.openOutputStream(uri) ?: throw IllegalStateException("Невозможно создать файл")
                    stream.use { it.write(pendingExport.toByteArray(Charsets.UTF_8)) }
                    pendingExport = ""
                    Toast.makeText(this, "Резервная копия сохранена", Toast.LENGTH_SHORT).show()
                }
                importRequest -> {
                    val content = contentResolver.openInputStream(uri)?.use { stream ->
                        val bytes = stream.readBytes()
                        if (bytes.size > 1_000_000) throw IllegalArgumentException("Слишком большой файл")
                        bytes.toString(Charsets.UTF_8)
                    } ?: return
                    web.evaluateJavascript("window.receiveImportBackup(${JSONObject.quote(content)});", null)
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Не удалось прочитать или сохранить файл", Toast.LENGTH_LONG).show()
        }
    }

    @Deprecated("Back button bridge to offline UI")
    override fun onBackPressed() {
        web.evaluateJavascript("window.gardenBack ? window.gardenBack() : 'exit';") { result ->
            if (result == "\"exit\"" || result == "null") finish()
        }
    }

    override fun onDestroy() {
        web.removeJavascriptInterface("GardenAndroid")
        web.destroy()
        super.onDestroy()
    }
}
