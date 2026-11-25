"use strict";
/* ================= Événements ================= */
document.addEventListener("click", e => {
  const fa = e.target.closest("[data-favadd],[data-favdel]");
  if (fa){
    if (fa.dataset.favdel){ S.favs = S.favs.filter(f => f.key !== fa.dataset.favdel); store.set("favs", S.favs); syncNotif(); renderMain(); }
    else showFavPicker("");
    return;
  }
  const fsb = e.target.closest("[data-fs]");
  if (fsb){ const on = fsb.dataset.fs === "1"; try{ AndroidBridge.setFullscreen(on); }catch(x){} document.querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("on", b === fsb)); return; }
  const nw = e.target.closest("[data-news]");
  if (nw){ openSheet(newsHtml(null).replace(/^/, "")); $("sheetBox").innerHTML = `<h2>📝 Nouveautés</h2>` + CHANGELOG.map(c => `<div class="pv"><b>Version ${esc(c.v)} <span class="stat" style="display:inline;font-weight:500">· ${esc(c.d)}</span></b><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("") + `<button class="btn sec" onclick="closeSheet()">Fermer</button>`; return; }
  const fa2 = e.target.closest("[data-foldall]");
  if (fa2){ const [t, act] = fa2.dataset.foldall.split(":"); foldAll(t, act === "open"); return; }
  const fd = e.target.closest("[data-fold]");
  if (fd){ const k = fd.dataset.fold; if (S.fold[k]) delete S.fold[k]; else S.fold[k] = 1; store.set("fold", S.fold); renderMain(); return; }
  const pvb = e.target.closest("[data-pv],[data-erase]");
  if (pvb){
    if (pvb.dataset.erase){ eraseAll(+pvb.dataset.erase); return; }
    if (pvb.dataset.pv === "ok" || pvb.dataset.pv === "more"){ store.set("privacyOk", true); const n = $("pvNotice"); if (n) n.remove(); }
    if (pvb.dataset.pv === "more") showPrivacy();
    return;
  }
  const sy = e.target.closest("[data-style]");
  if (sy){ e.stopPropagation(); showTeamStyle(sy.dataset.style, sy.dataset.sctx, sy.dataset.sclub); return; }
  const th = e.target.closest("[data-theme]");
  if (th){ setThemePref(th.dataset.theme); document.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("on", b === th)); return; }
  const lk = e.target.closest("[data-url]");
  if (lk){ e.preventDefault(); e.stopPropagation(); openUrl(lk.dataset.url); return; }
  const nb = e.target.closest("[data-notif]");
  if (nb){ handleNotifClick(nb.dataset.notif); return; }
  const um = e.target.closest("[data-upmode]");
  if (um){ S.upMode = um.dataset.upmode; renderMain(); return; }
  const pv = e.target.closest("[data-pview],[data-pj]");
  if (pv){
    const r = S.ranks[pv.dataset.pk]; if (!r) return;
    if (pv.dataset.pview) r.view = pv.dataset.pview; else r.j = +pv.dataset.pj;
    renderMain(); return;
  }
  const pl = e.target.closest("[data-poule],[data-poule-retry]");
  if (pl){
    const pk = pl.dataset.poule || pl.dataset.pouleRetry; const p = pouleFromKey(pk);
    if (pl.dataset.pouleRetry){ loadRanking(pk, p.id, p); return; }
    S.open[pk] = !S.open[pk];
    if (S.open[pk] && (!S.ranks[pk] || S.ranks[pk].error)) loadRanking(pk, p.id, p); else renderMain();
    return;
  }
  const el = e.target.closest("[data-cat],[data-sexe],[data-go],[data-fav],[data-club],[data-clearclub],.match,#saveSet,#resetSet");
  if (e.target.id === "sheet"){ closeSheet(); return; }
  if (!el) return;
  if (el.id === "saveSet"){ store.set("placesMontee", Math.max(1, +$("setPlaces").value || 1)); store.set("placesDescente", Math.max(1, +$("setDown").value || 1)); const nom = $("setNom").value.trim(), id = $("setId").value.trim(); store.set("comite", (nom||id) ? {nom: nom||undefined, id: id||undefined, manual: true} : null); closeSheet(); reload(); return; }
  if (el.id === "resetSet"){ store.set("comite", null); closeSheet(); reload(true); return; }
  if (el.dataset.cat){ S.cat = el.dataset.cat; render(); return; }
  if (el.dataset.sexe){ S.sexe = el.dataset.sexe; render(); return; }
  if (el.dataset.clearclub){ S.club = null; render(); return; }
  if (el.dataset.go){ e.stopPropagation(); const m = findMatch(el.dataset.go); if (m) openUrl(mapsUrl(m)); return; }
  if (el.dataset.fav){
    e.stopPropagation(); const k = el.dataset.fav;
    const i = S.favs.findIndex(f => f.key === k);
    if (i >= 0) S.favs.splice(i,1); else S.favs.push({key:k, nom: el.dataset.favname});
    store.set("favs", S.favs); const on = i < 0;
    document.querySelectorAll(`[data-fav="${CSS.escape(k)}"]`).forEach(b => { b.classList.toggle("on", on); b.textContent = on ? "★" : "☆"; });
    syncNotif(); if (on && !k.startsWith("nba:")) setTimeout(() => proposeNotif(el.dataset.favname), 400);
    if (S.tab === "favs" || S.view === "home") renderMain(); return;
  }
  if (el.dataset.club !== undefined){ if (el.dataset.club){ S.club = el.dataset.club; go("matchs", "list", {keepClub: true}); } return; }
  if (el.classList.contains("match")){ showMatch(el.dataset.id); }
});
$("prevW").onclick = () => { S.offset--; reload(); };
$("nextW").onclick = () => { S.offset++; reload(); };
$("btnRefresh").onclick = () => refreshAll();
let qT; $("q").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; renderMain(); }, 150); showSugg(); });
