"use strict";
/* ================= Montées ================= */
function pouleTree(list){
  const cats = {};
  list.forEach(m => {
    if (!m.pouleId && !m.poule) return;
    const c = cats[m.cat.code] = cats[m.cat.code] || {cat: m.cat, divs: {}};
    const dk = divisionKey(m);
    const d = c.divs[dk] = c.divs[dk] || {nom: m.comp, poules: {}};
    const pk = m.pouleId || (dk + "|" + m.poule);
    const p = d.poules[pk] = d.poules[pk] || {id: m.pouleId, nom: m.poule || "Poule unique", teams: {}, compId: m.compId, pouleNom: m.poule, compNom: m.comp, cat: m.cat, sexe: m.sexe};
    p.teams[m.t1.nom] = m.t1; p.teams[m.t2.nom] = m.t2;
  });
  return Object.values(cats).sort((a,b) => catSortKey(a.cat) - catSortKey(b.cat) || a.cat.code.localeCompare(b.cat.code))
    .map(c => ({cat: c.cat, divs: Object.values(c.divs).sort((a,b) => divRank(a.nom) - divRank(b.nom) || a.nom.localeCompare(b.nom))
      .map(d => ({nom: d.nom, poules: Object.entries(d.poules).sort((a,b) => a[1].nom.localeCompare(b[1].nom, "fr", {numeric:true}))}))}));
}
let upTimer = null;
function scheduleUpRender(){ if (upTimer) return; upTimer = setTimeout(() => { upTimer = null; if (S.tab === "up" || S.tab === "sty") renderMain(); }, 400); }
let upQueue = [], upRunning = 0;
function queueRankings(entries){
  entries.forEach(([pk, p]) => { if (!S.ranks[pk] && !upQueue.some(x => x[0] === pk)) upQueue.push([pk, p]); });
  const next = () => {
    while (upRunning < 4 && upQueue.length){
      const [pk, p] = upQueue.shift(); upRunning++;
      loadRanking(pk, p.id, p).finally(() => { upRunning--; next(); });
    }
  };
  next();
}
/* Goal-average particulier entre deux équipes (matchs aller/retour entre elles).
   Renvoie {diff, decided} : diff > 0 = avantage à a ; decided = tous leurs matchs sont joués. */
