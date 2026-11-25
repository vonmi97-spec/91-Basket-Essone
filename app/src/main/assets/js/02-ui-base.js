"use strict";
/* ================= État & rendu ================= */
const S = { offset: 0, matches: [], cat: "ALL", sexe: "ALL", q: "", tab: "matchs", loading: false, error: null, club: null,
            favs: store.get("favs", []), results: null, resWeeks: 4, resLoading: false, resError: null, open: {}, ranks: {} };
const src = () => S.tab === "res" ? (S.results || []) : (S.tab === "cls" || S.tab === "up" || S.tab === "sty") ? allKnown() : S.matches;
function allKnown(){ const seen = {}, out = []; [S.matches, S.results || []].forEach(l => l.forEach(m => { if (!seen[m.id]){ seen[m.id] = 1; out.push(m); } })); return out; }
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

function catSortKey(c){
  if (c.ordre != null) return c.ordre;
  const i = CAT_ORDER.findIndex(x => c.code.startsWith(x)); return i < 0 ? 99 : i;
}
function filtered(){
  const words = norm(S.q).split(/\s+/).filter(Boolean);
  return src().filter(m => {
    if (S.tab === "res" && !m.joue) return false;
    if (S.cat !== "ALL" && m.cat.code !== S.cat) return false;
    if (S.sexe !== "ALL" && m.sexe !== S.sexe) return false;
    if (S.club && m.t1.clubId !== S.club && m.t2.clubId !== S.club) return false;
    if (S.tab === "favs" && !isFavMatch(m)) return false;
    if (!words.length) return true;
    const hay = norm([m.t1.nom, m.t2.nom, m.t1.club, m.t2.club, m.salle.nom, m.salle.ville, m.comp, m.cat.libelle].join(" "));
    return words.every(w => hay.includes(w));
  });
}
function favKey(t){ return "n:" + norm(t.nom); }                 // équipe précise (ex. « ES BRUNOY - 1 »)
function clubKey(t){ return t.clubId ? "c:" + t.clubId : ""; }      // toutes les équipes d'un club
function isFavTeam(t){ return S.favs.some(f => f.key === favKey(t) || (clubKey(t) && f.key === clubKey(t))); }
function isFavMatch(m){ return isFavTeam(m.t1) || isFavTeam(m.t2); }

function renderWeek(){
  const r = weekendRange(S.offset);
  const lbl = S.offset === 0 ? "Ce week-end" : S.offset === 1 ? "Week-end prochain" : S.offset === -1 ? "Week-end dernier"
            : (S.offset > 0 ? `Dans ${S.offset} semaines` : `Il y a ${-S.offset} semaines`);
  $("wLabel").textContent = lbl;
  const sat = new Date(r.start); sat.setDate(sat.getDate()+1);
  $("wDates").textContent = `ven. ${fmtShort(r.start)} → dim. ${fmtShort(r.end)}`;
}
function renderChips(){
  const cats = {}; const base = S.tab === "res" ? (S.results||[]).filter(m => m.joue) : (S.tab === "cls" || S.tab === "up" || S.tab === "sty") ? allKnown() : S.matches; base.forEach(m => { const k = m.cat.code; if (!cats[k]) cats[k] = {c:m.cat, n:0}; cats[k].n++; });
  const list = Object.values(cats).sort((a,b) => catSortKey(a.c) - catSortKey(b.c) || a.c.code.localeCompare(b.c.code));
  $("cats").innerHTML = `<button class="chip ${S.cat==="ALL"?"on":""}" data-cat="ALL">Toutes (${base.length})</button>` +
    list.map(x => `<button class="chip ${S.cat===x.c.code?"on":""}" data-cat="${esc(x.c.code)}">${esc(prettyCat(x.c))} · ${x.n}</button>`).join("");
  const sx = [["ALL","Tous"],["F","Féminin"],["M","Masculin"],["X","Mixte"]].filter(([k]) => k==="ALL" || base.some(m => m.sexe===k));
  $("sexes").innerHTML = sx.map(([k,l]) => `<button class="chip ${S.sexe===k?"on":""}" data-sexe="${k}">${l}</button>`).join("") +
    (S.club ? `<button class="chip on" data-clearclub="1">✕ ${esc(clubName(S.club))}</button>` : "");
}
function prettyCat(c){
  const s = c.code; if (/^SE/.test(s)) return "Seniors"; if (/^U\d+/.test(s)) return s.match(/^U\d+/)[0]; return c.libelle || s;
}
function clubName(id){
  for (const m of S.matches){ if (m.t1.clubId===id) return m.t1.club || m.t1.nom; if (m.t2.clubId===id) return m.t2.club || m.t2.nom; }
  return "Club";
}

