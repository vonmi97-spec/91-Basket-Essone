package fr.basket91.app;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/**
 * Valide les certificats avec le magasin de confiance d'Android.
 * Si le serveur n'envoie pas sa chaîne complète (certificat intermédiaire manquant),
 * l'intermédiaire est téléchargé via l'extension AIA du certificat (comme le fait Chrome),
 * puis la chaîne complétée est de nouveau validée par le système. Aucune validation n'est désactivée.
 */
public class AiaTrustManager implements X509TrustManager {

    private final X509TrustManager system;
    private static X509TrustManager bundled; // racines Let's Encrypt embarquées

    /** Charge les racines embarquées (res/raw) comme ancres de confiance supplémentaires. */
    public static synchronized void init(android.content.Context ctx) {
        if (bundled != null) return;
        try {
            KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
            ks.load(null, null);
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            int[] ids = {R.raw.isrg_root_x1, R.raw.isrg_root_x2};
            int i = 0;
            for (int id : ids) {
                try (InputStream is = ctx.getResources().openRawResource(id)) {
                    ks.setCertificateEntry("le" + (i++), cf.generateCertificate(is));
                }
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(ks);
            for (TrustManager tm : tmf.getTrustManagers()) {
                if (tm instanceof X509TrustManager) { bundled = (X509TrustManager) tm; break; }
            }
        } catch (Exception ignored) { }
    }
    private static final Map<String, List<X509Certificate>> CACHE = new ConcurrentHashMap<>();
    private static SSLSocketFactory factory;

    public static synchronized SSLSocketFactory socketFactory() throws Exception {
        if (factory == null) {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{new AiaTrustManager()}, null);
            factory = ctx.getSocketFactory();
        }
        return factory;
    }

    public AiaTrustManager() throws Exception {
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init((KeyStore) null);
        X509TrustManager found = null;
        for (TrustManager tm : tmf.getTrustManagers()) {
            if (tm instanceof X509TrustManager) { found = (X509TrustManager) tm; break; }
        }
        if (found == null) throw new IllegalStateException("Aucun TrustManager système");
        system = found;
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        system.checkClientTrusted(chain, authType);
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        try {
            system.checkServerTrusted(chain, authType);
            return;
        } catch (CertificateException first) {
            if (bundled != null) {
                try { bundled.checkServerTrusted(chain, authType); return; } catch (CertificateException ignored) { }
            }
            List<X509Certificate> full = new ArrayList<>();
            for (X509Certificate c : chain) full.add(c);
            for (int i = 0; i < 4; i++) {
                X509Certificate last = full.get(full.size() - 1);
                if (last.getSubjectX500Principal().equals(last.getIssuerX500Principal())) break;
                String url = caIssuersUrl(last);
                if (url == null) break;
                List<X509Certificate> issuers;
                try {
                    issuers = download(url);
                } catch (Exception e) {
                    break;
                }
                if (issuers.isEmpty()) break;
                full.addAll(issuers);
                X509Certificate[] arr = full.toArray(new X509Certificate[0]);
                try { system.checkServerTrusted(arr, authType); return; } catch (CertificateException ignored) { }
                if (bundled != null) {
                    try { bundled.checkServerTrusted(arr, authType); return; } catch (CertificateException ignored) { }
                }
            }
            throw first;
        }
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return system.getAcceptedIssuers();
    }

    private static List<X509Certificate> download(String url) throws Exception {
        List<X509Certificate> cached = CACHE.get(url);
        if (cached != null) return cached;
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(10000);
        InputStream is = c.getInputStream();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        is.close();
        c.disconnect();
        byte[] data = bos.toByteArray();
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        List<X509Certificate> out = new ArrayList<>();
        try {
            Collection<? extends Certificate> all = cf.generateCertificates(new ByteArrayInputStream(data));
            for (Certificate cert : all) out.add((X509Certificate) cert);
        } catch (Exception e) {
            out.add((X509Certificate) cf.generateCertificate(new ByteArrayInputStream(data)));
        }
        CACHE.put(url, out);
        return out;
    }

    /** Lit l'URL "CA Issuers" (OID 1.3.6.1.5.5.7.48.2) dans l'extension AIA. */
    static String caIssuersUrl(X509Certificate cert) {
        byte[] ext = cert.getExtensionValue("1.3.6.1.5.5.7.1.1");
        if (ext == null) return null;
        byte[] oid = {0x06, 0x08, 0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x30, 0x02};
        for (int i = 0; i + oid.length < ext.length; i++) {
            boolean match = true;
            for (int j = 0; j < oid.length; j++) {
                if (ext[i + j] != oid[j]) { match = false; break; }
            }
            if (!match) continue;
            int p = i + oid.length;
            if ((ext[p] & 0xFF) != 0x86) continue; // GeneralName [6] uniformResourceIdentifier
            p++;
            int len = ext[p] & 0xFF;
            p++;
            if (len > 0x80) {
                int nb = len & 0x7F;
                len = 0;
                for (int k = 0; k < nb; k++) len = (len << 8) | (ext[p++] & 0xFF);
            }
            if (p + len > ext.length) return null;
            return new String(ext, p, len, java.nio.charset.StandardCharsets.US_ASCII);
        }
        return null;
    }
}
