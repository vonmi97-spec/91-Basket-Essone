"use strict";
/* ================= Protection des données ================= */
const PRIVACY_DATE = "22 novembre 2026";
function privacyHtml(){
  const sec = (t, b) => `<div class="pv"><b>${t}</b>${b}</div>`;
  return `<h2>🔒 Protection des données</h2>
    <p class="stat">Politique de confidentialité · mise à jour le ${PRIVACY_DATE}</p>
    ${sec("En résumé", `<p>91 : Basket Essonne ne demande <b>aucun compte</b>, ne collecte <b>aucune donnée personnelle</b> et ne contient <b>ni publicité, ni pisteur, ni outil de mesure d'audience</b>.</p>`)}
    ${sec("Ce qui reste sur ton téléphone", `<ul>
      <li>Tes équipes et clubs favoris</li><li>Tes réglages : thème, notifications, places de montée/descente, comité</li>
      <li>Une copie temporaire des données FFBB pour aller plus vite</li></ul>
      <p>Ces informations ne quittent jamais l'appareil et ne sont pas sauvegardées dans le cloud. Elles sont supprimées si tu désinstalles l'appli ou si tu touches « Effacer mes données » ci-dessous.</p>`)}
    ${sec("Services contactés", `<p>Pour afficher les informations, l'appli interroge directement :</p><ul>
      <li><b>FFBB</b> (api.ffbb.app, meilisearch-prod.ffbb.app) : matchs, résultats, classements, logos</li>
      <li><b>Google Maps</b>, seulement quand tu touches « Itinéraire »</li>
      <li><b>competitions.ffbb.com</b>, seulement quand tu ouvres un lien FFBB</li></ul>
      <p>Comme pour tout site web, ces services voient l'adresse IP de ton téléphone. Aucune information te concernant (favoris, réglages) ne leur est envoyée. Leurs propres politiques de confidentialité s'appliquent.</p>`)}
    ${sec("Notifications", `<p>Elles sont <b>facultatives</b> et nécessitent ton autorisation. La vérification des matchs se fait sur ton téléphone ; aucun serveur ne connaît tes équipes suivies. Tu peux les couper à tout moment dans 🔔 ou dans les réglages Android.</p>`)}
    ${sec("Autorisations Android", `<ul><li>Internet : récupérer les matchs</li><li>Notifications : rappels et scores (si tu les actives)</li><li>Démarrage : relancer la vérification des notifications après un redémarrage</li></ul>
      <p>Pas d'accès à ta position, tes contacts, ton appareil photo, ton micro ni tes fichiers.</p>`)}
    ${sec("Tes droits (RGPD)", `<p>Comme aucune donnée personnelle n'est collectée ni conservée hors de ton appareil, il n'y a rien à consulter ou rectifier chez nous. Tu gardes la maîtrise totale : effacement immédiat avec le bouton ci-dessous. Pour toute question : <a href="#" data-url="https://github.com/vonmi97-spec/91-Basket-Essone/issues">page du projet sur GitHub</a>. Tu peux aussi saisir la CNIL (cnil.fr).</p>`)}
    ${sec("Mineurs", `<p>L'appli peut être utilisée par des jeunes joueurs : elle ne demande ni âge, ni nom, ni contact.</p>`)}
    <p class="stat">Appli non officielle, indépendante de la FFBB.</p>
    <button class="btn" id="pvErase" data-erase="1">🗑 Effacer mes données</button>
    <button class="btn sec" onclick="closeSheet()">Fermer</button>`;
}
function showPrivacy(){ openSheet(privacyHtml()); }
function eraseAll(step){
  const b = $("pvErase");
  if (step !== 2){ b.textContent = "⚠️ Toucher à nouveau pour tout effacer (favoris, réglages)"; b.dataset.erase = "2"; b.style.background = "#C62E44"; return; }
  try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
  try{ if (window.AndroidBridge && AndroidBridge.clearData) AndroidBridge.clearData(); }catch(e){}
  S.favs = []; S.notif = {enabled: false, rappel: true, rappelMin: 60, resultats: true, asked: false};
  closeSheet(); toast("🗑 Toutes tes données ont été effacées");
  setTimeout(() => location.reload(), 900);
}
function privacyNotice(){
  if (store.get("privacyOk", false)) return;
  const d = document.createElement("div");
  d.id = "pvNotice";
  d.innerHTML = `<div><b>🔒 Tes données restent sur ton téléphone.</b><br>Aucun compte, aucune pub, aucun pistage. Favoris et réglages sont stockés uniquement sur l'appareil.</div>
    <div class="pvb"><button class="chip" data-pv="more">En savoir plus</button><button class="chip on" data-pv="ok">OK</button></div>`;
  document.body.appendChild(d);
}

