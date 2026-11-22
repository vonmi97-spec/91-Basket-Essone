package fr.basket91.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private WebView webView;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        AiaTrustManager.init(getApplicationContext());
        NotifJob.createChannels(this);
        NotifJob.schedule(getApplicationContext());
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Respecte la taille de texte choisie dans les réglages Android (bornée pour garder la mise en page lisible)
        float scale = getResources().getConfiguration().fontScale;
        s.setTextZoom(Math.max(85, Math.min(130, Math.round(scale * 100))));

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equals(scheme)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 42) {
            boolean ok = grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            webView.evaluateJavascript("window.onNotifPerm && window.onNotifPerm(" + ok + ")", null);
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        super.onDestroy();
    }

    /** Requêtes HTTP faites côté natif : pas de restriction CORS. */
    private class Bridge {
        @JavascriptInterface
        public void request(final String id, final String method, final String url,
                            final String headersJson, final String body) {
            pool.submit(() -> {
                int status = 0;
                String text;
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(url).openConnection();
                    if (c instanceof javax.net.ssl.HttpsURLConnection) {
                        ((javax.net.ssl.HttpsURLConnection) c).setSSLSocketFactory(AiaTrustManager.socketFactory());
                    }
                    c.setRequestMethod(method);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(30000);
                    c.setRequestProperty("User-Agent", "okhttp/4.12.0");
                    c.setRequestProperty("Accept", "application/json");
                    if (headersJson != null && !headersJson.isEmpty()) {
                        JSONObject h = new JSONObject(headersJson);
                        Iterator<String> keys = h.keys();
                        while (keys.hasNext()) {
                            String k = keys.next();
                            c.setRequestProperty(k, h.getString(k));
                        }
                    }
                    if (body != null && !body.isEmpty()) {
                        c.setDoOutput(true);
                        byte[] b = body.getBytes(StandardCharsets.UTF_8);
                        try (OutputStream os = c.getOutputStream()) { os.write(b); }
                    }
                    status = c.getResponseCode();
                    InputStream is = status >= 400 ? c.getErrorStream() : c.getInputStream();
                    text = is == null ? "" : readAll(is);
                } catch (Exception e) {
                    text = "Erreur réseau : " + e.getMessage();
                } finally {
                    if (c != null) c.disconnect();
                }
                final String js = "window.__nativeCb(" + JSONObject.quote(id) + "," + status + ","
                        + JSONObject.quote(text) + ")";
                webView.post(() -> webView.evaluateJavascript(js, null));
            });
        }

        @JavascriptInterface
        public void setNotifConfig(String json) {
            getSharedPreferences(NotifJob.PREFS, MODE_PRIVATE).edit().putString("config", json).apply();
            NotifJob.schedule(getApplicationContext());
        }

        @JavascriptInterface
        public boolean notifAllowed() {
            if (android.os.Build.VERSION.SDK_INT < 33) return true;
            return checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void askNotifPermission() {
            runOnUiThread(() -> {
                if (android.os.Build.VERSION.SDK_INT >= 33 && !notifAllowed()) {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 42);
                } else {
                    webView.evaluateJavascript("window.onNotifPerm && window.onNotifPerm(true)", null);
                }
            });
        }

        @JavascriptInterface
        public void testNotif() {
            NotifJob.notify(getApplicationContext(), 777, NotifJob.CHANNEL_RESULT, "🏀 Notifications activées",
                    "Tu seras prévenu des matchs et résultats de tes équipes favorites.");
        }

        @JavascriptInterface
        public void checkNow() {
            pool.submit(() -> { try { NotifJob.check(getApplicationContext()); } catch (Exception ignored) { } });
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) { }
            });
        }
    }

    private static String readAll(InputStream is) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        is.close();
        return bos.toString("UTF-8");
    }
}
