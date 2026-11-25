"use strict";
/* ================= Nouveautés : pop-up après une mise à jour ================= */
const CHANGELOG = [
  {v: "5.0", d: "25 novembre 2026", items: [
    "✨ Refonte complète : nouveau design, cartes de match plus lisibles, gros scores",
    "🧭 Nouvelle navigation en bas : Accueil, Matchs, Compétitions, Favoris, Plus",
    "🏠 Nouvel accueil : chiffres du week-end, matchs en cours, tes équipes, prochains coups d'envoi, derniers résultats",
    "🗂 Matchs → Liste / Gymnases / Clubs ; Compétitions → Résultats / Classements / Probabilités / Styles",
    "⚡ Ouverture instantanée : les derniers matchs s'affichent tout de suite, la mise à jour se fait en arrière-plan (et hors connexion)",
    "⚙️ Page « Plus » : notifications, réglages, thème, plein écran, nouveautés, confidentialité",
    "🧹 Code réorganisé en modules pour plus de fiabilité"]},
  {v: "4.8", d: "24 novembre 2026", items: ["🗑 Onglet NBA retiré (ainsi que les matchs NBA en cours sur l'accueil et les équipes NBA dans les favoris)"]},
  {v: "4.7", d: "24 novembre 2026", items: ["⛶ Plein écran en portrait et en paysage, jusque sous l'encoche de la caméra (plus de bande noire en paysage)", "🔄 Le plein écran reste actif après une rotation du téléphone", "⚙️ Interrupteur Plein écran / Barres visibles dans les Réglages"]},
  {v: "4.6", d: "23 novembre 2026", items: ["⚡ Affichage à la fréquence maximale de l'écran (120 Hz sur les téléphones compatibles) : défilement et animations plus fluides", "⚙️ Fréquence d'écran active affichée dans les Réglages"]},
  {v: "4.5", d: "23 novembre 2026", items: ["🟡 Pastille « 91 » parfaitement ronde sur tous les écrans"]},
  {v: "4.4", d: "23 novembre 2026", items: ["🟡 Pastille « 91 » de l'en-tête et de l'écran d'ouverture : fond jaune"]},
  {v: "4.3", d: "23 novembre 2026", items: ["🏀 Nouvelle icône : un grand « 91 » sur un ballon orange, fond bleu nuit (compatible icônes thématiques d'Android 13+)"]},
  {v: "4.2", d: "23 novembre 2026", items: [
    "📝 Ce pop-up : le détail de chaque mise à jour s'affiche au premier lancement (et dans ⚙️ → Nouveautés)",
    "🔍 Barre de recherche : liste des équipes (avec leur catégorie) et des gymnases (avec leur ville) en suggestions"]},
  {v: "4.0", d: "23 novembre 2026", items: ["▼▲ Tout déplier / Tout replier dans Résultats et Compétitions"]},
  {v: "3.9", d: "23 novembre 2026", items: ["🗂 Résultats et Compétitions regroupés par catégorie et par sexe, sections repliables"]},
  {v: "3.8", d: "23 novembre 2026", items: ["🎯 Probabilité de victoire sur chaque match à venir"]},
  {v: "3.7", d: "22 novembre 2026", items: ["🔒 Protection des données : politique de confidentialité, effacement des données, pas de sauvegarde cloud"]},
  {v: "3.6", d: "22 novembre 2026", items: ["🧠 Styles de jeu corrigés : une équipe = nom + catégorie + sexe"]},
  {v: "3.5", d: "22 novembre 2026", items: ["🧠 Styles de jeu calculés sur tous les matchs depuis le 1er septembre 2026"]},
  {v: "3.4", d: "22 novembre 2026", items: ["🧠 Onglet Styles : le style de jeu actuel de toutes les équipes"]},
  {v: "3.2", d: "22 novembre 2026", items: ["📈 Onglet Probabilités : % de montée et de descente"]},
  {v: "3.1", d: "22 novembre 2026", items: ["🌓 Thème automatique, clair ou sombre"]}
];
function appVersion(){
  try{ if (window.AndroidBridge && AndroidBridge.appVersion) return AndroidBridge.appVersion(); }catch(e){}
  return CHANGELOG[0].v;
}
function verCmp(a, b){ const x = String(a).split("."), y = String(b).split("."); for (let i = 0; i < Math.max(x.length, y.length); i++){ const d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; } return 0; }
function newsHtml(since){
  const list = CHANGELOG.filter(c => !since || verCmp(c.v, since) > 0);
  const show = list.length ? list : CHANGELOG.slice(0, 1);
  return `<h2>🎉 Mise à jour : version ${esc(appVersion())}</h2>
    ${show.map(c => `<div class="pv"><b>Version ${esc(c.v)} <span class="stat" style="display:inline;font-weight:500">· ${esc(c.d)}</span></b><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}
    <button class="btn" onclick="closeSheet()">C'est parti !</button>
    ${(() => { try{ if (window.AndroidBridge && AndroidBridge.displayHz){ const [c, m] = AndroidBridge.displayHz().split("|"); return `<div class="kv"><span class="k">Écran</span><span><b>${esc(c)} Hz</b> (maximum de l'écran : ${esc(m)} Hz)</span></div>`; } }catch(e){} return ""; })()}
    ${(() => { try{ if (window.AndroidBridge && AndroidBridge.setFullscreen){ const on = AndroidBridge.isFullscreen(); return `<label>Affichage</label><div class="themes"><button class="chip ${on?"on":""}" data-fs="1">⛶ Plein écran</button><button class="chip ${!on?"on":""}" data-fs="0">Barres visibles</button></div><p class="stat" style="margin-top:4px">Plein écran en portrait et en paysage. Glisse depuis le bord de l'écran pour afficher l'heure et la batterie.</p>`; } }catch(e){} return ""; })()}
    <button class="btn sec" data-news="all">Voir tout l'historique</button>`;
}
function showNews(since){ openSheet(newsHtml(since)); }
function checkNews(){
  const cur = appVersion(), last = store.get("lastVersion", null);
  store.set("lastVersion", cur);
  if (!last){                                  // version précédente sans suivi : on montre la dernière nouveauté
    if (store.get("privacyOk", false)) showNews(CHANGELOG[1].v);
    return;                                    // vraie première installation : avis de confidentialité à la place
  }
  if (verCmp(cur, last) > 0) showNews(last);
}

