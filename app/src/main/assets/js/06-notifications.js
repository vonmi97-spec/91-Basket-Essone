"use strict";
/* ================= Notifications ================= */
const hasNative = () => !!(window.AndroidBridge && window.AndroidBridge.setNotifConfig);
S.notif = store.get("notif", {enabled: false, rappel: true, rappelMin: 60, resultats: true, asked: false});
function saveNotif(){ store.set("notif", S.notif); syncNotif(); }
function syncNotif(){
  if (!hasNative()) return;
  try{ AndroidBridge.setNotifConfig(JSON.stringify({...S.notif, favs: S.favs, comite: store.get("comite", null)})); }catch(e){}
}
window.onNotifPerm = function(ok){
  S.notif.enabled = !!ok; S.notif.asked = true; saveNotif();
  if (ok){ try{ AndroidBridge.testNotif(); AndroidBridge.checkNow(); }catch(e){} }
  showNotifSheet(ok ? "✅ Notifications activées." : "⚠️ Autorisation refusée : active les notifications de l'appli dans les réglages Android.");
};
function enableNotif(){
  if (!hasNative()){ showNotifSheet("Les notifications ne fonctionnent que dans l'appli Android."); return; }
  AndroidBridge.askNotifPermission();
}
function proposeNotif(teamName){
  if (S.notif.enabled || S.notif.asked) return;
  openSheet(`<h2>🔔 Être prévenu ?</h2>
    <p style="color:var(--mute);line-height:1.5">Recevoir une notification pour <b style="color:var(--txt)">${esc(teamName)}</b> et tes autres équipes favorites :</p>
    <div class="kv"><span>⏰</span><span>Un rappel avant chaque match (heure + gymnase)</span></div>
    <div class="kv"><span>🏀</span><span>Le score final dès qu'il est publié par la FFBB</span></div>
    <button class="btn" data-notif="on">Activer les notifications</button>
    <button class="btn sec" data-notif="later">Plus tard</button>`);
}
function showNotifSheet(msg){
  const n = S.notif;
  const opts = [15, 30, 60, 120, 180].map(v => `<option value="${v}" ${n.rappelMin===v?"selected":""}>${v < 60 ? v + " min" : (v/60) + " h"} avant</option>`).join("");
  openSheet(`<div class="settings"><h2>🔔 Notifications</h2>
    ${msg ? `<div class="stat" style="margin-bottom:8px">${esc(msg)}</div>` : ""}
    <div class="kv"><span class="k">État</span><span><b>${n.enabled ? "Activées" : "Désactivées"}</b></span></div>
    <div class="kv"><span class="k">Équipes suivies</span><span>${S.favs.length ? S.favs.map(f => esc(f.nom)).join("<br>") : "Aucune — ajoute des favoris ★ depuis un match"}</span></div>
    <label><input type="checkbox" id="nRappel" ${n.rappel?"checked":""} style="width:auto"> Rappel avant le match</label>
    <select id="nMin" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--txt)">${opts}</select>
    <label><input type="checkbox" id="nRes" ${n.resultats?"checked":""} style="width:auto"> Score final publié</label>
    ${n.enabled ? `<button class="btn" data-notif="save">Enregistrer</button><button class="btn sec" data-notif="test">Envoyer une notification de test</button><button class="btn sec" data-notif="off">Désactiver</button>`
                : `<button class="btn" data-notif="on">Activer les notifications</button>`}
    <button class="btn sec" onclick="closeSheet()">Fermer</button>
    <p class="stat">Vérification automatique toutes les 15 min environ, même appli fermée.</p></div>`);
}
function handleNotifClick(act){
  const read = () => { const r = $("nRappel"), m = $("nMin"), res = $("nRes"); if (r){ S.notif.rappel = r.checked; S.notif.rappelMin = +m.value; S.notif.resultats = res.checked; } };
  if (act === "on"){ read(); S.notif.asked = true; store.set("notif", S.notif); enableNotif(); }
  else if (act === "later"){ S.notif.asked = true; store.set("notif", S.notif); closeSheet(); }
  else if (act === "save"){ read(); saveNotif(); showNotifSheet("✅ Enregistré."); }
  else if (act === "test"){ try{ AndroidBridge.testNotif(); }catch(e){} }
  else if (act === "off"){ S.notif.enabled = false; saveNotif(); showNotifSheet("Notifications désactivées."); }
}

