"use strict";
/* ================= Scores en direct (flux FFBB lives.json) ================= */
S.liveMap = {}; S.liveStatus = "";  // "" inconnu, "ok", "blocked", "err"
function liveKey(a, b){ return norm(a) + "|" + norm(b); }
async function refreshLiveMap(){
  try{
    const r = await http("GET", API + "json/lives.json", {});
    if (r.status === 403){ S.liveStatus = "blocked"; return; }
    if (r.status < 200 || r.status >= 300){ S.liveStatus = "err"; return; }
    const j = JSON.parse(r.text || "[]"); const arr = Array.isArray(j) ? j : (j.data || []);
    const map = {};
    arr.forEach(l => { if (l.matchId != null) map["id:" + l.matchId] = l; map[liveKey(l.teamName_home, l.teamName_out)] = l; });
    S.liveMap = map; S.liveStatus = "ok";
  }catch(e){ S.liveStatus = "err"; }
}
function liveOf(m){ return S.liveMap["id:" + m.id] || S.liveMap[liveKey(m.t1.nom, m.t2.nom)] || null; }
function liveLabel(l){
  const st = String(l.matchStatus || l.currentStatus || "").toLowerCase();
  if (/fin|final|end|termin/.test(st)) return "Fin du match";
  if (/half|mi-temps/.test(st)) return "Mi-temps";
  const per = l.currentPeriod ? String(l.currentPeriod).replace(/^Q/i, "QT") : "";
  return [per, l.clock].filter(Boolean).join(" · ") || "En direct";
}

