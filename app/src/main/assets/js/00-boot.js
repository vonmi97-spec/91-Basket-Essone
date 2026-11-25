/* Écran d'ouverture + thème (chargé en premier) */
(function(){ const sp = document.getElementById("splash"); if (!sp) return;
  const hide = () => sp.classList.add("gone");
  sp.addEventListener("click", hide); sp.addEventListener("animationend", e => { if (e.animationName === "spOut") hide(); });
  setTimeout(hide, 3600); })();
/* ===== Thème : auto / clair / sombre ===== */
(function(){
  function sysDark(){
    try{ if (window.AndroidBridge && AndroidBridge.isSystemDark) return AndroidBridge.isSystemDark(); }catch(e){}
    return !window.matchMedia || window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function pref(){ try{ return JSON.parse(localStorage.getItem("theme")) || "auto"; }catch(e){ return "auto"; } }
  window.applyTheme = function(){
    const p = pref(), dark = p === "dark" || (p === "auto" && sysDark());
    document.documentElement.classList.toggle("light", !dark);
    try{ if (window.AndroidBridge && AndroidBridge.setLightBars) AndroidBridge.setLightBars(!dark); }catch(e){}
  };
  window.setThemePref = function(p){ try{ localStorage.setItem("theme", JSON.stringify(p)); }catch(e){} applyTheme(); };
  window.onSystemTheme = function(){ applyTheme(); };
  if (window.matchMedia) try{ window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); }catch(e){}
  applyTheme();
})();