function h2h(a, b, ms){
  const na = norm(a.nom), nb = norm(b.nom);
  const mutual = (ms || []).filter(m => { const x = norm(m.t1.nom), y = norm(m.t2.nom); return (x === na && y === nb) || (x === nb && y === na); });
  if (!mutual.length) return {diff: 0, decided: false, played: 0};
  let diff = 0, played = 0, winsA = 0, winsB = 0;
  mutual.forEach(m => {
    if (!m.joue) return;
    const s1 = parseInt(m.t1.score, 10), s2 = parseInt(m.t2.score, 10); if (isNaN(s1) || isNaN(s2)) return;
    played++;
    const d = norm(m.t1.nom) === na ? s1 - s2 : s2 - s1;
    diff += d; if (d > 0) winsA++; else if (d < 0) winsB++;
  });
  // critère FFBB : d'abord les points des matchs particuliers (victoires), puis l'écart de paniers
  const score = winsA !== winsB ? (winsA - winsB) * 1000 + diff : diff;
  return {diff: score, decided: played === mutual.length && played > 0, played, gaDiff: diff};
}
/* a passe devant b à égalité de points ? true / false / null (pas encore décidé) */
function winsTie(a, b, ms){
  const h = h2h(a, b, ms);
  if (h.decided){ if (h.diff > 0) return true; if (h.diff < 0) return false; }
  return null;
}
function promoAnalysis(r, places){
  const rows = (r.rows || []).slice().sort((a,b) => (a.position||99) - (b.position||99));
  if (!rows.length) return null;
  const ms = r.matches || [];
  const known = !r.partial && ms.length > 0;
  rows.forEach(x => {
    let total = null;
    if (known){
      const n = ms.filter(m => norm(m.t1.nom) === norm(x.nom) || norm(m.t2.nom) === norm(x.nom)).length;
      total = n || null;
    }
    x.reste = total != null ? Math.max(0, total - x.joues) : null;
    x.max = x.reste != null ? x.points + 2 * x.reste : null;
  });
  const cut = rows[Math.min(places, rows.length) - 1];
  const outside = rows.slice(places);
  const bestOutsideMax = outside.length && outside.every(x => x.max != null) ? Math.max(...outside.map(x => x.max)) : (outside.length ? null : -1);
  const out = [];
  rows.forEach((x, i) => {
    let st = null, ga = "";
    if (i < places){
      // assuré si aucune équipe hors zone ne peut le dépasser, égalités départagées au goal-average particulier
      const safeFromAll = bestOutsideMax != null && outside.every(y => y.max < x.points || (y.max === x.points && winsTie(x, y, ms) === true));
      st = safeFromAll ? "q" : "z";
      if (safeFromAll && outside.some(y => y.max === x.points)) ga = "au goal-average particulier";
    }
    else if (x.max == null){ if (cut.points - x.points <= 4) st = "p"; }
    else if (x.max > cut.points) st = "p";
    else if (x.max === cut.points){
      const t = winsTie(x, cut, ms);
      if (t !== false){ st = "p"; ga = t === true ? "gagne le goal-average" : "goal-average à jouer"; }
    }
    if (st) out.push({...x, st, ga, ecart: Math.max(0, cut.points - x.points)});
  });
  return {out, known, finished: known && rows.every(x => x.reste === 0)};
}
function relegAnalysis(r, places){
  const rows = (r.rows || []).slice().sort((a,b) => (a.position||99) - (b.position||99));
  if (rows.length <= places) return null;
  promoAnalysis(r, 1); // calcule reste / max sur chaque ligne
  const n = rows.length, zoneStart = n - places;
  const safe = rows[zoneStart - 1];                  // dernière place sauvée
  const zone = rows.slice(zoneStart);
  const zoneBestMax = zone.every(x => x.max != null) ? Math.max(...zone.map(x => x.max)) : null;
  const out = [];
  rows.forEach((x, i) => {
    let st = null;
    const min = x.reste != null ? x.points + x.reste : null; // défaites = 1 pt
    let ga = "";
    if (i >= zoneStart){
      const condemned = x.max != null && (x.max < safe.points || (x.max === safe.points && winsTie(x, safe, r.matches) === false));
      st = condemned ? "c" : "d";
      if (condemned && x.max === safe.points) ga = "perd le goal-average";
    } else if (zoneBestMax != null && min != null){
      // menacé si une équipe de la zone peut le rattraper (à égalité : goal-average particulier)
      const threats = zone.filter(z => z.max > min || (z.max === min && winsTie(x, z, r.matches) !== true));
      if (threats.length) st = "m";
      else if (zone.some(z => z.max === min)) ga = "sauvé au goal-average";
    } else if (x.points - zone[0].points <= 4){
      st = "m";
    }
    if (st) out.push({...x, st, ga, marge: Math.max(0, x.points - zone[0].points), min});
  });
  return {out};
}
function stayAnalysis(r, upPlaces, downPlaces, lastDiv){
  const rows = (r.rows || []).slice().sort((a,b) => (a.position||99) - (b.position||99));
  if (!rows.length) return null;
  const pa = promoAnalysis(r, upPlaces);
  const ra = lastDiv ? {out: []} : (relegAnalysis(r, downPlaces) || {out: []});
  const upSet = new Set((pa ? pa.out : []).map(x => x.nom));
  const downSet = new Set(ra.out.map(x => x.nom));
  const n = rows.length;
  const out = [];
  rows.forEach((x, i) => {
    const inUpZone = i < upPlaces, inDownZone = !lastDiv && i >= n - downPlaces;
    if (inUpZone || inDownZone) return;                 // actuellement en zone de montée ou de descente
    const st = (!upSet.has(x.nom) && !downSet.has(x.nom)) ? "s" : "s2";
    out.push({...x, st, up: upSet.has(x.nom), down: downSet.has(x.nom)});
  });
  return {out};
}
function renderPromotions(list){
  const main = $("main");
  const mode = S.upMode || "up";
  const upPl = Math.max(1, +store.get("placesMontee", 1) || 1), downPl = Math.max(1, +store.get("placesDescente", 1) || 1);
  const places = mode === "down" ? downPl : upPl;
  const tree = pouleTree(list);
  const toggle = `<div class="chips"><button class="chip ${mode==="up"?"on":""}" data-upmode="up">⬆ Montées</button><button class="chip ${mode==="stay"?"on":""}" data-upmode="stay">= Maintien</button><button class="chip ${mode==="down"?"on":""}" data-upmode="down">⬇ Descentes</button></div>`;
  if (!tree.length){
    main.innerHTML = S.resLoading ? `<div class="load"><div class="spinner"></div>Recherche des poules…</div>` : `<div class="empty">Aucune poule trouvée.</div>`;
    return;
  }
  const all = []; tree.forEach(c => c.divs.forEach(d => d.poules.forEach(e => all.push(e))));
  if (S.cat === "ALL" && tree.length > 1){
    main.innerHTML = toggle + `<div class="empty">Choisis une catégorie ci-dessus (U11, U13, Seniors…)<br>pour calculer les ${mode==="up"?"montées":mode==="down"?"descentes":"maintiens"} possibles.<br><br><span class="stat">${all.length} poules au total</span></div>`;
    return;
  }
  queueRankings(all);
  const done = all.filter(([pk]) => S.ranks[pk] && !S.ranks[pk].loading).length;
  let html = toggle + `<div class="stat">${mode==="stay" ? `Montée : <b>${upPl}</b> · Descente : <b>${downPl}</b> place(s) par poule` : `Places de ${mode==="up"?"montée":"descente"} par poule : <b>${places}</b>`} (modifiable dans ⚙️) · ${done}/${all.length} poules analysées</div>`;
  if (done < all.length) html += `<div class="prog"><i style="width:${Math.round(100*done/all.length)}%"></i></div>`;
  html += mode === "stay"
    ? `<div class="stat"><span class="badge2 b-s">Maintien assuré</span> ne peut plus ni monter ni descendre · <span class="badge2 b-s2">Maintien probable</span> hors des zones, mais encore en jeu</div>`
    : mode === "up"
    ? `<div class="stat"><span class="badge2 b-q">Assuré</span> qualifié mathématiquement · <span class="badge2 b-z">En position</span> dans la zone de montée · <span class="badge2 b-p">Encore possible</span> peut encore l'atteindre</div>`
    : `<div class="stat"><span class="badge2 b-c">Condamné</span> ne peut plus se sauver · <span class="badge2 b-d">En position</span> dans la zone de descente · <span class="badge2 b-m">Menacé</span> peut encore y tomber</div>`;
  for (const c of tree){
    html += `<div class="day">${esc(prettyCat(c.cat))}</div>`;
    c.divs.forEach((d, di) => {
      const top = di === 0 && divRank(d.nom) <= 1;
      const last = c.divs.length > 1 && di === c.divs.length - 1;
      if (mode === "stay"){
        html += `<div class="div"><div class="hd">${esc(d.nom)}<span>${last ? "dernière division" : "reste dans la division"}</span></div>`;
        for (const [pk, p] of d.poules){
          const r = S.ranks[pk];
          html += `<div class="pl"><div class="ph2">${esc(p.nom)}</div>`;
          if (!r || r.loading){ html += `<div class="mini">Analyse en cours…</div></div>`; continue; }
          const a = stayAnalysis(r, upPl, downPl, last);
          if (!a){ html += `<div class="mini">${r.rankError ? "⚠️ " + esc(r.rankError) : "Classement pas encore disponible."}</div></div>`; continue; }
          if (!a.out.length){ html += `<div class="mini">Aucune équipe hors des zones de montée et de descente.</div></div>`; continue; }
          html += `<table class="rk"><tr><th>#</th><th style="text-align:left">Équipe</th><th>Pts</th><th>GA</th><th>Reste</th><th>Max</th></tr>` +
            a.out.map(x => `<tr><td>${esc(x.position)}</td><td class="tm">${logoHtml({logo: x.logo, club: x.club, nom: x.nom})}<span>${esc(x.nom)}
              <span class="badge2 ${x.st==="s"?"b-s":"b-s2"}">${x.st==="s" ? "Maintien assuré" : "Maintien probable" + (x.up && x.down ? " (↑↓ possible)" : x.up ? " (↑ possible)" : " (↓ possible)")}</span></span></td>
              <td class="pts">${esc(x.points)}</td><td>${x.diff>0?"+":""}${esc(x.diff)}</td><td>${x.reste != null ? esc(x.reste) : "?"}</td><td>${x.max != null ? esc(x.max) : "?"}</td></tr>`).join("") + `</table></div>`;
        }
        html += `</div>`;
        return;
      }
      if (mode === "down" && last){ html += `<div class="div"><div class="hd">${esc(d.nom)}<span>dernière division</span></div><div class="mini">Pas de descente depuis la division la plus basse.</div></div>`; return; }
      html += `<div class="div"><div class="hd">${esc(d.nom)}<span>${mode === "down" ? "vers la division inférieure" : top ? "montée en région" : "vers la division supérieure"}</span></div>`;
      for (const [pk, p] of d.poules){
        const r = S.ranks[pk];
        html += `<div class="pl"><div class="ph2">${esc(p.nom)}</div>`;
        if (!r || r.loading){ html += `<div class="mini">Analyse en cours…</div></div>`; continue; }
        const a = mode === "up" ? promoAnalysis(r, places) : relegAnalysis(r, places);
        if (a && mode === "down"){
          html += `<table class="rk"><tr><th>#</th><th style="text-align:left">Équipe</th><th>Pts</th><th>GA</th><th>Reste</th><th>Max</th></tr>` +
            a.out.map(x => `<tr><td>${esc(x.position)}</td><td class="tm">${logoHtml({logo: x.logo, club: x.club, nom: x.nom})}<span>${esc(x.nom)}
              <span class="badge2 ${x.st==="c"?"b-c":x.st==="d"?"b-d":"b-m"}">${x.st==="c"?"Condamné":x.st==="d"?"En position":"Menacé" + (x.marge ? " (+" + x.marge + " pts)" : "")}</span>${x.ga ? `<span class="badge2 b-p">${esc(x.ga)}</span>` : ""}</span></td>
              <td class="pts">${esc(x.points)}</td><td>${x.diff>0?"+":""}${esc(x.diff)}</td><td>${x.reste != null ? esc(x.reste) : "?"}</td><td>${x.max != null ? esc(x.max) : "?"}</td></tr>`).join("") + `</table></div>`;
          continue;
        }
        if (!a){ html += `<div class="mini">${r.rankError ? "⚠️ " + esc(r.rankError) : "Classement pas encore disponible."}</div></div>`; continue; }
        html += `<table class="rk"><tr><th>#</th><th style="text-align:left">Équipe</th><th>Pts</th><th>GA</th><th>Reste</th><th>Max</th></tr>` +
          a.out.map(x => `<tr><td>${esc(x.position)}</td><td class="tm">${logoHtml({logo: x.logo, club: x.club, nom: x.nom})}<span>${esc(x.nom)}
            <span class="badge2 ${x.st==="q"?"b-q":x.st==="z"?"b-z":"b-p"}">${x.st==="q"?"Assuré":x.st==="z"?"En position":"Encore possible" + (x.ecart ? " (−" + x.ecart + " pts)" : "")}</span>${x.ga ? `<span class="badge2 b-p">${esc(x.ga)}</span>` : ""}</span></td>
            <td class="pts">${esc(x.points)}</td><td>${x.diff>0?"+":""}${esc(x.diff)}</td><td>${x.reste != null ? esc(x.reste) : "?"}</td><td>${x.max != null ? esc(x.max) : "?"}</td></tr>`).join("") + `</table>`;
        if (!a.known) html += `<div class="mini">Calendrier complet indisponible : « Encore possible » = à 2 victoires ou moins.</div>`;
        else if (a.finished) html += `<div class="mini">Phase terminée.</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    });
  }
  html += `<div class="stat">Calcul : victoire 2 pts, défaite 1 pt. À égalité de points : goal-average particulier (matchs entre les équipes à égalité), puis goal-average général (GA = paniers marqués − encaissés). Le nombre réel de ${mode==="down"?"descentes":"montées et descentes"} dépend du règlement du comité.</div>`;
  main.innerHTML = html;
}

