"use strict";
/* ================= Liens vers le site FFBB ================= */
const FFBB_SITE = "https://competitions.ffbb.com";
const FFBB_COMITE = FFBB_SITE + "/ligues/idf/comites/0091";
function ffbbCompUrl(code){ return code ? FFBB_COMITE + "/competitions/" + encodeURIComponent(String(code).toLowerCase()) : FFBB_COMITE; }
function ffbbClubUrl(code){
  const m = /^([A-Za-z]{3})(\d{4})/.exec(code || "");
  return m ? `${FFBB_SITE}/ligues/${m[1].toLowerCase()}/comites/${m[2]}/clubs/${encodeURIComponent(code.toLowerCase())}` : "";
}
function ffbbBtn(url, label, cls){ return `<button class="btn ${cls || "sec"}" data-url="${esc(url)}">${label}</button>`; }

function ffbbEssonneBanner(){
  return `<button class="ffbblink" data-url="${esc(FFBB_COMITE)}">🌐<span>Résultats de l'Essonne sur FFBB<small>Site officiel competitions.ffbb.com · comité 91</small></span><i>↗</i></button>`;
}
