"use strict";
/* ================= Rafraîchir (bouton ⟳ et glisser vers le bas) ================= */
let refreshing = false, toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
async function refreshAll(){
  if (refreshing) return; refreshing = true;
  $("btnRefresh").classList.add("spin"); $("ptr").classList.add("spin");
  const before = new Set(allKnown().filter(m => m.joue).map(m => m.id));
  try{
    Object.keys(cache).forEach(k => delete cache[k]);       // on oublie tout ce qui était en mémoire
    try{ localStorage.removeItem("tokens"); }catch(e){}
    {
      const ms = await loadMatches(weekendRange(S.offset));
      cache["w" + S.offset] = ms; S.matches = ms; S.error = null;
      if (S.results || S.tab === "res"){ S.results = null; await loadResults(true); }
      if (S.tab === "cls" || S.tab === "up" || S.tab === "sty" || S.tab === "favs"){ S.ranks = {}; }
      if (S.season) await loadSeason(true);
      if (S.matches.some(m => isLiveMatch(m, Date.now()))) await refreshLiveMap();
    }
    const fresh = allKnown().filter(m => m.joue && !before.has(m.id)).length;
    render();
    const hr = new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    toast(fresh ? `✅ ${fresh} nouveau${fresh>1?"x":""} résultat${fresh>1?"s":""} · ${hr}` : `À jour · ${hr}`);
  }catch(e){ toast("⚠️ Impossible d'actualiser : " + (e.message || e)); }
  finally{ refreshing = false; $("btnRefresh").classList.remove("spin"); $("ptr").classList.remove("spin"); $("ptr").style.transform = ""; }
}
window.refreshAll = refreshAll;
(function(){
  let y0 = null, pulled = 0;
  document.addEventListener("touchstart", e => { if (window.scrollY <= 0 && !$("sheet").classList.contains("on") && (!$("splash") || $("splash").classList.contains("gone"))) y0 = e.touches[0].clientY; else y0 = null; }, {passive: true});
  document.addEventListener("touchmove", e => {
    if (y0 == null || refreshing) return;
    pulled = Math.max(0, e.touches[0].clientY - y0);
    if (pulled > 5 && window.scrollY <= 0) $("ptr").style.transform = `translate(-50%, ${Math.min(pulled * 0.6, 90) - 50}px) rotate(${pulled * 2}deg)`;
  }, {passive: true});
  document.addEventListener("touchend", () => {
    if (y0 == null) return;
    if (pulled > 90 && !refreshing){ $("ptr").style.transform = "translate(-50%, 30px)"; refreshAll(); }
    else if (!refreshing) $("ptr").style.transform = "";
    y0 = null; pulled = 0;
  });
})();
/* ----- Démarrage instantané : dernière copie des matchs gardée sur le téléphone ----- */
function reviveMatches(list){ (list || []).forEach(m => { m.date = m.date ? new Date(m.date) : null; }); return list || []; }
function saveSnapshot(ms){ try{ localStorage.setItem("snap_w0", JSON.stringify({t: Date.now(), start: weekendRange(0).start.getTime(), ms})); }catch(e){} }
function loadSnapshot(){
  try{
    const x = JSON.parse(localStorage.getItem("snap_w0") || "null");
    if (!x || x.start !== weekendRange(0).start.getTime()) return null;   // copie d'un autre week-end : ignorée
    return {t: x.t, ms: reviveMatches(x.ms)};
  }catch(e){ return null; }
}
async function reload(force){
  const key = "w" + S.offset;
  renderWeek();
  if (!force && cache[key]){ S.matches = cache[key]; S.error = null; S.cat = "ALL"; render(); return; }
  const snap = (!force && S.offset === 0 && !S.matches.length) ? loadSnapshot() : null;
  if (snap && snap.ms.length){
    // affichage immédiat de la copie, puis mise à jour silencieuse
    S.matches = snap.ms; S.error = null; S.loading = false; render();
    S.snapAge = snap.t;
  } else {
    S.loading = true; S.error = null; S.cat = "ALL"; S.club = null; renderChips(); renderMain();
  }
  const myOffset = S.offset;
  try{
    const ms = await loadMatches(weekendRange(S.offset));
    if (myOffset !== S.offset) return;
    cache[key] = ms; S.matches = ms; syncNotif(); S.rateCache = {}; S.snapAge = null;
    if (S.offset === 0) saveSnapshot(ms);
    if (!S.season) setTimeout(() => loadSeason(), 500);
    store.set("last_" + key, {t: Date.now(), n: ms.length});
  }catch(err){
    if (myOffset !== S.offset) return;
    if (snap && snap.ms.length){ toast("⚠️ Hors connexion : derniers matchs enregistrés"); }
    else { S.error = (err && err.message) || String(err); S.matches = []; }
  }finally{
    if (myOffset === S.offset){ S.loading = false; render(); }
  }
}
