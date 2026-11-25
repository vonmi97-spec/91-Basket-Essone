"use strict";
/* ================= Config ================= */
const API = "https://api.ffbb.app/";
const MEILI = "https://meilisearch-prod.ffbb.app/";
const IDX_R = "ffbbserver_rencontres";
const IDX_O = "ffbbserver_organismes";
const CAT_ORDER = ["U7","U9","U11","U13","U15","U17","U18","U20","U21","SE","SEN","SENIORS","VET","LOISIR"];

/* ================= Stockage ================= */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

/* ================= HTTP (pont natif ou fetch) ================= */
let reqSeq = 0; const pending = {};
window.__nativeCb = function(id, status, text){
  const p = pending[id]; if(!p) return; delete pending[id];
  p({status, text});
};
function http(method, url, headers, body){
  if (window.AndroidBridge && window.AndroidBridge.request && !window.__useWebFetch){
    return new Promise(res => {
      const id = "r" + (++reqSeq); pending[id] = res;
      window.AndroidBridge.request(id, method, url, JSON.stringify(headers||{}), body||"");
    }).then(r => {
      // échec natif (certificat…) : on retente via le moteur du navigateur
      if (r.status === 0) return webFetch(method, url, headers, body).then(w => { if (w.status) window.__useWebFetch = true; return w.status ? w : r; });
      return r;
    });
  }
  return webFetch(method, url, headers, body);
}
function webFetch(method, url, headers, body){
  return fetch(url, {method, headers, body: body||undefined})
    .then(r => r.text().then(t => ({status:r.status, text:t})))
    .catch(e => ({status:0, text:"Erreur réseau : "+e.message}));
}
async function httpJson(method, url, headers, body){
  const r = await http(method, url, headers, body);
  if (r.status < 200 || r.status >= 300) {
    const e = new Error("HTTP " + r.status + " — " + (r.text||"").slice(0,200)); e.status = r.status; throw e;
  }
  return JSON.parse(r.text);
}

/* ================= Jetons FFBB ================= */
async function getTokens(force){
  const c = store.get("tokens", null);
  if (!force && c && c.ms && Date.now() - c.t < 6*3600e3) return c;
  const j = await httpJson("GET", API + "items/configuration", {});
  const d = j && j.data ? j.data : j;
  const t = { ms: d.key_ms, dh: d.key_dh, t: Date.now() };
  if (!t.ms) throw new Error("Jeton de recherche FFBB introuvable");
  store.set("tokens", t); return t;
}
async function multiSearch(queries, retried){
  const tk = await getTokens(retried);
  try{
    const j = await httpJson("POST", MEILI + "multi-search",
      {"Authorization":"Bearer " + tk.ms, "Content-Type":"application/json"},
      JSON.stringify({queries}));
    return j.results || [];
  }catch(e){
    if (!retried && (e.status === 401 || e.status === 403)) return multiSearch(queries, true);
    throw e;
  }
}
const q = s => '"' + String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"') + '"';

/* ================= Week-end ================= */
function weekendRange(offset){
  const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wd = d.getDay(); // 0 dim … 6 sam
  // vendredi de référence : si on est ven/sam/dim → ce week-end, sinon le prochain
  let toFri = 5 - wd; if (wd === 6) toFri = -1; if (wd === 0) toFri = -2;
  const fri = new Date(d); fri.setDate(d.getDate() + toFri + offset*7);
  const end = new Date(fri); end.setDate(fri.getDate() + 2); end.setHours(23,59,59,999);
  return { start: fri, end };
}
function fmtDay(d){ return d.toLocaleDateString("fr-FR",{weekday:"long", day:"numeric", month:"long"}); }
function fmtShort(d){ return d.toLocaleDateString("fr-FR",{day:"numeric", month:"short"}); }

/* ================= Comité organisateur (Essonne) ================= */
async function findComite(range){
  const saved = store.get("comite", null);
  if (saved && (saved.id || saved.nom)) return saved;
  // 1) annuaire des organismes
  try{
    const [r] = await multiSearch([{indexUid: IDX_O, q: "comite essonne", limit: 30}]);
    const hit = (r && r.hits || []).find(h => /comit/i.test(h.nom||"") && /essonne/i.test(h.nom||""));
    if (hit){ const c = {id: String(hit.id), nom: hit.nom}; store.set("comite", c); return c; }
  }catch(e){ /* on tente la méthode suivante */ }
  // 2) organisateurs présents sur la période
  const tf = tsFilter(range);
  const [r2] = await multiSearch([{indexUid: IDX_R, q: "", limit: 0, filter: [tf], facets: ["organisateur.nom"]}]);
  const names = Object.keys((r2 && r2.facetDistribution && r2.facetDistribution["organisateur.nom"]) || {});
  const nm = names.find(n => /essonne/i.test(n)) || names.find(n => /\b91\b/.test(n));
  if (nm){ const c = {nom: nm}; store.set("comite", c); return c; }
  throw new Error("Comité de l'Essonne introuvable dans les données FFBB. Renseigne son nom dans ⚙️ Réglages.");
}
function tsFilter(range){
  // le timestamp peut être en secondes ou millisecondes : on couvre les deux (+/- 3 h de marge)
  const a = Math.floor(range.start.getTime()/1000) - 3*3600, b = Math.floor(range.end.getTime()/1000) + 3*3600;
  const f = "date_rencontre_timestamp";
  return `(${f} >= ${a} AND ${f} <= ${b}) OR (${f} >= ${a*1000} AND ${f} <= ${b*1000})`;
}
function comiteFilter(c){
  const parts = [];
  if (c.id) parts.push(`organisateur.id = ${q(c.id)}`);
  if (c.nom) parts.push(`organisateur.nom = ${q(c.nom)}`);
  return parts.join(" OR ");
}