function findMatch(id){
  let m = S.matches.find(x => x.id === id) || (S.results||[]).find(x => x.id === id);
  if (!m) for (const r of Object.values(S.ranks)){ m = (r.matches||[]).find(x => x.id === id); if (m) break; }
  return m;
}
function renderGyms(list){
  const g = {};
  list.forEach(m => { const k = (m.salle.nom||"Gymnase non précisé") + "|" + m.salle.ville; (g[k] = g[k] || {s:m.salle, ms:[]}).ms.push(m); });
  const arr = Object.values(g).sort((a,b) => (a.s.ville||"").localeCompare(b.s.ville||"") || (a.s.nom||"").localeCompare(b.s.nom||""));
  if (!arr.length){ $("main").innerHTML = `<div class="empty">Aucun gymnase pour cette sélection.</div>`; return; }
  $("main").innerHTML = arr.map(x => {
    x.ms.sort((a,b) => a.date - b.date);
    return `<div class="group">📍 ${esc(x.s.nom||"Gymnase non précisé")}${x.s.ville ? " — " + esc(x.s.ville) : ""} · ${x.ms.length} match${x.ms.length>1?"s":""}</div>` + x.ms.map(matchCard).join("");
  }).join("");
}
function renderClubs(list){
  const c = {};
  list.forEach(m => [m.t1, m.t2].forEach(t => {
    const k = t.clubId || "n:" + norm(t.club || t.nom);
    if (!c[k]) c[k] = {t, n:0, id:t.clubId};
    c[k].n++;
  }));
  const arr = Object.values(c).sort((a,b) => (a.t.club||a.t.nom).localeCompare(b.t.club||b.t.nom));
  if (!arr.length){ $("main").innerHTML = `<div class="empty">Aucun club pour cette sélection.</div>`; return; }
  $("main").innerHTML = arr.map(x => `<div class="club" data-club="${esc(x.id)}">${logoHtml(x.t)}
     <div class="info"><b>${esc(x.t.club || x.t.nom)}</b><span>${x.t.code ? esc(x.t.code) : ""}</span></div>
     <span class="count">${x.n} match${x.n>1?"s":""}</span>
     ${x.id ? (() => { const k = "c:" + x.id, on = S.favs.some(f => f.key === k); return `<button class="star ${on?"on":""}" data-fav="${esc(k)}" data-favname="${esc((x.t.club || x.t.nom) + " (club)")}">${on?"★":"☆"}</button>`; })() : ""}</div>`).join("");
}

