"use strict";
/* ================= Gestion des favoris ================= */
function favType(k){ return k.startsWith("c:") ? "Club (toutes ses équipes)" : "Équipe"; }
function favManager(){
  const rows = S.favs.filter(f => !f.key.startsWith("nba:")).map(f => `<div class="favrow"><span class="star on" style="padding:0">★</span><div class="nm">${esc(f.nom)}<div class="ty">${esc(favType(f.key))}</div>${f.key.startsWith("n:") ? `<button class="stylebtn" data-style="${esc(f.nom)}">🧠 Style de jeu</button>` : ""}</div><button class="x" data-favdel="${esc(f.key)}" aria-label="Retirer">✕</button></div>`).join("");
  return `<div class="group">Mes favoris (${S.favs.filter(f => !f.key.startsWith("nba:")).length})</div>${rows}<button class="btn" data-favadd="1" style="margin:8px 0 4px">＋ Ajouter une équipe ou un club</button><div class="group">Leurs matchs ce week-end</div>`;
}
function allTeams(){
  const t = {};
  allKnown().forEach(m => [m.t1, m.t2].forEach(x => {
    const k = favKey(x); if (!t[k]) t[k] = {key: k, nom: x.nom, sub: [prettyCat(m.cat), m.sexe === "F" ? "F" : m.sexe === "M" ? "M" : ""].filter(Boolean).join(" "), team: x};
    if (x.clubId){ const ck = "c:" + x.clubId; if (!t[ck]) t[ck] = {key: ck, nom: (x.club || x.nom) + " (club)", sub: "toutes ses équipes", team: x, club: true}; }
  }));
  return Object.values(t);
}
function showFavPicker(qs){
  openSheet(`<h2>Ajouter des favoris</h2>
    <div class="search" style="margin:0 0 8px"><input id="favQ" type="search" placeholder="Nom d'équipe ou de club…" value="${esc(qs)}" autocomplete="off"></div>
    <div id="favList"></div><button class="btn sec" onclick="closeSheet();renderMain()">Terminé</button>`);
  const draw = () => {
    const words = norm($("favQ").value).split(/\s+/).filter(Boolean);
    const all = allTeams().filter(x => !words.length || words.every(w => norm(x.nom + " " + x.sub).includes(w)))
      .sort((a,b) => (S.favs.some(f => f.key === b.key) - S.favs.some(f => f.key === a.key)) || (b.club ? 1 : 0) - (a.club ? 1 : 0) || a.nom.localeCompare(b.nom)).slice(0, 80);
    $("favList").innerHTML = all.length ? all.map(x => { const on = S.favs.some(f => f.key === x.key);
      return `<div class="favrow">${x.team ? logoHtml(x.team).replace('class="logo', 'style="width:30px;height:30px" class="logo') : ""}<div class="nm">${esc(x.nom)}<div class="ty">${esc(x.sub)}</div></div>
        <button class="star ${on?"on":""}" data-fav="${esc(x.key)}" data-favname="${esc(x.nom)}">${on?"★":"☆"}</button></div>`; }).join("")
      : `<div class="mini">Aucune équipe trouvée.${S.matches.length ? "" : " Charge d'abord les matchs du week-end."}</div>`;
  };
  $("favQ").addEventListener("input", draw); draw();
  // on charge aussi les week-ends précédents pour proposer toutes les équipes
  if (!S.results && !S.resLoading) loadResults().then(() => { if ($("favList")) draw(); });
}

