"use strict";
/* ================= Probabilités de montée / descente (simulation) ================= */
S.proba = {};
const SIMS = 5000, HOME_ADV = 3, SPREAD = 12;   // avantage du terrain (pts) et dispersion des écarts
function simulatePoule(r, upPl, downPl, noDown){
  const rows = (r.rows || []).slice().sort((a,b) => (a.position||99) - (b.position||99));
  const n = rows.length;
  if (n < 2) return null;
  const ms = r.matches || [];
  if (r.partial || !ms.length) return {error: "Calendrier complet de la poule indisponible : calcul impossible."};
  const idx = {}; rows.forEach((x, i) => idx[norm(x.nom)] = i);
  const remaining = ms.filter(m => !m.joue).map(m => [idx[norm(m.t1.nom)], idx[norm(m.t2.nom)]]).filter(p => p[0] != null && p[1] != null);
  // force de chaque équipe : écart moyen par match, ramené vers 0 en début de saison
  const rating = rows.map(x => (x.diff || 0) / ((x.joues || 0) + 2));
  const pWin = remaining.map(([h, a]) => 1 / (1 + Math.exp(-((rating[h] + HOME_ADV) - rating[a]) / SPREAD)));
  const up = new Array(n).fill(0), down = new Array(n).fill(0);
  const pts = new Array(n), order = rows.map((_, i) => i);
  for (let s = 0; s < SIMS; s++){
    for (let i = 0; i < n; i++) pts[i] = rows[i].points || 0;
    for (let k = 0; k < remaining.length; k++){
      const [h, a] = remaining[k];
      if (Math.random() < pWin[k]){ pts[h] += 2; pts[a] += 1; } else { pts[a] += 2; pts[h] += 1; }
    }
    // égalités : goal-average particulier si déjà décidé, sinon goal-average général, sinon tirage
    const tie = order.map(() => Math.random());
    order.sort((i, j) => (pts[j] - pts[i]) || tieBreak(rows[i], rows[j], ms) || (rows[j].diff - rows[i].diff) || (tie[i] - tie[j]));
    for (let p = 0; p < Math.min(upPl, n); p++) up[order[p]]++;
    if (!noDown) for (let p = Math.max(0, n - downPl); p < n; p++) down[order[p]]++;
  }
  return {rows: rows.map((x, i) => ({...x, up: 100 * up[i] / SIMS, down: noDown ? null : 100 * down[i] / SIMS})), remaining: remaining.length};
}
function tieBreak(a, b, ms){ const t = winsTie(a, b, ms); return t === true ? -1 : t === false ? 1 : 0; }
function pct(v){
  if (v == null) return "–";
  if (v >= 99.95) return "100 %"; if (v <= 0.05) return "0 %";
  if (v < 1) return "< 1 %"; if (v > 99) return "> 99 %";
  return Math.round(v) + " %";
}
function bar(v, cls){ return `<div class="pbar"><i class="${cls}" style="width:${Math.max(0, Math.min(100, v || 0))}%"></i><span>${pct(v)}</span></div>`; }
function renderProba(list){
  const main = $("main");
  const upPl = Math.max(1, +store.get("placesMontee", 1) || 1), downPl = Math.max(1, +store.get("placesDescente", 1) || 1);
  const tree = pouleTree(list);
  if (!tree.length){
    main.innerHTML = S.resLoading ? `<div class="load"><div class="spinner"></div>Recherche des poules…</div>` : `<div class="empty">Aucune poule trouvée.</div>`;
    return;
  }
  const all = []; tree.forEach(c => c.divs.forEach(d => d.poules.forEach(e => all.push(e))));
  if (S.cat === "ALL" && tree.length > 1){
    main.innerHTML = `<div class="empty">Choisis une catégorie ci-dessus (U11, U13, Seniors…)<br>pour calculer les probabilités de montée et de descente.<br><br><span class="stat">${all.length} poules au total</span></div>`;
    return;
  }
  queueRankings(all);
  const done = all.filter(([pk]) => S.ranks[pk] && !S.ranks[pk].loading).length;
  let html = `<div class="stat">Montée : <b>${upPl}</b> · Descente : <b>${downPl}</b> place(s) par poule (modifiable dans ⚙️) · ${done}/${all.length} poules analysées</div>`;
  if (done < all.length) html += `<div class="prog"><i style="width:${Math.round(100*done/all.length)}%"></i></div>`;
  for (const c of tree){
    html += `<div class="day">${esc(prettyCat(c.cat))}</div>`;
    c.divs.forEach((d, di) => {
      const top = di === 0 && divRank(d.nom) <= 1;
      const last = c.divs.length > 1 && di === c.divs.length - 1;
      html += `<div class="div"><div class="hd">${esc(d.nom)}<span>${top ? "⬆ = montée en région" : last ? "dernière division" : ""}</span></div>`;
      for (const [pk, p] of d.poules){
        const r = S.ranks[pk];
        html += `<div class="pl"><div class="ph2">${esc(p.nom)}</div>`;
        if (!r || r.loading){ html += `<div class="mini">Analyse en cours…</div></div>`; continue; }
        if (!r.rows || !r.rows.length){ html += `<div class="mini">${r.rankError ? "⚠️ " + esc(r.rankError) : "Classement pas encore disponible."}</div></div>`; continue; }
        const key = pk + "|" + upPl + "|" + downPl + "|" + last;
        const res = S.proba[key] || (S.proba[key] = simulatePoule(r, upPl, downPl, last));
        if (!res){ html += `</div>`; continue; }
        if (res.error){ html += `<div class="mini">⚠️ ${esc(res.error)}</div></div>`; continue; }
        html += `<table class="rk prob"><tr><th>#</th><th style="text-align:left">Équipe</th><th>Pts</th><th>⬆ Montée</th>${last ? "" : "<th>⬇ Descente</th>"}</tr>` +
          res.rows.map(x => `<tr class="${isFavTeam({nom: x.nom, clubId: x.clubId}) ? "me" : ""}"><td>${esc(x.position)}</td><td class="tm sty" data-style="${esc(x.nom)}" data-sctx="${esc(ctxStr(p.cat, p.sexe))}" data-sclub="${esc(x.clubId || "")}">${logoHtml({logo: x.logo, club: x.club, nom: x.nom})}<span>${esc(x.nom)} <span style="color:var(--orange2)">🧠</span></span></td>
            <td class="pts">${esc(x.points)}</td><td>${bar(x.up, "pu")}</td>${last ? "" : `<td>${bar(x.down, "pd")}</td>`}</tr>`).join("") + `</table>`;
        html += `<div class="mini">${res.remaining ? res.remaining + " match" + (res.remaining > 1 ? "s" : "") + " restant" + (res.remaining > 1 ? "s" : "") + " simulé" + (res.remaining > 1 ? "s" : "") : "Phase terminée : classement définitif."}</div></div>`;
      }
      html += `</div>`;
    });
  }
  html += `<div class="stat">Calcul : ${SIMS.toLocaleString("fr-FR")} fins de saison simulées. Chance de gagner un match selon l'écart moyen de points de chaque équipe, avec un avantage de ${HOME_ADV} pts à domicile. Victoire 2 pts, défaite 1 pt ; égalités au goal-average. Ce sont des estimations, pas des certitudes.</div>`;
  main.innerHTML = html;
}

