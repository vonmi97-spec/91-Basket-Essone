"use strict";
/* ================= Saison depuis le 1er septembre 2026 ================= */
const SEASON_START = new Date(2026, 8, 1);   // 1er septembre 2026
S.season = null; S.seasonErr = null; let seasonPromise = null;
function loadSeason(force){
  if (force){ S.season = null; seasonPromise = null; }
  if (seasonPromise) return seasonPromise;
  seasonPromise = (async () => {
    // copie de moins de 6 h : utilisée directement (la saison change peu)
    if (!force){
      try{
        const c = JSON.parse(localStorage.getItem("snap_season") || "null");
        if (c && Date.now() - c.t < 6 * 3600e3 && c.ms && c.ms.length){
          S.season = reviveMatches(c.ms); S.seasonErr = null; S.rateCache = {};
          if (["sty", "matchs", "favs", "cls"].includes(S.tab)) renderMain();
          return S.season;
        }
      }catch(e){}
    }
    try{
      const comite = store.get("comite", null) || {};
      if (!comite.id) throw new Error("comité non détecté");
      const filter = JSON.stringify({_and: [
        {competitionId: {organisateur: {_eq: comite.id}}},
        {date_rencontre: {_gte: isoLocal(SEASON_START)}},
        {joue: {_eq: true}}
      ]});
      let out = [], page = 1;
      while (page <= 12){
        const j = await directusGet("items/ffbbserver_rencontres", RENC_FIELDS, ["limit=1000", "page=" + page, "sort[]=date_rencontre", "filter=" + encodeURIComponent(filter)]);
        const d = (j && j.data) || [];
        out = out.concat(d);
        if (d.length < 1000) break;
        page++;
      }
      S.season = out.map(normalize).filter(m => m.date && m.date >= SEASON_START);
      S.seasonErr = null;
      try{ localStorage.setItem("snap_season", JSON.stringify({t: Date.now(), ms: S.season})); }catch(e){}
    }catch(e){
      S.season = []; S.seasonErr = e.status === 403 ? "base FFBB inaccessible (HTTP 403)" : (e.message || String(e));
    }
    S.rateCache = {};
    if (["sty", "matchs", "favs", "cls"].includes(S.tab)) renderMain();
    return S.season;
  })();
  return seasonPromise;
}
function categoryAverage(m){
  if (!S.season || !S.season.length || !m) return null;
  let pts = 0, n = 0;
  S.season.forEach(x => {
    if (x.cat.code !== m.cat.code || x.sexe !== m.sexe) return;
    const a = parseInt(x.t1.score, 10), b = parseInt(x.t2.score, 10);
    if (!isNaN(a) && !isNaN(b)){ pts += a + b; n += 2; }
  });
  return n >= 10 ? pts / n : null;
}

