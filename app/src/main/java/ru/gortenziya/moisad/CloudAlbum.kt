package ru.gortenziya.moisad

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

/** Supabase REST. The publishable/anon key is public; NEVER put a service-role key in an APK. */
class CloudAlbum(private val context: Context) {
    private val root = BuildConfig.SUPABASE_URL.trim().trimEnd('/')
    private val key = BuildConfig.SUPABASE_ANON_KEY.trim()
    val configured = root.matches(Regex("https://[a-zA-Z0-9.-]+(:[0-9]{2,5})?")) && key.isNotEmpty()
    private val prefs = context.getSharedPreferences("garden_community", Context.MODE_PRIVATE)
    private val bucket = "garden-photos"

    private fun req(method: String, path: String, bearer: String? = null, body: ByteArray? = null,
                    type: String = "application/json", prefer: String? = null): String {
        val conn = (URL(root + path).openConnection() as HttpURLConnection)
        try {
            conn.requestMethod = method
            conn.connectTimeout = 12000
            conn.readTimeout = 20000
            conn.instanceFollowRedirects = false
            conn.setRequestProperty("apikey", key)
            // Publishable keys are NOT JWTs. They belong only in the apikey header.
            if (bearer != null) conn.setRequestProperty("Authorization", "Bearer $bearer")
            else if (key.startsWith("eyJ")) conn.setRequestProperty("Authorization", "Bearer $key")
            conn.setRequestProperty("Accept", "application/json")
            if (prefer != null) conn.setRequestProperty("Prefer", prefer)
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", type)
                conn.outputStream.use { it.write(body) }
            }
            val status = conn.responseCode
            val bytes = (if (status in 200..299) conn.inputStream else conn.errorStream)
                ?.use { it.readBytes() } ?: ByteArray(0)
            if (status !in 200..299) {
                throw IllegalStateException("Сервер вернул ошибку $status. Проверьте подключение и права доступа.")
            }
            return bytes.toString(Charsets.UTF_8)
        } finally { conn.disconnect() }
    }

    private fun json(x: JSONObject) = x.toString().toByteArray(Charsets.UTF_8)
    private fun session(): String {
        check(configured) { "Общий альбом не настроен" }
        var access = prefs.getString("access", "") ?: ""
        val expires = prefs.getLong("expires", 0)
        if (access.isNotBlank() && System.currentTimeMillis() < expires - 60_000) return access
        val refresh = prefs.getString("refresh", "") ?: ""
        val response = if (refresh.isNotEmpty()) {
            try { req("POST", "/auth/v1/token?grant_type=refresh_token", body=json(JSONObject().put("refresh_token", refresh))) }
            catch (_: Exception) { req("POST", "/auth/v1/signup", body=json(JSONObject())) }
        } else req("POST", "/auth/v1/signup", body=json(JSONObject()))
        val result = JSONObject(response)
        access = result.getString("access_token")
        val userId = result.getJSONObject("user").getString("id")
        prefs.edit().putString("access", access).putString("refresh", result.getString("refresh_token"))
            .putString("uid", userId)
            .putLong("expires", System.currentTimeMillis() + result.optLong("expires_in", 3600) * 1000L).apply()
        return access
    }

    private fun uid() = prefs.getString("uid", "") ?: ""
    private fun id(raw: String): String {
        val parsed = UUID.fromString(raw)
        require(parsed.toString() == raw) { "Неверный идентификатор фотографии" }
        return raw
    }
    private fun text(value: String, max: Int) = value.trim().take(max)

    fun execute(action: String, input: JSONObject, localPhotos: File): JSONObject {
        check(configured) { "Общий альбом не настроен" }
        val token = session()
        return when (action) {
            "list" -> {
                val columns = "id,owner_id,nickname,variety,variety_key,caption,storage_path,status,created_at"
                val varietyKey = input.optString("varietyKey", "").trim()
                require(varietyKey.isEmpty() || varietyKey.matches(Regex("[\\p{L}0-9_]{1,100}"))) { "Неверный сорт" }
                val filter = if (varietyKey.isEmpty()) "&variety_key=not.is.null" else
                    "&variety_key=eq.${URLEncoder.encode(varietyKey, "UTF-8")}" 
                val q1 = "/rest/v1/garden_photos?select=$columns&status=eq.approved$filter&order=created_at.desc&limit=30"
                val q2 = "/rest/v1/garden_photos?select=$columns&owner_id=eq.${uid()}&status=eq.pending$filter&order=created_at.desc&limit=10"
                val approved = JSONArray(req("GET", q1, token))
                val pending = JSONArray(req("GET", q2, token))
                val all = JSONArray()
                for (i in 0 until pending.length()) all.put(pending.getJSONObject(i))
                for (i in 0 until approved.length()) all.put(approved.getJSONObject(i))
                val paths = JSONArray()
                for (i in 0 until all.length()) paths.put(all.getJSONObject(i).getString("storage_path"))
                val signed = if (paths.length() == 0) JSONArray() else JSONArray(req("POST", "/storage/v1/object/sign/$bucket", token,
                    json(JSONObject().put("expiresIn", 3600).put("paths", paths))))
                val output = JSONArray()
                for (i in 0 until all.length()) {
                    val item = all.getJSONObject(i)
                    // Send only display fields to WebView: no owner ID and no storage path.
                    val sign = if (i < signed.length()) signed.getJSONObject(i).optString("signedURL") else ""
                    val url = if (sign.startsWith("/object/sign/$bucket/")) root + "/storage/v1" + sign else ""
                    output.put(JSONObject().put("id", item.getString("id"))
                        .put("nickname", item.optString("nickname")).put("variety", item.optString("variety"))
                        .put("variety_key", item.optString("variety_key"))
                        .put("caption", item.optString("caption")).put("created_at", item.optString("created_at"))
                        .put("status", item.optString("status")).put("mine", item.optString("owner_id") == uid())
                        .put("url", url))
                }
                // Forum topics are bound by a real administrator, using Telegram numeric IDs.
                // Topic names and caption hashtags are NOT used to infer the cultivar.
                val forumTopics = JSONArray()
                var telegramReady = true
                try {
                    val topicRows = JSONArray(req("GET", "/rest/v1/gortenzium_topics?select=chat_id,message_thread_id,variety_key,topic_title&" +
                        (if (varietyKey.isEmpty()) "variety_key=not.is.null" else "variety_key=eq.${URLEncoder.encode(varietyKey, "UTF-8")}") +
                        "&limit=150", token))
                    for (i in 0 until topicRows.length()) {
                        val row = topicRows.getJSONObject(i)
                        val group = row.optString("chat_id")
                        val thread = row.optString("message_thread_id")
                        if (!group.matches(Regex("-100[0-9]{6,}")) || !thread.matches(Regex("[0-9]{1,15}"))) continue
                        forumTopics.put(JSONObject().put("chat_id", group).put("message_thread_id", thread)
                            .put("variety_key", row.optString("variety_key")))
                    }
                    val telegramRows = JSONArray(req("GET", "/rest/v1/telegram_topic_gallery?select=chat_id,message_id,message_thread_id,caption,variety_key,variety_storage_path,created_at&variety_key=" +
                        (if (varietyKey.isEmpty()) "not.is.null" else "eq.${URLEncoder.encode(varietyKey, "UTF-8")}") +
                        "&order=created_at.desc&limit=30", token))
                    for (i in 0 until telegramRows.length()) {
                        val post = telegramRows.getJSONObject(i)
                        val messageId = post.optString("message_id")
                        val group = post.optString("chat_id")
                        val thread = post.optString("message_thread_id")
                        if (!messageId.matches(Regex("[1-9][0-9]{0,14}")) ||
                            !group.matches(Regex("-100[0-9]{6,}")) ||
                            !thread.matches(Regex("[1-9][0-9]{0,14}"))) continue
                        // Reject foreign or stale topic mappings, even if the row's variety_key was set.
                        val mapped = (0 until forumTopics.length()).any { idx ->
                            val t = forumTopics.getJSONObject(idx)
                            t.optString("chat_id") == group && t.optString("message_thread_id") == thread &&
                                t.optString("variety_key") == post.optString("variety_key")
                        }
                        if (!mapped) continue
                        val storedPath = post.optString("variety_storage_path")
                        val expectedPath = "Gortenzium/topics/${post.optString("variety_key")}/$messageId.jpg"
                        if (storedPath != expectedPath || storedPath.contains("..")) continue
                        val imageUrl = "$root/storage/v1/object/public/gortenzium-channel/" +
                            storedPath.split('/').joinToString("/") { URLEncoder.encode(it, "UTF-8") }
                        output.put(JSONObject()
                            .put("id", "telegram-$group-$messageId")
                            .put("nickname", "Gortenzium · тема Telegram")
                            .put("variety", post.optString("variety_key").replace('_', ' '))
                            .put("variety_key", post.optString("variety_key"))
                            .put("caption", post.optString("caption").take(180))
                            .put("created_at", post.optString("created_at"))
                            .put("status", "approved").put("mine", false).put("source", "telegram")
                            .put("forum_chat_id", group).put("forum_message_id", messageId)
                            .put("url", imageUrl))
                    }
                } catch (_: Exception) { telegramReady = false }
                JSONObject().put("items", output).put("topics", forumTopics).put("telegramReady", telegramReady)
            }
            "upload" -> {
                require(input.optBoolean("consent", false)) { "Подтвердите согласие на публикацию" }
                val nick = text(input.optString("nickname"), 24)
                require(nick.isNotBlank()) { "Укажите псевдоним" }
                val photoId = id(input.getString("photoId"))
                val file = File(localPhotos, "$photoId.jpg")
                require(file.canonicalFile.parentFile == localPhotos.canonicalFile && file.isFile) { "Локальная фотография не найдена" }
                val bytes = file.readBytes()
                require(bytes.size in 100..1_000_000) { "Фото должно быть меньше 1 МБ" }
                val varietyKey = text(input.optString("varietyKey"), 100)
                require(varietyKey.matches(Regex("[\\p{L}0-9_]{1,100}"))) { "Выберите сорт из справочника" }
                val postId = UUID.randomUUID().toString()
                val path = "${uid()}/$postId.jpg"
                val row = JSONObject().put("id", postId).put("owner_id", uid()).put("storage_path", path)
                    .put("nickname", nick).put("variety", text(input.optString("variety"), 60))
                    .put("variety_key", varietyKey)
                    .put("caption", text(input.optString("caption"), 180))
                req("POST", "/rest/v1/garden_photos", token, json(row), prefer="return=minimal")
                try {
                    req("POST", "/storage/v1/object/$bucket/$path", token, bytes, "image/jpeg")
                } catch (e: Exception) {
                    // Upload failure: remove the pending DB row so it does not remain forever.
                    try { req("DELETE", "/rest/v1/garden_photos?id=eq.$postId&owner_id=eq.${uid()}", token) } catch (_: Exception) {}
                    throw e
                }
                JSONObject().put("id", postId).put("status", "pending")
            }
            "remove" -> {
                val postId=id(input.getString("id"))
                val rows = JSONArray(req("GET", "/rest/v1/garden_photos?select=storage_path&id=eq.$postId&owner_id=eq.${uid()}&limit=1", token))
                require(rows.length() == 1) { "Не удалось найти вашу публикацию" }
                val path=rows.getJSONObject(0).getString("storage_path")
                req("DELETE", "/storage/v1/object/$bucket", token, json(JSONObject().put("prefixes", JSONArray().put(path))))
                req("DELETE", "/rest/v1/garden_photos?id=eq.$postId&owner_id=eq.${uid()}", token)
                JSONObject().put("removed", true)
            }
            "report" -> {
                val postId=id(input.getString("id"))
                req("POST", "/rest/v1/garden_reports", token,
                    json(JSONObject().put("photo_id", postId).put("reporter_id", uid())), prefer="return=minimal")
                JSONObject().put("sent", true)
            }
            else -> throw IllegalArgumentException("Неизвестная операция")
        }
    }
}
