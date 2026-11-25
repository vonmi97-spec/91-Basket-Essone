"use strict";
window.reload = reload; window.closeSheet = closeSheet;
setTimeout(() => { privacyNotice(); if (store.get("privacyOk", false) || store.get("lastVersion", null)) checkNews(); else store.set("lastVersion", appVersion()); }, 3800);
go("home");
reload();
