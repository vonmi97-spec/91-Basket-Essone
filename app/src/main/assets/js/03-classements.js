"use strict";
/* ================= Classements ================= */
function divisionKey(m){ return m.compId || m.comp; }
function renderStandings(list){
  const main = $("main");
  // Catégorie → Division (compétition) → Poule
  const cats = {};
  list.forEach(m => {
    if (!m.pouleId && !m.poule) return;
    const ck = m.cat.code + "|" + (m.sexe || "");
    const c = cats[ck] = cats[ck] || {cat: m.cat, sexe: m.sexe, k: ck, divs: {}};
    const dk = divisionKey(m);
    const d = c.divs[dk] = c.divs[dk] || {nom: m.comp, sexe: m.sexe, poules: {}};
    const pk = m.pouleId || (dk + "|" + m.poule);
    const p = d.poules[pk] = d.poules[pk] || {id: m.pouleId, nom: m.poule || "Poule unique", teams: {}, compCode: m.compCode};
    [m.t1, m.t2].forEach(t => { p.teams[t.nom] = t; });
  });
  const catArr = Object.values(cats).sort((a,b) => catSortKey(a.cat) - catSortKey(b.cat) || a.cat.code.localeCompare(b.cat.code) || (a.sexe||"").localeCompare(b.sexe||""));
  if (!catArr.length){
    main.innerHTML = S.resLoading ? `<div class="load"><div class="spinner"></div>Recherche des divisions et poules…</div>` : `<div class="empty">Aucune poule trouvée.</div>`;
    return;
  }
  let html = foldBar("cls") + (S.resLoading ? `<div class="stat">⏳ Recherche d'autres poules en cours…</div>` : "");
  for (const c of catArr){
    const nPoules = Object.values(c.divs).reduce((s, d) => s + Object.keys(d.poules).length, 0);
    html += catHead("cls", c, nPoules, "poule");
    if (isFolded("cls", c)) continue;
    const divs = Object.values(c.divs).sort((a,b) => divRank(a.nom) - divRank(b.nom) || a.nom.localeCompare(b.nom));
    for (const d of divs){
      const poules = Object.entries(d.poules).sort((a,b) => a[1].nom.localeCompare(b[1].nom, "fr", {numeric:true}));
      html += `<div class="div"><div class="hd">${esc(d.nom)}<span>${poules.length} poule${poules.length>1?"s":""}</span></div>`;
      for (const [pk, p] of poules){
        const open = !!S.open[pk];
        html += `<div class="pl"><div class="ph2" data-poule="${esc(pk)}" data-pid="${esc(p.id||"")}">${esc(p.nom)} <i>${open ? "▲" : "▼ Calendrier · Classement"}</i></div>`;
        if (open) html += rankTable(pk, p);
        html += `</div>`;
      }
      html += `</div>`;
    }
  }
  main.innerHTML = html;
}
function divRank(nom){
  const n = norm(nom);
  if (/elite|excellence/.test(n)) return 0;
  const m = /(?:division|d[mf]?|niveau|div\.?)\s*(\d)/.exec(n); if (m) return +m[1];
  if (/honneur/.test(n)) return 3; if (/promotion/.test(n)) return 4;
  return 9;
}
function rankTable(pk, p){
  const r = S.ranks[pk];
  if (!r || r.loading) return `<div class="mini"><div class="spinner" style="width:22px;height:22px;border-width:3px;margin:6px auto"></div></div>`;
  const view = r.view || "cal";
  let html = `<div class="chips" style="padding:0 12px 8px"><button class="chip ${view==="cal"?"on":""}" data-pview="cal" data-pk="${esc(pk)}">Calendrier</button><button class="chip ${view==="rk"?"on":""}" data-pview="rk" data-pk="${esc(pk)}">Classement</button></div>`;
  const site = `<div style="padding:0 12px 10px">${ffbbBtn(ffbbCompUrl(p.compCode), "📊 Voir cette compétition sur FFBB ↗")}</div>`;
  if (view === "cal") return html + calTable(pk, p, r) + site;
  if (r.rankError) return html + `<div class="mini">⚠️ ${esc(r.rankError)} <button class="chip" data-poule-retry="${esc(pk)}">Réessayer</button></div>`;
  if (!r.rows || !r.rows.length) return html + `<div class="mini">Classement pas encore disponible sur la FFBB.</div>`;
  const favKeys = new Set(S.favs.map(f => f.key));
  const pp = pouleFromKey(pk), pctx = pp.cat ? ctxStr(pp.cat, pp.sexe) : "";
  return html + `<table class="rk"><tr><th>#</th><th style="text-align:left">Équipe</th><th>Pts</th><th>J</th><th>G</th><th>P</th><th>GA</th></tr>` +
    r.rows.map(x => {
      const t = matchTeam(p, x);
      const me = t ? isFavTeam(t) : favKeys.has("n:" + norm(x.nom));
      return `<tr class="${me?"me":""}"><td>${esc(x.position || "")}</td><td class="tm sty" data-style="${esc(x.nom)}" data-sctx="${esc(pctx)}" data-sclub="${esc(x.clubId || "")}">${logoHtml({logo: x.logo || (t && t.logo), club: x.club, nom: x.nom})}${esc(x.nom)} <span style="color:var(--orange2)">🧠</span></td>
        <td class="pts">${esc(x.points)}</td><td>${esc(x.joues)}</td><td>${esc(x.gagnes)}</td><td>${esc(x.perdus)}</td><td>${x.diff>0?"+":""}${esc(x.diff)}</td></tr>`;
    }).join("") + `</table><div class="mini">Classement officiel FFBB</div>` + site;
}
function calTable(pk, p, r){
  const ms = r.matches || [];
  if (!ms.length) return `<div class="mini">${r.calError ? "⚠️ " + esc(r.calError) + ` <button class="chip" data-poule-retry="${esc(pk)}">Réessayer</button>` : "Aucun match trouvé pour cette poule."}</div>`;
  const js = [...new Set(ms.map(m => +m.journee || 0))].sort((a,b) => a - b);
  if (r.j == null || !js.includes(r.j)){
    // journée par défaut : la première qui n'est pas entièrement jouée, sinon la dernière
    const next = js.find(j => ms.some(m => (+m.journee||0) === j && !m.joue));
    r.j = next != null ? next : js[js.length - 1];
  }
  let html = `<div class="chips" style="padding:0 12px 6px">` + js.map(j => `<button class="chip ${j===r.j?"on":""}" data-pj="${j}" data-pk="${esc(pk)}">${j ? "J" + j : "?"}</button>`).join("") + `</div>`;
  const list = ms.filter(m => (+m.journee||0) === r.j).sort((a,b) => (a.date||0) - (b.date||0));
  let lastDay = "";
  html += `<div style="padding:0 8px 8px">`;
  for (const m of list){
    const day = m.date ? fmtDay(m.date) : "Date à venir";
    if (day !== lastDay){ html += `<div class="group" style="margin-left:4px">${esc(day)}</div>`; lastDay = day; }
    html += matchCard(m);
  }
  html += `</div>`;
  if (r.partial) html += `<div class="mini">⚠️ Calendrier partiel (seulement les matchs récents et à venir) : la base complète FFBB n'a pas répondu.</div>`;
  return html;
}
function matchTeam(p, x){
  const teams = Object.values(p.teams);
  return teams.find(t => norm(t.nom) === norm(x.nom)) || teams.find(t => x.clubId && t.clubId === x.clubId) || null;
}
const RANK_FIELDS = ["id","nom","classements.position","classements.points","classements.matchJoues","classements.gagnes","classements.perdus",
  "classements.nuls","classements.paniersMarques","classements.paniersEncaisses","classements.difference","classements.horsClassement",
  "classements.organisme_nom","classements.organisme.id","classements.organisme.nom","classements.organisme.logo.id","classements.idEngagement.nom","classements.idEngagement.id"];
