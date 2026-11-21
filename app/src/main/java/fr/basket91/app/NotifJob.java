package fr.basket91.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Vérifie toutes les ~15 min les matchs des équipes favorites et envoie les notifications. */
public class NotifJob extends JobService {

    static final int JOB_ID = 9101;
    static final String PREFS = "notif";
    static final String CHANNEL_REMIND = "rappels";
    static final String CHANNEL_RESULT = "resultats";

    // ---------- planification ----------
    static void schedule(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (!isEnabled(ctx)) { js.cancel(JOB_ID); return; }
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(ctx, NotifJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(15 * 60 * 1000L)
                .setPersisted(true)
                .build();
        js.schedule(info);
    }

    static boolean isEnabled(Context ctx) {
        try {
            JSONObject c = new JSONObject(ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getString("config", "{}"));
            return c.optBoolean("enabled", false) && c.optJSONArray("favs") != null && c.optJSONArray("favs").length() > 0;
        } catch (Exception e) { return false; }
    }

    static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL_REMIND, "Rappels de match", NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(new NotificationChannel(CHANNEL_RESULT, "Résultats", NotificationManager.IMPORTANCE_HIGH));
    }

    static void notify(Context ctx, int id, String channel, String title, String text) {
        createChannels(ctx);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify(id, n);
    }

    // ---------- job ----------
    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(() -> {
            try { check(getApplicationContext()); } catch (Exception ignored) { }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }

    static String norm(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }

    static void check(Context ctx) throws Exception {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        JSONObject cfg = new JSONObject(sp.getString("config", "{}"));
        if (!cfg.optBoolean("enabled", false)) return;
        JSONArray favs = cfg.optJSONArray("favs");
        if (favs == null || favs.length() == 0) return;
        Set<String> clubIds = new HashSet<>(), names = new HashSet<>();
        for (int i = 0; i < favs.length(); i++) {
            String k = favs.getJSONObject(i).optString("key");
            if (k.startsWith("c:")) clubIds.add(k.substring(2)); else if (k.startsWith("n:")) names.add(k.substring(2));
        }
        boolean remind = cfg.optBoolean("rappel", true), results = cfg.optBoolean("resultats", true);
        int remindMin = cfg.optInt("rappelMin", 60);
        JSONObject comite = cfg.optJSONObject("comite");

        AiaTrustManager.init(ctx);
        JSONObject conf = new JSONObject(http("GET", "https://api.ffbb.app/items/configuration", null, null));
        String ms = conf.getJSONObject("data").getString("key_ms");

        long now = System.currentTimeMillis();
        long a = now / 1000 - 2 * 86400, b = now / 1000 + 2 * 86400;
        String f = "date_rencontre_timestamp";
        JSONArray filter = new JSONArray();
        filter.put("(" + f + " >= " + a + " AND " + f + " <= " + b + ") OR (" + f + " >= " + (a * 1000) + " AND " + f + " <= " + (b * 1000) + ")");
        if (comite != null) {
            StringBuilder or = new StringBuilder();
            if (comite.optString("id").length() > 0) or.append("organisateur.id = ").append(JSONObject.quote(comite.optString("id")));
            if (comite.optString("nom").length() > 0) { if (or.length() > 0) or.append(" OR "); or.append("organisateur.nom = ").append(JSONObject.quote(comite.optString("nom"))); }
            if (or.length() > 0) filter.put(or.toString());
        }
        JSONObject q = new JSONObject().put("indexUid", "ffbbserver_rencontres").put("q", "").put("limit", 1000).put("filter", filter);
        JSONObject body = new JSONObject().put("queries", new JSONArray().put(q));
        JSONObject res = new JSONObject(http("POST", "https://meilisearch-prod.ffbb.app/multi-search", ms, body.toString()));
        JSONArray hits = res.getJSONArray("results").getJSONObject(0).optJSONArray("hits");
        if (hits == null) return;

        Set<String> sent = new HashSet<>(sp.getStringSet("sent", new HashSet<>()));
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.FRANCE);
        SimpleDateFormat hhmm = new SimpleDateFormat("HH'h'mm", Locale.FRANCE);
        for (int i = 0; i < hits.length(); i++) {
            JSONObject h = hits.getJSONObject(i);
            String id = h.optString("id");
            JSONObject o1 = h.optJSONObject("idOrganismeEquipe1"), o2 = h.optJSONObject("idOrganismeEquipe2");
            String n1 = h.optString("nomEquipe1"), n2 = h.optString("nomEquipe2");
            boolean fav = (o1 != null && clubIds.contains(o1.optString("id"))) || (o2 != null && clubIds.contains(o2.optString("id")))
                    || names.contains(norm(n1)) || names.contains(norm(n2));
            if (!fav) continue;
            Date d = null;
            try { d = iso.parse(h.optString("date_rencontre")); } catch (Exception ignored) { }
            JSONObject salle = h.optJSONObject("salle");
            String gym = salle != null ? salle.optString("libelle") : "";
            JSONObject carto = salle != null ? salle.optJSONObject("cartographie") : null;
            String ville = carto != null ? carto.optString("ville") : "";
            String nid = Integer.toString(Math.abs(id.hashCode()));

            if (results && h.optBoolean("joue") && !sent.contains("r" + id)) {
                String s1 = h.optString("resultatEquipe1"), s2 = h.optString("resultatEquipe2");
                if (s1.length() > 0 && s2.length() > 0) {
                    notify(ctx, ("r" + nid).hashCode(), CHANNEL_RESULT, "🏀 Résultat : " + s1 + " - " + s2,
                            n1 + " " + s1 + " - " + s2 + " " + n2);
                    sent.add("r" + id);
                }
            }
            if (remind && d != null && !h.optBoolean("joue") && !sent.contains("m" + id)) {
                long diff = d.getTime() - now;
                boolean hasHour = !(hhmm.format(d).equals("00h00"));
                if (hasHour && diff > 0 && diff <= remindMin * 60_000L + 8 * 60_000L) {
                    String where = gym.length() > 0 ? " · " + gym + (ville.length() > 0 ? " (" + ville + ")" : "") : "";
                    notify(ctx, ("m" + nid).hashCode(), CHANNEL_REMIND, "⏰ Match à " + hhmm.format(d),
                            n1 + " – " + n2 + where);
                    sent.add("m" + id);
                }
            }
        }
        if (sent.size() > 400) sent.clear();
        sp.edit().putStringSet("sent", sent).putLong("lastCheck", now).apply();
    }

    static String http(String method, String url, String bearer, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        if (c instanceof javax.net.ssl.HttpsURLConnection) {
            ((javax.net.ssl.HttpsURLConnection) c).setSSLSocketFactory(AiaTrustManager.socketFactory());
        }
        c.setRequestMethod(method);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "okhttp/4.12.0");
        c.setRequestProperty("Accept", "application/json");
        if (bearer != null) c.setRequestProperty("Authorization", "Bearer " + bearer);
        if (body != null) {
            c.setRequestProperty("Content-Type", "application/json");
            c.setDoOutput(true);
            try (OutputStream os = c.getOutputStream()) { os.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int st = c.getResponseCode();
        InputStream is = st >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        if (is != null) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            is.close();
        }
        c.disconnect();
        if (st >= 400) throw new Exception("HTTP " + st);
        return bos.toString("UTF-8");
    }
}