function matchCard(m){
  const noHour = m.date && m.date.getHours() === 0 && m.date.getMinutes() === 0;
  const hr = m.date && !noHour ? m.date.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "Horaire à venir";
  const s1 = +m.t1.score, s2 = +m.t2.score;
  const nowT = Date.now();
  const enCours = !m.joue && m.date && !noHour && m.date.getTime() <= nowT && nowT - m.date.getTime() < 2.25*3600e3;
  const lv = !m.joue ? liveOf(m) : null;
  const mid = lv ? `<div class="sc" style="color:#FF6B7F">${esc(lv.score_home ?? 0)} - ${esc(lv.score_out ?? 0)}</div><div class="st">● ${esc(liveLabel(lv))}</div>`
            : m.joue ? `<div class="sc">${esc(m.t1.score)} - ${esc(m.t2.score)}</div><div class="st">Terminé · ${hr}</div>`
                     : enCours ? `<div class="hr" style="color:#FF6B7F">● ${hr}</div><div class="st">En cours</div>`
                     : `<div class="hr">${hr}</div><div class="st">${m.journee ? "J" + esc(m.journee) : ""}</div>`;
  const sexe = m.sexe === "F" ? " F" : m.sexe === "M" ? " M" : "";
  return `<div class="match" data-id="${esc(m.id)}">
    <div class="top"><span class="cat">${esc(prettyCat(m.cat))}${sexe}</span><span class="comp">${esc(m.comp)}${m.poule ? " · " + esc(m.poule) : ""}</span></div>
    <div class="teams">
      <div class="team ${m.joue && s1>s2 ? "win":""}">${logoHtml(m.t1)}<div class="nm">${esc(m.t1.nom)}</div>${miniStar(m.t1)}</div>
      <div class="mid">${mid}</div>
      <div class="team ${m.joue && s2>s1 ? "win":""}">${logoHtml(m.t2)}<div class="nm">${esc(m.t2.nom)}</div>${miniStar(m.t2)}</div>
    </div>
    ${!m.joue && !lv ? wpBar(m) : ""}
    <div class="gym">📍 <span><b>${esc(m.salle.nom || "Gymnase non précisé")}</b>${m.salle.ville ? " · " + esc(m.salle.ville) : ""}</span>
      ${m.salle.nom || m.salle.geo ? `<button class="go" data-go="${esc(m.id)}">Itinéraire</button>` : ""}</div>
  </div>`;
}

function renderMain(){
  const main = $("main");
  if (S.tab === "more") return renderMore();
  if (S.loading){ main.innerHTML = `<div class="load"><div class="spinner"></div>Chargement des matchs du week-end…</div>`; return; }
  if (S.error){ main.innerHTML = `<div class="err">⚠️ ${esc(S.error)}<br><button onclick="reload(true)">Réessayer</button></div>`; return; }
  const list = filtered();
  if (S.tab === "res") return renderResults(list);
  if (S.tab === "cls") return renderStandings(list);
  if (S.tab === "up") return renderProba(list);
  if (S.tab === "sty") return renderStyles(list);
  if (S.tab === "clubs") return renderClubs(list);
  if (S.tab === "gyms") return renderGyms(list);
  if (S.tab === "matchs" && !S.homeAll) return renderHome(list);
  const favHead = S.tab === "favs" ? favManager() : (S.club ? `<div class="clubbar">🏠 Matchs de <b>${esc(clubName(S.club))}</b><button class="chip" data-clearclub="1">✕ Tous les clubs</button></div>` : "");
  if (!list.length){
    main.innerHTML = favHead + `<div class="empty">${S.tab==="favs" ? (S.favs.length ? "Aucun match de tes équipes favorites ce week-end." : "Pas encore de favoris.<br>Touche ＋ Ajouter, ou ☆ sous une équipe dans un match.") : S.matches.length ? "Aucun match ne correspond à ta recherche." : "Aucun match départemental trouvé pour ce week-end<br>(vacances scolaires ou trêve ?)."}</div>`;
    return;
  }
  list.sort((a,b) => (a.date - b.date) || catSortKey(a.cat) - catSortKey(b.cat));
  let html = "", lastDay = "";
  for (const m of list){
    const day = m.date ? fmtDay(m.date) : "Date inconnue";
    if (day !== lastDay){ html += `<div class="day">${esc(day)}</div>`; lastDay = day; }
    html += matchCard(m);
  }
  html += `<div class="stat">${list.length} match${list.length>1?"s":""} · Données FFBB</div>`;
  main.innerHTML = favHead + html;
}
/* ===== Regroupement par catégorie (repliable) ===== */
S.fold = store.get("fold", {});
function sexLabel(x){ return x === "F" ? "Féminines" : x === "M" ? "Masculins" : x === "X" ? "Mixtes" : ""; }
function catGroups(list){
  const g = {};
  list.forEach(m => { const k = m.cat.code + "|" + (m.sexe || ""); (g[k] = g[k] || {cat: m.cat, sexe: m.sexe, k, items: []}).items.push(m); });
  return Object.values(g).sort((a,b) => catSortKey(a.cat) - catSortKey(b.cat) || a.cat.code.localeCompare(b.cat.code) || (a.sexe||"").localeCompare(b.sexe||""));
}
function catHead(tab, grp, count, unit){
  const key = tab + ":" + grp.k, closed = !!S.fold[key];
  return `<button class="cathd" data-fold="${esc(key)}"><span class="cn">${esc(prettyCat(grp.cat))}</span><span class="cs">${esc(sexLabel(grp.sexe))}</span><span class="cc">${count} ${unit}${count>1?"s":""}</span><i>${closed ? "▼" : "▲"}</i></button>`;
}
function isFolded(tab, grp){ return !!S.fold[tab + ":" + grp.k]; }
function foldBar(tab){
  return `<div class="foldbar"><button class="chip" data-foldall="${tab}:open">▼ Tout déplier</button><button class="chip" data-foldall="${tab}:close">▲ Tout replier</button></div>`;
}
function foldAll(tab, open){
  // catégories
  Object.keys(S.fold).forEach(k => { if (k.startsWith(tab + ":")) delete S.fold[k]; });
  if (!open){
    const list = filtered();
    if (tab === "res") catGroups(list.filter(m => m.joue)).forEach(g => S.fold["res:" + g.k] = 1);
    else catGroups(list.filter(m => m.pouleId || m.poule)).forEach(g => S.fold["cls:" + g.k] = 1);
  }
  store.set("fold", S.fold);
  // Compétitions : ouvre ou ferme aussi toutes les poules
  if (tab === "cls"){
    const tree = pouleTree(filtered());
    const all = []; tree.forEach(c => c.divs.forEach(d => d.poules.forEach(e => all.push(e))));
    if (open){ all.forEach(([pk]) => S.open[pk] = true); queueRankings(all); }
    else S.open = {};
  }
  renderMain();
}

