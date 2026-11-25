"use strict";
/* ================= Navigation : barre du bas + sous-onglets ================= */
// Vues : home (accueil), matchs (liste / gymnases / clubs), comp (résultats / classements / probabilités / styles),
// favs (favoris), more (plus). Chaque vue correspond à un « S.tab » interne utilisé par les écrans.
const SUBS = {
  matchs: [["list", "Liste"], ["gyms", "Gymnases"], ["clubs", "Clubs"]],
  comp: [["res", "Résultats"], ["cls", "Classements"], ["up", "Probabilités"], ["sty", "Styles"]]
};
S.view = "home";
S.sub = Object.assign({matchs: "list", comp: "res"}, store.get("subs", {}));

function tabFor(view, sub){
  if (view === "home") return "matchs";
  if (view === "matchs") return sub === "list" ? "matchs" : sub;
  if (view === "comp") return sub;
  return view; // favs, more
}
function go(view, sub, opts){
  opts = opts || {};
  if (sub && SUBS[view]){ S.sub[view] = sub; store.set("subs", S.sub); }
  const prevTab = S.tab;
  if (view === "home" && S.offset !== 0){ S.offset = 0; S.view = view; S.tab = "matchs"; S.homeAll = false; reload(); }
  S.view = view;
  S.tab = tabFor(view, S.sub[view]);
  S.homeAll = view !== "home";
  if (!opts.keepClub && view !== "matchs") S.club = null;
  // les résultats ont leurs propres catégories : on repart de « Toutes » en changeant de source
  if ((prevTab === "res") !== (S.tab === "res")) S.cat = "ALL";
  if (["res", "cls", "up", "sty"].includes(S.tab) && !S.results) loadResults();
  document.body.dataset.view = view;
  document.querySelectorAll("#bnav [data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === view));
  renderSeg(); renderTitle(); renderWeek(); renderChips(); renderMain();
  hideSugg && hideSugg();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}
function renderSeg(){
  const subs = SUBS[S.view];
  const box = $("seg");
  if (!subs){ box.innerHTML = ""; return; }
  const cur = S.sub[S.view];
  box.innerHTML = subs.map(([k, l]) => `<button class="${k === cur ? "on" : ""}" data-sub="${k}">${l}</button>`).join("");
}
function renderTitle(){
  const T = {home: "Basket Essonne", matchs: "Matchs", comp: "Compétitions", favs: "Mes favoris", more: "Plus"};
  const now = new Date();
  const sub = {
    home: now.toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "long"}),
    matchs: "Championnat départemental · Essonne",
    comp: "Résultats, classements et analyses",
    favs: "Tes équipes et leurs matchs",
    more: "Réglages et informations"
  };
  $("vTitle").textContent = T[S.view] || "Basket Essonne";
  $("vSub").textContent = sub[S.view] || "";
}

/* ----- Page « Plus » ----- */
function moreRow(icon, title, sub, attrs){
  return `<button class="mrow" ${attrs}><span class="mi">${icon}</span><span class="mt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span><i>›</i></button>`;
}
function renderMore(){
  const n = S.notif || {};
  let hz = "";
  try{ if (window.AndroidBridge && AndroidBridge.displayHz){ const [c, m] = AndroidBridge.displayHz().split("|"); hz = `${c} Hz (max ${m} Hz)`; } }catch(e){}
  const theme = store.get("theme", "auto");
  let fs = null; try{ if (window.AndroidBridge && AndroidBridge.isFullscreen) fs = AndroidBridge.isFullscreen(); }catch(e){}
  $("main").innerHTML = `
    <div class="mgroup">
      ${moreRow("🔔", "Notifications", n.enabled ? `Activées · rappel ${n.rappelMin < 60 ? n.rappelMin + " min" : (n.rappelMin / 60) + " h"} avant` : "Désactivées", 'data-more="notif"')}
      ${moreRow("⚙️", "Réglages des compétitions", `Montée ${store.get("placesMontee", 1)} · descente ${store.get("placesDescente", 1)} place(s) · comité`, 'data-more="settings"')}
    </div>
    <div class="mgroup">
      <div class="mhead">Apparence</div>
      <div class="mpad"><div class="themes">${[["auto","Automatique"],["light","Clair"],["dark","Sombre"]].map(([k,l]) => `<button class="chip ${theme===k?"on":""}" data-theme="${k}">${l}</button>`).join("")}</div></div>
      ${fs === null ? "" : `<div class="mpad"><div class="themes"><button class="chip ${fs?"on":""}" data-fs="1">⛶ Plein écran</button><button class="chip ${!fs?"on":""}" data-fs="0">Barres visibles</button></div></div>`}
    </div>
    <div class="mgroup">
      ${moreRow("🌐", "Site FFBB de l'Essonne", "competitions.ffbb.com · comité 91", `data-url="${esc(FFBB_COMITE)}"`)}
      ${moreRow("📝", "Nouveautés", "Version " + esc(appVersion()), 'data-news="all"')}
      ${moreRow("🔒", "Protection des données", "Aucun compte, aucune pub, aucun pistage", 'data-pv="more"')}
    </div>
    <div class="about">
      <div class="badge">91</div>
      <b>91 : Basket Essonne</b>
      <span>Version ${esc(appVersion())}${hz ? " · écran " + esc(hz) : ""}</span>
      <span>Appli non officielle · données FFBB</span>
    </div>`;
}

/* ----- Événements de navigation ----- */
document.addEventListener("click", e => {
  const nv = e.target.closest("[data-nav]");
  if (nv){ e.stopPropagation(); go(nv.dataset.nav); return; }
  const sb = e.target.closest("#seg [data-sub]");
  if (sb){ e.stopPropagation(); go(S.view, sb.dataset.sub); return; }
  const gt = e.target.closest("[data-goto]");
  if (gt){ e.stopPropagation(); const [v, sub] = gt.dataset.goto.split(":"); go(v, sub); return; }
  const mr = e.target.closest("[data-more]");
  if (mr){
    e.stopPropagation();
    if (mr.dataset.more === "notif") showNotifSheet();
    else if (mr.dataset.more === "settings") showSettings();
    return;
  }
}, true);

// Retour Android : sous-vue → vue précédente → accueil
const prevBack = window.onAndroidBack;
window.onAndroidBack = function(){
  if (prevBack && prevBack()) return true;
  if (S.view !== "home"){ go("home"); return true; }
  return false;
};
