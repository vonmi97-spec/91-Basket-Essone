"use strict";
/* ================= Style de jeu (déduit des scores) ================= */
// Les noms FFBB ne contiennent pas la catégorie (« CO SAVIGNY - 1 » existe en U11, U13, Seniors…) :
// une équipe = nom + catégorie + sexe.
function ctxStr(cat, sexe){ return (cat && cat.code ? cat.code : cat || "") + "|" + (sexe || ""); }
function parseCtx(c){ if (!c) return null; const [cat, sexe] = String(c).split("|"); return cat ? {cat, sexe: sexe || ""} : null; }
function inCtx(m, ctx){ return !ctx || (m.cat.code === ctx.cat && (!ctx.sexe || !m.sexe || m.sexe === ctx.sexe)); }
function teamPouleKey(name, ctx){
  const n = norm(name);
  const m = allKnown().filter(x => (norm(x.t1.nom) === n || norm(x.t2.nom) === n) && inCtx(x, ctx)).sort((a,b) => (b.date||0) - (a.date||0))[0];
  if (!m) return null;
  return {pk: m.pouleId || (divisionKey(m) + "|" + m.poule), m};
}
function playedOf(name, extra, ctx, clubId){
  const pool = (S.season || []).concat(allKnown(), ...Object.values(S.ranks).map(r => r.matches || []), extra || [])
    .filter(m => m.joue && (!m.date || m.date >= SEASON_START) && inCtx(m, ctx));
  const collect = test => {
    const seen = {}, out = [];
    pool.forEach(m => {
      if (seen[m.id]) return;
      const s1 = parseInt(m.t1.score, 10), s2 = parseInt(m.t2.score, 10); if (isNaN(s1) || isNaN(s2)) return;
      const home = test(m.t1), away = test(m.t2); if (!home && !away) return;
      seen[m.id] = 1;
      out.push({m, home, pf: home ? s1 : s2, pa: home ? s2 : s1, opp: home ? m.t2.nom : m.t1.nom, date: m.date});
    });
    return out.sort((a,b) => (a.date||0) - (b.date||0));
  };
  const n = norm(name);
  let out = collect(t => norm(t.nom) === n);
  // nom du classement différent de celui des matchs : on passe par le club s'il n'a qu'une équipe dans la catégorie
  if (!out.length && clubId){
    const names = new Set(); pool.forEach(m => [m.t1, m.t2].forEach(t => { if (t.clubId === clubId) names.add(norm(t.nom)); }));
    if (names.size === 1) out = collect(t => t.clubId === clubId);
  }
  return out;
}
function pouleAverages(r){
  const ms = ((r && r.matches) || []).filter(m => m.joue);
  let pts = 0, n = 0;
  ms.forEach(m => { const a = parseInt(m.t1.score,10), b = parseInt(m.t2.score,10); if (!isNaN(a) && !isNaN(b)){ pts += a + b; n += 2; } });
  return n ? pts / n : null;   // points marqués moyens par équipe et par match dans la poule
}
function teamStyle(name, r, ctx, clubId){
  const g = playedOf(name, r && r.matches, ctx, clubId);
  if (!g.length) return null;
  const N = g.length, wins = g.filter(x => x.pf > x.pa), margins = g.map(x => x.pf - x.pa);
  const ppg = g.reduce((s,x) => s + x.pf, 0) / N, papg = g.reduce((s,x) => s + x.pa, 0) / N;
  const avgM = margins.reduce((s,x) => s + x, 0) / N;
  const sd = Math.sqrt(margins.reduce((s,x) => s + (x - avgM) ** 2, 0) / N);
  const close = g.filter(x => Math.abs(x.pf - x.pa) <= 6), closeW = close.filter(x => x.pf > x.pa).length;
  const H = g.filter(x => x.home), A = g.filter(x => !x.home);
  const hw = H.filter(x => x.pf > x.pa).length, aw = A.filter(x => x.pf > x.pa).length;
  const big = g.reduce((b,x) => (x.pf - x.pa) > (b ? b.pf - b.pa : -1e9) ? x : b, null);
  const worst = g.reduce((b,x) => (x.pf - x.pa) < (b ? b.pf - b.pa : 1e9) ? x : b, null);
  const avg = categoryAverage(g[g.length - 1].m) || pouleAverages(r) || (ppg + papg) / 2;
  const last = g.slice(-5);
  const tags = [];
  const off = ppg >= avg * 1.12, def = papg <= avg * 0.88;
  if (off && def) tags.push(["⭐", "Complète", "attaque et défense au-dessus de la moyenne de la poule"]);
  else if (off) tags.push(["🔥", "Offensive", `marque ${Math.round((ppg/avg - 1)*100)} % de points de plus que la moyenne`]);
  else if (def) tags.push(["🛡", "Défensive", `encaisse ${Math.round((1 - papg/avg)*100)} % de points de moins que la moyenne`]);
  if (ppg <= avg * 0.85) tags.push(["🧊", "Attaque en panne", "marque peu de points"]);
  if (papg >= avg * 1.15) tags.push(["🚪", "Défense perméable", "encaisse beaucoup de points"]);
  const wr = wins.length / N;
  if (wr >= 0.7 && avgM >= 15) tags.push(["🚜", "Rouleau compresseur", `gagne avec ${Math.round(avgM)} pts d'écart en moyenne`]);
  if (close.length >= 2){
    if (closeW / close.length >= 0.65) tags.push(["🧠", "Solide dans les fins serrées", `${closeW}/${close.length} matchs serrés gagnés`]);
    else if (closeW / close.length <= 0.35) tags.push(["😬", "Fragile dans les fins serrées", `${closeW}/${close.length} matchs serrés gagnés`]);
  }
  if (H.length >= 2 && A.length >= 2){
    const d = hw / H.length - aw / A.length;
    if (d >= 0.34) tags.push(["🏠", "Forte à domicile", `${hw}/${H.length} à domicile, ${aw}/${A.length} à l'extérieur`]);
    else if (d <= -0.34) tags.push(["✈️", "Meilleure à l'extérieur", `${aw}/${A.length} à l'extérieur, ${hw}/${H.length} à domicile`]);
  }
  if (N >= 4){
    if (sd <= 8) tags.push(["📏", "Régulière", "écarts de score très constants"]);
    else if (sd >= 20) tags.push(["🎢", "Irrégulière", "résultats très variables d'un match à l'autre"]);
  }
  if (last.length >= 3){
    const lw = last.slice(-3).filter(x => x.pf > x.pa).length;
    if (lw === 3) tags.push(["📈", "En forme", "3 victoires de suite"]);
    else if (lw === 0) tags.push(["📉", "En difficulté", "3 défaites de suite"]);
  }
  if (!tags.length) tags.push(["⚖️", "Équilibrée", "dans la moyenne de sa poule"]);
  return {N, w: wins.length, l: N - wins.length, ppg, papg, avgM, sd, close, closeW, H, A, hw, aw, big, worst, last, avg, tags};
}
function showTeamStyle(name, ctxS, clubId){
  if (!S.season){
    openSheet(`<h2>${esc(name)}</h2><div class="load" style="padding:24px"><div class="spinner"></div>Récupération des matchs depuis septembre 2026…</div>`);
    loadSeason().then(() => { if ($("sheet").classList.contains("on")) showTeamStyle(name, ctxS, clubId); });
    return;
  }
  let ctx = parseCtx(ctxS);
  const tp = teamPouleKey(name, ctx);
  if (!ctx && tp) ctx = {cat: tp.m.cat.code, sexe: tp.m.sexe};
  const r = tp ? S.ranks[tp.pk] : null;
  if (tp && (!r || (!r.loading && !r.matches))){
    const p = pouleFromKey(tp.pk);
    openSheet(`<h2>${esc(name)}</h2><div class="load" style="padding:24px"><div class="spinner"></div>Analyse des résultats de la saison…</div>`);
    loadRanking(tp.pk, p.id, p).then(() => { if ($("sheet").classList.contains("on")) showTeamStyle(name, ctxS, clubId); });
    return;
  }
  const st = teamStyle(name, r, ctx, clubId);
  const f = v => (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  if (!st){ openSheet(`<h2>${esc(name)}</h2><div class="empty">Pas encore de match joué : style de jeu indisponible.</div><button class="btn sec" onclick="closeSheet()">Fermer</button>`); return; }
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`;
  const catLbl = ctx ? `${esc(prettyCat({code: ctx.cat}))}${ctx.sexe === "F" ? " féminines" : ctx.sexe === "M" ? " masculins" : ""}` : "";
  openSheet(`<h2>🧠 Style de jeu · ${esc(name)}${catLbl ? ` <span class="stat">(${catLbl})</span>` : ""}</h2>
    <div class="stags">${st.tags.map(([i,t,d]) => `<div class="stag"><b>${i} ${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</div>
    ${kv("Bilan", `<b>${st.w} V – ${st.l} D</b> sur ${st.N} match${st.N>1?"s":""}`)}
    ${kv("Points marqués", `<b>${f(st.ppg)}</b> / match <span class="stat">(moyenne poule ${f(st.avg)})</span>`)}
    ${kv("Points encaissés", `<b>${f(st.papg)}</b> / match`)}
    ${kv("Écart moyen", `<b>${st.avgM > 0 ? "+" : ""}${f(st.avgM)}</b> pts`)}
    ${st.H.length ? kv("À domicile", `${st.hw} V – ${st.H.length - st.hw} D`) : ""}
    ${st.A.length ? kv("À l'extérieur", `${st.aw} V – ${st.A.length - st.aw} D`) : ""}
    ${st.close.length ? kv("Matchs serrés (≤ 6 pts)", `${st.closeW} V – ${st.close.length - st.closeW} D`) : ""}
    ${st.big && st.big.pf > st.big.pa ? kv("Plus large victoire", `${st.big.pf}-${st.big.pa} contre ${esc(st.big.opp)}`) : ""}
    ${st.worst && st.worst.pf < st.worst.pa ? kv("Plus lourde défaite", `${st.worst.pf}-${st.worst.pa} contre ${esc(st.worst.opp)}`) : ""}
    ${kv("Forme", st.last.map(x => `<span class="form ${x.pf > x.pa ? "fw" : "fl"}" title="${esc(x.opp)} ${x.pf}-${x.pa}">${x.pf > x.pa ? "V" : "D"}</span>`).join(""))}
    <p class="stat">${S.season && S.season.length ? "Calculé sur tous ses matchs depuis le 1er septembre 2026 (toutes phases)." : "⚠️ Matchs depuis septembre indisponibles (" + esc(S.seasonErr || "?") + ") : calcul sur les matchs récents seulement."} Déduit uniquement des scores (pas de statistiques détaillées en départemental).</p>
    <button class="btn sec" onclick="closeSheet()">Fermer</button>`);
}

/* ================= Vue d'ensemble des styles de jeu ================= */
function renderStyles(list){
  const main = $("main");
  const tree = pouleTree(list);
  if (!tree.length){
    main.innerHTML = S.resLoading ? `<div class="load"><div class="spinner"></div>Recherche des équipes…</div>` : `<div class="empty">Aucune équipe trouvée.</div>`;
    return;
  }
  const all = []; tree.forEach(c => c.divs.forEach(d => d.poules.forEach(e => all.push(e))));
  if (S.cat === "ALL" && tree.length > 1){
    main.innerHTML = `<div class="empty">Choisis une catégorie ci-dessus (U11, U13, Seniors…)<br>pour voir le style de jeu actuel de chaque équipe.<br><br><span class="stat">${all.length} poules au total</span></div>`;
    return;
  }
  if (!S.season){ loadSeason(); main.innerHTML = `<div class="load"><div class="spinner"></div>Récupération de tous les matchs depuis le 1er septembre 2026…</div>`; return; }
  queueRankings(all);
  const done = all.filter(([pk]) => S.ranks[pk] && !S.ranks[pk].loading).length;
  let html = `<div class="stat">${S.season.length ? `Depuis le <b>1er septembre 2026</b> · ${S.season.length.toLocaleString("fr-FR")} matchs analysés (toutes phases)` : `⚠️ Matchs depuis septembre indisponibles (${esc(S.seasonErr || "?")}) : styles calculés sur les matchs récents seulement`} · ${done}/${all.length} poules</div>`;
  if (done < all.length) html += `<div class="prog"><i style="width:${Math.round(100*done/all.length)}%"></i></div>`;
  const words = norm(S.q).split(/\s+/).filter(Boolean);
  for (const c of tree){
    html += `<div class="day">${esc(prettyCat(c.cat))}</div>`;
    for (const d of c.divs){
      html += `<div class="div"><div class="hd">${esc(d.nom)}</div>`;
      for (const [pk, p] of d.poules){
        const r = S.ranks[pk];
        html += `<div class="pl"><div class="ph2">${esc(p.nom)}</div>`;
        if (!r || r.loading){ html += `<div class="mini">Analyse en cours…</div></div>`; continue; }
        // équipes : ordre du classement si disponible, sinon celles vues dans les matchs
        const names = (r.rows && r.rows.length) ? r.rows.map(x => x.nom) : Object.keys(p.teams);
        const items = names.filter(n => !words.length || words.every(w => norm(n).includes(w))).map(n => ({n, st: teamStyle(n, r, {cat: p.cat.code, sexe: p.sexe}, ((r.rows || []).find(x => x.nom === n) || {}).clubId), t: p.teams[n] || Object.values(p.teams).find(t => norm(t.nom) === norm(n)) || {nom: n}}));
        if (!items.length){ html += `</div>`; continue; }
        html += items.map(({n, st, t}) => `<div class="srow" data-style="${esc(n)}" data-sctx="${esc(ctxStr(p.cat, p.sexe))}" data-sclub="${esc(((r.rows || []).find(x => x.nom === n) || {}).clubId || t.clubId || "")}">${logoHtml(t)}<div class="sinfo"><b>${esc(n)}</b>
            ${st ? `<div class="stl">${st.tags.slice(0, 3).map(([i, l]) => `<span class="badge2 b-p">${i} ${esc(l)}</span>`).join("")}</div>
            <div class="ssub">${st.w} V – ${st.l} D · ${(Math.round(st.ppg*10)/10).toLocaleString("fr-FR")} marqués · ${(Math.round(st.papg*10)/10).toLocaleString("fr-FR")} encaissés <span class="sform">${st.last.map(x => `<span class="form ${x.pf > x.pa ? "fw" : "fl"}">${x.pf > x.pa ? "V" : "D"}</span>`).join("")}</span></div>`
                 : `<div class="ssub">Pas encore de match joué</div>`}</div></div>`).join("");
        html += `</div>`;
      }
      html += `</div>`;
    }
  }
  html += `<div class="stat">Touche une équipe pour le détail. Styles déduits uniquement des scores.</div>`;
  main.innerHTML = html;
}