/* ================= Chargement des matchs ================= */
async function loadMatches(range){
  let comite = await findComite(range);
  let res = await fetchMatches(range, comite);
  if (!res.length && range.end < new Date()){
    // le moteur de recherche FFBB ne garde que ~1 semaine : on interroge la base FFBB pour les week-ends plus anciens
    try{ res = await fetchMatchesDirectus(range, comite); }catch(e){ S.oldErr = e.message || String(e); }
    return res;
  }
  if (!res.length && !comite.manual){
    // la détection via l'annuaire a pu donner un nom/ID différent : on tente via les organisateurs de la période
    const tf = tsFilter(range);
    const [r2] = await multiSearch([{indexUid: IDX_R, q: "", limit: 0, filter: [tf], facets: ["organisateur.nom"]}]);
    const names = Object.keys((r2 && r2.facetDistribution && r2.facetDistribution["organisateur.nom"]) || {});
    const nm = names.find(n => /essonne/i.test(n));
    if (nm && nm !== comite.nom){ comite = {nom: nm}; store.set("comite", comite); res = await fetchMatches(range, comite); }
  }
  return res;
}
const RENC_FIELDS = ["id","date","date_rencontre","horaire","numeroJournee","nomEquipe1","nomEquipe2","resultatEquipe1","resultatEquipe2","joue",
  "competitionId.id","competitionId.nom","competitionId.code","competitionId.sexe","competitionId.categorie.code","competitionId.categorie.libelle","competitionId.categorie.ordre",
  "idPoule.id","idPoule.nom","salle.libelle","salle.adresse","salle.cartographie.ville","salle.cartographie.codePostal","salle.cartographie.latitude","salle.cartographie.longitude",
  "idOrganismeEquipe1.id","idOrganismeEquipe1.nom","idOrganismeEquipe1.code","idOrganismeEquipe1.logo",
  "idOrganismeEquipe2.id","idOrganismeEquipe2.nom","idOrganismeEquipe2.code","idOrganismeEquipe2.logo"];