const POULE_RENC_FIELDS = ["id","date","date_rencontre","horaire","numeroJournee","nomEquipe1","nomEquipe2","resultatEquipe1","resultatEquipe2","joue",
  "salle.libelle","salle.adresse","salle.cartographie.ville","salle.cartographie.codePostal","salle.cartographie.latitude","salle.cartographie.longitude",
  "idOrganismeEquipe1.id","idOrganismeEquipe1.nom","idOrganismeEquipe1.code","idOrganismeEquipe1.logo",
  "idOrganismeEquipe2.id","idOrganismeEquipe2.nom","idOrganismeEquipe2.code","idOrganismeEquipe2.logo"].map(f => "rencontres." + f);
async function directusGet(path, fields, extra){
  const tk = await getTokens();
  const qs = fields.map(f => "fields[]=" + encodeURIComponent(f)).concat(extra || []).join("&");
  return httpJson("GET", API + path + "?" + qs, {"Authorization": "Bearer " + tk.dh});
}
function parseRanks(d, p){
  const rows = (d.classements || []).filter(c => c && !c.horsClassement).map(c => {
    const org = (c.organisme && typeof c.organisme === "object") ? c.organisme : {};
    const eng = (c.idEngagement && typeof c.idEngagement === "object") ? c.idEngagement : {};
    const nom = eng.nom || c.organisme_nom || org.nom || "?";
    const pm = +c.paniersMarques || 0, pe = +c.paniersEncaisses || 0;
    return { position: +c.position || 0, nom, club: org.nom || c.organisme_nom || "", clubId: org.id ? String(org.id) : (typeof c.organisme !== "object" && c.organisme ? String(c.organisme) : ""),
             logo: logoId(org.logo), points: +c.points || 0, joues: +c.matchJoues || 0, gagnes: +c.gagnes || 0, perdus: +c.perdus || 0,
             diff: c.difference != null ? +c.difference : pm - pe };
  }).sort((a,b) => (a.position || 99) - (b.position || 99) || b.points - a.points || b.diff - a.diff);
  rows.forEach(x => { if (!/\d/.test(x.nom)){ const t = matchTeam(p, x); if (t && t.clubId === x.clubId) x.nom = t.nom; } });
  return rows;
}
async function loadRanking(pk, pid, p){
  const prev = S.ranks[pk] || {};
  S.ranks[pk] = {loading: true, view: prev.view, j: prev.j}; if (S.tab === "cls") renderMain();
  const r = {view: prev.view || "cal", j: prev.j};
  const path = "items/ffbbserver_poules/" + encodeURIComponent(pid || "");
  const deep = ["deep[classements][_limit]=100", "deep[rencontres][_limit]=500", "deep[rencontres][_sort][]=date_rencontre"];
  try{
    if (!pid) throw new Error("Identifiant de poule inconnu");
    let j;
    try{ j = await directusGet(path, RANK_FIELDS.concat(POULE_RENC_FIELDS), deep); }
    catch(e){
      if (e.status === 401) await getTokens(true);
      // si les champs détaillés sont refusés, on demande le minimum
      j = await directusGet(path, ["id","nom","classements.*","rencontres.*"], deep);
    }
    const d = (j && j.data) || {};
    r.rows = parseRanks(d, p);
    const renc = (d.rencontres || []).filter(x => x && typeof x === "object");
    r.matches = renc.map(h => { const m = normalize(h); m.comp = p.compNom || m.comp; m.cat = p.cat || m.cat; m.sexe = p.sexe || m.sexe; m.poule = p.pouleNom || m.poule; return m; });
  }catch(err){
    r.rankError = (err && err.status === 403) ? "Le serveur FFBB des classements refuse la connexion (HTTP 403)." : ((err && err.message) || String(err));
  }
  if (!r.matches || !r.matches.length){
    // repli : moteur de recherche FFBB (matchs récents et à venir uniquement)
    try{
      const filter = [`competitionId.id = ${q(p.compId)}`]; if (p.pouleNom) filter.push(`idPoule.nom = ${q(p.pouleNom)}`);
      const [res] = await multiSearch([{indexUid: IDX_R, q: "", limit: 1000, filter}]);
      r.matches = ((res && res.hits) || []).filter(h => !p.id || !h.idPoule || !h.idPoule.id || String(h.idPoule.id) === p.id).map(normalize);
      r.partial = r.matches.length > 0;
    }catch(e2){ r.calError = (e2 && e2.message) || String(e2); r.matches = []; }
  }
  S.ranks[pk] = r; Object.keys(S.proba).forEach(k => { if (k.startsWith(pk + "|")) delete S.proba[k]; });
  if (S.tab === "cls") renderMain(); else if (S.tab === "up" || S.tab === "sty") scheduleUpRender();
}
function pouleFromKey(pk){
  for (const m of allKnown()){ const k = m.pouleId || (divisionKey(m) + "|" + m.poule); if (k === pk){
    const teams = {}; allKnown().forEach(x => { const kx = x.pouleId || (divisionKey(x) + "|" + x.poule); if (kx === pk){ teams[x.t1.nom] = x.t1; teams[x.t2.nom] = x.t2; } });
    return {id: m.pouleId, teams, compId: m.compId, compCode: m.compCode, pouleNom: m.poule, compNom: m.comp, cat: m.cat, sexe: m.sexe}; } }
  return {id: "", teams: {}};
}

