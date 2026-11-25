"use strict";
/* ================= Accueil ================= */
S.homeAll = false;
function isLiveMatch(m, now){
  if (m.joue || !m.date) return false;
  if (m.date.getHours() === 0 && m.date.getMinutes() === 0) return false;
  const t = m.date.getTime();
  return t <= now && now - t < 2.25*3600e3;
}
function homeToggle(){ return ""; }   // ancien bouton « En cours / Tout le week-end » (remplacé par la navigation)
function homeSection(title, more, body){
  return `<section class="hsec"><div class="hhead"><h2>${title}</h2>${more || ""}</div>${body}</section>`;
}
function renderHome(list){
  const now = Date.now();
  const all = S.matches;
  const live = all.filter(m => isLiveMatch(m, now)).sort((a,b) => a.date - b.date);
  const played = all.filter(m => m.joue);
  const upcoming = all.filter(m => m.date && !m.joue && m.date.getTime() > now).sort((a,b) => a.date - b.date);
  const r = weekendRange(0);
  let html = `<div class="hero">
      <div class="hero-top"><span>Ce week-end en Essonne</span><b>${esc(fmtShort(r.start))} → ${esc(fmtShort(r.end))}</b></div>
      <div class="hero-stats">
        <div><b>${all.length}</b><span>matchs</span></div>
        <div class="${live.length ? "live" : ""}"><b>${live.length}</b><span>en cours</span></div>
        <div><b>${played.length}</b><span>terminés</span></div>
        <div><b>${upcoming.length}</b><span>à venir</span></div>
      </div>
    </div>`;
  // En cours
  if (live.length){
    const withScore = live.filter(m => liveOf(m)).length;
    html += homeSection(`<span class="dot"></span>En cours`, "", live.map(matchCard).join("") +
      `<div class="stat">${S.liveStatus === "ok" ? (withScore ? `Score en direct pour ${withScore} match${withScore>1?"s":""} (toutes les 30 s). ` : "") + (withScore < live.length ? "Sans direct FFBB : score publié à la fin du match." : "")
        : S.liveStatus === "blocked" ? "Le direct FFBB refuse la connexion : score à la fin du match." : "Recherche des scores en direct…"}</div>`);
  }
  // Mes équipes
  const favMs = all.filter(isFavMatch).sort((a,b) => a.date - b.date);
  if (S.favs.length){
    html += homeSection("★ Mes équipes", `<button class="more" data-nav="favs">Tout voir</button>`,
      favMs.length ? favMs.slice(0, 4).map(matchCard).join("") : `<div class="hint">Pas de match de tes équipes ce week-end.</div>`);
  } else {
    html += `<button class="cta" data-nav="favs"><span>★</span><div><b>Suis tes équipes</b><small>Ajoute des favoris pour les retrouver ici et recevoir leurs scores.</small></div><i>›</i></button>`;
  }
  // Prochains coups d'envoi
  if (upcoming.length){
    const first = upcoming[0].date.getTime();
    const batch = upcoming.filter(m => m.date.getTime() === first);
    const when = `${fmtDay(upcoming[0].date)} · ${upcoming[0].date.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`;
    html += homeSection("Prochains coups d'envoi", `<button class="more" data-goto="matchs:list">Tous les matchs</button>`,
      `<div class="hwhen">${esc(when)}</div>` + batch.slice(0, 4).map(matchCard).join("") +
      (batch.length > 4 ? `<button class="morebtn" data-goto="matchs:list">+ ${batch.length - 4} autres matchs à la même heure</button>` : ""));
  }
  // Derniers résultats
  if (played.length){
    const last = played.slice().sort((a,b) => b.date - a.date).slice(0, 4);
    html += homeSection("Derniers résultats", `<button class="more" data-goto="comp:res">Tous les résultats</button>`, last.map(matchCard).join(""));
  }
  if (!all.length) html += `<div class="empty">Aucun match départemental trouvé ce week-end<br>(vacances scolaires ou trêve ?).</div>`;
  html += ffbbEssonneBanner();
  html += `<div class="stat center">Actualisation automatique chaque minute · glisse vers le bas pour rafraîchir</div>`;
  $("main").innerHTML = html;
}
// Direct FFBB toutes les 30 s quand des matchs sont en cours
setInterval(async () => {
  const now = Date.now();
  if (S.matches.some(m => isLiveMatch(m, now))){ await refreshLiveMap(); if (S.view === "home" || S.tab === "matchs" || S.tab === "favs") renderMain(); }
}, 30000);
setTimeout(async () => { if (S.matches.some(m => isLiveMatch(m, Date.now()))){ await refreshLiveMap(); if (S.view === "home") renderMain(); } }, 2500);
// Accueil : matchs du week-end rechargés chaque minute
setInterval(() => {
  if (S.view !== "home" || S.offset !== 0 || S.loading) return;
  loadMatches(weekendRange(0)).then(ms => { cache["w0"] = ms; S.matches = ms; saveSnapshot(ms); if (S.view === "home") renderMain(); }).catch(() => {});
}, 60000);