function renderResults(list){
  const main = $("main");
  if (S.resLoading){ main.innerHTML = `<div class="load"><div class="spinner"></div>Récupération des résultats FFBB des ${S.resWeeks} derniers week-ends…</div>`; return; }
  if (S.resError){ main.innerHTML = `<div class="err">⚠️ ${esc(S.resError)}<br><button onclick="loadResults(true)">Réessayer</button></div>`; return; }
  if (!S.results){ loadResults(); return; }
  const more = `<button class="btn sec" onclick="moreResults()">Charger 4 week-ends de plus</button>` + ffbbBtn(FFBB_COMITE, "🌐 Tous les résultats de l'Essonne sur FFBB ↗");
  if (!list.length){ main.innerHTML = ffbbEssonneBanner() + `<div class="empty">Aucun résultat trouvé.${S.oldErr ? "<br>⚠️ " + esc(S.oldErr) : ""}</div>` + more; return; }
  let html = ffbbEssonneBanner() + foldBar("res");
  for (const grp of catGroups(list)){
    html += catHead("res", grp, grp.items.length, "résultat");
    if (isFolded("res", grp)) continue;
    // compétition (division) puis matchs du plus récent au plus ancien
    const comps = {};
    grp.items.forEach(m => (comps[m.comp] = comps[m.comp] || []).push(m));
    Object.entries(comps).sort((a,b) => divRank(a[0]) - divRank(b[0]) || a[0].localeCompare(b[0])).forEach(([comp, ms]) => {
      html += `<div class="group">${esc(comp)} · ${ms.length}</div>`;
      let lastDay = "";
      ms.sort((a,b) => b.date - a.date).forEach(m => {
        const day = fmtDay(m.date); if (day !== lastDay){ html += `<div class="rday">${esc(day)}</div>`; lastDay = day; }
        html += matchCard(m);
      });
    });
  }
  html += `<div class="stat">${list.length} résultat${list.length>1?"s":""} · Données FFBB</div>`;
  if (S.oldErr) html += `<div class="stat">⚠️ Certains week-ends anciens n'ont pas pu être récupérés : ${esc(S.oldErr)}</div>`;
  html += more;
  main.innerHTML = html;
}
function weekendOf(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = x.getDay();
  const back = wd === 5 ? 0 : wd === 6 ? 1 : wd === 0 ? 2 : wd + 2; x.setDate(x.getDate() - back); return x;
}
async function loadResults(force){
  if (S.resLoading) return;
  if (force) S.results = null; S.oldErr = null;
  S.resLoading = true; S.resError = null; if (S.tab === "res") renderMain();
  try{
    const now = new Date(); let all = [];
    for (let w = 0; w >= -S.resWeeks; w--){
      const r = weekendRange(w); if (r.start > now) continue;
      const key = "res" + w;
      if (!cache[key] || w === 0){
        try{ cache[key] = (await loadMatches({start: r.start, end: r.end < now ? r.end : now})).filter(m => m.joue); }
        catch(e){ S.oldErr = e.message || String(e); continue; }
      }
      all = all.concat(cache[key]);
      S.results = all; if (S.tab === "res" || S.tab === "cls" || S.tab === "up" || S.tab === "sty"){ S.resLoading = false; renderChips(); renderMain(); S.resLoading = true; }
    }
    S.results = all;
  }catch(err){ S.resError = (err && err.message) || String(err); }
  finally{ S.resLoading = false; if (S.tab === "res" || S.tab === "cls" || S.tab === "up" || S.tab === "sty"){ renderChips(); renderMain(); } }
}
function moreResults(){ S.resWeeks += 4; loadResults(true); }
window.loadResults = loadResults; window.moreResults = moreResults;