function isoLocal(d){ const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
async function fetchMatchesDirectus(range, comite){
  if (!comite.id) throw new Error("ID du comité inconnu");
  const filter = JSON.stringify({_and: [
    {competitionId: {organisateur: {_eq: comite.id}}},
    {date_rencontre: {_between: [isoLocal(range.start), isoLocal(range.end)]}}
  ]});
  const j = await directusGet("items/ffbbserver_rencontres", RENC_FIELDS, ["limit=2000", "filter=" + encodeURIComponent(filter)]);
  return ((j && j.data) || []).map(normalize).filter(m => m.date && m.date >= range.start && m.date <= range.end);
}
async function fetchMatches(range, comite){
  const filter = [tsFilter(range), comiteFilter(comite)];
  let all = [], offset = 0, total = Infinity;
  while (offset < total && offset < 3000){
    const [r] = await multiSearch([{indexUid: IDX_R, q: "", limit: 500, offset, filter}]);
    const hits = (r && r.hits) || [];
    all = all.concat(hits);
    total = r && (r.estimatedTotalHits != null ? r.estimatedTotalHits : r.totalHits != null ? r.totalHits : hits.length);
    if (hits.length < 500) break;
    offset += 500;
  }
  return all.map(normalize).filter(m => m.date && m.date >= new Date(range.start.getTime()) && m.date <= range.end);
}

/* ================= Normalisation ================= */
function logoId(x){
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "object") return x.id || null;
  return null;
}
function parseDate(h){
  let s = h.date_rencontre || h.date;
  if (s){
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ","T"));
    if (!isNaN(d)) {
      // si l'heure est 00:00 et "horaire" est fourni (ex. 1530)
      if (d.getHours()===0 && d.getMinutes()===0 && h.horaire && /^\d{3,4}$/.test(String(h.horaire))){
        const hh = String(h.horaire).padStart(4,"0"); d.setHours(+hh.slice(0,2), +hh.slice(2));
      }
      return d;
    }
  }
  let t = h.date_rencontre_timestamp; if (t){ if (t < 1e11) t *= 1000; return new Date(t); }
  return null;
}
function catOf(h){
  const c = (h.competitionId && h.competitionId.categorie) || {};
  let code = (c.code || "").toUpperCase();
  if (!code){
    const m = /(U\d{1,2})/i.exec((h.competitionId && h.competitionId.nom) || "");
    code = m ? m[1].toUpperCase() : ((/senior/i.test((h.competitionId && h.competitionId.nom)||"")) ? "SE" : "Autre");
  }
  return { code, libelle: c.libelle || code, ordre: c.ordre != null ? +c.ordre : null };
}
function sexeOf(h){
  const s = ((h.competitionId && h.competitionId.sexe) || h.sexe || "").toString().toLowerCase();
  if (s.startsWith("f")) return "F"; if (s.startsWith("m")) return "M"; if (s.startsWith("x")||s.includes("mixte")) return "X";
  return "";
}
function team(h, n){
  const org = h["idOrganismeEquipe"+n] || {}; const eng = h["idEngagementEquipe"+n] || {};
  return {
    nom: h["nomEquipe"+n] || eng.nom || org.nom || "?",
    club: org.nom || "", clubId: org.id ? String(org.id) : "", code: org.code || "",
    logo: logoId(org.logo) || logoId(eng.logo),
    score: h["resultatEquipe"+n]
  };
}
function cleanName(x){
  if (!x) return "";
  x = String(x);
  if (x.includes("|")){
    // format FFBB "id|Nom|uuid|DIV|…" : on garde le premier morceau qui ressemble à un nom
    const parts = x.split("|").map(t => t.trim()).filter(Boolean);
    return parts.find(t => /[A-Za-zÀ-ÿ]{3,}/.test(t) && !/^[0-9a-f-]{20,}$/i.test(t)) || parts[0] || "";
  }
  return x;
}
function compName(comp, h){
  return cleanName(comp.nom) || cleanName(comp.nomExtended) || cleanName(h.nomExtended) || "Compétition";
}
function normalize(h){
  const s = h.salle || {}; const com = (s.commune && typeof s.commune === "object") ? s.commune : {};
  const carto = (s.cartographie && typeof s.cartographie === "object") ? s.cartographie : {};
  const cc = carto.coordonnees && carto.coordonnees.coordinates;
  const geo = h._geo || (carto.latitude ? {lat: +carto.latitude, lng: +carto.longitude} : (cc ? {lat: cc[1], lng: cc[0]} : null));
  const cat = catOf(h);
  const comp = h.competitionId || {};
  const t1 = team(h,1), t2 = team(h,2);
  const joue = !!h.joue || (t1.score!=null && t1.score!=="" && t2.score!=null && t2.score!=="" && +t1.score + +t2.score > 0);
  return {
    id: String(h.id || h.uniqueKey || Math.random()),
    date: parseDate(h), cat, sexe: sexeOf(h),
    comp: compName(comp, h),
    compCode: comp.code || "", compId: comp.id ? String(comp.id) : "", pouleId: (h.idPoule && h.idPoule.id) ? String(h.idPoule.id) : "", poule: (h.idPoule && h.idPoule.nom) || "", journee: h.numeroJournee,
    t1, t2, joue,
    salle: { nom: s.libelle || s.libelle2 || "", adresse: [s.adresse, s.adresseComplement].filter(Boolean).join(" "),
             cp: com.codePostal || carto.codePostal || "", ville: com.libelle || carto.ville || "", geo },
    officiels: h.officiels_string || ""
  };
}

/* ================= Logos ================= */
function logoUrl(id, withToken){
  let u = API + "assets/" + encodeURIComponent(id) + "?width=120&height=120&fit=contain&format=png";
  if (withToken){ const t = store.get("tokens", {}); if (t.dh) u += "&access_token=" + encodeURIComponent(t.dh); }
  return u;
}
function initials(n){
  const w = String(n||"?").replace(/[^A-Za-zÀ-ÿ0-9 ]/g," ").split(/\s+/).filter(x => x && x.length>1 && !/^(de|du|des|la|le|les|et|basket|bc|ball)$/i.test(x));
  return (w.slice(0,2).map(x => x[0]).join("") || "?").toUpperCase();
}
function logoHtml(t){
  const ph = `<div class="logo ph">${esc(initials(t.club||t.nom))}</div>`;
  if (!t.logo) return ph;
  return `<img class="logo" loading="lazy" alt="" src="${logoUrl(t.logo)}" data-id="${esc(t.logo)}" data-ini="${esc(initials(t.club||t.nom))}" onerror="logoErr(this)">`;
}
window.logoErr = function(img){
  if (!img.dataset.tok){ img.dataset.tok = "1"; img.src = logoUrl(img.dataset.id, true); return; }
  const d = document.createElement("div"); d.className = "logo ph"; d.textContent = img.dataset.ini || "?"; img.replaceWith(d);
};

