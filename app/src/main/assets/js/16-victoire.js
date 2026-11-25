"use strict";
/* ================= Probabilité de victoire d'un match ================= */
S.rateCache = {};
function teamRating(t, m){
  const ctx = {cat: m.cat.code, sexe: m.sexe};
  const key = norm(t.nom) + "|" + ctxStr(m.cat, m.sexe);
  if (S.rateCache[key]) return S.rateCache[key];
  const g = playedOf(t.nom, null, ctx, t.clubId);
  const sum = g.reduce((s, x) => s + (x.pf - x.pa), 0);
  return (S.rateCache[key] = {r: sum / (g.length + 2), n: g.length, w: g.filter(x => x.pf > x.pa).length});
}
function winProb(m){
  if (m.joue) return null;
  const a = teamRating(m.t1, m), b = teamRating(m.t2, m);
  if (!a.n && !b.n) return null;
  const p = 1 / (1 + Math.exp(-((a.r + HOME_ADV) - b.r) / SPREAD));
  return {p1: p, p2: 1 - p, a, b, low: Math.min(a.n, b.n) < 3};
}
function wpBar(m){
  const w = winProb(m); if (!w) return "";
  const p1 = Math.round(w.p1 * 100), p2 = 100 - p1;
  return `<div class="wp" title="Probabilité de victoire"><b class="${p1 >= p2 ? "fav" : ""}">${p1} %</b><div class="wpbar"><i style="width:${p1}%"></i></div><b class="${p2 > p1 ? "fav" : ""}">${p2} %</b></div>`;
}
function wpDetail(m){
  const w = winProb(m); if (!w) return "";
  const f = v => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  const p1 = Math.round(w.p1 * 100);
  return `<div class="kv"><span class="k">Probabilité de victoire</span><span style="flex:1">${wpBar(m)}
    <span class="stat">${esc(m.t1.nom)} : ${w.a.w} V / ${w.a.n} matchs, écart ${f(w.a.r)} · ${esc(m.t2.nom)} : ${w.b.w} V / ${w.b.n} matchs, écart ${f(w.b.r)} · avantage du terrain ${HOME_ADV} pts${w.low ? " · ⚠️ peu de matchs : estimation fragile" : ""}</span></span></div>`;
}

