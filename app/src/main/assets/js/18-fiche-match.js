"use strict";
/* ================= Fiche match ================= */
function openSheet(html){ $("sheetBox").innerHTML = html; $("sheet").classList.add("on"); }
function closeSheet(){ $("sheet").classList.remove("on"); }
window.onAndroidBack = function(){ if ($("sheet").classList.contains("on")){ closeSheet(); return true; } if (S.club){ S.club=null; render(); return true; } return false; };

function mapsUrl(m){
  const s = m.salle;
  if (s.geo && s.geo.lat) return `https://www.google.com/maps/dir/?api=1&destination=${s.geo.lat},${s.geo.lng}`;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([s.nom, s.adresse, s.cp, s.ville].filter(Boolean).join(" "));
}
function openUrl(u){ if (window.AndroidBridge && AndroidBridge.openUrl) AndroidBridge.openUrl(u); else window.open(u, "_blank"); }
function miniStar(t){
  const on = isFavTeam(t);
  return `<button class="star mini ${on?"on":""}" data-fav="${esc(favKey(t))}" data-favname="${esc(t.nom)}" aria-label="Favori">${on?"★":"☆"}</button>`;
}
function favBtn(t){
  const on = S.favs.some(f => f.key === favKey(t));
  return `<button class="star ${on?"on":""}" data-fav="${esc(favKey(t))}" data-favname="${esc(t.nom)}">${on?"★":"☆"}</button>`;
}
function showMatch(id){
  const m = findMatch(id); if (!m) return;
  const dt = m.date ? m.date.toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}) : "—";
  openSheet(`<h2>${esc(m.comp)}</h2>
    <div class="teams">
      <div class="team">${logoHtml(m.t1)}<div class="nm">${esc(m.t1.nom)} ${favBtn(m.t1)}</div></div>
      <div class="mid">${m.joue ? `<div class="sc">${esc(m.t1.score)} - ${esc(m.t2.score)}</div>` : `<div class="hr">VS</div>`}</div>
      <div class="team">${logoHtml(m.t2)}<div class="nm">${esc(m.t2.nom)} ${favBtn(m.t2)}</div></div>
    </div>
    <div class="kv"><span class="k">Date</span><span>${esc(dt)}</span></div>
    ${wpDetail(m)}
    <div class="kv"><span class="k">Catégorie</span><span>${esc(m.cat.libelle)}${m.sexe ? " · " + ({F:"Féminin",M:"Masculin",X:"Mixte"}[m.sexe]) : ""}</span></div>
    ${m.poule ? `<div class="kv"><span class="k">Poule</span><span>${esc(m.poule)}${m.journee ? " · Journée " + esc(m.journee) : ""}</span></div>` : ""}
    <div class="kv"><span class="k">Gymnase</span><span><b>${esc(m.salle.nom || "Non précisé")}</b><br>${esc(m.salle.adresse)}<br>${esc(m.salle.cp)} ${esc(m.salle.ville)}</span></div>
    ${m.t1.club ? `<div class="kv"><span class="k">Recevant</span><span>${esc(m.t1.club)}</span></div>` : ""}
    ${m.officiels ? `<div class="kv"><span class="k">Officiels</span><span>${esc(m.officiels)}</span></div>` : ""}
    ${m.salle.nom || m.salle.geo ? `<button class="btn" data-go="${esc(m.id)}">🧭 Itinéraire vers le gymnase</button>` : ""}
    <button class="btn sec" data-style="${esc(m.t1.nom)}" data-sctx="${esc(ctxStr(m.cat, m.sexe))}" data-sclub="${esc(m.t1.clubId)}">🧠 Style de jeu · ${esc(m.t1.nom)}</button>
    <button class="btn sec" data-style="${esc(m.t2.nom)}" data-sctx="${esc(ctxStr(m.cat, m.sexe))}" data-sclub="${esc(m.t2.clubId)}">🧠 Style de jeu · ${esc(m.t2.nom)}</button>
    ${ffbbBtn(ffbbCompUrl(m.compCode), "📊 Résultats et classement sur FFBB ↗", "")}
    ${[m.t1, m.t2].filter(t => ffbbClubUrl(t.code)).map(t => ffbbBtn(ffbbClubUrl(t.code), "🏠 " + esc(t.club || t.nom) + " sur FFBB ↗")).join("")}
    <button class="btn sec" onclick="closeSheet()">Fermer</button>`);
}
function showSettings(){
  const c = store.get("comite", {}) || {};
  openSheet(`<div class="settings"><h2>Réglages</h2>
    <label>Thème</label>
    <div class="themes">${[["auto","Automatique"],["light","Clair"],["dark","Sombre"]].map(([k,l]) => `<button class="chip ${(store.get("theme","auto"))===k?"on":""}" data-theme="${k}">${l}</button>`).join("")}</div>
    <p class="stat" style="margin-top:4px">Automatique : suit le mode sombre du téléphone.</p>
    <label>Comité organisateur détecté</label>
    <input id="setNom" value="${esc(c.nom||"")}" placeholder="ex. COMITE DE L'ESSONNE">
    <label>Identifiant FFBB du comité (optionnel)</label>
    <input id="setId" value="${esc(c.id||"")}" placeholder="détecté automatiquement">
    <label>Places de montée par poule</label>
    <input id="setPlaces" type="number" min="1" max="6" value="${esc(store.get("placesMontee", 1))}">
    <label>Places de descente par poule</label>
    <input id="setDown" type="number" min="1" max="6" value="${esc(store.get("placesDescente", 1))}">
    <button class="btn" id="saveSet">Enregistrer et recharger</button>
    <button class="btn sec" id="resetSet">Réinitialiser la détection automatique</button>
    <button class="btn sec" data-news="all">📝 Nouveautés · version ${esc(appVersion())}</button>
    <button class="btn sec" data-pv="more">🔒 Protection des données</button>
    ${ffbbBtn(FFBB_COMITE, "🌐 Site FFBB de l'Essonne ↗")}
    <button class="btn sec" onclick="closeSheet()">Fermer</button>
    <p class="stat">Les matchs, logos et gymnases proviennent de l'API publique de la FFBB. Appli non officielle.</p></div>`);
}

