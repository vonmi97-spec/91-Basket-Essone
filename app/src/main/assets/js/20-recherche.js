"use strict";
/* ===== Suggestions : liste des équipes et des gymnases ===== */
function suggSource(){
  const teams = {}, gyms = {};
  const pool = allKnown().concat(S.season || []);
  pool.forEach(m => {
    [m.t1, m.t2].forEach(t => {
      const k = norm(t.nom) + "|" + m.cat.code + "|" + (m.sexe || "");
      if (!teams[k]) teams[k] = {type: "team", nom: t.nom, sub: prettyCat(m.cat) + (m.sexe ? " " + sexLabel(m.sexe).toLowerCase() : ""), t, ord: catSortKey(m.cat)};
    });
    if (m.salle && m.salle.nom){
      const k = norm(m.salle.nom) + "|" + norm(m.salle.ville);
      if (!gyms[k]) gyms[k] = {type: "gym", nom: m.salle.nom, sub: m.salle.ville || "", n: 0};
      gyms[k].n++;
    }
  });
  return {teams: Object.values(teams), gyms: Object.values(gyms)};
}
function showSugg(){
  const box = $("sugg"), q = $("q").value;
  if (S.tab === "nba"){ box.hidden = true; return; }
  const words = norm(q).split(/\s+/).filter(Boolean);
  const ok = x => !words.length || words.every(w => norm(x.nom + " " + x.sub).includes(w));
  const src = suggSource();
  const teams = src.teams.filter(ok).sort((a,b) => a.nom.localeCompare(b.nom) || a.ord - b.ord);
  const gyms = src.gyms.filter(ok).sort((a,b) => a.nom.localeCompare(b.nom));
  if (!teams.length && !gyms.length){ box.innerHTML = `<div class="sg-empty">Aucune équipe ni gymnase trouvé</div>`; box.hidden = !words.length; return; }
  const max = words.length ? 40 : 300;
  box.innerHTML =
    (teams.length ? `<div class="sg-h">🏀 Équipes (${teams.length})</div>` + teams.slice(0, max).map(x => `<button class="sg" data-sg="${esc(x.nom)}">${logoHtml(x.t)}<span><b>${esc(x.nom)}</b><small>${esc(x.sub)}</small></span></button>`).join("") : "") +
    (gyms.length ? `<div class="sg-h">📍 Gymnases (${gyms.length})</div>` + gyms.slice(0, max).map(x => `<button class="sg" data-sg="${esc(x.nom)}"><span class="sg-ic">📍</span><span><b>${esc(x.nom)}</b><small>${esc(x.sub)}</small></span></button>`).join("") : "");
  box.hidden = false;
}
function hideSugg(){ $("sugg").hidden = true; }
$("q").addEventListener("focus", showSugg);
$("q").addEventListener("keydown", e => { if (e.key === "Escape" || e.key === "Enter"){ hideSugg(); $("q").blur(); } });
document.addEventListener("click", e => {
  const it = e.target.closest("[data-sg]");
  if (it){
    e.stopPropagation();
    $("q").value = it.dataset.sg; S.q = it.dataset.sg; hideSugg(); $("q").blur();
    if (S.tab === "matchs" && !S.homeAll) S.homeAll = true;   // afficher tous les matchs de l'équipe ou du gymnase
    renderMain(); return;
  }
  if (!e.target.closest(".search")) hideSugg();
}, true);
$("q").addEventListener("search", () => { if (!$("q").value){ S.q = ""; renderMain(); } });

function render(){ renderWeek(); renderChips(); renderMain(); }

const cache = {};
